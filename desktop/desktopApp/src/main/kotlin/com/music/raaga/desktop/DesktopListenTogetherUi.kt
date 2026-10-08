package com.music.raaga.desktop

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.ContentPaste
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.KeyboardArrowUp
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.LockOpen
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Radio
import androidx.compose.material.icons.rounded.RemoveCircleOutline
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Wifi
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.music.raaga.data.listentogether.JamInvite
import com.music.raaga.data.listentogether.PartyActivity
import com.music.raaga.data.listentogether.PartyMember
import com.music.raaga.data.listentogether.PartyPreview
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val EmeraldGreen = Color(0xFF00E676)
private val EmeraldBg = Color(0x1F00E676)

/**
 * Mobile-inspired, streamlined Jam UI for Desktop.
 * Fits naturally as a modal card right over the expanded player or inside Settings.
 */
@Composable
internal fun DesktopListenTogetherDialog(autoplayEnabled: Boolean, onDismiss: () -> Unit) {
    val state by DesktopListenTogether.state.collectAsState()
    val activity by DesktopListenTogether.activity.collectAsState()
    val server by DesktopListenTogether.customServerUrl.collectAsState()
    val serverStatus by DesktopListenTogether.serverStatus.collectAsState()
    val localEndpoints by LocalJamDiscovery.activeLocalEndpoints.collectAsState()

    var preferLocal by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current

    var joinCodeInput by remember { mutableStateOf("") }
    var nickname by remember { mutableStateOf(DesktopListenTogether.nickname()) }
    var maxMembers by remember { mutableStateOf(5) }
    var serverDraft by remember { mutableStateOf(server) }
    var busy by remember { mutableStateOf(false) }
    var localError by remember { mutableStateOf<String?>(null) }
    var copyNotice by remember { mutableStateOf<String?>(null) }
    var showServerSettings by remember { mutableStateOf(false) }

    LaunchedEffect(server) {
        if (serverDraft == server || serverDraft.isBlank()) serverDraft = server
    }

    fun showToast(msg: String) {
        copyNotice = msg
        scope.launch {
            delay(2200)
            if (copyNotice == msg) copyNotice = null
        }
    }

    DesktopDialogPanel(onDismiss = onDismiss, maxWidth = 500) {
        Column(desktopPanelBody(cardMax = 720.dp, cardMin = 220.dp, fill = false)) {
            // Header: Raaga Jam title + close button
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(start = panelInset(20.dp), end = panelInset(16.dp), top = 18.dp, bottom = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(DesktopAccent.copy(alpha = 0.18f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Radio,
                        contentDescription = null,
                        tint = DesktopAccent,
                        modifier = Modifier.size(20.dp),
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        text = "Raaga Jam",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = Color.White,
                    )
                    Text(
                        text = if (state.inParty) "Synchronized playback with friends"
                               else "Listen together with friends in real-time",
                        style = MaterialTheme.typography.bodySmall,
                        color = DesktopSecondary,
                    )
                }
                if (!LocalDesktopPanelIsPage.current) {
                    IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Rounded.Close, "Close", tint = DesktopSecondary, modifier = Modifier.size(18.dp))
                    }
                }
            }

            DesktopCardRule()

            // Toast / Copy notification badge
            AnimatedVisibility(
                visible = copyNotice != null,
                enter = fadeIn(),
                exit = fadeOut(),
            ) {
                copyNotice?.let { notice ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = panelInset(20.dp), vertical = 6.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(EmeraldBg)
                            .border(1.dp, EmeraldGreen.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.Check, null, tint = EmeraldGreen, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(notice, color = EmeraldGreen, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        }
                    }
                }
            }

            // Error notice
            (localError ?: state.error)?.takeIf(String::isNotBlank)?.let { err ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = panelInset(20.dp), vertical = 6.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(DesktopDestructive.copy(alpha = 0.15f))
                        .border(1.dp, DesktopDestructive.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                ) {
                    Text(err, color = DesktopDestructive, fontSize = 13.sp)
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(
                    start = panelInset(20.dp),
                    end = panelInset(20.dp),
                    top = 14.dp,
                    bottom = 20.dp,
                ),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                if (state.inParty) {
                    // =========================================================
                    // IN PARTY: Active Jam Session with Generated 6-Digit Code
                    // =========================================================
                    item {
                        ActiveJamBanner(
                            state = state,
                            onCopyCode = {
                                clipboard.setText(AnnotatedString(state.code.orEmpty()))
                                showToast("Copied Jam Room Code: ${state.code.orEmpty()}")
                            },
                            onCopyLink = {
                                val url = DesktopListenTogether.inviteUrl(state.code.orEmpty())
                                clipboard.setText(AnnotatedString(url))
                                showToast("Copied Jam Invite Link!")
                            },
                        )
                    }

                    // Playing track / synchronized status
                    item {
                        JamPlaybackStatus(state = state)
                    }

                    // Members list
                    item {
                        JamMembersCard(state = state)
                    }

                    // Host governance controls (if host)
                    if (state.you?.isHost == true) {
                        item {
                            JamHostControls(state = state)
                        }
                    }

                    // Leave Jam button
                    item {
                        Button(
                            onClick = {
                                busy = true
                                scope.launch {
                                    DesktopListenTogether.leaveParty()
                                    busy = false
                                }
                            },
                            enabled = !busy,
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = DesktopDestructive.copy(alpha = 0.15f),
                                contentColor = DesktopDestructive,
                            ),
                            modifier = Modifier.fillMaxWidth().height(42.dp),
                        ) {
                            Text("Leave Jam", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                } else {
                    // =========================================================
                    // NOT IN PARTY: Local/Cloud Selector, 6-Digit Code, Start Jam
                    // =========================================================

                    // 1. Discovered Nearby Wi-Fi Jams (if any)
                    if (localEndpoints.isNotEmpty()) {
                        item {
                            NearbyJamsCard(
                                endpoints = localEndpoints.values.toList(),
                                busy = busy,
                                onJoin = { ep ->
                                    busy = true
                                    localError = null
                                    scope.launch {
                                        DesktopListenTogether.joinParty(ep.code, nickname, explicitServerUrl = ep.httpBase)
                                            .onFailure { localError = it.message }
                                        busy = false
                                    }
                                },
                            )
                        }
                    }

                    // 2. Start Jam Hero Card (Local vs Cloud Mode + Start Button)
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(Color.White.copy(alpha = 0.05f))
                                .border(0.5.dp, DesktopCardEdge, RoundedCornerShape(18.dp))
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(CircleShape)
                                        .background(DesktopAccent.copy(alpha = 0.15f)),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Groups,
                                        contentDescription = null,
                                        tint = DesktopAccent,
                                        modifier = Modifier.size(18.dp),
                                    )
                                }
                                Spacer(Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = "Start a Jam",
                                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                        color = Color.White,
                                    )
                                    Text(
                                        text = "Stream and sync music simultaneously with other devices",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = DesktopSecondary,
                                    )
                                }
                            }

                            // Hybrid Mode Selector (⚡ Local Wi-Fi vs ☁ Cloud Jam)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color.White.copy(alpha = 0.04f))
                                    .padding(4.dp),
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                JamModePill(
                                    selected = preferLocal,
                                    label = "⚡ Local Wi-Fi",
                                    icon = Icons.Rounded.Wifi,
                                    modifier = Modifier.weight(1f),
                                    onClick = { preferLocal = true },
                                )
                                JamModePill(
                                    selected = !preferLocal,
                                    label = "☁ Cloud Jam",
                                    icon = Icons.Rounded.Radio,
                                    modifier = Modifier.weight(1f),
                                    onClick = { preferLocal = false },
                                )
                            }

                            Text(
                                text = if (preferLocal) "⚡ Direct LAN sync • Zero data usage • <5ms instant sync"
                                       else "☁ Sync anywhere in the world over cellular & internet",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (preferLocal) EmeraldGreen else DesktopSecondary,
                                modifier = Modifier.padding(horizontal = 4.dp),
                            )

                            // Profile & Nickname row
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                PartyAvatar(DesktopListenTogether.myAvatarUrl(), 36, nickname)
                                Spacer(Modifier.width(10.dp))
                                OutlinedTextField(
                                    value = nickname,
                                    onValueChange = {
                                        nickname = it.take(60)
                                        DesktopListenTogether.setNickname(nickname)
                                    },
                                    label = { Text("Your Nickname", fontSize = 11.sp) },
                                    singleLine = true,
                                    modifier = Modifier.weight(1f),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = DesktopAccent,
                                        unfocusedBorderColor = DesktopCardEdge,
                                    ),
                                )
                                Spacer(Modifier.width(10.dp))
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("Size", style = MaterialTheme.typography.labelSmall, color = DesktopSecondary)
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Stepper("−", maxMembers > 2) { maxMembers = (maxMembers - 1).coerceAtLeast(2) }
                                        Text(
                                            text = "$maxMembers",
                                            modifier = Modifier.width(26.dp),
                                            textAlign = TextAlign.Center,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp,
                                        )
                                        Stepper("+", maxMembers < 10) { maxMembers = (maxMembers + 1).coerceAtMost(10) }
                                    }
                                }
                            }

                            // Start Jam Button
                            Button(
                                onClick = {
                                    busy = true
                                    localError = null
                                    scope.launch {
                                        val res = DesktopListenTogether.createParty(nickname, maxMembers, autoplayEnabled, preferLocal)
                                        busy = false
                                        if (res.isFailure) {
                                            localError = res.exceptionOrNull()?.message ?: "Failed to start Jam"
                                        } else {
                                            showToast("Jam created! Room code: ${res.getOrNull()}")
                                        }
                                    }
                                },
                                enabled = !busy,
                                shape = RoundedCornerShape(50),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = DesktopAccent,
                                    contentColor = Color.Black,
                                ),
                                modifier = Modifier.fillMaxWidth().height(44.dp),
                            ) {
                                if (busy) {
                                    CircularProgressIndicator(Modifier.size(18.dp), color = Color.Black, strokeWidth = 2.dp)
                                } else {
                                    Text(
                                        text = if (preferLocal) "⚡ Start Local Jam" else "☁ Start Cloud Jam",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                    )
                                }
                            }
                        }
                    }

                    // 3. Join with 6-Digit Code Card (Mobile-style input + instant join)
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(Color.White.copy(alpha = 0.05f))
                                .border(0.5.dp, DesktopCardEdge, RoundedCornerShape(18.dp))
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Text(
                                text = "Join with Code",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                color = Color.White,
                            )
                            Text(
                                text = "Enter 6-digit room code or paste an invite link",
                                style = MaterialTheme.typography.labelSmall,
                                color = DesktopSecondary,
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                // 6-digit styled text field with Paste / Clear icons
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(46.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color.White.copy(alpha = 0.07f))
                                        .border(
                                            1.dp,
                                            if (joinCodeInput.length == 6) DesktopAccent.copy(alpha = 0.6f) else DesktopCardEdge,
                                            RoundedCornerShape(12.dp),
                                        )
                                        .padding(horizontal = 12.dp),
                                    contentAlignment = Alignment.CenterStart,
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        BasicTextField(
                                            value = joinCodeInput,
                                            onValueChange = { input ->
                                                val parsed = JamInvite.parse(input)
                                                if (parsed != null) {
                                                    joinCodeInput = parsed
                                                } else {
                                                    joinCodeInput = input.filter(Char::isLetterOrDigit).take(6).uppercase()
                                                }
                                                localError = null
                                            },
                                            textStyle = TextStyle(
                                                color = Color.White,
                                                fontSize = 17.sp,
                                                fontWeight = FontWeight.Bold,
                                                letterSpacing = 4.sp,
                                            ),
                                            singleLine = true,
                                            cursorBrush = SolidColor(DesktopAccent),
                                            keyboardOptions = KeyboardOptions(
                                                capitalization = KeyboardCapitalization.Characters,
                                                imeAction = ImeAction.Done,
                                            ),
                                            keyboardActions = KeyboardActions(onDone = {
                                                if (joinCodeInput.length == 6 && !busy) {
                                                    busy = true
                                                    localError = null
                                                    scope.launch {
                                                        val res = DesktopListenTogether.joinParty(joinCodeInput, nickname)
                                                        busy = false
                                                        if (res.isFailure) {
                                                            localError = res.exceptionOrNull()?.message ?: "Failed to join Jam"
                                                        }
                                                    }
                                                }
                                            }),
                                            modifier = Modifier.weight(1f),
                                            decorationBox = { innerTextField ->
                                                if (joinCodeInput.isEmpty()) {
                                                    Text(
                                                        text = "6-DIGIT CODE",
                                                        style = TextStyle(
                                                            color = Color.White.copy(alpha = 0.35f),
                                                            fontSize = 14.sp,
                                                            letterSpacing = 2.sp,
                                                            fontWeight = FontWeight.Medium,
                                                        ),
                                                    )
                                                }
                                                innerTextField()
                                            },
                                        )

                                        if (joinCodeInput.isNotEmpty()) {
                                            IconButton(
                                                onClick = { joinCodeInput = "" },
                                                modifier = Modifier.size(28.dp),
                                            ) {
                                                Icon(
                                                    Icons.Rounded.Close,
                                                    contentDescription = "Clear",
                                                    tint = DesktopSecondary,
                                                    modifier = Modifier.size(16.dp),
                                                )
                                            }
                                        } else {
                                            IconButton(
                                                onClick = {
                                                    val clip = clipboard.getText()?.text?.trim()
                                                    if (!clip.isNullOrBlank()) {
                                                        val parsed = JamInvite.parse(clip)
                                                        joinCodeInput = parsed ?: clip.filter(Char::isLetterOrDigit).take(6).uppercase()
                                                        showToast("Pasted code: $joinCodeInput")
                                                    }
                                                },
                                                modifier = Modifier.size(28.dp),
                                            ) {
                                                Icon(
                                                    Icons.Rounded.ContentPaste,
                                                    contentDescription = "Paste from clipboard",
                                                    tint = DesktopAccent,
                                                    modifier = Modifier.size(16.dp),
                                                )
                                            }
                                        }
                                    }
                                }

                                Spacer(Modifier.width(10.dp))

                                Button(
                                    onClick = {
                                        busy = true
                                        localError = null
                                        scope.launch {
                                            val res = DesktopListenTogether.joinParty(joinCodeInput, nickname)
                                            busy = false
                                            if (res.isFailure) {
                                                localError = res.exceptionOrNull()?.message ?: "Failed to join Jam"
                                            }
                                        }
                                    },
                                    enabled = joinCodeInput.length == 6 && !busy,
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = DesktopAccent,
                                        contentColor = Color.Black,
                                        disabledContainerColor = Color.White.copy(alpha = 0.1f),
                                        disabledContentColor = Color.White.copy(alpha = 0.35f),
                                    ),
                                    modifier = Modifier.height(46.dp),
                                ) {
                                    if (busy) {
                                        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.Black)
                                    } else {
                                        Text("Join", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    }
                                }
                            }
                        }
                    }

                    // 4. Advanced Server Configuration (Collapsed by default)
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color.White.copy(alpha = 0.03f))
                                .padding(12.dp),
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { showServerSettings = !showServerSettings },
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Rounded.Settings, null, tint = DesktopSecondary, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(8.dp))
                                Text("Server Settings", style = MaterialTheme.typography.labelMedium, color = DesktopSecondary, modifier = Modifier.weight(1f))
                                Icon(
                                    if (showServerSettings) Icons.Rounded.KeyboardArrowUp else Icons.Rounded.KeyboardArrowDown,
                                    null,
                                    tint = DesktopSecondary,
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                            if (showServerSettings) {
                                Spacer(Modifier.height(10.dp))
                                DesktopSearchField(
                                    query = serverDraft,
                                    onQueryChange = { serverDraft = it },
                                    onSearch = {},
                                    placeholder = "Custom server URL (leave blank for built-in)",
                                )
                                Spacer(Modifier.height(8.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = serverStatusLine(serverStatus),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = DesktopSecondary,
                                        modifier = Modifier.weight(1f),
                                    )
                                    TextButton(onClick = DesktopListenTogether::refreshServerHealth) { Text("Test", fontSize = 12.sp) }
                                    Spacer(Modifier.width(4.dp))
                                    Button(
                                        onClick = {
                                            localError = null
                                            DesktopListenTogether.normalizeServerUrl(serverDraft)
                                                .onSuccess { normalized ->
                                                    DesktopListenTogether.setCustomServerUrl(normalized)
                                                        .onSuccess { serverDraft = normalized; showToast("Server saved") }
                                                        .onFailure { localError = it.message }
                                                }
                                                .onFailure { localError = it.message }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = DesktopCardInsetFill),
                                        shape = RoundedCornerShape(8.dp),
                                    ) {
                                        Text("Save", fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

@Composable
private fun JamModePill(
    selected: Boolean,
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val bg = if (selected) DesktopAccent.copy(alpha = 0.22f) else Color.Transparent
    val border = if (selected) DesktopAccent.copy(alpha = 0.55f) else Color.Transparent
    val textCol = if (selected) Color.White else DesktopSecondary

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 9.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (selected) DesktopAccent else DesktopSecondary,
                modifier = Modifier.size(15.dp),
            )
            Spacer(Modifier.width(6.dp))
            Text(
                text = label,
                fontSize = 12.sp,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                color = textCol,
            )
        }
    }
}

@Composable
private fun NearbyJamsCard(
    endpoints: List<LocalJamEndpoint>,
    busy: Boolean,
    onJoin: (LocalJamEndpoint) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(EmeraldBg)
            .border(1.dp, EmeraldGreen.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.Wifi, null, tint = EmeraldGreen, modifier = Modifier.size(17.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                text = "Nearby Jams on Your Wi-Fi",
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                color = Color.White,
            )
            Spacer(Modifier.weight(1f))
            Text("⚡ Direct LAN", style = MaterialTheme.typography.labelSmall, color = EmeraldGreen, fontWeight = FontWeight.Bold)
        }
        endpoints.forEach { ep ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White.copy(alpha = 0.08f))
                    .padding(horizontal = 12.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Room ${ep.code}", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
                    Text("Direct LAN Sync • ${ep.memberCount} of ${ep.maxMembers} listening", style = MaterialTheme.typography.labelSmall, color = EmeraldGreen)
                }
                Button(
                    onClick = { onJoin(ep) },
                    enabled = !busy,
                    shape = RoundedCornerShape(20.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = EmeraldGreen,
                        contentColor = Color.Black,
                    ),
                ) {
                    Text("Join", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }
    }
}

/**
 * In-Party Hero Card: displays the generated 6-digit room code with large letter spacing,
 * network badge (Local LAN vs Cloud), and instant Copy Code & Copy Link buttons.
 */
@Composable
private fun ActiveJamBanner(
    state: DesktopListenTogether.State,
    onCopyCode: () -> Unit,
    onCopyLink: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White.copy(alpha = 0.07f))
            .border(0.5.dp, DesktopCardEdge, RoundedCornerShape(18.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = "JAM ROOM CODE",
                    style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.sp),
                    color = DesktopSecondary,
                )
                Spacer(Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = state.code.orEmpty(),
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 5.sp,
                        ),
                        color = DesktopAccent,
                    )
                    Spacer(Modifier.width(10.dp))
                    Box(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(if (state.isLocalNetwork) EmeraldBg else DesktopAccent.copy(alpha = 0.20f))
                            .border(0.5.dp, if (state.isLocalNetwork) EmeraldGreen.copy(alpha = 0.5f) else DesktopAccent.copy(alpha = 0.5f), CircleShape)
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(if (state.isLocalNetwork) EmeraldGreen else DesktopAccent),
                            )
                            Spacer(Modifier.width(5.dp))
                            Text(
                                text = if (state.isLocalNetwork) "⚡ Local Wi-Fi (<5ms)" else "☁ Cloud Jam",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                                color = if (state.isLocalNetwork) EmeraldGreen else DesktopAccent,
                            )
                        }
                    }
                }
            }
        }

        // Action buttons: Copy Code + Copy Link
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Button(
                onClick = onCopyCode,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White.copy(alpha = 0.10f),
                    contentColor = Color.White,
                ),
                modifier = Modifier.weight(1f).height(38.dp),
            ) {
                Icon(Icons.Rounded.ContentCopy, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Copy Code", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }

            Button(
                onClick = onCopyLink,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White.copy(alpha = 0.10f),
                    contentColor = Color.White,
                ),
                modifier = Modifier.weight(1f).height(38.dp),
            ) {
                Icon(Icons.Rounded.Share, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Copy Link", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun JamPlaybackStatus(state: DesktopListenTogether.State) {
    val track = state.playback.track
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White.copy(alpha = 0.05f))
            .border(0.5.dp, DesktopCardEdge, RoundedCornerShape(16.dp))
            .padding(14.dp),
    ) {
        if (track == null) {
            Text("Nothing playing yet", color = DesktopSecondary, style = MaterialTheme.typography.bodyMedium)
            if (state.you?.isHost == true) {
                Text(
                    "Play any song on Raaga and everyone in the Jam will hear it instantly.",
                    color = DesktopSecondary.copy(alpha = 0.7f),
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                DesktopArtwork(track.thumbnailUrl, Modifier.size(48.dp).clip(RoundedCornerShape(8.dp)), px = 140)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(track.title, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color.White)
                    Text(track.artist, color = DesktopSecondary, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        connectionLine(state),
                        color = if (state.clockSynced) EmeraldGreen else DesktopAccent,
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }
        }
    }
}

@Composable
private fun JamMembersCard(state: DesktopListenTogether.State) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White.copy(alpha = 0.05f))
            .border(0.5.dp, DesktopCardEdge, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Members (${state.members.size}/${state.maxMembers})",
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                color = Color.White,
            )
        }
        state.members.forEach { member ->
            val isYou = member.memberId == state.you?.memberId
            val canKick = state.you?.isHost == true && !member.isHost

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White.copy(alpha = 0.03f))
                    .padding(horizontal = 10.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PartyAvatar(member.avatarUrl, 30, member.displayName)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = member.displayName.ifBlank { "Listener" },
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            color = Color.White,
                        )
                        if (isYou) {
                            Spacer(Modifier.width(6.dp))
                            Text("(You)", fontSize = 11.sp, color = DesktopAccent, fontWeight = FontWeight.Bold)
                        }
                    }
                    Text(
                        text = when {
                            member.isHost -> "Host 👑"
                            !member.connected -> "Away"
                            else -> "Connected"
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = if (member.isHost) DesktopAccent else DesktopSecondary,
                    )
                }
                if (canKick) {
                    IconButton(
                        onClick = { DesktopListenTogether.kick(member.memberId) },
                        modifier = Modifier.size(26.dp),
                    ) {
                        Icon(Icons.Rounded.RemoveCircleOutline, "Kick", tint = DesktopDestructive, modifier = Modifier.size(16.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun JamHostControls(state: DesktopListenTogether.State) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White.copy(alpha = 0.05f))
            .border(0.5.dp, DesktopCardEdge, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("HOST GOVERNANCE", style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.sp), color = DesktopSecondary)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(if (state.hostOnlyControl) Icons.Rounded.Lock else Icons.Rounded.LockOpen, null, tint = DesktopAccent, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("Only host controls playback", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Color.White)
                Text("Guests can still pause locally", style = MaterialTheme.typography.labelSmall, color = DesktopSecondary)
            }
            Switch(checked = state.hostOnlyControl, onCheckedChange = DesktopListenTogether::setHostOnlyControl)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Max Room Size", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Color.White)
                Text("Max participants allowed", style = MaterialTheme.typography.labelSmall, color = DesktopSecondary)
            }
            Stepper("−", state.maxMembers > maxOf(2, state.members.size)) { DesktopListenTogether.setMaxMembers(state.maxMembers - 1) }
            Text("${state.maxMembers}", modifier = Modifier.width(28.dp), textAlign = TextAlign.Center, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Stepper("+", state.maxMembers < 10) { DesktopListenTogether.setMaxMembers(state.maxMembers + 1) }
        }
    }
}

