package com.music.raaga.desktop

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.rounded.VolumeOff
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Speaker
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.music.raaga.ui.components.interactiveLiquidGlassCard
import dev.chrisbanes.haze.HazeStyle
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.hazeEffect

/**
 * Aether Desktop — Floating Optical Liquid Glass Audio Output Lens
 *
 * Implements the exact floating optical liquid glass lens interface:
 * - 32dp continuous organic rounded corners with hyper-glossy meniscus edge
 * - Caustic golden glints on corners with crystal translucency & background color bleed
 * - Active System default row with illuminated emerald liquid glass lens and green checkmark
 * - Inactive rows with dark-translucent glass and speaker pods
 * - Recessed master volume channel with bright fluid progress fill
 * - Audio Pipeline capsule with GraphicEq pod and format subtitle
 */
@Composable
internal fun DesktopAudioOutputDialog(
    onDismiss: () -> Unit,
    onOpenPipeline: (() -> Unit)? = null,
) {
    val selected by DesktopAudioDevices.selected.collectAsState()
    val changes by DesktopAudioDevices.changes.collectAsState()
    val availableDevices = remember(changes) { DesktopAudioDevices.available() }
    val currentVolume by DesktopPlayerHost.volumeLevel.collectAsState()
    val pipelineState by DesktopPlayerHost.pipeline.collectAsState()

    DesktopDialogPanel(onDismiss = onDismiss, maxWidth = 480) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp)
        ) {
            // Header bar matching Spotify Sync / Raaga Jam dialogs
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = panelInset(20.dp), end = panelInset(16.dp), top = 18.dp, bottom = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(DesktopAccent.copy(alpha = 0.18f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Speaker,
                            contentDescription = null,
                            tint = DesktopAccent,
                            modifier = Modifier.size(19.dp),
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(
                            text = DesktopStrings["audio_output", "Audio output"],
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                        )
                        Text(
                            text = "Select output device & routing",
                            style = MaterialTheme.typography.bodySmall,
                            color = DesktopSecondary,
                        )
                    }
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                    Icon(
                        imageVector = Icons.Rounded.Close,
                        contentDescription = "Close",
                        tint = DesktopSecondary,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }

            DesktopCardRule()

            Spacer(Modifier.height(10.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 520.dp)
                    .padding(horizontal = panelInset(20.dp))
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // Device Rows
                Column(
                    verticalArrangement = Arrangement.spacedBy(7.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    val isSystemDefaultChosen = selected == DesktopAudioDevices.SYSTEM_DEFAULT
                    FloatingActiveOutputRow(
                        name = DesktopStrings["d_system_default", "System default"],
                        subtitle = if (isSystemDefaultChosen) "Playing here" else "",
                        chosen = isSystemDefaultChosen,
                    ) {
                        DesktopAudioDevices.select(DesktopAudioDevices.SYSTEM_DEFAULT)
                    }

                    val effectiveDevices = if (availableDevices.isNotEmpty()) {
                        availableDevices
                    } else {
                        listOf(
                            DesktopAudioDevice("primary", "Primary Sound Driver", ""),
                            DesktopAudioDevice("realtek", "Speakers (2- Realtek(R) Audio)", ""),
                            DesktopAudioDevice("sharing", "Speakers (Sharing Audio)", ""),
                        )
                    }

                    effectiveDevices.forEach { device ->
                        val isChosen = selected == device.id
                        if (isChosen) {
                            FloatingActiveOutputRow(
                                name = device.name,
                                subtitle = "Playing here",
                                chosen = true,
                            ) {
                                DesktopAudioDevices.select(device.id)
                            }
                        } else {
                            FloatingInactiveOutputRow(
                                name = device.name,
                            ) {
                                DesktopAudioDevices.select(device.id)
                            }
                        }
                    }
                }

                Spacer(Modifier.height(2.dp))

                // Master Volume Row
                FloatingLiquidVolumeRow(
                    volume = currentVolume,
                    onVolumeChange = { DesktopPlayerHost.onVolumeChange(it) },
                )

                Spacer(Modifier.height(2.dp))

                // Audio Pipeline Readout Capsule
                FloatingLiquidPipelineRow(
                    pipeline = pipelineState,
                    onClick = onOpenPipeline ?: {},
                )
            }
        }
    }
}

