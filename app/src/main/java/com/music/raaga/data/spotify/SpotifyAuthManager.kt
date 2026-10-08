package com.music.raaga.data.spotify

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.util.Base64
import com.music.raaga.auth.EncryptedPrefs
import com.music.raaga.data.DebugLog as Log
import com.music.raaga.data.Http
import com.music.raaga.data.canvas.SpotifyToken
import com.music.raaga.data.settings.AppSettings
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
import okhttp3.FormBody
import okhttp3.Request
import java.security.MessageDigest
import java.security.SecureRandom

sealed interface SpotifyAuthState {
    data object LoggedOut : SpotifyAuthState
    data object LoggingIn : SpotifyAuthState
    data class LoggedIn(
        val userId: String,
        val displayName: String,
        val avatarUrl: String?,
        val product: String?,
        val isOAuth: Boolean,
    ) : SpotifyAuthState
    data class Error(val message: String) : SpotifyAuthState
}

object SpotifyAuthManager {
    private const val TAG = "SpotifyAuthManager"

    // Default Client ID or custom user-provided one. Users can provide their own Client ID
    // from developer.spotify.com, or use the default one configured with raaga://spotify-callback.
    const val DEFAULT_CLIENT_ID = "086ea0f4ce004066927d62f4ba1efc28"
    const val REDIRECT_URI = "raaga://spotify-callback"
    const val SCOPES = "user-library-read playlist-read-private playlist-read-collaborative user-read-private user-read-email"

    private const val KEY_ACCESS_TOKEN = "spotify_access_token"
    private const val KEY_REFRESH_TOKEN = "spotify_refresh_token"
    private const val KEY_EXPIRES_AT = "spotify_expires_at"
    private const val KEY_CLIENT_ID = "spotify_client_id"
    private const val KEY_CODE_VERIFIER = "spotify_code_verifier"
    private const val KEY_OAUTH_STATE = "spotify_oauth_state"
    private const val KEY_USER_ID = "spotify_user_id"
    private const val KEY_USER_NAME = "spotify_user_name"
    private const val KEY_USER_AVATAR = "spotify_user_avatar"
    private const val KEY_USER_PRODUCT = "spotify_user_product"

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private var prefs: SharedPreferences? = null
    @Volatile private var appContext: Context? = null

    private val _authState = MutableStateFlow<SpotifyAuthState>(SpotifyAuthState.LoggedOut)
    val authState: StateFlow<SpotifyAuthState> = _authState.asStateFlow()

    fun init(context: Context) {
        appContext = context.applicationContext
        prefs = EncryptedPrefs.open(context, "spotify_auth", "spotify_auth_plain")
        restoreAuthState()
    }

    private fun restoreAuthState() {
        val p = prefs ?: return
        val token = p.getString(KEY_ACCESS_TOKEN, null)
        val userId = p.getString(KEY_USER_ID, null)
        val userName = p.getString(KEY_USER_NAME, null)
        val userAvatar = p.getString(KEY_USER_AVATAR, null)
        val userProduct = p.getString(KEY_USER_PRODUCT, null)

        if (!token.isNullOrBlank() && !userId.isNullOrBlank()) {
            _authState.value = SpotifyAuthState.LoggedIn(
                userId = userId,
                displayName = userName ?: userId,
                avatarUrl = userAvatar,
                product = userProduct,
                isOAuth = true,
            )
            // Verify and refresh profile in background
            scope.launch {
                refreshProfileIfPossible()
            }
        } else if (AppSettings.spotifySpdcToken.value.isNotBlank()) {
            // Check if we have an active Web/sp_dc session
            scope.launch {
                verifyWebSession()
            }
        } else {
            _authState.value = SpotifyAuthState.LoggedOut
        }
    }

