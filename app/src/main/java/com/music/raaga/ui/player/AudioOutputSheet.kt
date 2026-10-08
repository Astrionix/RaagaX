package com.music.raaga.ui.player

import android.content.Context
import android.media.AudioManager
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.rounded.VolumeOff
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Bluetooth
import androidx.compose.material.icons.rounded.Cast
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Headphones
import androidx.compose.material.icons.rounded.Key
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PhoneAndroid
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Speaker
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material.icons.rounded.Usb
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.R
import com.music.raaga.data.connect.AndroidConnect
import com.music.raaga.data.connect.ConnectDevice
import com.music.raaga.data.connect.ConnectDeviceType
import com.music.raaga.data.connect.PairedDeviceWithStatus
import com.music.raaga.data.connect.RaagaConnectManager
import com.music.raaga.playback.AudioOutputStatus
import com.music.raaga.playback.AudioRouting
import com.music.raaga.ui.haptics.Haptic
import com.music.raaga.ui.haptics.rememberHaptics
import dev.chrisbanes.haze.HazeState
import kotlinx.coroutines.delay
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Where the music is coming out, and how loud.
 *
 * Replaces two things that did not work. On Android 14 and up the headphones
 * glyph opened the *system* output switcher — a panel this app does not control,
 * styled like nothing else here, and one that routes the whole phone rather than
 * this player. Below that it opened a stock [android.app.AlertDialog] driven by
 * [android.media.MediaRouter], whose `selectRoute` is a request the framework is
 * free to ignore, and usually did.
 *
 * This one switches by telling our own player which sink to render into, which
 * is the only routing decision the app owns and the one that actually takes
 * effect — see [AudioRouting].
 *
 * A [PlayerDrawer] off the bottom edge, as the rest of the app's sheets are.
 * Outputs come first and volume follows. Every available device stays visible:
 * on a phone there are usually two, so a disclosure would cost a tap merely to
 * reveal a single row.
 */
@Composable
internal fun AudioOutputSheet(
    hazeState: HazeState,
    accountName: String?,
    onDismiss: () -> Unit,
    onOpenPipeline: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val manager = remember(context) {
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }
    val outputs = rememberAudioOutputs()

    PlayerDrawer(
        hazeState = hazeState,
        title = stringResource(R.string.connect_to_device),
        onDismiss = onDismiss,
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Raaga Connect: 2-way Spotify Connect style device handoff & remote control
            val connectManager = AndroidConnect.manager
            val activeRemote by connectManager.activeRemoteDevice.collectAsStateWithLifecycle()

            LaunchedEffect(Unit) {
                connectManager.refreshDiscovery()
            }

            RaagaConnectSection(
                connectManager = connectManager,
                activeRemote = activeRemote,
            )

            HorizontalDivider(
                thickness = 1.dp,
                color = Color.White.copy(alpha = 0.08f),
                modifier = Modifier.padding(vertical = 2.dp),
            )

            // Local phone audio routing
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = stringResource(R.string.audio_output).uppercase(Locale.ROOT),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color.White.copy(alpha = 0.5f),
                    letterSpacing = 1.2.sp,
                    modifier = Modifier.padding(horizontal = 2.dp),
                )

                outputs.forEach { device ->
                    OutputRow(
                        device = device,
                        accountName = accountName,
                        onSelect = { AudioRouting.select(device.id) },
                    )
                }

                VolumeRow(manager, routeKey = outputs)

                AudioPipelineRow(onClick = onOpenPipeline)
            }
        }
    }
}

/**
 * Drills into [com.music.raaga.ui.components.AudioPipelineDialog] — the
 * subtitle is the negotiated output itself, read live off
 * [AudioOutputStatus], so the row states what's actually leaving the phone
 * before anyone taps in for the rest of the chain.
 */
