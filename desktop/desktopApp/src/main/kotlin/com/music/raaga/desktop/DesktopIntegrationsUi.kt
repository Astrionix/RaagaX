package com.music.raaga.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Signing in to Last.fm with a username and password.
 *
 * Android's `LastfmLoginAlert`: two fields, and the error takes the
 * description's place rather than appearing beside it, because a wrong password
 * is the only thing anybody needs told at that moment. The password is sent to
 * `auth.getMobileSession` and never stored — only the session key it returns.
 */
@Composable
internal fun DesktopLastfmLoginDialog(onDismiss: () -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }

    fun submit() {
        if (busy || username.isBlank() || password.isBlank()) return
        busy = true
        error = null
        scope.launch {
            DesktopScrobbling.signInToLastFm(username.trim(), password)
                .onSuccess { onDismiss() }
                .onFailure { error = it.message ?: "Last.fm would not sign you in" }
            busy = false
        }
    }

    DesktopDialogPanel(onDismiss = onDismiss, maxWidth = 380) {
        DialogHeading(
            title = DesktopStrings["d_sign_in_to_last_fm", "Sign in to Last.fm"],
            message = error ?: "Your password is sent to Last.fm once and never stored.",
            isError = error != null,
        )
        DialogField(
            value = username,
            onValueChange = { username = it },
            placeholder = DesktopStrings["username", "Username"],
            enabled = !busy,
            imeAction = ImeAction.Next,
            modifier = Modifier.focusRequester(focus),
        )
        Spacer(Modifier.height(8.dp))
        DialogField(
            value = password,
            onValueChange = { password = it },
            placeholder = DesktopStrings["password", "Password"],
            enabled = !busy,
            isPassword = true,
            onSubmit = ::submit,
        )
        DialogActions(
            confirm = if (busy) "Signing in…" else "Sign in",
            confirmEnabled = !busy && username.isNotBlank() && password.isNotBlank(),
            busy = busy,
            onConfirm = ::submit,
            onDismiss = onDismiss,
        )
    }
}

/**
 * The `sp_dc` cookie Spotify Canvas needs.
 *
 * Android's `SpotifyCanvasAuthScreen`, with its four steps unchanged — they name a browser's
 * developer tools, which is where a desktop listener already is.
 */
@Composable
internal fun DesktopSpotifyCanvasDialog(onDismiss: () -> Unit, onSaved: (String) -> Unit) {
    var token by remember { mutableStateOf(DesktopSpotifyToken.cookie()) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }

    fun save() {
        DesktopSpotifyToken.setCookie(token.trim())
        onSaved(token.trim())
        onDismiss()
    }

    DesktopDialogPanel(onDismiss = onDismiss, maxWidth = 420) {
        DialogHeading(
            title = DesktopStrings["spotify_canvas_setup", "Spotify Canvas setup"],
            message = DesktopStrings["spotify_canvas_setup_description", "To use Spotify Canvas, provide your Spotify sp_dc cookie."],
        )
        Text(
            DesktopStrings[
                "spotify_canvas_setup_steps",
                "1. Sign in at open.spotify.com in a browser.\n" +
                    "2. Open Developer Tools, then Application and Cookies.\n" +
                    "3. Copy the value of the sp_dc cookie.\n" +
                    "4. Paste it below.",
            ],
            modifier = Modifier.fillMaxWidth().padding(horizontal = panelInset(22.dp), vertical = 4.dp),
            style = MaterialTheme.typography.bodySmall,
            color = DesktopSecondary,
        )
        Spacer(Modifier.height(12.dp))
        DialogField(
            value = token,
            onValueChange = { token = it },
            placeholder = DesktopStrings["spdc_token", "sp_dc token"],
            isPassword = true,
            onSubmit = ::save,
            modifier = Modifier.focusRequester(focus),
        )
        Row(
            Modifier.fillMaxWidth().padding(horizontal = panelInset(22.dp)),
            horizontalArrangement = Arrangement.Start,
        ) {
            TextButton(onClick = { DesktopExternalLinks.open("https://open.spotify.com/") }) {
                Text(DesktopStrings["d_open_spotify", "Open Spotify"], color = DesktopSecondary, style = MaterialTheme.typography.bodySmall)
            }
        }
        DialogActions(
            confirm = DesktopStrings["save", "Save"],
            confirmEnabled = true,
            busy = false,
            onConfirm = ::save,
            onDismiss = onDismiss,
        )
    }
}

