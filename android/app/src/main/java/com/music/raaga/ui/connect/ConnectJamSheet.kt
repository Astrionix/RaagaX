package com.music.raaga.ui.connect

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.rounded.VolumeOff
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.ArrowDownward
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material.icons.rounded.Bluetooth
import androidx.compose.material.icons.rounded.Cast
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.ContentPaste
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Headphones
import androidx.compose.material.icons.rounded.Laptop
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PhoneAndroid
import androidx.compose.material.icons.rounded.Radio
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Speaker
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material.icons.rounded.Usb
import androidx.compose.material.icons.rounded.Wifi
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.connect.ConnectDevice
import com.music.raaga.connect.ConnectDeviceManager
import com.music.raaga.connect.DeviceType
import com.music.raaga.connect.RaagaSyncClient
import com.music.raaga.connect.TransportKind
import com.music.raaga.data.listentogether.JamInviteLink
import com.music.raaga.data.listentogether.JamVotingManager
import com.music.raaga.data.listentogether.ListenTogether
import com.music.raaga.data.listentogether.PartyMember
import com.music.raaga.data.listentogether.PartyTrack
import com.music.raaga.data.listentogether.local.LocalJamDiscovery
import com.music.raaga.playback.AudioOutputStatus
import com.music.raaga.playback.AudioRouting
import com.music.raaga.ui.haptics.Haptic
import com.music.raaga.ui.haptics.rememberHaptics
import com.music.raaga.ui.player.PlayerDrawer
import com.music.raaga.ui.player.ROW_SHAPE
import com.music.raaga.ui.player.ThinSlider
import com.music.raaga.ui.player.rememberAudioOutputs
import dev.chrisbanes.haze.HazeState
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Groups
import com.music.raaga.data.model.Song
import com.music.raaga.ui.blend.BlendTabContent
import com.music.raaga.ui.social.FriendActivityTabContent
import java.util.Locale
import kotlin.math.roundToInt

enum class ConnectJamTab {
    DEVICES,
    JAM,
    BLEND,
    FRIENDS,
}

/**
 * Unified Connect & Jam Sheet — Combines Spotify Connect-style Device Switching
 * with RaagaX Jam social listening & collaborative queue voting, Spotify-style Blend,
 * and Live Friend Activity.
 */
@Composable
internal fun ConnectJamSheet(
    hazeState: HazeState,
    accountName: String?,
    initialTab: ConnectJamTab = ConnectJamTab.DEVICES,
    currentSong: Song? = null,
    currentPositionMs: Long = 0L,
    isPlaying: Boolean = false,
    myTracks: List<Song> = emptyList(),
    onPlaySong: (Song) -> Unit = {},
    onPlayQueue: (List<Song>, Int) -> Unit = { _, _ -> },
    onDismiss: () -> Unit,
    onOpenPipeline: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val haptics = rememberHaptics()
    val context = LocalContext.current
    var selectedTab by remember { mutableStateOf(initialTab) }
    val partyState by ListenTogether.state.collectAsStateWithLifecycle()

    DisposableEffect(Unit) {
        ConnectDeviceManager.startDiscovery(context)
        LocalJamDiscovery.startDiscovery(context)
        onDispose {
            ConnectDeviceManager.stopDiscovery()
            LocalJamDiscovery.stopDiscovery()
        }
    }

    PlayerDrawer(
        hazeState = hazeState,
        title = "",
        onDismiss = onDismiss,
        modifier = modifier,
    ) {
        // Tab Segment Switcher (Devices 🎧 vs Jam 👥 vs Blend ✨ vs Friends 👥)
        TabHeader(
            selectedTab = selectedTab,
            inParty = partyState.inParty,
            partyMemberCount = partyState.members.size,
            onTabSelected = { tab ->
                haptics.play(Haptic.Select)
                selectedTab = tab
            },
        )

        Spacer(Modifier.height(14.dp))

        when (selectedTab) {
            ConnectJamTab.DEVICES -> {
                DevicesTabContent(
                    accountName = accountName,
                    currentSong = currentSong,
                    currentPositionMs = currentPositionMs,
                    isPlaying = isPlaying,
                    onOpenPipeline = onOpenPipeline,
                    onSwitchToJam = {
                        haptics.play(Haptic.Select)
                        selectedTab = ConnectJamTab.JAM
                    },
                )
            }
            ConnectJamTab.JAM -> {
                JamTabContent(
                    partyState = partyState,
                    onDismiss = onDismiss,
                )
            }
            ConnectJamTab.BLEND -> {
                BlendTabContent(
                    myTracks = myTracks,
                    onPlayQueue = { tracks, idx ->
                        onPlayQueue(tracks, idx)
                        onDismiss()
                    },
                )
            }
            ConnectJamTab.FRIENDS -> {
                FriendActivityTabContent(
                    onPlaySong = { song ->
                        onPlaySong(song)
                        onDismiss()
                    },
                )
            }
        }
    }
}

