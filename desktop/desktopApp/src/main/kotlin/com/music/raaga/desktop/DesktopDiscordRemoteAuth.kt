package com.music.raaga.desktop

import com.my.kizzy.rpc.UserInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.net.http.WebSocket
import java.nio.ByteBuffer
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.spec.MGF1ParameterSpec
import java.time.Duration
import java.util.Base64
import java.util.concurrent.CompletionStage
import javax.crypto.Cipher
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource

/**
 * State of Discord's Remote Authentication (QR code login) flow.
 */
internal sealed interface DiscordRemoteAuthState {
    data object Idle : DiscordRemoteAuthState
    data object Connecting : DiscordRemoteAuthState
    data class Ready(val qrUrl: String, val fingerprint: String) : DiscordRemoteAuthState
    data class Scanned(val username: String, val avatarUrl: String?) : DiscordRemoteAuthState
    data class Exchanging(val username: String) : DiscordRemoteAuthState
    data class Success(val user: UserInfo) : DiscordRemoteAuthState
    data class Error(val message: String) : DiscordRemoteAuthState
}

/**
 * Client for Discord's official Remote Authentication Gateway protocol.
 *
 * Connects to `wss://remote-auth-gateway.discord.gg/?v=2`, performs an ephemeral
 * RSA 2048-bit key exchange and cryptographic nonce proof, and yields a scannable
 * QR code URL (`https://discord.com/ra/<fingerprint>`).
 *
 * When scanned by the Discord mobile app and approved by the user, exchanges the
 * authorization ticket for the user token and signs in without manual token copying.
 */
internal class DesktopDiscordRemoteAuth {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var connectionJob: Job? = null
    private var heartbeatJob: Job? = null
    private var activeSocket: WebSocket? = null

    private val _state = MutableStateFlow<DiscordRemoteAuthState>(DiscordRemoteAuthState.Idle)
    val state: StateFlow<DiscordRemoteAuthState> = _state.asStateFlow()

    private val json = Json { ignoreUnknownKeys = true }

    fun start() {
        cancel()
        _state.value = DiscordRemoteAuthState.Connecting

        connectionJob = scope.launch {
            runCatching {
                connectAndAuthenticate()
            }.onFailure { e ->
                if (isActive) {
                    _state.value = DiscordRemoteAuthState.Error(e.message ?: "Connection failed")
                }
            }
        }
    }

    fun cancel() {
        connectionJob?.cancel()
        connectionJob = null
        heartbeatJob?.cancel()
        heartbeatJob = null
        runCatching { activeSocket?.sendClose(WebSocket.NORMAL_CLOSURE, "Closed") }
        activeSocket = null
        if (_state.value !is DiscordRemoteAuthState.Success) {
            _state.value = DiscordRemoteAuthState.Idle
        }
    }

    private suspend fun connectAndAuthenticate() {
        val keyPair = generateRsaKeyPair()
        val encodedPublicKey = Base64.getEncoder().encodeToString(keyPair.public.encoded)

        val httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(12))
            .build()

        val textBuffer = StringBuilder()

        val socketListener = object : WebSocket.Listener {
            override fun onOpen(webSocket: WebSocket) {
                activeSocket = webSocket
                webSocket.request(1)
            }

            override fun onText(webSocket: WebSocket, data: CharSequence, last: Boolean): CompletionStage<*>? {
                textBuffer.append(data)
                if (last) {
                    val message = textBuffer.toString()
                    textBuffer.setLength(0)
                    handleGatewayMessage(message, webSocket, keyPair, encodedPublicKey, httpClient)
                }
                webSocket.request(1)
                return null
            }

            override fun onError(webSocket: WebSocket, error: Throwable) {
                if (scope.isActive && _state.value !is DiscordRemoteAuthState.Success) {
                    _state.value = DiscordRemoteAuthState.Error("WebSocket error: ${error.message ?: "Disconnected"}")
                }
            }

            override fun onClose(webSocket: WebSocket, statusCode: Int, reason: String): CompletionStage<*>? {
                if (scope.isActive && _state.value !is DiscordRemoteAuthState.Success && _state.value !is DiscordRemoteAuthState.Error) {
                    if (statusCode == 4003) {
                        _state.value = DiscordRemoteAuthState.Error("QR code expired. Click retry to generate a new one.")
                    }
                }
                return null
            }
        }