/**
 * ListenBrainz's user token.
 *
 * One field and no verification, as on Android: ListenBrainz has no endpoint
 * that says whether a token is good, so the first listen is the test.
 */
@Composable
internal fun DesktopListenBrainzTokenDialog(onDismiss: () -> Unit) {
    var token by remember { mutableStateOf(DesktopScrobbleSettings.listenBrainzToken.value) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }

    fun save() {
        DesktopScrobbleSettings.setListenBrainzToken(token.trim())
        DesktopScrobbleSettings.setListenBrainzEnabled(token.isNotBlank())
        onDismiss()
    }

    DesktopDialogPanel(onDismiss = onDismiss, maxWidth = 380) {
        DialogHeading(
            title = DesktopStrings["listenbrainz_token", "ListenBrainz token"],
            message = DesktopStrings["d_found_on_your_listenbrainz_profile_under_settings", "Found on your ListenBrainz profile, under Settings."],
        )
        DialogField(
            value = token,
            onValueChange = { token = it },
            placeholder = DesktopStrings["api_token", "API token"],
            isPassword = true,
            onSubmit = ::save,
            modifier = Modifier.focusRequester(focus),
        )
        Row(
            Modifier.fillMaxWidth().padding(horizontal = panelInset(22.dp)),
            horizontalArrangement = Arrangement.Start,
        ) {
            TextButton(onClick = { DesktopExternalLinks.open("https://listenbrainz.org/settings/") }) {
                Text(DesktopStrings["d_open_listenbrainz", "Open ListenBrainz"], color = DesktopSecondary, style = MaterialTheme.typography.bodySmall)
            }
        }
        DialogActions(
            confirm = DesktopStrings["save", "Save"],
            confirmEnabled = true,
            busy = false,
            onConfirm = ::save,
            onDismiss = onDismiss,
        )
    }
}

@Composable
private fun DialogHeading(title: String, message: String, isError: Boolean = false) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = panelInset(22.dp), vertical = 18.dp),
        horizontalAlignment = if (LocalDesktopPanelIsPage.current) Alignment.Start else Alignment.CenterHorizontally,
    ) {
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = Color.White,
        )
        Text(
            message,
            modifier = Modifier.padding(top = 5.dp),
            style = MaterialTheme.typography.bodySmall,
            color = if (isError) DesktopDestructive else DesktopSecondary,
            textAlign = if (LocalDesktopPanelIsPage.current) TextAlign.Start else TextAlign.Center,
        )
    }
}

/** The same filled field the playlist dialogs use. */
@Composable
private fun DialogField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isPassword: Boolean = false,
    imeAction: ImeAction = ImeAction.Done,
    onSubmit: () -> Unit = {},
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = panelInset(22.dp))
            .clip(RoundedCornerShape(11.dp))
            .background(Color.White.copy(alpha = if (enabled) 0.08f else 0.04f))
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) {
                Text(placeholder, style = MaterialTheme.typography.bodyLarge, color = DesktopSecondary)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                enabled = enabled,
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge.copy(color = Color.White),
                cursorBrush = SolidColor(DesktopAccent),
                visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
                keyboardOptions = KeyboardOptions(imeAction = imeAction),
                keyboardActions = KeyboardActions(onDone = { onSubmit() }),
                modifier = modifier.fillMaxWidth(),
            )
        }
        if (value.isNotEmpty() && enabled) {
            Box(
                Modifier.size(26.dp).clip(CircleShape).clickable { onValueChange("") },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Rounded.Close, DesktopStrings["clear", "Clear"], tint = DesktopSecondary, modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
private fun DialogActions(
    confirm: String,
    confirmEnabled: Boolean,
    busy: Boolean,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = panelInset(16.dp), vertical = 12.dp),
        horizontalArrangement = Arrangement.End,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (busy) {
            CircularProgressIndicator(
                color = DesktopAccent,
                strokeWidth = 2.dp,
                modifier = Modifier.size(16.dp).padding(end = 0.dp),
            )
            Spacer(Modifier.size(12.dp))
        }
        TextButton(onClick = onDismiss, enabled = !busy) {
            Text(DesktopStrings["cancel", "Cancel"], color = DesktopSecondary)
        }
        TextButton(onClick = onConfirm, enabled = confirmEnabled) {
            Text(confirm, color = if (confirmEnabled) DesktopAccent else DesktopSecondary)
        }
    }
}


