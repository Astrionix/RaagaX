package com.music.aether.connect

import android.os.Build
import android.util.Log
import com.music.aether.data.TrackLog
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.websocket.DefaultClientWebSocketSession
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import kotlinx.coroutines.CancellationException
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
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * RaagaSyncClient — Real-Time WebSocket bridge connecting Aether with the RaagaX
 * coordinator (raaga-sync-server) on Render.
 *
 * Supports:
 * 1. Both user-deployed and fallback sync servers:
 *    - Primary:  wss://raaga-sync-server-x2xy.onrender.com
 *    - Fallback: wss://raaga-sync-server.onrender.com
 * 2. Connect to Device: Discovers PC / Mac / Web (raaga.me) and sends/receives
 *    Spotify Connect-style playback handover and remote control commands.
 * 3. 20s Keep-Alive heartbeat to keep Render's free tier awake.
 */
object RaagaSyncClient {

    private const val TAG = "RaagaSyncClient"

    val SERVERS = listOf(
        "wss://raaga-sync-server-x2xy.onrender.com",
        "wss://raaga-sync-server.onrender.com",
    )

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var connectionJob: Job? = null
    private var pingJob: Job? = null
    private var webSocketSession: DefaultClientWebSocketSession? = null

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _activeServerUrl = MutableStateFlow(SERVERS.first())
    val activeServerUrl: StateFlow<String> = _activeServerUrl.asStateFlow()

    val myDeviceId = "dev_aether_" + UUID.randomUUID().toString().replace("-", "").take(8)
    val myDeviceName = "Aether Phone (${Build.MODEL.ifBlank { "Android" }})"

    // Callbacks invoked when PC (raaga.me) sends remote control commands to this phone
    var onRemotePlay: (() -> Unit)? = null
    var onRemotePause: (() -> Unit)? = null
    var onRemoteSeek: ((Long) -> Unit)? = null
    var onRemoteVolume: ((Float) -> Unit)? = null
    var onRemoteTransfer: ((trackId: String?, title: String?, artist: String?, positionMs: Long) -> Unit)? = null

    private val client by lazy {
        HttpClient(OkHttp) {
            engine {
                config {
                    readTimeout(0, TimeUnit.MILLISECONDS)
                    connectTimeout(12, TimeUnit.SECONDS)
                    pingInterval(20, TimeUnit.SECONDS)
                    retryOnConnectionFailure(true)
                }
            }
            install(HttpTimeout)
            install(WebSockets)
            expectSuccess = false
        }
    }

    fun start() {
        if (connectionJob?.isActive == true) return
        connectionJob = scope.launch {
            var serverIndex = 0
            while (isActive) {
                val currentUrl = SERVERS[serverIndex % SERVERS.size]
                _activeServerUrl.value = currentUrl
                TrackLog.d(TAG, "Connecting to Raaga Sync Coordinator at $currentUrl...")

                try {
                    client.webSocket(urlString = currentUrl) {
                        webSocketSession = this
                        _isConnected.value = true
                        TrackLog.d(TAG, "✓ Connected to Raaga Sync Server ($currentUrl)")

                        // Register this device with the coordinator
                        registerDevice()

                        // Start Render keep-alive ping loop
                        startPingLoop(this)

                        // Listen for incoming frames from PC / peers
                        for (frame in incoming) {
                            if (frame is Frame.Text) {
                                handleIncomingMessage(frame.readText())
                            }
                        }
                    }
                } catch (e: Exception) {
                    if (e is CancellationException) throw e
                    TrackLog.w(TAG, "Connection lost to $currentUrl: ${e.message}. Trying next coordinator in 4s...")
                } finally {
                    webSocketSession = null
                    _isConnected.value = false
                    pingJob?.cancel()
                }

                serverIndex++
                delay(4000)
            }
        }
    }

    fun stop() {
        connectionJob?.cancel()
        connectionJob = null
        pingJob?.cancel()
        pingJob = null
        scope.launch {
            webSocketSession?.close()
            webSocketSession = null
            _isConnected.value = false
        }
    }

    private suspend fun registerDevice() {
        val registerPayload = buildJsonObject {
            put("type", "REGISTER_DEVICE")
            putJsonObject("device") {
                put("deviceId", myDeviceId)
                put("name", myDeviceName)
                put("deviceType", "MOBILE")
                put("isOnline", true)
                put("subnet", "local")
            }
        }.toString()
        sendFrame(registerPayload)
    }

    private fun startPingLoop(session: DefaultClientWebSocketSession) {
        pingJob?.cancel()
        pingJob = scope.launch {
            while (isActive) {
                delay(20_000) // 20s interval keeps Render free-tier alive
                try {
                    val ping = buildJsonObject {
                        put("type", "PING")
                        put("timestamp", System.currentTimeMillis())
                    }.toString()
                    session.send(Frame.Text(ping))
                } catch (e: Exception) {
                    break
                }
            }
        }
    }

