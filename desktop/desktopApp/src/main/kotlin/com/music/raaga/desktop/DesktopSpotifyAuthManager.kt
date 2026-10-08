package com.music.raaga.desktop

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpHandler
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Duration
import java.util.Base64
import java.util.UUID

sealed interface DesktopSpotifyAuthState {
    data object LoggedOut : DesktopSpotifyAuthState
    data object LoggingIn : DesktopSpotifyAuthState
    data class LoggedIn(
        val userId: String,
        val displayName: String,
        val avatarUrl: String?,
        val product: String?,
        val isOAuth: Boolean,
    ) : DesktopSpotifyAuthState
    data class Error(val message: String) : DesktopSpotifyAuthState
}

object DesktopSpotifyAuthManager {
    // Official Spotify Client ID with PKCE loopback redirect allowed
    const val DEFAULT_CLIENT_ID = "086ea0f4ce004066927d62f4ba1efc28"
    const val SCOPES = "user-library-read playlist-read-private playlist-read-collaborative user-read-private user-read-email"

    private const val KEY_ACCESS_TOKEN = "spotify_access_token"
    private const val KEY_REFRESH_TOKEN = "spotify_refresh_token"
    private const val KEY_EXPIRES_AT = "spotify_expires_at"
    private const val KEY_CLIENT_ID = "spotify_client_id"
    private const val KEY_USER_ID = "spotify_user_id"
    private const val KEY_USER_NAME = "spotify_user_name"
    private const val KEY_USER_AVATAR = "spotify_user_avatar"
    private const val KEY_USER_PRODUCT = "spotify_user_product"

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val http: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .followRedirects(HttpClient.Redirect.NORMAL)
        .build()

    private val _authState = MutableStateFlow<DesktopSpotifyAuthState>(DesktopSpotifyAuthState.LoggedOut)
    val authState: StateFlow<DesktopSpotifyAuthState> = _authState.asStateFlow()

    @Volatile private var activeServer: HttpServer? = null

    init {
        restoreAuthState()
    }

    fun getStoredClientId(): String {
        return DesktopPersistence().string(KEY_CLIENT_ID, DEFAULT_CLIENT_ID).ifBlank { DEFAULT_CLIENT_ID }
    }

    fun setCustomClientId(clientId: String) {
        val clean = clientId.trim()
        DesktopPersistence().saveString(KEY_CLIENT_ID, clean)
    }

    fun restoreAuthState() {
        val p = DesktopPersistence()
        val token = p.string(KEY_ACCESS_TOKEN, "")
        val userId = p.string(KEY_USER_ID, "")
        val userName = p.string(KEY_USER_NAME, "")
        val userAvatar = p.string(KEY_USER_AVATAR, "").takeIf { it.isNotBlank() }
        val userProduct = p.string(KEY_USER_PRODUCT, "").takeIf { it.isNotBlank() }

        if (token.isNotBlank() && userId.isNotBlank()) {
            _authState.value = DesktopSpotifyAuthState.LoggedIn(
                userId = userId,
                displayName = userName.ifBlank { userId },
                avatarUrl = userAvatar,
                product = userProduct,
                isOAuth = true,
            )
            // Refresh in background if needed
            scope.launch {
                refreshProfileIfPossible()
            }
        } else if (DesktopSpotifyToken.cookie().isNotBlank()) {
            // Check if active Web Session (sp_dc) exists
            scope.launch {
                verifyWebSession()
            }
        } else {
            _authState.value = DesktopSpotifyAuthState.LoggedOut
        }
    }