/**
 * Discord's user token.
 *
 * Verified before it is kept — Android's alert does the same, because a token
 * that was mistyped and one that has expired look identical until Discord is
 * asked about it.
 */
@Composable
internal fun DesktopDiscordTokenDialog(onDismiss: () -> Unit) {
    val currentToken by DesktopDiscordRpc.token.collectAsState()
    val currentUsername by DesktopDiscordRpc.username.collectAsState()
    var manualToken by remember { mutableStateOf(currentToken) }
    var showManualInput by remember { mutableStateOf(false) }
    var manualError by remember { mutableStateOf<String?>(null) }
    var manualBusy by remember { mutableStateOf(false) }

    val remoteAuth = remember { DesktopDiscordRemoteAuth() }
    val remoteState by remoteAuth.state.collectAsState()

    val scope = rememberCoroutineScope()

    LaunchedEffect(currentToken) {
        if (currentToken.isBlank()) {
            remoteAuth.start()
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            remoteAuth.cancel()
        }
    }

    // When remote auth succeeds, dismiss automatically after 1 second
    LaunchedEffect(remoteState) {
        if (remoteState is DiscordRemoteAuthState.Success) {
            delay(1000)
            onDismiss()
        }
    }

    fun saveManualToken() {
        if (manualBusy || manualToken.isBlank()) return
        manualBusy = true
        manualError = null
        scope.launch {
            DesktopDiscordRpc.signIn(manualToken.trim())
                .onSuccess { onDismiss() }
                .onFailure { manualError = "Discord would not accept that token" }
            manualBusy = false
        }
    }

    DesktopDialogPanel(onDismiss = onDismiss, maxWidth = 440) {
        DialogHeading(
            title = "Discord Account Login",
            message = manualError
                ?: if (currentUsername.isNotBlank()) {
                    "Connected as @$currentUsername. Scan below to switch accounts, or enter a token manually."
                } else {
                    "Scan the QR code with your Discord mobile app to log in instantly without entering tokens."
                },
            isError = manualError != null,
        )

        // QR Code remote auth section
        if (!showManualInput) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = panelInset(20.dp), vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                when (val state = remoteState) {
                    is DiscordRemoteAuthState.Connecting, is DiscordRemoteAuthState.Idle -> {
                        Box(
                            modifier = Modifier
                                .size(180.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF1E1E22)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                CircularProgressIndicator(
                                    color = DesktopAccent,
                                    strokeWidth = 2.5.dp,
                                    modifier = Modifier.size(28.dp),
                                )
                                Text(
                                    text = "Connecting to Discord…",
                                    color = DesktopSecondary,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                        }
                    }

                    is DiscordRemoteAuthState.Ready -> {
                        DesktopQrCode(content = state.qrUrl, size = 180.dp)
                        Spacer(Modifier.height(14.dp))
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFF1E1E22))
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Text(
                                text = "How to log in:",
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold,
                                style = MaterialTheme.typography.bodySmall,
                            )
                            Text(
                                text = "1. Open Discord on your phone",
                                color = DesktopSecondary,
                                style = MaterialTheme.typography.bodySmall,
                            )
                            Text(
                                text = "2. Go to Settings  →  Scan QR Code",
                                color = DesktopSecondary,
                                style = MaterialTheme.typography.bodySmall,
                            )
                            Text(
                                text = "3. Point camera at this screen and tap 'Log In'",
                                color = DesktopSecondary,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }

                    is DiscordRemoteAuthState.Scanned -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF1E1E22))
                                .padding(16.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                CircularProgressIndicator(
                                    color = Color(0xFF5865F2),
                                    strokeWidth = 2.5.dp,
                                    modifier = Modifier.size(32.dp),
                                )
                                Text(
                                    text = "Scanned by @${state.username}!",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                Text(
                                    text = "Please tap 'Yes, log me in' on your phone to confirm.",
                                    color = DesktopSecondary,
                                    textAlign = TextAlign.Center,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                        }
                    }

                    is DiscordRemoteAuthState.Exchanging -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF1E1E22)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                CircularProgressIndicator(
                                    color = DesktopAccent,
                                    strokeWidth = 2.5.dp,
                                    modifier = Modifier.size(32.dp),
                                )
                                Text(
                                    text = "Authorizing session…",
                                    color = Color.White,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                            }
                        }
                    }

                    is DiscordRemoteAuthState.Success -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF1E1E22)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Check,
                                    contentDescription = null,
                                    tint = DesktopAccent,
                                    modifier = Modifier.size(36.dp),
                                )
                                Text(
                                    text = "Connected as @${state.user.name}!",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                            }
                        }
                    }

                    is DiscordRemoteAuthState.Error -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF1E1E22))
                                .padding(16.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Text(
                                    text = state.message,
                                    color = DesktopDestructive,
                                    textAlign = TextAlign.Center,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                                TextButton(onClick = { remoteAuth.start() }) {
                                    Icon(
                                        imageVector = Icons.Rounded.Refresh,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp),
                                    )
                                    Spacer(Modifier.width(6.dp))
                                    Text("Reload QR Code", color = DesktopAccent)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Expandable Manual Token input option
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = panelInset(20.dp), vertical = 4.dp),
        ) {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .clickable {
                        showManualInput = !showManualInput
                        if (!showManualInput && currentToken.isBlank()) {
                            remoteAuth.start()
                        } else if (showManualInput) {
                            remoteAuth.cancel()
                        }
                    }
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = if (showManualInput) "▾ Switch back to QR code login" else "▸ Or enter token manually",
                    color = DesktopSecondary,
                    fontSize = 12.sp,
                )
            }

            if (showManualInput) {
                Spacer(Modifier.height(8.dp))
                DialogField(
                    value = manualToken,
                    onValueChange = { manualToken = it },
                    placeholder = DesktopStrings["token", "Token"],
                    enabled = !manualBusy,
                    isPassword = true,
                    onSubmit = ::saveManualToken,
                )
                var snippetCopied by remember { mutableStateOf(false) }
                Row(
                    Modifier.fillMaxWidth().padding(top = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(
                        onClick = {
                            DesktopExternalLinks.copy(
                                "(webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken()"
                            )
                            snippetCopied = true
                        },
                    ) {
                        Text(
                            if (snippetCopied) "Snippet Copied!" else "Copy Token Script",
                            color = if (snippetCopied) DesktopAccent else DesktopSecondary,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    TextButton(
                        onClick = { DesktopExternalLinks.open("https://discord.com/app") },
                    ) {
                        Text(
                            "Open Discord Web",
                            color = DesktopSecondary,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }

        // Bottom Actions Row
        Row(
            Modifier.fillMaxWidth().padding(horizontal = panelInset(16.dp), vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (currentToken.isNotBlank()) {
                TextButton(
                    onClick = {
                        DesktopDiscordRpc.signOut()
                        onDismiss()
                    },
                    enabled = !manualBusy,
                ) {
                    Text("Disconnect", color = DesktopDestructive)
                }
            } else {
                Spacer(Modifier.width(1.dp))
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (manualBusy) {
                    CircularProgressIndicator(
                        color = DesktopAccent,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.size(12.dp))
                }
                TextButton(onClick = onDismiss, enabled = !manualBusy) {
                    Text(DesktopStrings["cancel", "Cancel"], color = DesktopSecondary)
                }
                if (showManualInput && manualToken.isNotBlank() && (manualToken != currentToken || currentUsername.isBlank())) {
                    TextButton(
                        onClick = ::saveManualToken,
                        enabled = !manualBusy,
                    ) {
                        Text(
                            if (manualBusy) "Checking…" else "Save",
                            color = DesktopAccent,
                        )
                    }
                }
            }
        }
    }
}


/**
 * One free-text value — an activity name, a button label.
 *
 * [message] is where the caller explains the field, including which `{...}`
 * variables it accepts, since that is the only place anyone would find out.
 */
@Composable
internal fun DesktopTextValueDialog(
    title: String,
    message: String,
    initial: String,
    placeholder: String,
    onSave: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var value by remember { mutableStateOf(initial) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }

    DesktopDialogPanel(onDismiss = onDismiss, maxWidth = 400, popup = true) {
        DialogHeading(title = title, message = message)
        DialogField(
            value = value,
            onValueChange = { value = it },
            placeholder = placeholder,
            onSubmit = { onSave(value.trim()) },
            modifier = Modifier.focusRequester(focus),
        )
        DialogActions(
            confirm = DesktopStrings["save", "Save"],
            confirmEnabled = true,
            busy = false,
            onConfirm = { onSave(value.trim()) },
            onDismiss = onDismiss,
        )
    }
}