@Composable
private fun TabHeader(
    selectedTab: ConnectJamTab,
    inParty: Boolean,
    partyMemberCount: Int,
    onTabSelected: (ConnectJamTab) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(CircleShape)
            .background(Color.White.copy(alpha = 0.08f))
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        TabButton(
            title = stringResource(R.string.connect_devices_tab),
            icon = Icons.Rounded.Headphones,
            isSelected = selectedTab == ConnectJamTab.DEVICES,
            modifier = Modifier.weight(1f),
            onClick = { onTabSelected(ConnectJamTab.DEVICES) },
        )

        TabButton(
            title = stringResource(R.string.connect_jam_tab),
            icon = Icons.Rounded.Radio,
            badge = if (inParty) partyMemberCount.toString() else null,
            isSelected = selectedTab == ConnectJamTab.JAM,
            modifier = Modifier.weight(1f),
            onClick = { onTabSelected(ConnectJamTab.JAM) },
        )

        TabButton(
            title = stringResource(R.string.connect_blend_tab),
            icon = Icons.Rounded.AutoAwesome,
            isSelected = selectedTab == ConnectJamTab.BLEND,
            modifier = Modifier.weight(1f),
            onClick = { onTabSelected(ConnectJamTab.BLEND) },
        )

        TabButton(
            title = stringResource(R.string.connect_friends_tab),
            icon = Icons.Rounded.Groups,
            isSelected = selectedTab == ConnectJamTab.FRIENDS,
            modifier = Modifier.weight(1f),
            onClick = { onTabSelected(ConnectJamTab.FRIENDS) },
        )
    }
}

@Composable
private fun TabButton(
    title: String,
    icon: ImageVector,
    isSelected: Boolean,
    badge: String? = null,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val bgAlpha by animateColorAsState(
        targetValue = if (isSelected) Color.White.copy(alpha = 0.16f) else Color.Transparent,
        animationSpec = spring(stiffness = Spring.StiffnessMediumLow),
        label = "tabBg",
    )

    Row(
        modifier = modifier
            .clip(CircleShape)
            .background(bgAlpha)
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (isSelected) Color.White else Color.White.copy(alpha = 0.6f),
            modifier = Modifier.size(17.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
            color = if (isSelected) Color.White else Color.White.copy(alpha = 0.6f),
        )
        if (badge != null) {
            Spacer(Modifier.width(6.dp))
            Box(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary)
                    .padding(horizontal = 6.dp, vertical = 2.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = badge,
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            }
        }
    }
}

// -----------------------------------------------------------------------------
// TAB 1: CONNECT TO DEVICE
// -----------------------------------------------------------------------------