    /**
     * Starts OAuth PKCE flow by running a local loopback HTTP server and opening the browser.
     */
    fun startOAuthLogin(customClientId: String? = null) {
        scope.launch {
            try {
                _authState.value = DesktopSpotifyAuthState.LoggingIn

                // Stop any previous server
                activeServer?.stop(0)

                val clientId = customClientId?.trim()?.takeIf { it.isNotBlank() }
                    ?: getStoredClientId()
                DesktopPersistence().saveString(KEY_CLIENT_ID, clientId)

                // Try ports 8888 through 8895
                var port = 8888
                var server: HttpServer? = null
                while (port <= 8895) {
                    try {
                        server = HttpServer.create(InetSocketAddress("127.0.0.1", port), 0)
                        break
                    } catch (e: Exception) {
                        port++
                    }
                }

                if (server == null) {
                    _authState.value = DesktopSpotifyAuthState.Error("Could not start local authorization listener on port 8888-8895")
                    return@launch
                }

                activeServer = server
                val redirectUri = "http://127.0.0.1:$port/callback"
                val codeVerifier = generateCodeVerifier()
                val codeChallenge = generateCodeChallenge(codeVerifier)
                val oauthState = UUID.randomUUID().toString()

                server.createContext("/callback", object : HttpHandler {
                    override fun handle(exchange: HttpExchange) {
                        val query = exchange.requestURI.query.orEmpty()
                        val params = query.split("&").associate {
                            val parts = it.split("=", limit = 2)
                            val k = parts.getOrNull(0).orEmpty()
                            val v = parts.getOrNull(1).orEmpty()
                            k to java.net.URLDecoder.decode(v, StandardCharsets.UTF_8)
                        }

                        val code = params["code"]
                        val returnedState = params["state"]
                        val error = params["error"]

                        val htmlResponse = if (code != null && returnedState == oauthState) {
                            """
                            <!DOCTYPE html>
                            <html>
                            <head>
                              <meta charset="utf-8">
                              <title>Spotify Connected - Raaga</title>
                              <style>
                                body { background: #121212; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                                .card { background: #181818; border: 1px solid #282828; border-radius: 16px; padding: 40px; text-align: center; max-width: 440px; box-shadow: 0 16px 32px rgba(0,0,0,0.5); }
                                h1 { color: #1DB954; font-size: 24px; margin-bottom: 12px; }
                                p { color: #b3b3b3; font-size: 14px; line-height: 1.6; }
                              </style>
                            </head>
                            <body>
                              <div class="card">
                                <h1>✓ Spotify Connected!</h1>
                                <p>Your Spotify account has been successfully linked with Raaga.<br><br>You can close this tab and return to Raaga desktop app.</p>
                              </div>
                            </body>
                            </html>
                            """.trimIndent()
                        } else {
                            """
                            <!DOCTYPE html>
                            <html>
                            <head>
                              <meta charset="utf-8">
                              <title>Spotify Connection Failed - Raaga</title>
                              <style>
                                body { background: #121212; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                                .card { background: #181818; border: 1px solid #282828; border-radius: 16px; padding: 40px; text-align: center; max-width: 440px; }
                                h1 { color: #e91429; font-size: 24px; margin-bottom: 12px; }
                                p { color: #b3b3b3; font-size: 14px; line-height: 1.6; }
                              </style>
                            </head>
                            <body>
                              <div class="card">
                                <h1>Connection Failed</h1>
                                <p>${error ?: "Authorization was not completed"}.<br><br>You can close this tab and try again.</p>
                              </div>
                            </body>
                            </html>
                            """.trimIndent()
                        }

                        val bytes = htmlResponse.toByteArray(StandardCharsets.UTF_8)
                        exchange.responseHeaders.set("Content-Type", "text/html; charset=utf-8")
                        exchange.sendResponseHeaders(200, bytes.size.toLong())
                        exchange.responseBody.use { os: OutputStream ->
                            os.write(bytes)
                        }

                        // Stop server shortly after response
                        scope.launch {
                            kotlinx.coroutines.delay(1000)
                            server.stop(0)
                        }

                        if (code != null && returnedState == oauthState) {
                            scope.launch {
                                exchangeCodeForToken(code, codeVerifier, redirectUri, clientId)
                            }
                        } else {
                            _authState.value = DesktopSpotifyAuthState.Error(error ?: "Authorization cancelled")
                        }
                    }
                })

                server.start()

                val authUrl = "https://accounts.spotify.com/authorize?" + listOf(
                    "client_id" to clientId,
                    "response_type" to "code",
                    "redirect_uri" to redirectUri,
                    "scope" to SCOPES,
                    "code_challenge" to codeChallenge,
                    "code_challenge_method" to "S256",
                    "state" to oauthState,
                ).joinToString("&") { (k, v) -> "$k=${URLEncoder.encode(v, StandardCharsets.UTF_8)}" }

                DesktopExternalLinks.open(authUrl)
            } catch (e: Exception) {
                DesktopTrackLog.log("DesktopSpotifyAuthManager: startOAuthLogin error: ${e.message}")
                _authState.value = DesktopSpotifyAuthState.Error(e.message ?: "Failed to start Spotify login")
            }
        }
    }