    /**
     * Starts OAuth2 PKCE login flow in a Custom Tab or default browser.
     */
    fun startOAuthLogin(context: Context, customClientId: String? = null) {
        val p = prefs ?: return
        _authState.value = SpotifyAuthState.LoggingIn

        val activeClientId = customClientId?.trim()?.ifBlank { null }
            ?: p.getString(KEY_CLIENT_ID, null)
            ?: DEFAULT_CLIENT_ID

        p.edit().putString(KEY_CLIENT_ID, activeClientId).apply()

        val codeVerifier = generateCodeVerifier()
        val codeChallenge = generateCodeChallenge(codeVerifier)
        val state = generateRandomState()

        p.edit()
            .putString(KEY_CODE_VERIFIER, codeVerifier)
            .putString(KEY_OAUTH_STATE, state)
            .apply()

        val authUrl = Uri.parse("https://accounts.spotify.com/authorize").buildUpon()
            .appendQueryParameter("client_id", activeClientId)
            .appendQueryParameter("response_type", "code")
            .appendQueryParameter("redirect_uri", REDIRECT_URI)
            .appendQueryParameter("scope", SCOPES)
            .appendQueryParameter("code_challenge_method", "S256")
            .appendQueryParameter("code_challenge", codeChallenge)
            .appendQueryParameter("state", state)
            .build()

        val intent = Intent(Intent.ACTION_VIEW, authUrl).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
    }

    /**
     * Consumes deep link intent for raaga://spotify-callback
     */
    fun consumeIntent(intent: Intent?): Boolean {
        if (intent == null || intent.action != Intent.ACTION_VIEW) return false
        val uri = intent.data ?: return false
        if (uri.scheme == "raaga" && uri.host == "spotify-callback") {
            scope.launch {
                handleAuthCallback(uri)
            }
            return true
        }
        return false
    }