@Composable
private fun DevicesTabContent(
    accountName: String?,
    currentSong: Song? = null,
    currentPositionMs: Long = 0L,
    isPlaying: Boolean = false,
    onOpenPipeline: () -> Unit,
    onSwitchToJam: () -> Unit,
) {
    val haptics = rememberHaptics()
    val context = LocalContext.current
    val manager = remember(context) { context.getSystemService(Context.AUDIO_SERVICE) as AudioManager }
    val localOutputs = rememberAudioOutputs()
    val networkDevices by ConnectDeviceManager.networkDevices.collectAsStateWithLifecycle()
    val activeId by ConnectDeviceManager.activeDeviceId.collectAsStateWithLifecycle()
    val isRemote by ConnectDeviceManager.isRemoteActive.collectAsStateWithLifecycle()
    val outputStatus by AudioOutputStatus.current.collectAsStateWithLifecycle()
    val isSyncConnected by RaagaSyncClient.isConnected.collectAsStateWithLifecycle()
    val activeServer by RaagaSyncClient.activeServerUrl.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Raaga Sync Coordinator Status Pill
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(Color.White.copy(alpha = 0.05f))
                .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(if (isSyncConnected) Color(0xFF22C55E) else Color(0xFFEAB308)),
                )
                Text(
                    text = if (isSyncConnected) "Raaga Sync: Connected" else "Raaga Sync: Connecting…",
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                    color = if (isSyncConnected) Color(0xFF4ADE80) else Color(0xFFFDE047),
                )
            }
            Text(
                text = activeServer.removePrefix("wss://").take(24),
                style = MaterialTheme.typography.labelSmall.copy(fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace),
                color = Color.White.copy(alpha = 0.45f),
            )
        }

        // 1. Current Active Target Card
        ActiveDeviceCard(
            isRemote = isRemote,
            activeName = if (isRemote) {
                networkDevices.firstOrNull { it.id == activeId }?.name ?: "Remote Device"
            } else {
                localOutputs.firstOrNull { it.isActive }?.name?.takeIf { it.isNotBlank() } ?: stringResource(R.string.connect_this_device)
            },
            spec = if (isRemote) {
                "Remote Playback · LAN Relay"
            } else {
                ConnectDeviceManager.formatLocalSpec(outputStatus)
            },
        )

        // 2. Volume Row
        VolumeSliderRow(
            manager = manager,
            isRemote = isRemote,
        )

        Spacer(Modifier.height(4.dp))

        // 3. Local Outputs List (Phone, Bluetooth, USB)
        Text(
            text = "This Device",
            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
            color = Color.White.copy(alpha = 0.5f),
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
        )

        localOutputs.forEach { device ->
            val isCurrent = !isRemote && device.isActive
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(ROW_SHAPE)
                    .background(Color.White.copy(alpha = if (isCurrent) 0.12f else 0.05f))
                    .clickable {
                        haptics.play(Haptic.Select)
                        AudioRouting.select(device.id)
                        ConnectDeviceManager.transferPlayback(
                            targetId = "this_device",
                            currentTrackId = currentSong?.videoId,
                            positionMs = currentPositionMs,
                            isPlaying = isPlaying,
                            title = currentSong?.title,
                            artist = currentSong?.artist,
                            thumbnailUrl = currentSong?.thumbnailUrl,
                        )
                    }
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = if (isCurrent) 0.18f else 0.08f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = iconForKind(device.kind),
                        contentDescription = null,
                        tint = if (isCurrent) Color.White else Color.White.copy(alpha = 0.7f),
                        modifier = Modifier.size(20.dp),
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        text = device.name.ifBlank { stringResource(R.string.connect_this_device) },
                        style = MaterialTheme.typography.bodyLarge,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = if (isCurrent) stringResource(R.string.audio_output_playing) else "Audio endpoint",
                        style = MaterialTheme.typography.labelMedium,
                        color = Color.White.copy(alpha = 0.5f),
                    )
                }
                if (isCurrent) {
                    Icon(
                        imageVector = Icons.Rounded.Check,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        }

        Spacer(Modifier.height(6.dp))

        // 4. Remote Cast & Connect Devices (Discovered Peers)
        Text(
            text = stringResource(R.string.connect_device_header),
            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
            color = Color.White.copy(alpha = 0.5f),
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
        )

        if (networkDevices.isEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(ROW_SHAPE)
                    .background(Color.White.copy(alpha = 0.04f))
                    .padding(horizontal = 14.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        text = "Searching for devices…",
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                        color = Color.White.copy(alpha = 0.85f),
                    )
                    Text(
                        text = "Make sure other devices are on the same Wi-Fi or running Raaga Sync",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White.copy(alpha = 0.5f),
                    )
                }
            }
        } else {
            networkDevices.forEach { peer ->
                val isCurrent = isRemote && activeId == peer.id
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(ROW_SHAPE)
                        .background(Color.White.copy(alpha = if (isCurrent) 0.14f else 0.05f))
                        .clickable {
                            haptics.play(Haptic.Select)
                            ConnectDeviceManager.transferPlayback(
                                targetId = peer.id,
                                currentTrackId = currentSong?.videoId,
                                positionMs = currentPositionMs,
                                isPlaying = isPlaying,
                                title = currentSong?.title,
                                artist = currentSong?.artist,
                                thumbnailUrl = currentSong?.thumbnailUrl,
                            )
                        }
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = if (isCurrent) 0.18f else 0.08f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = iconForDeviceType(peer.type),
                            contentDescription = null,
                            tint = if (isCurrent) Color.White else Color.White.copy(alpha = 0.7f),
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            text = peer.name,
                            style = MaterialTheme.typography.bodyLarge,
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = stringResource(R.string.connect_device_lan, peer.latencyMs ?: 15),
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.White.copy(alpha = 0.5f),
                        )
                    }
                    if (isCurrent) {
                        Icon(
                            imageVector = Icons.Rounded.Check,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(6.dp))

        // 5. Audio Pipeline Technical Link
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(ROW_SHAPE)
                .background(Color.White.copy(alpha = 0.04f))
                .clickable {
                    haptics.play(Haptic.Select)
                    onOpenPipeline()
                }
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Rounded.GraphicEq,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.7f),
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(12.dp))
            Text(
                text = stringResource(R.string.audio_pipeline),
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.85f),
                modifier = Modifier.weight(1f),
            )
            Icon(
                imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.35f),
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