        httpClient.newWebSocketBuilder()
            .header("Origin", "https://discord.com")
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .buildAsync(URI.create("wss://remote-auth-gateway.discord.gg/?v=2"), socketListener)
            .join()
    }

    private fun handleGatewayMessage(
        raw: String,
        webSocket: WebSocket,
        keyPair: KeyPair,
        encodedPublicKey: String,
        httpClient: HttpClient,
    ) {
        val payload = runCatching { json.decodeFromString<JsonObject>(raw) }.getOrNull() ?: return
        val op = payload["op"]?.jsonPrimitive?.content ?: return

        when (op) {
            "hello" -> {
                val heartbeatInterval = payload["heartbeat_interval"]?.jsonPrimitive?.intOrNull ?: 41250
                startHeartbeat(webSocket, heartbeatInterval.toLong())

                // Send init payload with our ephemeral public key
                val initMessage = """{"op":"init","encoded_public_key":"$encodedPublicKey"}"""
                webSocket.sendText(initMessage, true)
            }

            "nonce_proof" -> {
                val encryptedNonce = payload["encrypted_nonce"]?.jsonPrimitive?.content ?: return
                val encBytes = Base64.getDecoder().decode(encryptedNonce)
                val decryptedNonce = decryptOaep(keyPair.private, encBytes)
                val proofDigest = MessageDigest.getInstance("SHA-256").digest(decryptedNonce)
                val proof = Base64.getUrlEncoder().withoutPadding().encodeToString(proofDigest)

                val proofMessage = """{"op":"nonce_proof","proof":"$proof"}"""
                webSocket.sendText(proofMessage, true)
            }

            "pending_remote_init" -> {
                val fingerprint = payload["fingerprint"]?.jsonPrimitive?.content ?: return
                val qrUrl = "https://discord.com/ra/$fingerprint"
                _state.value = DiscordRemoteAuthState.Ready(qrUrl = qrUrl, fingerprint = fingerprint)
            }

            "pending_ticket" -> {
                val userObj = payload["user"]?.jsonObject
                val username = userObj?.get("username")?.jsonPrimitive?.content ?: "Discord User"
                val userId = userObj?.get("id")?.jsonPrimitive?.content
                val avatarHash = userObj?.get("avatar")?.jsonPrimitive?.content
                val avatarUrl = if (userId != null && avatarHash != null) {
                    "https://cdn.discordapp.com/avatars/$userId/$avatarHash.png?size=128"
                } else null

                _state.value = DiscordRemoteAuthState.Scanned(username = username, avatarUrl = avatarUrl)
            }

            "pending_login" -> {
                val ticket = payload["ticket"]?.jsonPrimitive?.content ?: return
                val current = _state.value
                val username = if (current is DiscordRemoteAuthState.Scanned) current.username else "Discord User"
                _state.value = DiscordRemoteAuthState.Exchanging(username)

                scope.launch {
                    exchangeTicketAndSignIn(ticket, keyPair, httpClient, username)
                }
            }

            "cancel" -> {
                _state.value = DiscordRemoteAuthState.Error("Login was cancelled from your phone.")
            }
        }
    }

    private suspend fun exchangeTicketAndSignIn(
        ticket: String,
        keyPair: KeyPair,
        httpClient: HttpClient,
        username: String,
    ) {
        runCatching {
            val request = HttpRequest.newBuilder()
                .uri(URI.create("https://discord.com/api/v9/users/@me/remote-auth/login"))
                .header("Content-Type", "application/json")
                .header("Origin", "https://discord.com")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .POST(HttpRequest.BodyPublishers.ofString("""{"ticket":"$ticket"}"""))
                .timeout(Duration.ofSeconds(15))
                .build()

            val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() !in 200..299) {
                error("Discord refused the login ticket (HTTP ${response.statusCode()})")
            }

            val bodyJson = json.decodeFromString<JsonObject>(response.body())
            val encryptedToken = bodyJson["encrypted_token"]?.jsonPrimitive?.content
                ?: error("No encrypted token returned by Discord")

            val encBytes = Base64.getDecoder().decode(encryptedToken)
            val decryptedBytes = decryptOaep(keyPair.private, encBytes)
            val token = String(decryptedBytes, Charsets.UTF_8).trim()

            DesktopDiscordRpc.signIn(token).getOrThrow()
        }.onSuccess { userInfo ->
            _state.value = DiscordRemoteAuthState.Success(userInfo)
            cancel()
        }.onFailure { err ->
            _state.value = DiscordRemoteAuthState.Error("Sign in failed: ${err.message ?: "Unknown error"}")
        }
    }

    private fun startHeartbeat(webSocket: WebSocket, intervalMs: Long) {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive) {
                delay(intervalMs)
                runCatching {
                    webSocket.sendText("""{"op":"heartbeat"}""", true)
                }
            }
        }
    }

    private fun generateRsaKeyPair(): KeyPair {
        val generator = KeyPairGenerator.getInstance("RSA")
        generator.initialize(2048)
        return generator.generateKeyPair()
    }

    private fun decryptOaep(privateKey: PrivateKey, encryptedBytes: ByteArray): ByteArray {
        // Try SHA-256 with MGF1 SHA-256 first
        return runCatching {
            val oaepSpec = OAEPParameterSpec(
                "SHA-256",
                "MGF1",
                MGF1ParameterSpec.SHA256,
                PSource.PSpecified.DEFAULT,
            )
            val cipher = Cipher.getInstance("RSA/ECB/OAEPPadding")
            cipher.init(Cipher.DECRYPT_MODE, privateKey, oaepSpec)
            cipher.doFinal(encryptedBytes)
        }.getOrElse {
            // Fallback for SunJCE default MGF1 SHA-1
            val cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding")
            cipher.init(Cipher.DECRYPT_MODE, privateKey)
            cipher.doFinal(encryptedBytes)
        }
    }
}