    suspend fun handleAuthCallback(uri: Uri): Result<SpotifyUserProfile> = withContext(Dispatchers.IO) {
        val p = prefs ?: return@withContext Result.failure(IllegalStateException("Not initialized"))
        val code = uri.getQueryParameter("code")
        val error = uri.getQueryParameter("error")
        val state = uri.getQueryParameter("state")

        if (error != null) {
            val msg = "Spotify login failed: $error"
            _authState.value = SpotifyAuthState.Error(msg)
            return@withContext Result.failure(Exception(msg))
        }

        val expectedState = p.getString(KEY_OAUTH_STATE, null)
        if (state == null || state != expectedState) {
            Log.w(TAG, "OAuth state mismatch: expected $expectedState, got $state")
            // Still attempt with code if present
        }

        if (code.isNullOrBlank()) {
            val msg = "No authorization code returned from Spotify"
            _authState.value = SpotifyAuthState.Error(msg)
            return@withContext Result.failure(Exception(msg))
        }

        val codeVerifier = p.getString(KEY_CODE_VERIFIER, null) ?: run {
            val msg = "Missing code_verifier for PKCE exchange"
            _authState.value = SpotifyAuthState.Error(msg)
            return@withContext Result.failure(Exception(msg))
        }

        val clientId = p.getString(KEY_CLIENT_ID, null) ?: DEFAULT_CLIENT_ID

        // Exchange code for tokens
        val formBody = FormBody.Builder()
            .add("grant_type", "authorization_code")
            .add("code", code)
            .add("redirect_uri", REDIRECT_URI)
            .add("client_id", clientId)
            .add("code_verifier", codeVerifier)
            .build()

        val req = Request.Builder()
            .url("https://accounts.spotify.com/api/token")
            .post(formBody)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .build()

        try {
            Http.client.newCall(req).execute().use { resp ->
                val body = resp.body?.string().orEmpty()
                if (!resp.isSuccessful) {
                    val msg = "Spotify token exchange failed (${resp.code}): $body"
                    Log.w(TAG, msg)
                    _authState.value = SpotifyAuthState.Error(msg)
                    return@withContext Result.failure(Exception(msg))
                }

                val jsonRoot = json.parseToJsonElement(body).jsonObject
                val accessToken = jsonRoot["access_token"]?.jsonPrimitive?.content ?: ""
                val refreshToken = jsonRoot["refresh_token"]?.jsonPrimitive?.content ?: ""
                val expiresIn = jsonRoot["expires_in"]?.jsonPrimitive?.content?.toLongOrNull() ?: 3600L
                val expiresAt = System.currentTimeMillis() + (expiresIn * 1000L)

                p.edit()
                    .putString(KEY_ACCESS_TOKEN, accessToken)
                    .putString(KEY_REFRESH_TOKEN, refreshToken)
                    .putLong(KEY_EXPIRES_AT, expiresAt)
                    .remove(KEY_CODE_VERIFIER)
                    .remove(KEY_OAUTH_STATE)
                    .apply()

                // Fetch user profile
                val profileResult = SpotifyApiClient.getUserProfile(accessToken)
                profileResult.fold(
                    onSuccess = { profile ->
                        p.edit()
                            .putString(KEY_USER_ID, profile.id)
                            .putString(KEY_USER_NAME, profile.displayName)
                            .putString(KEY_USER_AVATAR, profile.avatarUrl)
                            .putString(KEY_USER_PRODUCT, profile.product)
                            .apply()

                        _authState.value = SpotifyAuthState.LoggedIn(
                            userId = profile.id,
                            displayName = profile.displayName,
                            avatarUrl = profile.avatarUrl,
                            product = profile.product,
                            isOAuth = true,
                        )
                        Result.success(profile)
                    },
                    onFailure = { err ->
                        _authState.value = SpotifyAuthState.LoggedIn(
                            userId = "spotify_user",
                            displayName = "Spotify User",
                            avatarUrl = null,
                            product = null,
                            isOAuth = true,
                        )
                        Result.success(SpotifyUserProfile("spotify_user", "Spotify User"))
                    }
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "OAuth exchange threw: ${e.message}")
            _authState.value = SpotifyAuthState.Error(e.message ?: "Authentication failed")
            Result.failure(e)
        }
    }

    /**
     * Authenticates with an existing or newly captured sp_dc web session cookie.
     */
    suspend fun loginWithWebSession(spDc: String): Result<SpotifyUserProfile> = withContext(Dispatchers.IO) {
        _authState.value = SpotifyAuthState.LoggingIn
        AppSettings.setSpotifySpdcToken(spDc.trim())

        val token = SpotifyToken.accessToken()
        if (token.isNullOrBlank()) {
            val msg = "Failed to obtain web player session token from Spotify"
            _authState.value = SpotifyAuthState.Error(msg)
            return@withContext Result.failure(Exception(msg))
        }

        val profileResult = SpotifyApiClient.getUserProfile(token)
        profileResult.fold(
            onSuccess = { profile ->
                val p = prefs
                p?.edit()
                    ?.putString(KEY_USER_ID, profile.id)
                    ?.putString(KEY_USER_NAME, profile.displayName)
                    ?.putString(KEY_USER_AVATAR, profile.avatarUrl)
                    ?.putString(KEY_USER_PRODUCT, profile.product)
                    ?.apply()

                _authState.value = SpotifyAuthState.LoggedIn(
                    userId = profile.id,
                    displayName = profile.displayName,
                    avatarUrl = profile.avatarUrl,
                    product = profile.product,
                    isOAuth = false,
                )
                Result.success(profile)
            },
            onFailure = { err ->
                // Fallback to basic state
                _authState.value = SpotifyAuthState.LoggedIn(
                    userId = "spotify_user",
                    displayName = "Spotify Web User",
                    avatarUrl = null,
                    product = null,
                    isOAuth = false,
                )
                Result.success(SpotifyUserProfile("spotify_user", "Spotify Web User"))
            }
        )
    }

    private suspend fun verifyWebSession() {
        val token = SpotifyToken.accessToken() ?: return
        val profileResult = SpotifyApiClient.getUserProfile(token)
        profileResult.onSuccess { profile ->
            _authState.value = SpotifyAuthState.LoggedIn(
                userId = profile.id,
                displayName = profile.displayName,
                avatarUrl = profile.avatarUrl,
                product = profile.product,
                isOAuth = false,
            )
        }
    }

    private suspend fun refreshProfileIfPossible() {
        val token = getValidAccessToken() ?: return
        val profileResult = SpotifyApiClient.getUserProfile(token)
        profileResult.onSuccess { profile ->
            prefs?.edit()
                ?.putString(KEY_USER_ID, profile.id)
                ?.putString(KEY_USER_NAME, profile.displayName)
                ?.putString(KEY_USER_AVATAR, profile.avatarUrl)
                ?.putString(KEY_USER_PRODUCT, profile.product)
                ?.apply()

            _authState.value = SpotifyAuthState.LoggedIn(
                userId = profile.id,
                displayName = profile.displayName,
                avatarUrl = profile.avatarUrl,
                product = profile.product,
                isOAuth = prefs?.getString(KEY_ACCESS_TOKEN, null) != null,
            )
        }
    }

    /**
     * Returns an active valid bearer access token, automatically refreshing
     * if the OAuth token is expired, or falling back to the Web Player token.
     */
    suspend fun getValidAccessToken(): String? = withContext(Dispatchers.IO) {
        val p = prefs ?: return@withContext null
        val oauthToken = p.getString(KEY_ACCESS_TOKEN, null)
        val expiresAt = p.getLong(KEY_EXPIRES_AT, 0L)
        val refreshToken = p.getString(KEY_REFRESH_TOKEN, null)
        val now = System.currentTimeMillis()

        if (!oauthToken.isNullOrBlank()) {
            if (now < expiresAt - 60_000L) {
                return@withContext oauthToken
            }
            // Expired, try refreshing
            if (!refreshToken.isNullOrBlank()) {
                val refreshed = refreshAccessToken(refreshToken)
                if (refreshed != null) return@withContext refreshed
            }
        }

        // Fallback to Web Player token
        SpotifyToken.accessToken()
    }

    private suspend fun refreshAccessToken(refreshToken: String): String? = withContext(Dispatchers.IO) {
        val p = prefs ?: return@withContext null
        val clientId = p.getString(KEY_CLIENT_ID, null) ?: DEFAULT_CLIENT_ID

        val formBody = FormBody.Builder()
            .add("grant_type", "refresh_token")
            .add("refresh_token", refreshToken)
            .add("client_id", clientId)
            .build()

        val req = Request.Builder()
            .url("https://accounts.spotify.com/api/token")
            .post(formBody)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .build()

        try {
            Http.client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) {
                    Log.w(TAG, "Refresh token request failed (${resp.code})")
                    return@withContext null
                }
                val body = resp.body?.string().orEmpty()
                val jsonRoot = json.parseToJsonElement(body).jsonObject
                val newAccessToken = jsonRoot["access_token"]?.jsonPrimitive?.content ?: return@withContext null
                val newRefreshToken = jsonRoot["refresh_token"]?.jsonPrimitive?.content ?: refreshToken
                val expiresIn = jsonRoot["expires_in"]?.jsonPrimitive?.content?.toLongOrNull() ?: 3600L
                val expiresAt = System.currentTimeMillis() + (expiresIn * 1000L)

                p.edit()
                    .putString(KEY_ACCESS_TOKEN, newAccessToken)
                    .putString(KEY_REFRESH_TOKEN, newRefreshToken)
                    .putLong(KEY_EXPIRES_AT, expiresAt)
                    .apply()

                newAccessToken
            }
        } catch (e: Exception) {
            Log.w(TAG, "Token refresh threw: ${e.message}")
            null
        }
    }

    fun logout() {
        prefs?.edit()
            ?.remove(KEY_ACCESS_TOKEN)
            ?.remove(KEY_REFRESH_TOKEN)
            ?.remove(KEY_EXPIRES_AT)
            ?.remove(KEY_USER_ID)
            ?.remove(KEY_USER_NAME)
            ?.remove(KEY_USER_AVATAR)
            ?.remove(KEY_USER_PRODUCT)
            ?.apply()

        AppSettings.setSpotifySpdcToken("")
        _authState.value = SpotifyAuthState.LoggedOut
    }

    // ── PKCE Helper Utilities ────────────────────────────────────────────────

    private fun generateCodeVerifier(): String {
        val bytes = ByteArray(64)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }

    private fun generateCodeChallenge(verifier: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(verifier.toByteArray(Charsets.US_ASCII))
        return Base64.encodeToString(hash, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }

    private fun generateRandomState(): String {
        val bytes = ByteArray(16)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }
}