@Composable
private fun ActiveDeviceCard(
    isRemote: Boolean,
    activeName: String,
    spec: String,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(ROW_SHAPE)
            .background(Color.White.copy(alpha = 0.08f))
            .border(1.dp, Color.White.copy(alpha = 0.15f), ROW_SHAPE)
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.20f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = if (isRemote) Icons.Rounded.Cast else Icons.Rounded.Speaker,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(22.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.connect_playing_on, activeName),
                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold),
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = spec,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.60f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun VolumeSliderRow(
    manager: AudioManager,
    isRemote: Boolean,
) {
    val remoteVol by ConnectDeviceManager.remoteVolume.collectAsStateWithLifecycle()
    var max by remember(manager) {
        mutableIntStateOf(manager.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1))
    }
    var localLevel by remember(manager) {
        mutableFloatStateOf(manager.getStreamVolume(AudioManager.STREAM_MUSIC).toFloat() / max)
    }
    var dragging by remember { mutableStateOf(false) }

    val currentLevel = if (isRemote) remoteVol else localLevel

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(ROW_SHAPE)
            .background(Color.White.copy(alpha = 0.05f))
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = if (currentLevel > 0f) Icons.AutoMirrored.Rounded.VolumeUp else Icons.AutoMirrored.Rounded.VolumeOff,
            contentDescription = null,
            tint = Color.White.copy(alpha = 0.6f),
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(12.dp))
        ThinSlider(
            value = currentLevel,
            onValueChange = {
                dragging = true
                if (isRemote) {
                    ConnectDeviceManager.setRemoteVolume(it)
                } else {
                    localLevel = it
                    manager.setStreamVolume(AudioManager.STREAM_MUSIC, (it * max).roundToInt(), 0)
                }
            },
            onValueChangeFinished = { dragging = false },
            idleHeight = 6.dp,
            activeHeight = 10.dp,
            modifier = Modifier.weight(1f),
        )
    }
}

// -----------------------------------------------------------------------------
// TAB 2: JAM SESSION & COLLABORATIVE VOTED QUEUE
// -----------------------------------------------------------------------------