    private fun handleIncomingMessage(rawText: String) {
        try {
            val root = json.parseToJsonElement(rawText).jsonObject
            val type = root["type"]?.jsonPrimitive?.contentOrNull ?: return

            when (type) {
                "DEVICE_LIST_UPDATED" -> {
                    val devicesArray = root["devices"]?.jsonArray ?: JsonArray(emptyList())
                    val discovered = devicesArray.mapNotNull { item ->
                        val obj = item.jsonObject
                        val devId = obj["deviceId"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                        if (devId == myDeviceId) return@mapNotNull null // Filter out self

                        val name = obj["name"]?.jsonPrimitive?.contentOrNull ?: "Remote Device"
                        val devTypeStr = obj["deviceType"]?.jsonPrimitive?.contentOrNull?.uppercase() ?: "COMPUTER"

                        val devType = when (devTypeStr) {
                            "DESKTOP", "COMPUTER" -> DeviceType.COMPUTER
                            "TV" -> DeviceType.TV
                            "SPEAKER" -> DeviceType.SPEAKER
                            "TABLET" -> DeviceType.TABLET
                            else -> DeviceType.COMPUTER
                        }

                        ConnectDevice(
                            id = devId,
                            name = name,
                            type = devType,
                            transport = TransportKind.CLOUD_RELAY,
                            latencyMs = 9,
                            volume = 0.85f,
                            canReceiveAudio = true,
                            canControl = true,
                        )
                    }

                    // Update ConnectDeviceManager's active network devices
                    ConnectDeviceManager.updateDiscoveredDevices(discovered)
                    TrackLog.d(TAG, "Updated device list: ${discovered.size} remote devices found")
                }

                "CONNECT_COMMAND" -> {
                    val payload = root["payload"]?.jsonObject ?: root
                    val cmdType = payload["type"]?.jsonPrimitive?.contentOrNull?.uppercase()

                    when (cmdType) {
                        "TRANSFER" -> {
                            val track = payload["track"]?.jsonObject
                            val trackId = track?.get("id")?.jsonPrimitive?.contentOrNull
                                ?: track?.get("videoId")?.jsonPrimitive?.contentOrNull
                            val title = track?.get("title")?.jsonPrimitive?.contentOrNull
                            val artist = track?.get("artist")?.jsonPrimitive?.contentOrNull
                            val pos = payload["positionMs"]?.jsonPrimitive?.longOrNull ?: 0L

                            onRemoteTransfer?.invoke(trackId, title, artist, pos)
                        }
                        "PLAY" -> onRemotePlay?.invoke()
                        "PAUSE" -> onRemotePause?.invoke()
                        "SEEK" -> {
                            val pos = payload["positionMs"]?.jsonPrimitive?.longOrNull ?: 0L
                            onRemoteSeek?.invoke(pos)
                        }
                        "VOLUME" -> {
                            val vol = payload["volume"]?.jsonPrimitive?.contentOrNull?.toFloatOrNull() ?: 1.0f
                            onRemoteVolume?.invoke(vol)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            TrackLog.w(TAG, "Error parsing incoming sync frame: ${e.message}")
        }
    }

    /**
     * Send Spotify Connect handover to remote target (e.g. raaga.me on PC).
     */
    fun sendTransferToPeer(
        targetDeviceId: String,
        trackId: String?,
        title: String?,
        artist: String?,
        coverUrl: String?,
        positionMs: Long,
        isPlaying: Boolean,
    ) {
        start()
        val payload = buildJsonObject {
            put("type", "CONNECT_COMMAND")
            put("targetDeviceId", targetDeviceId)
            putJsonObject("command") {
                put("type", "TRANSFER")
                putJsonObject("track") {
                    put("id", trackId ?: "")
                    put("title", title ?: "")
                    put("artist", artist ?: "")
                    put("coverUrl", coverUrl ?: "")
                }
                put("positionMs", positionMs)
                put("isPlaying", isPlaying)
            }
        }.toString()
        sendFrame(payload)
    }

    /**
     * Send remote playback command (Play, Pause, Seek, Volume) to target device.
     */
    fun sendRemoteCommand(targetDeviceId: String, command: RemoteCommand) {
        start()
        val payload = buildJsonObject {
            put("type", "CONNECT_COMMAND")
            put("targetDeviceId", targetDeviceId)
            putJsonObject("command") {
                when (command) {
                    is RemoteCommand.Play -> put("type", "PLAY")
                    is RemoteCommand.Pause -> put("type", "PAUSE")
                    is RemoteCommand.Seek -> {
                        put("type", "SEEK")
                        put("positionMs", command.positionMs)
                    }
                    is RemoteCommand.Volume -> {
                        put("type", "VOLUME")
                        put("volume", command.volume.toDouble())
                    }
                    else -> Unit
                }
            }
        }.toString()
        sendFrame(payload)
    }

    private fun sendFrame(text: String) {
        scope.launch {
            try {
                webSocketSession?.send(Frame.Text(text))
            } catch (e: Exception) {
                TrackLog.w(TAG, "Failed to send frame: ${e.message}")
            }
        }
    }
}