@Composable
private fun AudioPipelineRow(onClick: () -> Unit) {
    val haptics = rememberHaptics()
    val outputStatus by AudioOutputStatus.current.collectAsStateWithLifecycle()
    val subtitle = remember(outputStatus) { outputSummary(outputStatus) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(ROW_SHAPE)
            .background(Color.White.copy(alpha = 0.05f))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
            ) {
                haptics.play(Haptic.Select)
                onClick()
            }
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.08f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Rounded.GraphicEq,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.7f),
                modifier = Modifier.size(20.dp),
            )
        }
        Spacer(Modifier.width(13.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = stringResource(R.string.audio_pipeline),
                style = MaterialTheme.typography.bodyLarge,
                color = Color.White.copy(alpha = 0.85f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelMedium,
                color = Color.White.copy(alpha = 0.55f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Icon(
            imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
            contentDescription = null,
            tint = Color.White.copy(alpha = 0.35f),
            modifier = Modifier.size(20.dp),
        )
    }
}

/** "24-bit PCM · 48 kHz" — whichever of encoding and rate are actually known yet. */
private fun outputSummary(status: AudioOutputStatus.Snapshot): String {
    val encoding = AudioOutputStatus.encodingLabel(status)
    val rate = status.actualSampleRateHz?.takeIf { it > 0 } ?: return encoding
    val khz = "%.1f".format(Locale.ROOT, rate / 1000f).removeSuffix(".0")
    return "$encoding · $khz kHz"
}

/**
 * One output. The playing one is lit and says so; the rest are there to be
 * tapped.
 */
@Composable
private fun OutputRow(
    device: AudioRouting.Device,
    accountName: String?,
    onSelect: () -> Unit,
) {
    val haptics = rememberHaptics()
    val active = device.isActive
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(ROW_SHAPE)
            .background(Color.White.copy(alpha = if (active) 0.10f else 0.05f))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                enabled = !active,
            ) {
                haptics.play(Haptic.Select)
                onSelect()
            }
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = if (active) 0.16f else 0.08f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = iconFor(device.kind),
                contentDescription = null,
                tint = Color.White.copy(alpha = if (active) 1f else 0.7f),
                modifier = Modifier.size(21.dp),
            )
        }
        Spacer(Modifier.width(13.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = outputLabel(device, accountName),
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                ),
                color = Color.White.copy(alpha = if (active) 1f else 0.85f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (active) {
                Spacer(Modifier.height(2.dp))
                Text(
                    text = stringResource(R.string.audio_output_playing),
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.White.copy(alpha = 0.55f),
                )
            }
        }
        if (active) {
            Icon(
                imageVector = Icons.Rounded.Check,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

/**
 * The phone's media volume, on the player's own slider rather than Material's.
 *
 * Two things move it, and only one of them announces itself. The hardware keys
 * broadcast `VOLUME_CHANGED_ACTION`, which is easy. A *route* change does not:
 * Android keeps one media volume index per output and silently swaps which one
 * is in force, so the number behind this bar changes with no event at all. Read
 * once at composition, as this was, the bar went on showing the level of the
 * device the listener had just moved away from.
 *
 * So [routeKey] — the outputs and the current choice — re-reads it, and re-reads
 * it again a beat later, because the framework swaps the index a moment after
 * the device list changes rather than in the same breath.
 */
@Composable
private fun VolumeRow(manager: AudioManager, routeKey: Any) {
    var max by remember(manager) {
        mutableIntStateOf(manager.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1))
    }
    var level by remember(manager) {
        mutableFloatStateOf(manager.getStreamVolume(AudioManager.STREAM_MUSIC).toFloat() / max)
    }
    var dragging by remember { mutableStateOf(false) }
    val context = LocalContext.current

    LaunchedEffect(routeKey) {
        repeat(VOLUME_REREADS) {
            // Never over a finger: the listener's own drag is the one source
            // of truth this must not fight.
            if (!dragging) {
                max = manager.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
                level = manager.getStreamVolume(AudioManager.STREAM_MUSIC).toFloat() / max
            }
            delay(VOLUME_REREAD_GAP_MS)
        }
    }

    DisposableEffect(manager) {
        val receiver = object : android.content.BroadcastReceiver() {
            override fun onReceive(context: Context, intent: android.content.Intent) {
                if (dragging) return
                level = manager.getStreamVolume(AudioManager.STREAM_MUSIC).toFloat() / max
            }
        }
        val filter = android.content.IntentFilter(VOLUME_CHANGED_ACTION)
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(receiver, filter)
        }
        onDispose { runCatching { context.unregisterReceiver(receiver) } }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(ROW_SHAPE)
            .background(Color.White.copy(alpha = 0.05f))
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = if (level > 0f) Icons.AutoMirrored.Rounded.VolumeUp else Icons.AutoMirrored.Rounded.VolumeOff,
            contentDescription = null,
            tint = Color.White.copy(alpha = 0.6f),
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(12.dp))
        ThinSlider(
            value = level,
            onValueChange = {
                dragging = true
                level = it
                manager.setStreamVolume(AudioManager.STREAM_MUSIC, (it * max).roundToInt(), 0)
            },
            onValueChangeFinished = { dragging = false },
            idleHeight = 6.dp,
            activeHeight = 10.dp,
            modifier = Modifier.weight(1f),
        )
    }
}