    private suspend fun exchangeCodeForToken(
        code: String,
        codeVerifier: String,
        redirectUri: String,
        clientId: String,
    ) = withContext(Dispatchers.IO) {
        try {
            val params = listOf(
                "grant_type" to "authorization_code",
                "code" to code,
                "redirect_uri" to redirectUri,
                "client_id" to clientId,
                "code_verifier" to codeVerifier,
            ).joinToString("&") { (k, v) -> "$k=${URLEncoder.encode(v, StandardCharsets.UTF_8)}" }

            val req = HttpRequest.newBuilder(URI.create("https://accounts.spotify.com/api/token"))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(params))
                .build()

            val resp = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
            val body = resp.body()

            if (resp.statusCode() !in 200..299) {
                _authState.value = DesktopSpotifyAuthState.Error("Token exchange failed (HTTP ${resp.statusCode()}): $body")
                return@withContext
            }

            val obj = json.parseToJsonElement(body).jsonObject
            val accessToken = obj["access_token"]?.jsonPrimitive?.content ?: ""
            val refreshToken = obj["refresh_token"]?.jsonPrimitive?.content ?: ""
            val expiresIn = obj["expires_in"]?.jsonPrimitive?.longOrNull ?: 3600L
            val expiresAt = System.currentTimeMillis() + (expiresIn * 1000)

            val p = DesktopPersistence()
            p.saveString(KEY_ACCESS_TOKEN, accessToken)
            if (refreshToken.isNotBlank()) p.saveString(KEY_REFRESH_TOKEN, refreshToken)
            p.saveString(KEY_EXPIRES_AT, expiresAt.toString())

            // Fetch profile
            val profileRes = DesktopSpotifyApiClient.getUserProfile(accessToken)
            val profile = profileRes.getOrNull()

            if (profile != null) {
                p.saveString(KEY_USER_ID, profile.id)
                p.saveString(KEY_USER_NAME, profile.displayName)
                p.saveString(KEY_USER_AVATAR, profile.avatarUrl.orEmpty())
                p.saveString(KEY_USER_PRODUCT, profile.product.orEmpty())

                _authState.value = DesktopSpotifyAuthState.LoggedIn(
                    userId = profile.id,
                    displayName = profile.displayName,
                    avatarUrl = profile.avatarUrl,
                    product = profile.product,
                    isOAuth = true,
                )
            } else {
                _authState.value = DesktopSpotifyAuthState.LoggedIn(
                    userId = "user",
                    displayName = "Spotify User",
                    avatarUrl = null,
                    product = null,
                    isOAuth = true,
                )
            }
        } catch (e: Exception) {
            DesktopTrackLog.log("DesktopSpotifyAuthManager: exchangeCodeForToken error: ${e.message}")
            _authState.value = DesktopSpotifyAuthState.Error("Login error: ${e.message}")
        }
    }

    /**
     * Connects using an sp_dc Web Cookie.
     */
    fun loginWithSpdc(spdc: String) {
        scope.launch {
            _authState.value = DesktopSpotifyAuthState.LoggingIn
            try {
                val clean = spdc.trim()
                DesktopSpotifyToken.setCookie(clean)
                verifyWebSession()
            } catch (e: Exception) {
                _authState.value = DesktopSpotifyAuthState.Error(e.message ?: "Failed to verify sp_dc cookie")
            }
        }
    }

    private suspend fun verifyWebSession() = withContext(Dispatchers.IO) {
        val token = DesktopSpotifyToken.accessToken()
        if (token.isNullOrBlank()) {
            _authState.value = DesktopSpotifyAuthState.LoggedOut
            return@withContext
        }

        val profileRes = DesktopSpotifyApiClient.getUserProfile(token)
        val profile = profileRes.getOrNull()

        if (profile != null) {
            val p = DesktopPersistence()
            p.saveString(KEY_USER_ID, profile.id)
            p.saveString(KEY_USER_NAME, profile.displayName)
            p.saveString(KEY_USER_AVATAR, profile.avatarUrl.orEmpty())
            p.saveString(KEY_USER_PRODUCT, profile.product.orEmpty())

            _authState.value = DesktopSpotifyAuthState.LoggedIn(
                userId = profile.id,
                displayName = profile.displayName,
                avatarUrl = profile.avatarUrl,
                product = profile.product,
                isOAuth = false,
            )
        } else {
            _authState.value = DesktopSpotifyAuthState.LoggedIn(
                userId = "spotify_web",
                displayName = "Spotify Web Account",
                avatarUrl = null,
                product = null,
                isOAuth = false,
            )
        }
    }

    private suspend fun refreshProfileIfPossible() = withContext(Dispatchers.IO) {
        val token = getValidAccessToken() ?: return@withContext
        val profileRes = DesktopSpotifyApiClient.getUserProfile(token)
        val profile = profileRes.getOrNull() ?: return@withContext

        val p = DesktopPersistence()
        p.saveString(KEY_USER_ID, profile.id)
        p.saveString(KEY_USER_NAME, profile.displayName)
        p.saveString(KEY_USER_AVATAR, profile.avatarUrl.orEmpty())
        p.saveString(KEY_USER_PRODUCT, profile.product.orEmpty())

        val current = _authState.value
        val isOAuth = if (current is DesktopSpotifyAuthState.LoggedIn) current.isOAuth else true

        _authState.value = DesktopSpotifyAuthState.LoggedIn(
            userId = profile.id,
            displayName = profile.displayName,
            avatarUrl = profile.avatarUrl,
            product = profile.product,
            isOAuth = isOAuth,
        )
    }

    suspend fun getValidAccessToken(): String? = withContext(Dispatchers.IO) {
        val p = DesktopPersistence()
        val oauthToken = p.string(KEY_ACCESS_TOKEN, "")
        val refreshToken = p.string(KEY_REFRESH_TOKEN, "")
        val expiresAt = p.string(KEY_EXPIRES_AT, "0").toLongOrNull() ?: 0L

        if (oauthToken.isNotBlank()) {
            val now = System.currentTimeMillis()
            if (now < expiresAt - 60_000) {
                return@withContext oauthToken
            }

            // Need refresh
            if (refreshToken.isNotBlank()) {
                val refreshed = refreshAccessToken(refreshToken)
                if (!refreshed.isNullOrBlank()) {
                    return@withContext refreshed
                }
            }
        }

        // Fall back to Web Session (sp_dc)
        return@withContext DesktopSpotifyToken.accessToken()
    }

    private suspend fun refreshAccessToken(refreshToken: String): String? = withContext(Dispatchers.IO) {
        try {
            val clientId = getStoredClientId()
            val params = listOf(
                "grant_type" to "refresh_token",
                "refresh_token" to refreshToken,
                "client_id" to clientId,
            ).joinToString("&") { (k, v) -> "$k=${URLEncoder.encode(v, StandardCharsets.UTF_8)}" }

            val req = HttpRequest.newBuilder(URI.create("https://accounts.spotify.com/api/token"))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(params))
                .build()

            val resp = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
            if (resp.statusCode() !in 200..299) return@withContext null

            val obj = json.parseToJsonElement(resp.body()).jsonObject
            val newAccess = obj["access_token"]?.jsonPrimitive?.content ?: return@withContext null
            val newRefresh = obj["refresh_token"]?.jsonPrimitive?.content
            val expiresIn = obj["expires_in"]?.jsonPrimitive?.longOrNull ?: 3600L

            val p = DesktopPersistence()
            p.saveString(KEY_ACCESS_TOKEN, newAccess)
            if (!newRefresh.isNullOrBlank()) p.saveString(KEY_REFRESH_TOKEN, newRefresh)
            p.saveString(KEY_EXPIRES_AT, (System.currentTimeMillis() + expiresIn * 1000).toString())

            return@withContext newAccess
        } catch (e: Exception) {
            DesktopTrackLog.log("DesktopSpotifyAuthManager: refreshAccessToken error: ${e.message}")
            return@withContext null
        }
    }

    fun disconnect() {
        activeServer?.stop(0)
        activeServer = null

        val p = DesktopPersistence()
        p.saveString(KEY_ACCESS_TOKEN, "")
        p.saveString(KEY_REFRESH_TOKEN, "")
        p.saveString(KEY_EXPIRES_AT, "0")
        p.saveString(KEY_USER_ID, "")
        p.saveString(KEY_USER_NAME, "")
        p.saveString(KEY_USER_AVATAR, "")
        p.saveString(KEY_USER_PRODUCT, "")
        DesktopSpotifyToken.setCookie("")

        _authState.value = DesktopSpotifyAuthState.LoggedOut
    }

    private fun generateCodeVerifier(): String {
        val secureRandom = SecureRandom()
        val code = ByteArray(64)
        secureRandom.nextBytes(code)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(code)
    }

    private fun generateCodeChallenge(verifier: String): String {
        val bytes = verifier.toByteArray(StandardCharsets.US_ASCII)
        val md = MessageDigest.getInstance("SHA-256")
        md.update(bytes, 0, bytes.size)
        val digest = md.digest()
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
    }
}
