package com.music.raaga.ui.screens

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Login
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Key
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kotlinx.coroutines.delay
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.R
import com.music.raaga.data.settings.AppSettings

private val SpotifyBrandGreen = Color(0xFF1DB954)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SpotifyCanvasAuthScreen(
    onNavigateUp: () -> Unit
) {
    val context = LocalContext.current
    val currentToken by AppSettings.spotifySpdcToken.collectAsStateWithLifecycle()
    val spotifyCanvasEnabled by AppSettings.spotifyCanvasEnabled.collectAsStateWithLifecycle()
    val autoHidePlayer by AppSettings.spotifyCanvasAutoHide.collectAsStateWithLifecycle()
    val prioritizeSpotify by AppSettings.prioritizeSpotifyCanvas.collectAsStateWithLifecycle()
    var tokenInput by remember(currentToken) { mutableStateOf(currentToken) }
    var showLoginDialog by remember { mutableStateOf(false) }

    val isConnected = currentToken.isNotBlank()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.spotify_canvas_setup)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateUp) {
                        Icon(
                            Icons.AutoMirrored.Rounded.ArrowBack,
                            contentDescription = stringResource(R.string.back),
                        )
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text(
                text = stringResource(R.string.spotify_canvas_setup_description),
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            // Settings Toggles
            SpotifyCanvasSettingToggle(
                title = stringResource(R.string.spotify_canvas),
                subtitle = stringResource(R.string.spotify_canvas_subtitle),
                checked = spotifyCanvasEnabled,
                onCheckedChange = AppSettings::setSpotifyCanvasEnabled,
            )

            SpotifyCanvasSettingToggle(
                title = stringResource(R.string.spotify_canvas_auto_hide),
                subtitle = stringResource(R.string.spotify_canvas_auto_hide_subtitle),
                checked = autoHidePlayer,
                onCheckedChange = AppSettings::setSpotifyCanvasAutoHide,
            )

            SpotifyCanvasSettingToggle(
                title = stringResource(R.string.prioritize_spotify_canvas),
                subtitle = stringResource(R.string.prioritize_spotify_canvas_subtitle),
                checked = prioritizeSpotify,
                onCheckedChange = AppSettings::setPrioritizeSpotifyCanvas,
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Connection Status Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isConnected) {
                        SpotifyBrandGreen.copy(alpha = 0.12f)
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    }
                ),
                border = BorderStroke(
                    1.dp,
                    if (isConnected) SpotifyBrandGreen.copy(alpha = 0.4f) else MaterialTheme.colorScheme.outlineVariant
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(
                                if (isConnected) SpotifyBrandGreen.copy(alpha = 0.2f)
                                else MaterialTheme.colorScheme.surfaceVariant
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (isConnected) Icons.Rounded.CheckCircle else Icons.AutoMirrored.Rounded.Login,
                            contentDescription = null,
                            tint = if (isConnected) SpotifyBrandGreen else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(14.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = if (isConnected) stringResource(R.string.spotify_connected_status)
                            else stringResource(R.string.spotify_not_connected),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isConnected) SpotifyBrandGreen else MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = if (isConnected) "Canvas video loops active" else "Connect your account to view canvas loops",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    if (isConnected) {
                        OutlinedButton(
                            onClick = {
                                AppSettings.setSpotifySpdcToken("")
                                tokenInput = ""
                            },
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f)),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = MaterialTheme.colorScheme.error
                            ),
                        ) {
                            Text(stringResource(R.string.spotify_disconnect))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Option 1: In-App 1-Tap Login (Recommended)
            Text(
                text = "Option 1: In-App Login (Recommended)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = stringResource(R.string.spotify_login_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Note: Please sign in with your Spotify Email/Username & Password. (Google Sign-In is blocked in embedded WebViews by Google).",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline
            )

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = { showLoginDialog = true },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = SpotifyBrandGreen,
                    contentColor = Color.White
                )
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.Login,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = stringResource(R.string.spotify_login_button),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Option 2: Manual Cookie Entry (Alternative)
            Text(
                text = stringResource(R.string.spotify_manual_cookie_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = stringResource(R.string.spotify_canvas_setup_steps),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            OutlinedTextField(
                value = tokenInput,
                onValueChange = { tokenInput = it },
                label = { Text(stringResource(R.string.spdc_token)) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 14.dp),
                shape = RoundedCornerShape(12.dp),
                singleLine = true,
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Rounded.Key,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            )

            Button(
                onClick = {
                    val clean = tokenInput.trim()
                    AppSettings.setSpotifySpdcToken(clean)
                    Toast.makeText(
                        context,
                        if (clean.isNotBlank()) context.getString(R.string.spotify_login_success) else "Cleared",
                        Toast.LENGTH_SHORT
                    ).show()
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(stringResource(R.string.save))
            }

            Spacer(modifier = Modifier.height(40.dp))
        }
    }

    if (showLoginDialog) {
        SpotifyLoginDialog(
            onDismiss = { showLoginDialog = false },
            onSuccess = { spDc ->
                AppSettings.setSpotifySpdcToken(spDc)
                tokenInput = spDc
                showLoginDialog = false
                Toast.makeText(context, context.getString(R.string.spotify_login_success), Toast.LENGTH_SHORT).show()
            }
        )
    }
}

private val SPOTIFY_COOKIE_URLS = listOf(
    "https://accounts.spotify.com",
    "https://accounts.spotify.com/",
    "https://open.spotify.com",
    "https://open.spotify.com/",
    "https://spotify.com",
    "https://spotify.com/",
    "https://.spotify.com",
)

private fun extractSpDcFromCookieManager(cookieManager: CookieManager): String? {
    for (url in SPOTIFY_COOKIE_URLS) {
        val cookies = cookieManager.getCookie(url) ?: continue
        val token = extractSpDc(cookies)
        if (!token.isNullOrBlank()) return token
    }
    return null
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SpotifyLoginDialog(
    onDismiss: () -> Unit,
    onSuccess: (spDc: String) -> Unit,
) {
    val context = LocalContext.current
    var isLoading by remember { mutableStateOf(true) }
    var captured by remember { mutableStateOf(false) }
    val cookieManager = remember { CookieManager.getInstance() }

    fun checkAndCaptureCookies(): Boolean {
        if (captured) return true
        val spDc = extractSpDcFromCookieManager(cookieManager)
        if (!spDc.isNullOrBlank()) {
            captured = true
            onSuccess(spDc)
            return true
        }
        return false
    }

    // Active polling loop: checks every 500ms so the moment Spotify authenticates
    // via AJAX and writes the session cookie, the dialog instantly captures it and closes.
    LaunchedEffect(Unit) {
        while (!captured) {
            delay(500)
            checkAndCaptureCookies()
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(stringResource(R.string.spotify_login_button)) },
                    navigationIcon = {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Rounded.Close, contentDescription = stringResource(R.string.close))
                        }
                    },
                    actions = {
                        TextButton(
                            onClick = {
                                if (!checkAndCaptureCookies()) {
                                    Toast.makeText(context, "Please log in first, then tap Done", Toast.LENGTH_SHORT).show()
                                }
                            }
                        ) {
                            Text(
                                text = "Done",
                                color = SpotifyBrandGreen,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                )
            }
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Tip: Sign in with your Spotify Email / Username & Password. (Google Sign-In is blocked in embedded WebViews by Google).",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { ctx ->
                            WebView(ctx).apply {
                                layoutParams = ViewGroup.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                )
                                settings.apply {
                                    javaScriptEnabled = true
                                    domStorageEnabled = true
                                    databaseEnabled = true
                                    setSupportZoom(true)
                                    builtInZoomControls = true
                                    displayZoomControls = false
                                    // Clean standard mobile Chrome UA without '; wv' or 'Version/4.0'
                                    userAgentString = "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36"
                                }
                                cookieManager.setAcceptCookie(true)
                                cookieManager.setAcceptThirdPartyCookies(this, true)

                                webChromeClient = object : WebChromeClient() {
                                    override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                        super.onProgressChanged(view, newProgress)
                                        isLoading = newProgress < 100
                                        checkAndCaptureCookies()
                                    }
                                }

                                webViewClient = object : WebViewClient() {
                                    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                        super.onPageStarted(view, url, favicon)
                                        isLoading = true
                                        checkAndCaptureCookies()
                                    }

                                    override fun onPageFinished(view: WebView?, url: String?) {
                                        super.onPageFinished(view, url)
                                        isLoading = false
                                        checkAndCaptureCookies()
                                    }

                                    override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {
                                        super.doUpdateVisitedHistory(view, url, isReload)
                                        checkAndCaptureCookies()
                                    }
                                }
                                loadUrl("https://accounts.spotify.com/en/login?continue=https%3A%2F%2Fopen.spotify.com%2F")
                            }
                        }
                    )

                    if (isLoading) {
                        LinearProgressIndicator(
                            modifier = Modifier
                                .fillMaxWidth()
                                .align(Alignment.TopCenter),
                            color = SpotifyBrandGreen
                        )
                    }
                }
            }
        }
    }
}

private fun extractSpDc(cookieHeader: String?): String? {
    if (cookieHeader.isNullOrBlank()) return null
    return cookieHeader.split(";")
        .map { it.trim() }
        .firstOrNull { it.startsWith("sp_dc=") }
        ?.substringAfter("sp_dc=")
        ?.trim()
        ?.takeIf { it.isNotBlank() }
}

@Composable
private fun SpotifyCanvasSettingToggle(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(end = 16.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
        )
    }
}