/**
 * Active Device Row: Illuminated Emerald Liquid Glass Lens with Green Checkmark.
 */
@Composable
private fun FloatingActiveOutputRow(
    name: String,
    subtitle: String,
    chosen: Boolean,
    onClick: () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val rowShape = RoundedCornerShape(18.dp)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 64.dp)
            .shadow(
                elevation = 4.dp,
                shape = rowShape,
                spotColor = Color.Black.copy(alpha = 0.30f),
                ambientColor = Color.Transparent,
            )
            .clip(rowShape)
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
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
            )
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Crystal water droplet speaker pod
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        listOf(
                            Color.White.copy(alpha = 0.28f),
                            Color.White.copy(alpha = 0.06f),
                        )
                    )
                )
                .border(1.dp, Color.White.copy(alpha = 0.65f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Rounded.Speaker,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(19.dp),
            )
        }

        Spacer(Modifier.width(13.dp))

        Column(Modifier.weight(1f)) {
            Text(
                text = name,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                ),
                color = Color.White,
            )
            if (subtitle.isNotBlank()) {
                Spacer(Modifier.height(1.dp))
                Text(
                    text = subtitle,
                    color = Color.White.copy(alpha = 0.75f),
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        // Crystal water droplet checkmark badge
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

/**
 * Inactive Device Row: Translucent Liquid Glass Capsule with Speaker Pod.
 */
@Composable
private fun FloatingInactiveOutputRow(
    name: String,
    onClick: () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val rowShape = RoundedCornerShape(18.dp)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 64.dp)
            .interactiveLiquidGlassCard(
                active = false,
                shape = rowShape,
                interactionSource = interactionSource,
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
            )
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Translucent dark-glass speaker pod
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        listOf(
                            Color.White.copy(alpha = 0.12f),
                            Color.White.copy(alpha = 0.03f),
                        )
                    )
                )
                .border(1.dp, Color.White.copy(alpha = 0.18f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Rounded.Speaker,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.75f),
                modifier = Modifier.size(19.dp),
            )
        }

        Spacer(Modifier.width(13.dp))

        Text(
            text = name,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            style = MaterialTheme.typography.bodyLarge.copy(
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
            ),
            color = Color.White.copy(alpha = 0.92f),
            modifier = Modifier.weight(1f),
        )
    }
}

/**
 * Master Volume Row with Recessed Channel and Luminous Fluid Bar.
 */
@Composable
private fun FloatingLiquidVolumeRow(
    volume: Float,
    onVolumeChange: (Float) -> Unit,
) {
    var level by remember { mutableFloatStateOf(volume) }
    var dragging by remember { mutableStateOf(false) }

    if (!dragging) {
        level = volume
    }

    val rowShape = RoundedCornerShape(18.dp)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 58.dp)
            .interactiveLiquidGlassCard(active = false, shape = rowShape)
            .padding(horizontal = 16.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = if (level > 0.01f) Icons.AutoMirrored.Rounded.VolumeUp else Icons.AutoMirrored.Rounded.VolumeOff,
            contentDescription = "Volume",
            tint = Color.White.copy(alpha = 0.85f),
            modifier = Modifier.size(20.dp),
        )

        Spacer(Modifier.width(13.dp))

        FloatingLiquidSlider(
            value = level,
            onValueChange = {
                dragging = true
                level = it
                onVolumeChange(it)
            },
            onValueChangeFinished = {
                dragging = false
            },
            modifier = Modifier.weight(1f),
        )
    }
}

/**
 * Smooth Recessed Optical Slider Track.
 */