@Composable
private fun JamTabContent(
    partyState: ListenTogether.State,
    onDismiss: () -> Unit,
) {
    val haptics = rememberHaptics()
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    val guestControlAllowed by JamVotingManager.guestControlAllowed.collectAsStateWithLifecycle()
    val guestQueueAllowed by JamVotingManager.guestQueueAllowed.collectAsStateWithLifecycle()
    val votes by JamVotingManager.votes.collectAsStateWithLifecycle()
    val localEndpoints by LocalJamDiscovery.activeLocalEndpoints.collectAsStateWithLifecycle()

    var joinCodeInput by remember { mutableStateOf("") }
    var isJoining by remember { mutableStateOf(false) }
    var isCreating by remember { mutableStateOf(false) }
    var preferLocal by remember { mutableStateOf(ListenTogether.isWifiConnected()) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (!partyState.inParty) {
            // Discovered Nearby Wi-Fi Jams
            if (localEndpoints.isNotEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(ROW_SHAPE)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f))
                        .border(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.35f), ROW_SHAPE)
                        .padding(14.dp),
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Rounded.Wifi,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(18.dp),
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = "Nearby Jams on Your Wi-Fi",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                color = Color.White,
                            )
                        }
                        localEndpoints.values.forEach { endpoint ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color.White.copy(alpha = 0.07f))
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        text = "Room ${endpoint.code}",
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                                        color = Color.White,
                                    )
                                    Text(
                                        text = "Direct LAN Sync • ⚡ <5ms latency",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.primary,
                                    )
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(CircleShape)
                                        .background(MaterialTheme.colorScheme.primary)
                                        .clickable(enabled = !isJoining) {
                                            haptics.play(Haptic.Select)
                                            isJoining = true
                                            coroutineScope.launch {
                                                val res = ListenTogether.joinParty(endpoint.code)
                                                isJoining = false
                                                if (res.isFailure) {
                                                    Toast.makeText(context, res.exceptionOrNull()?.message ?: "Failed to join", Toast.LENGTH_SHORT).show()
                                                }
                                            }
                                        }
                                        .padding(horizontal = 16.dp, vertical = 6.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        text = "Join",
                                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                        color = MaterialTheme.colorScheme.onPrimary,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // NOT IN PARTY: Landing & Join UI
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(ROW_SHAPE)
                    .background(Color.White.copy(alpha = 0.07f))
                    .padding(18.dp),
            ) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.20f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Radio,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(22.dp),
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                        Text(
                            text = stringResource(R.string.jam_start_hero_title),
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = stringResource(R.string.jam_start_hero_subtitle),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.65f),
                    )
                    Spacer(Modifier.height(14.dp))

                    // Hybrid Mode Selector (Local Wi-Fi vs Cloud Server)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White.copy(alpha = 0.05f))
                            .padding(3.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (preferLocal) MaterialTheme.colorScheme.primary.copy(alpha = 0.25f) else Color.Transparent)
                                .border(
                                    1.dp,
                                    if (preferLocal) MaterialTheme.colorScheme.primary.copy(alpha = 0.5f) else Color.Transparent,
                                    RoundedCornerShape(10.dp),
                                )
                                .clickable {
                                    haptics.play(Haptic.Select)
                                    preferLocal = true
                                }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Rounded.Wifi,
                                    contentDescription = null,
                                    tint = if (preferLocal) MaterialTheme.colorScheme.primary else Color.White.copy(alpha = 0.5f),
                                    modifier = Modifier.size(15.dp),
                                )
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    text = "⚡ Local Wi-Fi",
                                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = if (preferLocal) FontWeight.Bold else FontWeight.Normal),
                                    color = if (preferLocal) Color.White else Color.White.copy(alpha = 0.6f),
                                )
                            }
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (!preferLocal) MaterialTheme.colorScheme.primary.copy(alpha = 0.25f) else Color.Transparent)
                                .border(
                                    1.dp,
                                    if (!preferLocal) MaterialTheme.colorScheme.primary.copy(alpha = 0.5f) else Color.Transparent,
                                    RoundedCornerShape(10.dp),
                                )
                                .clickable {
                                    haptics.play(Haptic.Select)
                                    preferLocal = false
                                }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Rounded.Radio,
                                    contentDescription = null,
                                    tint = if (!preferLocal) MaterialTheme.colorScheme.primary else Color.White.copy(alpha = 0.5f),
                                    modifier = Modifier.size(15.dp),
                                )
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    text = "☁ Cloud Server",
                                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = if (!preferLocal) FontWeight.Bold else FontWeight.Normal),
                                    color = if (!preferLocal) Color.White else Color.White.copy(alpha = 0.6f),
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = if (preferLocal) "Direct LAN sync • Zero data usage • <5ms instant sync"
                               else "Sync anywhere in the world over cellular & internet",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (preferLocal) MaterialTheme.colorScheme.primary.copy(alpha = 0.9f) else Color.White.copy(alpha = 0.55f),
                    )
                    Spacer(Modifier.height(14.dp))

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary)
                            .clickable(enabled = !isCreating) {
                                isCreating = true
                                haptics.play(Haptic.Tap)
                                coroutineScope.launch {
                                    val result = ListenTogether.createParty(preferLocal = preferLocal)
                                    isCreating = false
                                    if (result.isFailure) {
                                        Toast.makeText(
                                            context,
                                            result.exceptionOrNull()?.message ?: "Failed to start Jam",
                                            Toast.LENGTH_SHORT,
                                        ).show()
                                    }
                                }
                            }
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (isCreating && partyState.connection == ListenTogether.Connection.CONNECTING) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp,
                            )
                        } else {
                            Text(
                                text = stringResource(R.string.jam_start_btn),
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.onPrimary,
                            )
                        }
                    }
                }
            }

            // Join with Code Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(ROW_SHAPE)
                    .background(Color.White.copy(alpha = 0.05f))
                    .padding(14.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    BasicTextField(
                        value = joinCodeInput,
                        onValueChange = { input ->
                            val code = JamInviteLink.parse(input) ?: input.filter { it.isLetterOrDigit() }.take(6).uppercase()
                            joinCodeInput = code
                        },
                        textStyle = TextStyle(
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 2.sp,
                        ),
                        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                        keyboardOptions = KeyboardOptions(
                            capitalization = KeyboardCapitalization.Characters,
                            imeAction = ImeAction.Done,
                        ),
                        keyboardActions = KeyboardActions(onDone = {
                            if (joinCodeInput.length == 6 && !isJoining) {
                                isJoining = true
                                coroutineScope.launch {
                                    val result = ListenTogether.joinParty(joinCodeInput)
                                    isJoining = false
                                    if (result.isFailure) {
                                        Toast.makeText(
                                            context,
                                            result.exceptionOrNull()?.message ?: "Failed to join Jam",
                                            Toast.LENGTH_SHORT,
                                        ).show()
                                    }
                                }
                            }
                        }),
                        modifier = Modifier.weight(1f),
                        decorationBox = { innerTextField ->
                            if (joinCodeInput.isEmpty()) {
                                Text(
                                    text = stringResource(R.string.jam_enter_code_hint),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Color.White.copy(alpha = 0.4f),
                                )
                            }
                            innerTextField()
                        },
                    )

                    if (joinCodeInput.isNotEmpty()) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .clickable { joinCodeInput = "" },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Close,
                                contentDescription = "Clear",
                                tint = Color.White.copy(alpha = 0.6f),
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .clickable {
                                    val clip = clipboard.getText()?.text?.trim()
                                    if (!clip.isNullOrBlank()) {
                                        val code = JamInviteLink.parse(clip) ?: clip.filter { it.isLetterOrDigit() }.take(6).uppercase()
                                        joinCodeInput = code
                                    }
                                },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.ContentPaste,
                                contentDescription = "Paste",
                                tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.85f),
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    }

                    Spacer(Modifier.width(8.dp))

                    Box(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(
                                if (joinCodeInput.length == 6) MaterialTheme.colorScheme.primary
                                else Color.White.copy(alpha = 0.1f),
                            )
                            .clickable(enabled = joinCodeInput.length == 6 && !isJoining) {
                                haptics.play(Haptic.Select)
                                isJoining = true
                                coroutineScope.launch {
                                    val result = ListenTogether.joinParty(joinCodeInput)
                                    isJoining = false
                                    if (result.isFailure) {
                                        Toast.makeText(
                                            context,
                                            result.exceptionOrNull()?.message ?: "Failed to join Jam",
                                            Toast.LENGTH_SHORT,
                                        ).show()
                                    }
                                }
                            }
                            .padding(horizontal = 18.dp, vertical = 10.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = stringResource(R.string.jam_join_btn),
                            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                            color = if (joinCodeInput.length == 6) MaterialTheme.colorScheme.onPrimary else Color.White.copy(alpha = 0.4f),
                        )
                    }
                }
            }
        } else {
            // IN PARTY: Active Session & Collaborative Voted Queue
            val isHost = partyState.you?.isHost == true

            // 1. Room Code & Share Banner
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(ROW_SHAPE)
                    .background(Color.White.copy(alpha = 0.08f))
                    .padding(14.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            text = "Jam Room Code",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White.copy(alpha = 0.5f),
                        )
                        Spacer(Modifier.height(2.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = partyState.code.orEmpty(),
                                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 3.sp),
                                color = MaterialTheme.colorScheme.primary,
                            )
                            Spacer(Modifier.width(10.dp))
                            Box(
                                modifier = Modifier
                                    .clip(CircleShape)
                                    .background(
                                        if (partyState.isLocalNetwork) Color(0xFF00E676).copy(alpha = 0.20f)
                                        else MaterialTheme.colorScheme.primary.copy(alpha = 0.20f)
                                    )
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(6.dp)
                                            .clip(CircleShape)
                                            .background(if (partyState.isLocalNetwork) Color(0xFF00E676) else MaterialTheme.colorScheme.primary),
                                    )
                                    Spacer(Modifier.width(5.dp))
                                    Text(
                                        text = if (partyState.isLocalNetwork) "⚡ Local Wi-Fi (<5ms)" else "☁ Cloud Jam",
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                                        color = if (partyState.isLocalNetwork) Color(0xFF00E676) else MaterialTheme.colorScheme.primary,
                                    )
                                }
                            }
                        }
                    }

                    // Copy Code Button
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.10f))
                            .clickable {
                                haptics.play(Haptic.Tap)
                                clipboard.setText(AnnotatedString(partyState.code.orEmpty()))
                                Toast.makeText(context, "Copied party code", Toast.LENGTH_SHORT).show()
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.ContentCopy,
                            contentDescription = "Copy code",
                            tint = Color.White,
                            modifier = Modifier.size(18.dp),
                        )
                    }

                    Spacer(Modifier.width(8.dp))

                    // Share Link Button
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.10f))
                            .clickable {
                                haptics.play(Haptic.Tap)
                                val inviteUrl = JamInviteLink.url(partyState.code.orEmpty())
                                val intent = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_TEXT, "Join my Jam session on Raaga: $inviteUrl")
                                }
                                context.startActivity(Intent.createChooser(intent, "Share Jam Invite"))
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Share,
                            contentDescription = "Share",
                            tint = Color.White,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            }

            // 2. Members Row
            Text(
                text = "Members (${partyState.members.size})",
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                color = Color.White.copy(alpha = 0.5f),
                modifier = Modifier.padding(horizontal = 4.dp),
            )

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                items(partyState.members) { member ->
                    MemberBadge(member = member, isYou = member.memberId == partyState.you?.memberId)
                }
            }

            // 3. Host Governance Controls (if host)
            if (isHost) {
                Spacer(Modifier.height(4.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(ROW_SHAPE)
                        .background(Color.White.copy(alpha = 0.05f))
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = stringResource(R.string.jam_guest_control_label),
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.White,
                        )
                        Switch(
                            checked = guestControlAllowed,
                            onCheckedChange = {
                                haptics.play(Haptic.Select)
                                JamVotingManager.setGuestControlAllowed(it)
                            },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = MaterialTheme.colorScheme.primary,
                            ),
                        )
                    }
                }
            }

            Spacer(Modifier.height(4.dp))

            // 4. Collaborative Social Voted Queue
            Text(
                text = stringResource(R.string.jam_queue_voted_title),
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                color = Color.White.copy(alpha = 0.5f),
                modifier = Modifier.padding(horizontal = 4.dp),
            )

            val upcomingTracks = partyState.queue.items.drop(partyState.queue.index.coerceAtLeast(0) + 1)
            if (upcomingTracks.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(ROW_SHAPE)
                        .background(Color.White.copy(alpha = 0.04f))
                        .padding(20.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = stringResource(R.string.jam_empty_queue),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.45f),
                        textAlign = TextAlign.Center,
                    )
                }
            } else {
                upcomingTracks.forEach { track ->
                    JamVotedQueueRow(
                        track = track,
                        userId = partyState.you?.userId ?: "local",
                        score = JamVotingManager.getScore(track.videoId),
                        hasUpvoted = JamVotingManager.hasUpvoted(partyState.you?.userId ?: "local", track.videoId),
                        hasDownvoted = JamVotingManager.hasDownvoted(partyState.you?.userId ?: "local", track.videoId),
                        addedBy = JamVotingManager.getAddedByName(track.videoId),
                        onUpvote = {
                            haptics.play(Haptic.Select)
                            JamVotingManager.toggleUpvote(partyState.you?.userId ?: "local", track.videoId)
                        },
                        onDownvote = {
                            haptics.play(Haptic.Select)
                            JamVotingManager.toggleDownvote(partyState.you?.userId ?: "local", track.videoId)
                        },
                    )
                }
            }

            Spacer(Modifier.height(6.dp))

            // Leave Party Action
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(CircleShape)
                    .background(Color.Red.copy(alpha = 0.15f))
                    .clickable {
                        haptics.play(Haptic.Tap)
                        coroutineScope.launch {
                            ListenTogether.leaveParty()
                            onDismiss()
                        }
                    }
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = stringResource(R.string.listen_together_leave),
                    style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                    color = Color(0xFFFF5252),
                )
            }
        }
    }
}