@Composable
private fun PartyAvatar(url: String?, size: Int, fallback: String = "") {
    if (url != null) {
        DesktopArtwork(url, Modifier.size(size.dp).clip(CircleShape), px = size * 3)
    } else {
        Box(
            Modifier
                .size(size.dp)
                .clip(CircleShape)
                .background(DesktopCardInsetFill)
                .border(0.5.dp, DesktopCardEdge, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            if (fallback.isNotBlank()) {
                Text(fallback.take(1).uppercase(), fontWeight = FontWeight.Bold, fontSize = (size * 0.4f).sp, color = Color.White)
            } else {
                Icon(Icons.Rounded.Person, null, tint = DesktopSecondary, modifier = Modifier.size((size * 0.55f).dp))
            }
        }
    }
}

@Composable
private fun Stepper(label: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .size(28.dp)
            .clip(CircleShape)
            .background(if (enabled) Color.White.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.04f))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = if (enabled) Color.White else DesktopSecondary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    }
}

@Composable
private fun connectionLine(state: DesktopListenTogether.State): String = when {
    state.connection == DesktopListenTogether.Connection.CONNECTING -> "Reconnecting…"
    state.connection == DesktopListenTogether.Connection.OFFLINE -> "Offline"
    !state.clockSynced -> "Syncing clocks…"
    else -> "⚡ In sync with ${state.members.size} listener(s) · ${state.roundTripMs}ms"
}

private fun serverStatusLine(status: DesktopListenTogether.ServerStatus): String = when {
    status.health == DesktopListenTogether.Health.CHECKING -> "Checking party server…"
    status.health == DesktopListenTogether.Health.OFFLINE -> "Party server offline"
    status.isFallback -> "Custom server offline · using built-in · ${status.latencyMs}ms"
    else -> "Party server online · ${status.latencyMs}ms"
}