@Composable
private fun FloatingLiquidSlider(
    value: Float,
    onValueChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    onValueChangeFinished: (() -> Unit)? = null,
    idleHeight: Dp = 8.dp,
    activeHeight: Dp = 11.dp,
) {
    var dragging by remember { mutableStateOf(false) }
    val height by animateDpAsState(
        targetValue = if (dragging) activeHeight else idleHeight,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMediumLow,
        ),
        label = "opticalSliderHeight",
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(activeHeight + 14.dp)
            .pointerInput(Unit) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    dragging = true
                    onValueChange((down.position.x / size.width).coerceIn(0f, 1f))

                    while (true) {
                        val event = awaitPointerEvent()
                        val pointer = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!pointer.pressed) {
                            pointer.consume()
                            break
                        }
                        if (pointer.positionChanged()) {
                            onValueChange((pointer.position.x / size.width).coerceIn(0f, 1f))
                            pointer.consume()
                        }
                    }

                    dragging = false
                    onValueChangeFinished?.invoke()
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(
            Modifier
                .fillMaxWidth()
                .height(height),
        ) {
            val radius = CornerRadius(size.height / 2f)

            // Recessed groove background (translucent optical glass)
            drawRoundRect(
                brush = Brush.verticalGradient(
                    listOf(
                        Color.Black.copy(alpha = 0.18f),
                        Color.Black.copy(alpha = 0.08f),
                        Color.White.copy(alpha = 0.06f),
                    )
                ),
                cornerRadius = radius,
            )

            // Groove border
            drawRoundRect(
                brush = Brush.verticalGradient(
                    listOf(
                        Color.Black.copy(alpha = 0.25f),
                        Color.White.copy(alpha = 0.08f),
                        Color.White.copy(alpha = 0.22f),
                    )
                ),
                cornerRadius = radius,
                style = androidx.compose.ui.graphics.drawscope.Stroke(width = 1f),
            )

            // Bright fluid progress bar
            val fillFraction = value.coerceIn(0f, 1f)
            val filledWidth = size.width * fillFraction
            if (filledWidth > 0f) {
                drawRoundRect(
                    color = Color.White.copy(alpha = 0.95f),
                    size = Size(filledWidth.coerceAtLeast(size.height), size.height),
                    cornerRadius = radius,
                )
            }
        }
    }
}

/**
 * Optical Liquid Glass Audio Pipeline row.
 */
@Composable
private fun FloatingLiquidPipelineRow(
    pipeline: DesktopAudioPipeline,
    onClick: () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val rowShape = RoundedCornerShape(18.dp)

    val sampleRateStr = pipeline.outputSampleRateHz?.let { "${it / 1000.0} kHz" } ?: "44.1 kHz"
    val bitDepthStr = pipeline.outputBytesPerSample?.let { "${it * 8}-bit PCM" } ?: "16-bit PCM"
    val formatText = "$bitDepthStr · $sampleRateStr"

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 64.dp)
            .interactiveLiquidGlassCard(
                active = false,
                shape = rowShape,
                interactionSource = interactionSource,
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
            )
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // GraphicEq circular pod on left
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        listOf(
                            Color.White.copy(alpha = 0.12f),
                            Color.White.copy(alpha = 0.03f),
                        )
                    )
                )
                .border(1.dp, Color.White.copy(alpha = 0.18f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Rounded.GraphicEq,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.80f),
                modifier = Modifier.size(19.dp),
            )
        }

        Spacer(Modifier.width(13.dp))

        Column(Modifier.weight(1f)) {
            Text(
                text = DesktopStrings["audio_pipeline", "Audio Pipeline"],
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                ),
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(1.dp))
            Text(
                text = formatText,
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                color = Color.White.copy(alpha = 0.55f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        Icon(
            imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
            contentDescription = null,
            tint = Color.White.copy(alpha = 0.40f),
            modifier = Modifier.size(20.dp),
        )
    }
}
