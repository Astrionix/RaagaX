package com.music.raaga.ui.player

import androidx.compose.foundation.background
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
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.rounded.CastConnected
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Headphones
import androidx.compose.material.icons.rounded.Key
import androidx.compose.material.icons.rounded.PhoneAndroid
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Speaker
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material.icons.rounded.Usb
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.unit.sp
import com.music.raaga.data.connect.ConnectDevice
import com.music.raaga.data.connect.ConnectDeviceType
import com.music.raaga.data.connect.RaagaConnectManager
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.sharedui.resources.*
import com.music.raaga.ui.haptics.Haptic
import com.music.raaga.ui.haptics.rememberHaptics
import dev.chrisbanes.haze.HazeState
import com.music.raaga.ui.components.LiquidGlassTokens
import com.music.raaga.ui.components.interactiveLiquidGlassCard
import com.music.raaga.ui.components.liquidGlassCard
import com.music.raaga.ui.components.liquidDropletPod
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
    onOpenCast: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val outputs = rememberAudioOutputs()
    val cast by PlayerPlatform.host.castState.collectAsStateWithLifecycle()

    PlayerDrawer(
        hazeState = hazeState,
        title = stringResource(Res.string.audio_output),
        onDismiss = onDismiss,
        modifier = modifier,
    ) {
        // Flat, with the playing one marked, rather than folded behind a
        // chevron. There are two outputs on a phone most of the time; one
        // of them is the answer and the other is the only alternative, so a
        // disclosure control costs a tap to reveal a single row.
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            outputs.forEach { device ->
                OutputRow(
                    device = device,
                    accountName = accountName,
                    onSelect = { PlayerPlatform.host.selectAudioOutput(device.id) },
                )
            }
            // One more place to send the music, listed with the others. The
            // receivers behind it are chosen in a popup of their own — there
            // can be any number of them, and they come and go while it is open.
            if (cast.supported) CastRow(cast = cast, onClick = onOpenCast)
        }

        Spacer(Modifier.height(10.dp))
        VolumeRow(routeKey = outputs)

        Spacer(Modifier.height(6.dp))
        AudioPipelineRow(onClick = onOpenPipeline)
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
    val outputFormat by PlayerPlatform.host.outputFormat.collectAsStateWithLifecycle()
    val subtitle = outputFormat.summary
    val interactionSource = remember { MutableInteractionSource() }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .interactiveLiquidGlassCard(active = false, interactionSource = interactionSource)
            .clickable(
                interactionSource = interactionSource,
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
                .liquidDropletPod(active = false),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Rounded.GraphicEq,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.75f),
                modifier = Modifier.size(20.dp),
            )
        }
        Spacer(Modifier.width(13.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = stringResource(Res.string.audio_pipeline),
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

/**
 * Opens the receiver picker. Lit like the playing output while the music is on
 * a receiver, with that receiver's name in place of the generic title — at that
 * point it *is* the output, and the rows above it are the way back.
 */
@Composable
private fun CastRow(cast: CastUi, onClick: () -> Unit) {
    val haptics = rememberHaptics()
    val casting = cast.connectedName != null
    val interactionSource = remember { MutableInteractionSource() }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .interactiveLiquidGlassCard(active = casting, interactionSource = interactionSource)
            .clickable(
                interactionSource = interactionSource,
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
                .liquidDropletPod(active = casting),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = if (casting) Icons.Rounded.CastConnected else Icons.Rounded.Cast,
                contentDescription = null,
                tint = Color.White.copy(alpha = if (casting) 1f else 0.7f),
                modifier = Modifier.size(21.dp),
            )
        }
        Spacer(Modifier.width(13.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = cast.connectedName ?: stringResource(Res.string.cast),
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontWeight = if (casting) FontWeight.SemiBold else FontWeight.Normal,
                ),
                color = Color.White.copy(alpha = if (casting) 1f else 0.85f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = stringResource(
                    when {
                        cast.connecting -> Res.string.cast_connecting
                        casting -> Res.string.cast_casting
                        else -> Res.string.cast_row_subtitle
                    },
                ),
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

/**
 * One output. The playing one is lit and says so; the rest are there to be
 * tapped.
 */
@Composable
private fun OutputRow(
    device: AudioOutputDevice,
    accountName: String?,
    onSelect: () -> Unit,
) {
    val haptics = rememberHaptics()
    val active = device.isActive
    val interactionSource = remember { MutableInteractionSource() }
    val rowShape = RoundedCornerShape(18.dp)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(rowShape)
            .then(
                if (active) {
                    Modifier
                        .background(
                            Brush.verticalGradient(
                                listOf(
                                    Color.White.copy(alpha = 0.14f),
                                    Color.White.copy(alpha = 0.04f),
                                    Color.White.copy(alpha = 0.06f),
                                )
                            )
                        )
                        .border(
                            1.dp,
                            Brush.verticalGradient(
                                listOf(
                                    Color.White.copy(alpha = 0.92f),
                                    Color.White.copy(alpha = 0.32f),
                                    Color.White.copy(alpha = 0.08f),
                                    Color.White.copy(alpha = 0.24f),
                                )
                            ),
                            rowShape,
                        )
                } else {
                    Modifier.interactiveLiquidGlassCard(
                        active = false,
                        shape = rowShape,
                        interactionSource = interactionSource,
                    )
                }
            )
            .clickable(
                interactionSource = interactionSource,
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
                .size(38.dp)
                .clip(CircleShape)
                .then(
                    if (active) {
                        Modifier
                            .background(
                                Brush.radialGradient(
                                    listOf(
                                        Color.White.copy(alpha = 0.28f),
                                        Color.White.copy(alpha = 0.06f),
                                    )
                                )
                            )
                            .border(1.dp, Color.White.copy(alpha = 0.65f), CircleShape)
                    } else {
                        Modifier.liquidDropletPod(active = false)
                    }
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = iconFor(device.kind),
                contentDescription = null,
                tint = if (active) Color.White else Color.White.copy(alpha = 0.75f),
                modifier = Modifier.size(19.dp),
            )
        }
        Spacer(Modifier.width(13.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = outputLabel(device, accountName),
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontSize = 15.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                ),
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (active) {
                Spacer(Modifier.height(1.dp))
                Text(
                    text = stringResource(Res.string.audio_output_playing),
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                    ),
                    color = Color.White.copy(alpha = 0.75f),
                )
            }
        }
        if (active) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.24f))
                    .border(1.dp, Color.White.copy(alpha = 0.75f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Rounded.Check,
                    contentDescription = "Selected",
                    tint = Color.White,
                    modifier = Modifier.size(15.dp),
                )
            }
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
private fun VolumeRow(routeKey: Any) {
    val system = PlayerPlatform.host.volume
    val systemLevel by system.level.collectAsStateWithLifecycle()
    var level by remember(system) { mutableFloatStateOf(systemLevel) }
    var dragging by remember { mutableStateOf(false) }

    // The hardware keys move the system level; follow it, but never over a
    // finger: the listener's own drag is the one source of truth this must
    // not fight.
    LaunchedEffect(systemLevel) {
        if (!dragging) level = systemLevel
    }

    LaunchedEffect(routeKey) {
        repeat(VOLUME_REREADS) {
            if (!dragging) system.refresh()
            delay(VOLUME_REREAD_GAP_MS)
        }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .interactiveLiquidGlassCard(active = false)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = if (level > 0f) Icons.AutoMirrored.Rounded.VolumeUp else Icons.AutoMirrored.Rounded.VolumeOff,
            contentDescription = null,
            tint = Color.White.copy(alpha = 0.7f),
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(12.dp))
        ThinSlider(
            value = level,
            onValueChange = {
                dragging = true
                level = it
                system.set(it)
            },
            onValueChangeFinished = { dragging = false },
            drawThumb = true,
            idleHeight = 4.dp,
            activeHeight = 6.dp,
            thumbRadius = 7.dp,
            activeColor = Color.White,
            inactiveColor = Color.White.copy(alpha = 0.22f),
            modifier = Modifier.weight(1f),
        )
    }
}

private fun iconFor(kind: AudioOutputKind): ImageVector = when (kind) {
    AudioOutputKind.PHONE -> Icons.Rounded.PhoneAndroid
    AudioOutputKind.WIRED -> Icons.Rounded.Headphones
    AudioOutputKind.USB -> Icons.Rounded.Usb
    AudioOutputKind.BLUETOOTH -> Icons.Rounded.Bluetooth
    AudioOutputKind.HDMI -> Icons.Rounded.Tv
    AudioOutputKind.OTHER -> Icons.Rounded.Speaker
}

/** How many times the level is re-read after a route change, and how far apart. */
private const val VOLUME_REREADS = 4
private const val VOLUME_REREAD_GAP_MS = 250L

@Suppress("Unused", "UNUSED_ELEMENT")
@Composable
private fun RaagaConnectSection(
    connectManager: RaagaConnectManager,
    activeRemote: ConnectDevice?,
    modifier: Modifier = Modifier,
) {
    val haptics = rememberHaptics()
    val remoteStatus by connectManager.remoteStatus.collectAsStateWithLifecycle()
    val pairedDevicesWithStatus by connectManager.pairedDevicesWithStatus.collectAsStateWithLifecycle()
    val unpairedDevices by connectManager.unpairedDiscoveredDevices.collectAsStateWithLifecycle()
    val activePairCode by connectManager.activePairCode.collectAsStateWithLifecycle()
    val pairingFeedback by connectManager.pairingFeedback.collectAsStateWithLifecycle()
    val isPairingSubmitting by connectManager.isPairingSubmitting.collectAsStateWithLifecycle()

    var showPairingCard by remember { mutableStateOf(false) }
    var pairTab by remember { mutableIntStateOf(0) } // 0 = Show Code, 1 = Enter Code
    var enteredCode by remember { mutableStateOf("") }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Section Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Text(
                    text = "RAAGA CONNECT",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF1DB954), // Spotify Connect green
                    letterSpacing = 1.2.sp,
                )
                Text(
                    text = if (activeRemote != null) "Playing remotely" else "Listen across Phone & PC",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.5f),
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                // Pair Device Button
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(if (showPairingCard) Color(0xFF1DB954) else Color(0xFF1DB954).copy(alpha = 0.18f))
                        .clickable {
                            haptics.play(Haptic.Select)
                            showPairingCard = !showPairingCard
                            if (showPairingCard && activePairCode == null) {
                                connectManager.generatePairCode()
                            }
                        }
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = if (showPairingCard) Icons.Rounded.Close else Icons.Rounded.Key,
                            contentDescription = null,
                            tint = if (showPairingCard) Color.Black else Color(0xFF1DB954),
                            modifier = Modifier.size(14.dp),
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = if (showPairingCard) "Close" else "Pair Device",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = if (showPairingCard) Color.Black else Color(0xFF1DB954),
                        )
                    }
                }

                // Refresh Button
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.08f))
                        .clickable {
                            haptics.play(Haptic.Select)
                            connectManager.refreshDiscovery()
                        }
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Refresh",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White.copy(alpha = 0.75f),
                    )
                }
            }
        }

        // Pair New Device Card (6-Digit Code)
        if (showPairingCard) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .liquidGlassCard(active = false, accentBorder = Color(0xFF1DB954))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                // Pill Switcher: [Show Code] [Enter Code]
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.08f))
                        .border(1.dp, Color.White.copy(alpha = 0.12f), CircleShape)
                        .padding(3.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(CircleShape)
                            .then(
                                if (pairTab == 0) {
                                    Modifier.background(
                                        Brush.horizontalGradient(
                                            listOf(Color(0xFF1DB954), Color(0xFF10B981))
                                        )
                                    )
                                } else Modifier
                            )
                            .clickable {
                                pairTab = 0
                                if (activePairCode == null) connectManager.generatePairCode()
                            }
                            .padding(vertical = 7.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Show 6-Digit Code",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = if (pairTab == 0) Color.Black else Color.White.copy(alpha = 0.7f),
                        )
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(CircleShape)
                            .then(
                                if (pairTab == 1) {
                                    Modifier.background(
                                        Brush.horizontalGradient(
                                            listOf(Color(0xFF1DB954), Color(0xFF10B981))
                                        )
                                    )
                                } else Modifier
                            )
                            .clickable {
                                pairTab = 1
                            }
                            .padding(vertical = 7.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Enter 6-Digit Code",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = if (pairTab == 1) Color.Black else Color.White.copy(alpha = 0.7f),
                        )
                    }
                }

                if (pairTab == 0) {
                    // TAB 0: SHOW CODE
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text(
                            text = "Enter this code on your other device (Phone or PC) to link them:",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.7f),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 8.dp),
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
                                .background(Color.Black.copy(alpha = 0.35f))
                                .border(1.dp, Color(0xFF1DB954).copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                                .padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = formattedCode,
                                style = MaterialTheme.typography.headlineLarge,
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFF1DB954),
                                letterSpacing = 4.sp,
                            )
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                text = "Waiting for connection...",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.5f),
                            )

                            Box(
                                modifier = Modifier
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.12f))
                                    .border(1.dp, Color.White.copy(alpha = 0.18f), CircleShape)
                                    .clickable {
                                        haptics.play(Haptic.Select)
                                        connectManager.generatePairCode()
                                    }
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                            ) {
                                Text(
                                    text = "New Code",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color.White.copy(alpha = 0.8f),
                                )
                            }
                        }
                    }
                } else {
                    // TAB 1: ENTER CODE
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = "Enter the 6-digit code shown on the other device:",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.7f),
                            textAlign = TextAlign.Center,
                        )

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.Black.copy(alpha = 0.35f))
                                .border(1.dp, Color.White.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                                .padding(horizontal = 16.dp, vertical = 10.dp),
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

                        // Submit Pair Button
                        val canSubmit = enteredCode.length == 6 && !isPairingSubmitting
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(CircleShape)
                                .background(
                                    if (canSubmit) {
                                        Brush.horizontalGradient(
                                            listOf(Color(0xFF1DB954), Color(0xFF10B981))
                                        )
                                    } else {
                                        Brush.horizontalGradient(
                                            listOf(Color.White.copy(alpha = 0.12f), Color.White.copy(alpha = 0.08f))
                                        )
                                    }
                                )
                                .border(
                                    1.dp,
                                    if (canSubmit) Color.White.copy(alpha = 0.4f) else Color.White.copy(alpha = 0.12f),
                                    CircleShape
                                )
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

                // Feedback message
                if (pairingFeedback != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF1DB954).copy(alpha = 0.15f))
                            .border(1.dp, Color(0xFF1DB954).copy(alpha = 0.35f), RoundedCornerShape(8.dp))
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = pairingFeedback!!,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF1DB954),
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }

        // ACTIVE REMOTE PLAYBACK CONTROLLER CARD
        if (activeRemote != null) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .liquidGlassCard(active = true, accentBorder = Color(0xFF1DB954))
                    .padding(14.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.radialGradient(
                                    listOf(Color(0xFF1DB954), Color(0xFF15803D))
                                )
                            )
                            .border(1.dp, Color.White.copy(alpha = 0.4f), CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = when (activeRemote.type) {
                                ConnectDeviceType.PHONE -> Icons.Rounded.PhoneAndroid
                                ConnectDeviceType.DESKTOP -> Icons.Rounded.Tv
                                ConnectDeviceType.SPEAKER -> Icons.Rounded.Speaker
                            },
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(22.dp),
                        )
                    }

                    Spacer(Modifier.width(12.dp))

                    Column(Modifier.weight(1f)) {
                        Text(
                            text = activeRemote.name,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        val trackInfo = remoteStatus?.track
                        val subText = if (trackInfo != null) {
                            "${trackInfo.title} • ${trackInfo.artist}"
                        } else {
                            "Active playback output"
                        }
                        Text(
                            text = subText,
                            style = MaterialTheme.typography.labelMedium,
                            color = Color(0xFF4ADE80),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    // Play / Pause toggle
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.18f))
                            .border(1.dp, Color.White.copy(alpha = 0.3f), CircleShape)
                            .clickable {
                                haptics.play(Haptic.Select)
                                connectManager.sendToggle()
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        val isPlaying = remoteStatus?.isPlaying ?: true
                        Icon(
                            imageVector = if (isPlaying) Icons.Rounded.GraphicEq else Icons.Rounded.PlayArrow,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }

                Spacer(Modifier.height(10.dp))

                // Switch back button
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.12f))
                        .border(1.dp, Color.White.copy(alpha = 0.22f), CircleShape)
                        .clickable {
                            haptics.play(Haptic.Select)
                            connectManager.transferBackToThisDevice()
                        }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Play on this device instead",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Medium,
                        color = Color.White,
                    )
                }
            }
        }

        // PAIRED DEVICES LIST (Persistent until user deletes)
        Text(
            text = "PAIRED DEVICES (${pairedDevicesWithStatus.size})",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = Color.White.copy(alpha = 0.65f),
            letterSpacing = 1.sp,
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
        )

        if (pairedDevicesWithStatus.isEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .liquidGlassCard(active = false)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Rounded.Cast,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.45f),
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    text = "No paired devices. Tap 'Pair Device' above to link Phone & PC.",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.White.copy(alpha = 0.55f),
                )
            }
        } else {
            pairedDevicesWithStatus.forEach { item ->
                val paired = item.paired
                val isOnline = item.isOnline
                val onlineDev = item.onlineDevice
                val isCurrentlyActive = activeRemote?.id == paired.id

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .liquidGlassCard(
                            active = isCurrentlyActive,
                            accentBorder = if (isCurrentlyActive) Color(0xFF1DB954) else null,
                        )
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            enabled = isOnline && !isCurrentlyActive,
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
                            .background(
                                if (isCurrentlyActive) {
                                    Brush.radialGradient(
                                        listOf(Color.White.copy(alpha = 0.35f), Color(0xFF1DB954).copy(alpha = 0.30f))
                                    )
                                } else if (isOnline) {
                                    Brush.radialGradient(
                                        listOf(Color(0xFF1DB954).copy(alpha = 0.25f), Color(0xFF1DB954).copy(alpha = 0.08f))
                                    )
                                } else {
                                    Brush.radialGradient(
                                        listOf(Color.White.copy(alpha = 0.14f), Color.White.copy(alpha = 0.04f))
                                    )
                                }
                            )
                            .border(
                                1.dp,
                                if (isCurrentlyActive || isOnline) Color(0xFF1DB954).copy(alpha = 0.45f) else Color.White.copy(alpha = 0.18f),
                                CircleShape
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = when (paired.type) {
                                ConnectDeviceType.PHONE -> Icons.Rounded.PhoneAndroid
                                ConnectDeviceType.DESKTOP -> Icons.Rounded.Tv
                                ConnectDeviceType.SPEAKER -> Icons.Rounded.Speaker
                            },
                            contentDescription = null,
                            tint = if (isCurrentlyActive || isOnline) Color(0xFF4ADE80) else Color.White.copy(alpha = 0.4f),
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
                            isCurrentlyActive -> "Currently Playing"
                            isOnline && onlineDev?.isCloud == true -> "Online • Cloud Relay (Tap to play)"
                            isOnline -> "Online • Local Wi-Fi (Tap to play)"
                            else -> "Offline"
                        }
                        Text(
                            text = statusText,
                            style = MaterialTheme.typography.labelMedium,
                            color = when {
                                isCurrentlyActive || isOnline -> Color(0xFF4ADE80)
                                else -> Color.White.copy(alpha = 0.4f)
                            },
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    // Delete / Unpair Button (Permanently deletes paired device until repaired)
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.06f))
                            .border(1.dp, Color.White.copy(alpha = 0.12f), CircleShape)
                            .clickable {
                                haptics.play(Haptic.Select)
                                connectManager.unpairDevice(paired.id)
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.DeleteOutline,
                            contentDescription = "Unpair device",
                            tint = Color.White.copy(alpha = 0.45f),
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            }
        }

        // OTHER UNPAIRED DEVICES (Discovered on LAN / Cloud)
        if (unpairedDevices.isNotEmpty()) {
            Text(
                text = "AVAILABLE DEVICES",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.65f),
                letterSpacing = 1.sp,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
            )

            unpairedDevices.forEach { device ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .liquidGlassCard(active = false)
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.radialGradient(
                                    listOf(Color.White.copy(alpha = 0.14f), Color.White.copy(alpha = 0.04f))
                                )
                            )
                            .border(1.dp, Color.White.copy(alpha = 0.18f), CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = when (device.type) {
                                ConnectDeviceType.PHONE -> Icons.Rounded.PhoneAndroid
                                ConnectDeviceType.DESKTOP -> Icons.Rounded.Tv
                                ConnectDeviceType.SPEAKER -> Icons.Rounded.Speaker
                            },
                            contentDescription = null,
                            tint = Color.White.copy(alpha = 0.75f),
                            modifier = Modifier.size(18.dp),
                        )
                    }

                    Spacer(Modifier.width(12.dp))

                    Column(Modifier.weight(1f)) {
                        Text(
                            text = device.name,
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.White.copy(alpha = 0.85f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = if (device.isCloud) "Discovered via Cloud" else "Discovered on Local Wi-Fi",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White.copy(alpha = 0.5f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    // 1-Tap Pair Button
                    Box(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(
                                Brush.horizontalGradient(
                                    listOf(Color(0xFF1DB954).copy(alpha = 0.35f), Color(0xFF1DB954).copy(alpha = 0.18f))
                                )
                            )
                            .border(1.dp, Color(0xFF1DB954).copy(alpha = 0.55f), CircleShape)
                            .clickable {
                                haptics.play(Haptic.Select)
                                connectManager.pairDeviceDirectly(device)
                            }
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "+ Pair",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF4ADE80),
                        )
                    }
                }
            }
        }
    }
}