@Composable
private fun MemberBadge(member: PartyMember, isYou: Boolean) {
    Row(
        modifier = Modifier
            .clip(CircleShape)
            .background(Color.White.copy(alpha = if (isYou) 0.15f else 0.07f))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (member.avatarUrl != null) {
            AsyncImage(
                model = member.avatarUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(24.dp)
                    .clip(CircleShape),
            )
        } else {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Rounded.Person,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(14.dp),
                )
            }
        }
        Spacer(Modifier.width(6.dp))
        Text(
            text = member.displayName.ifBlank { "Member" } + if (isYou) " (You)" else "",
            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
            color = Color.White,
        )
        if (member.isHost) {
            Spacer(Modifier.width(4.dp))
            Text(text = "👑", fontSize = 11.sp)
        }
    }
}

@Composable
private fun JamVotedQueueRow(
    track: PartyTrack,
    userId: String,
    score: Int,
    hasUpvoted: Boolean,
    hasDownvoted: Boolean,
    addedBy: String?,
    onUpvote: () -> Unit,
    onDownvote: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(ROW_SHAPE)
            .background(Color.White.copy(alpha = 0.05f))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (track.thumbnailUrl != null) {
            AsyncImage(
                model = track.thumbnailUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(8.dp)),
            )
        } else {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color.White.copy(alpha = 0.08f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Rounded.MusicNote,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.6f),
                    modifier = Modifier.size(20.dp),
                )
            }
        }

        Spacer(Modifier.width(12.dp))

        Column(Modifier.weight(1f)) {
            Text(
                text = track.title,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = track.artist + (if (!addedBy.isNullOrBlank()) " • Added by $addedBy" else ""),
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.5f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        Spacer(Modifier.width(8.dp))

        // Voting Controls: Upvote (▲) | Score Chip | Downvote (▼)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.08f))
                .padding(horizontal = 4.dp, vertical = 2.dp),
        ) {
            // Upvote Button
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(if (hasUpvoted) Color(0xFF4CAF50).copy(alpha = 0.25f) else Color.Transparent)
                    .clickable(onClick = onUpvote),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Rounded.ArrowUpward,
                    contentDescription = "Upvote",
                    tint = if (hasUpvoted) Color(0xFF4CAF50) else Color.White.copy(alpha = 0.5f),
                    modifier = Modifier.size(15.dp),
                )
            }

            // Score Chip
            Text(
                text = (if (score > 0) "+$score" else "$score"),
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 11.sp),
                color = when {
                    score > 0 -> Color(0xFF4CAF50)
                    score < 0 -> Color(0xFFFF5252)
                    else -> Color.White.copy(alpha = 0.7f)
                },
                modifier = Modifier.padding(horizontal = 6.dp),
            )

            // Downvote Button
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(if (hasDownvoted) Color(0xFFFF5252).copy(alpha = 0.25f) else Color.Transparent)
                    .clickable(onClick = onDownvote),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Rounded.ArrowDownward,
                    contentDescription = "Downvote",
                    tint = if (hasDownvoted) Color(0xFFFF5252) else Color.White.copy(alpha = 0.5f),
                    modifier = Modifier.size(15.dp),
                )
            }
        }
    }
}

// -----------------------------------------------------------------------------
// HELPERS & ICON MAPPINGS
// -----------------------------------------------------------------------------

private fun iconForKind(kind: AudioRouting.Kind): ImageVector = when (kind) {
    AudioRouting.Kind.PHONE -> Icons.Rounded.PhoneAndroid
    AudioRouting.Kind.WIRED -> Icons.Rounded.Headphones
    AudioRouting.Kind.USB -> Icons.Rounded.Usb
    AudioRouting.Kind.BLUETOOTH -> Icons.Rounded.Bluetooth
    AudioRouting.Kind.HDMI -> Icons.Rounded.Tv
    AudioRouting.Kind.OTHER -> Icons.Rounded.Speaker
}

private fun iconForDeviceType(type: DeviceType): ImageVector = when (type) {
    DeviceType.PHONE -> Icons.Rounded.PhoneAndroid
    DeviceType.TABLET -> Icons.Rounded.PhoneAndroid
    DeviceType.COMPUTER -> Icons.Rounded.Laptop
    DeviceType.TV -> Icons.Rounded.Tv
    DeviceType.SPEAKER -> Icons.Rounded.Speaker
    DeviceType.HEADPHONES -> Icons.Rounded.Headphones
}