private fun iconFor(kind: AudioRouting.Kind): ImageVector = when (kind) {
    AudioRouting.Kind.PHONE -> Icons.Rounded.PhoneAndroid
    AudioRouting.Kind.WIRED -> Icons.Rounded.Headphones
    AudioRouting.Kind.USB -> Icons.Rounded.Usb
    AudioRouting.Kind.BLUETOOTH -> Icons.Rounded.Bluetooth
    AudioRouting.Kind.HDMI -> Icons.Rounded.Tv
    AudioRouting.Kind.OTHER -> Icons.Rounded.Speaker
}

/** Not in the SDK as a constant, but this is the action AudioManager broadcasts. */
private const val VOLUME_CHANGED_ACTION = "android.media.VOLUME_CHANGED_ACTION"

/** How many times the level is re-read after a route change, and how far apart. */
private const val VOLUME_REREADS = 4
private const val VOLUME_REREAD_GAP_MS = 250L

private val ConnectGreen = Color(0xFF1DB954)

@Composable
private fun RaagaConnectSection(
    connectManager: RaagaConnectManager,
    activeRemote: ConnectDevice?,
    modifier: Modifier = Modifier,
) {
    val haptics = rememberHaptics()
    val clipboardManager = LocalClipboardManager.current
    val remoteStatus by connectManager.remoteStatus.collectAsStateWithLifecycle()
    val pairedDevicesWithStatus by connectManager.pairedDevicesWithStatus.collectAsStateWithLifecycle()
    val unpairedDevices by connectManager.unpairedDiscoveredDevices.collectAsStateWithLifecycle()
    val activePairCode by connectManager.activePairCode.collectAsStateWithLifecycle()
    val pairingFeedback by connectManager.pairingFeedback.collectAsStateWithLifecycle()
    val isPairingSubmitting by connectManager.isPairingSubmitting.collectAsStateWithLifecycle()
    val localDeviceName by connectManager.currentDeviceName.collectAsStateWithLifecycle()
    val connectingDeviceId by connectManager.connectingDeviceId.collectAsStateWithLifecycle()

    var showPairingCard by remember { mutableStateOf(false) }
    var pairTab by remember { mutableIntStateOf(0) } // 0 = Show Code, 1 = Enter Code
    var enteredCode by remember { mutableStateOf("") }
    var copiedToast by remember { mutableStateOf(false) }

    var isEditingName by remember { mutableStateOf(false) }
    var editedName by remember(localDeviceName) { mutableStateOf(localDeviceName) }

    LaunchedEffect(copiedToast) {
        if (copiedToast) {
            delay(2000L)
            copiedToast = false
        }
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // 1. ACTIVE REMOTE CONTROLLER CARD OR CURRENT LOCAL DEVICE CARD
        if (activeRemote != null) {
            val remote = activeRemote
            Text(
                text = "CURRENTLY PLAYING ON",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.5f),
                letterSpacing = 1.2.sp,
                modifier = Modifier.padding(horizontal = 2.dp),
            )
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(ROW_SHAPE)
                    .background(ConnectGreen.copy(alpha = 0.14f))
                    .border(1.dp, ConnectGreen.copy(alpha = 0.35f), ROW_SHAPE)
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(ConnectGreen),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = when (remote.type) {
                                ConnectDeviceType.PHONE -> Icons.Rounded.PhoneAndroid
                                ConnectDeviceType.DESKTOP -> Icons.Rounded.Tv
                                ConnectDeviceType.SPEAKER -> Icons.Rounded.Speaker
                            },
                            contentDescription = null,
                            tint = Color.Black,
                            modifier = Modifier.size(22.dp),
                        )
                    }

                    Spacer(Modifier.width(12.dp))

                    Column(Modifier.weight(1f)) {
                        Text(
                            text = remote.name,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        val trackInfo = remoteStatus?.track
                        val subText = if (trackInfo != null) {
                            "${trackInfo.title} • ${trackInfo.artist}"
                        } else {
                            "Remote playback active"
                        }
                        Text(
                            text = subText,
                            style = MaterialTheme.typography.labelMedium,
                            color = ConnectGreen,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    // Play / Pause toggle
                    val isPlaying = remoteStatus?.isPlaying ?: true
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.15f))
                            .clickable {
                                haptics.play(Haptic.Select)
                                connectManager.sendToggle()
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }

                // Switch back button
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.12f))
                        .clickable {
                            haptics.play(Haptic.Select)
                            connectManager.transferBackToThisDevice()
                        }
                        .padding(vertical = 9.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Play on this phone instead",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White,
                    )
                }
            }
        } else {
            // CURRENT LOCAL DEVICE CARD
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(ROW_SHAPE)
                    .background(Color.White.copy(alpha = 0.05f))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(ConnectGreen.copy(alpha = 0.18f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.PhoneAndroid,
                        contentDescription = null,
                        tint = ConnectGreen,
                        modifier = Modifier.size(22.dp),
                    )
                }

                Spacer(Modifier.width(13.dp))

                Column(Modifier.weight(1f)) {
                    if (isEditingName) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            BasicTextField(
                                value = editedName,
                                onValueChange = { editedName = it },
                                textStyle = MaterialTheme.typography.bodyMedium.copy(
                                    color = Color.White,
                                    fontWeight = FontWeight.SemiBold,
                                ),
                                singleLine = true,
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color.White.copy(alpha = 0.12f))
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                            )
                            Box(
                                modifier = Modifier
                                    .size(26.dp)
                                    .clip(CircleShape)
                                    .background(ConnectGreen)
                                    .clickable {
                                        haptics.play(Haptic.Select)
                                        connectManager.updateDeviceName(editedName)
                                        isEditingName = false
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Rounded.Check,
                                    contentDescription = "Save",
                                    tint = Color.Black,
                                    modifier = Modifier.size(15.dp),
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .size(26.dp)
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.1f))
                                    .clickable {
                                        haptics.play(Haptic.Select)
                                        editedName = localDeviceName
                                        isEditingName = false
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Rounded.Close,
                                    contentDescription = "Cancel",
                                    tint = Color.White,
                                    modifier = Modifier.size(15.dp),
                                )
                            }
                        }
                    } else {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Text(
                                text = localDeviceName,
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false),
                            )
                            Icon(
                                imageVector = Icons.Rounded.Edit,
                                contentDescription = "Edit device name",
                                tint = Color.White.copy(alpha = 0.45f),
                                modifier = Modifier
                                    .size(15.dp)
                                    .clickable {
                                        haptics.play(Haptic.Select)
                                        editedName = localDeviceName
                                        isEditingName = true
                                    },
                            )
                        }
                    }
                    Spacer(Modifier.height(2.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Rounded.GraphicEq,
                            contentDescription = null,
                            tint = ConnectGreen,
                            modifier = Modifier.size(14.dp),
                        )
                        Spacer(Modifier.width(5.dp))
                        Text(
                            text = "Listening on this phone",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Medium,
                            color = ConnectGreen,
                        )
                    }
                }
            }
        }

        // 2. PAIRING & DISCOVERY HEADER
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 2.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = "PAIRING & DISCOVERY",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color.White.copy(alpha = 0.5f),
                    letterSpacing = 1.2.sp,
                )
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .clickable {
                            haptics.play(Haptic.Select)
                            connectManager.refreshDiscovery()
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Refresh,
                        contentDescription = "Refresh",
                        tint = Color.White.copy(alpha = 0.5f),
                        modifier = Modifier.size(15.dp),
                    )
                }
            }

            Box(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(if (showPairingCard) ConnectGreen else ConnectGreen.copy(alpha = 0.16f))
                    .clickable {
                        haptics.play(Haptic.Select)
                        showPairingCard = !showPairingCard
                        if (showPairingCard && activePairCode == null) {
                            connectManager.generatePairCode()
                        }
                    }
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(
                        imageVector = if (showPairingCard) Icons.Rounded.Close else Icons.Rounded.Key,
                        contentDescription = null,
                        tint = if (showPairingCard) Color.Black else ConnectGreen,
                        modifier = Modifier.size(13.dp),
                    )
                    Text(
                        text = if (showPairingCard) "Close" else "Pair Device",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (showPairingCard) Color.Black else ConnectGreen,
                    )
                }
            }
        }

        // 3. PAIRING CARD (CODE CREATING & ENTERING - LIKE DESKTOP)
        AnimatedVisibility(
            visible = showPairingCard,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically(),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(ROW_SHAPE)
                    .background(Color(0xFF161618))
                    .border(1.dp, ConnectGreen.copy(alpha = 0.35f), ROW_SHAPE)
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                // Segmented tab switcher
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.08f))
                        .padding(3.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(CircleShape)
                            .background(if (pairTab == 0) ConnectGreen else Color.Transparent)
                            .clickable {
                                haptics.play(Haptic.Select)
                                pairTab = 0
                                if (activePairCode == null) connectManager.generatePairCode()
                            }
                            .padding(vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Show Code",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = if (pairTab == 0) Color.Black else Color.White.copy(alpha = 0.7f),
                        )
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(CircleShape)
                            .background(if (pairTab == 1) ConnectGreen else Color.Transparent)
                            .clickable {
                                haptics.play(Haptic.Select)
                                pairTab = 1
                            }
                            .padding(vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Enter Code",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = if (pairTab == 1) Color.Black else Color.White.copy(alpha = 0.7f),
                        )
                    }
                }

                if (pairTab == 0) {
                    // TAB 0: SHOW CODE (Code Creating)
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = "Enter this 6-digit code in Raaga on your PC or other device:",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.7f),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 6.dp),
                        )

                        val code = activePairCode ?: "------"
                        val formattedCode = if (code.length == 6) {
                            "${code.substring(0, 3)} - ${code.substring(3)}"
                        } else {
                            code
                        }

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.Black.copy(alpha = 0.5f))
                                .border(1.dp, ConnectGreen.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                                .clickable {
                                    if (activePairCode != null) {
                                        haptics.play(Haptic.Select)
                                        clipboardManager.setText(AnnotatedString(activePairCode!!))
                                        copiedToast = true
                                    }
                                }
                                .padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = formattedCode,
                                style = MaterialTheme.typography.headlineLarge,
                                fontWeight = FontWeight.ExtraBold,
                                color = ConnectGreen,
                                letterSpacing = 4.sp,
                            )
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                text = "Expires in 5 minutes",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.5f),
                            )

                            // Copy button
                            Box(
                                modifier = Modifier
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.1f))
                                    .clickable {
                                        if (activePairCode != null) {
                                            haptics.play(Haptic.Select)
                                            clipboardManager.setText(AnnotatedString(activePairCode!!))
                                            copiedToast = true
                                        }
                                    }
                                    .padding(horizontal = 9.dp, vertical = 4.dp),
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    Icon(
                                        imageVector = if (copiedToast) Icons.Rounded.Check else Icons.Rounded.ContentCopy,
                                        contentDescription = null,
                                        tint = if (copiedToast) ConnectGreen else Color.White,
                                        modifier = Modifier.size(12.dp),
                                    )
                                    Text(
                                        text = if (copiedToast) "Copied!" else "Copy",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.SemiBold,
                                        color = if (copiedToast) ConnectGreen else Color.White,
                                    )
                                }
                            }

                            // New Code button
                            Box(
                                modifier = Modifier
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.1f))
                                    .clickable {
                                        haptics.play(Haptic.Select)
                                        connectManager.generatePairCode()
                                    }
                                    .padding(horizontal = 9.dp, vertical = 4.dp),
                            ) {
                                Text(
                                    text = "New Code",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color.White,
                                )
                            }
                        }
                    }
                } else {
                    // TAB 1: ENTER CODE (Code Entering)
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = "Enter the 6-digit code displayed on your other device:",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.7f),
                            textAlign = TextAlign.Center,
                        )

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.Black.copy(alpha = 0.5f))
                                .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            BasicTextField(
                                value = enteredCode,
                                onValueChange = {
                                    val digitsOnly = it.filter { c -> c.isDigit() }
                                    if (digitsOnly.length <= 6) enteredCode = digitsOnly
                                },
                                textStyle = TextStyle(
                                    color = Color.White,
                                    fontSize = 24.sp,
                                    fontWeight = FontWeight.Bold,
                                    textAlign = TextAlign.Center,
                                    letterSpacing = 6.sp,
                                ),
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.fillMaxWidth(),
                            )
                            if (enteredCode.isEmpty()) {
                                Text(
                                    text = "000000",
                                    style = TextStyle(
                                        color = Color.White.copy(alpha = 0.2f),
                                        fontSize = 24.sp,
                                        fontWeight = FontWeight.Bold,
                                        textAlign = TextAlign.Center,
                                        letterSpacing = 6.sp,
                                    ),
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                        }

                        val canSubmit = enteredCode.length == 6 && !isPairingSubmitting
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(CircleShape)
                                .background(if (canSubmit) ConnectGreen else Color.White.copy(alpha = 0.12f))
                                .clickable(enabled = canSubmit) {
                                    haptics.play(Haptic.Select)
                                    connectManager.submitPairCode(enteredCode)
                                }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = if (isPairingSubmitting) "Connecting..." else "Pair Device",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (canSubmit) Color.Black else Color.White.copy(alpha = 0.4f),
                            )
                        }
                    }
                }

                if (pairingFeedback != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(ConnectGreen.copy(alpha = 0.15f))
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = pairingFeedback!!,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = ConnectGreen,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }

        // 4. PAIRED DEVICES LIST
        Text(
            text = "PAIRED DEVICES (${pairedDevicesWithStatus.size})",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = Color.White.copy(alpha = 0.5f),
            letterSpacing = 1.2.sp,
            modifier = Modifier.padding(horizontal = 2.dp),
        )

        if (pairedDevicesWithStatus.isEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(ROW_SHAPE)
                    .background(Color.White.copy(alpha = 0.04f))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Rounded.Cast,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.35f),
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    text = "No paired devices yet. Tap 'Pair Device' above to link Phone & PC.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.5f),
                )
            }
        } else {
            pairedDevicesWithStatus.forEach { item ->
                val paired = item.paired
                val isOnline = item.isOnline
                val onlineDev = item.onlineDevice
                val isConnecting = connectingDeviceId == paired.id
                val isCurrentlyActive = activeRemote?.id == paired.id

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(ROW_SHAPE)
                        .background(if (isCurrentlyActive) ConnectGreen.copy(alpha = 0.14f) else Color.White.copy(alpha = 0.05f))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            enabled = isOnline && !isCurrentlyActive && !isConnecting,
                        ) {
                            haptics.play(Haptic.Select)
                            if (onlineDev != null) {
                                connectManager.transferLocalPlaybackTo(onlineDev)
                            }
                        }
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(if (isOnline) ConnectGreen.copy(alpha = 0.18f) else Color.White.copy(alpha = 0.06f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = when (paired.type) {
                                ConnectDeviceType.PHONE -> Icons.Rounded.PhoneAndroid
                                ConnectDeviceType.DESKTOP -> Icons.Rounded.Tv
                                ConnectDeviceType.SPEAKER -> Icons.Rounded.Speaker
                            },
                            contentDescription = null,
                            tint = if (isOnline) ConnectGreen else Color.White.copy(alpha = 0.4f),
                            modifier = Modifier.size(20.dp),
                        )
                    }

                    Spacer(Modifier.width(13.dp))

                    Column(Modifier.weight(1f)) {
                        Text(
                            text = paired.name,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = if (isOnline) FontWeight.SemiBold else FontWeight.Normal,
                            color = if (isOnline) Color.White else Color.White.copy(alpha = 0.6f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Spacer(Modifier.height(2.dp))
                        val statusText = when {
                            isConnecting -> "Connecting to ${paired.name}..."
                            isCurrentlyActive -> "Currently Playing"
                            isOnline && onlineDev?.isCloud == true -> "Online • Cloud Relay (Tap to play)"
                            isOnline -> "Online • Local Wi-Fi (Tap to play)"
                            else -> "Offline"
                        }
                        Text(
                            text = statusText,
                            style = MaterialTheme.typography.labelMedium,
                            color = when {
                                isConnecting || isCurrentlyActive || isOnline -> ConnectGreen
                                else -> Color.White.copy(alpha = 0.4f)
                            },
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    if (isConnecting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            color = ConnectGreen,
                            strokeWidth = 2.dp,
                        )
                        Spacer(Modifier.width(8.dp))
                    }

                    // Delete / Unpair Button
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .clickable {
                                haptics.play(Haptic.Select)
                                connectManager.unpairDevice(paired.id)
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.DeleteOutline,
                            contentDescription = "Unpair device",
                            tint = Color.White.copy(alpha = 0.35f),
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            }
        }

        // 5. NEARBY DEVICES ON WI-FI
        if (unpairedDevices.isNotEmpty()) {
            Text(
                text = "NEARBY DEVICES ON WI-FI (${unpairedDevices.size})",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.5f),
                letterSpacing = 1.2.sp,
                modifier = Modifier.padding(horizontal = 2.dp),
            )

            unpairedDevices.forEach { device ->
                val isConnecting = connectingDeviceId == device.id
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(ROW_SHAPE)
                        .background(Color.White.copy(alpha = 0.04f))
                        .clickable(enabled = !isConnecting) {
                            haptics.play(Haptic.Select)
                            connectManager.pairDeviceDirectly(device)
                            connectManager.transferLocalPlaybackTo(device)
                        }
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(ConnectGreen.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = when (device.type) {
                                ConnectDeviceType.PHONE -> Icons.Rounded.PhoneAndroid
                                ConnectDeviceType.DESKTOP -> Icons.Rounded.Tv
                                ConnectDeviceType.SPEAKER -> Icons.Rounded.Speaker
                            },
                            contentDescription = null,
                            tint = ConnectGreen,
                            modifier = Modifier.size(18.dp),
                        )
                    }

                    Spacer(Modifier.width(12.dp))

                    Column(Modifier.weight(1f)) {
                        Text(
                            text = device.name,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White.copy(alpha = 0.9f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        val statusText = when {
                            isConnecting -> "Connecting to ${device.name}..."
                            device.isCloud -> "Discovered via Cloud • Tap to play"
                            else -> "Discovered on Wi-Fi (${device.host}) • Tap to play"
                        }
                        Text(
                            text = statusText,
                            style = MaterialTheme.typography.labelSmall,
                            color = ConnectGreen,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    if (isConnecting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            color = ConnectGreen,
                            strokeWidth = 2.dp,
                        )
                        Spacer(Modifier.width(8.dp))
                    }

                    // 1-Tap Pair Button
                    Box(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(ConnectGreen.copy(alpha = 0.2f))
                            .clickable {
                                haptics.play(Haptic.Select)
                                connectManager.pairDeviceDirectly(device)
                            }
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "+ Pair",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = ConnectGreen,
                        )
                    }
                }
            }
        }
    }
}

