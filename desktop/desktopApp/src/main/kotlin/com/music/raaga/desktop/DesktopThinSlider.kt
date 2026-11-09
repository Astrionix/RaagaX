package com.music.raaga.desktop

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerIcon
import androidx.compose.ui.input.pointer.pointerHoverIcon
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChanged
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Apple Music's scrubber, ported from Android's `ThinSlider`. */
@Composable
internal fun DesktopThinSlider(
    value: Float,
    onValueChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    onValueChangeFinished: (() -> Unit)? = null,
    /** Sends a sheen travelling along the bar for as long as it is true. */
    mixing: Boolean = false,
    /**
     * Span of the track, as fractions of its duration, that the next Automix transition is planned
     * to occupy.
     */
    transitionWindow: ClosedFloatingPointRange<Float>? = null,
    idleHeight: Dp = 4.dp,
    activeHeight: Dp = 6.dp,
    activeColor: Color = Color.White.copy(alpha = 0.92f),
    inactiveColor: Color = Color.White.copy(alpha = 0.26f),
    /** Halfway between the two track colours: visible against unplayed, invisible under played. */
    markerColor: Color = Color.White.copy(alpha = 0.5f),
    drawThumb: Boolean = true,
    thumbRadius: Dp = 6.dp,
    thumbColor: Color = Color.White,
) {
    var dragging by remember { mutableStateOf(false) }
    var dragFraction by remember { mutableStateOf<Float?>(null) }
    val interactionSource = remember { MutableInteractionSource() }
    val isHovered by interactionSource.collectIsHoveredAsState()
    val isElevated = dragging || isHovered

    val currentOnValueChange by rememberUpdatedState(onValueChange)
    val currentOnValueChangeFinished by rememberUpdatedState(onValueChangeFinished)

    val height by animateDpAsState(
        targetValue = if (isElevated) activeHeight else idleHeight,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioNoBouncy,
            stiffness = Spring.StiffnessMediumLow,
        ),
        label = "sliderHeight",
    )
    val canvasSlotHeight = remember(activeHeight, drawThumb, thumbRadius) {
        if (drawThumb) maxOf(activeHeight, thumbRadius * 2 + 4.dp) else activeHeight
    }

    Box(
        modifier = modifier
            // Generous invisible hit target with hover and hand cursor for desktop
            .height(maxOf(activeHeight + 20.dp, 28.dp))
            .hoverable(interactionSource)
            .pointerHoverIcon(PointerIcon.Hand)
            // One gesture loop for both clicks and drags.
            .pointerInput(Unit) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    down.consume()
                    val width = size.width.toFloat().coerceAtLeast(1f)
                    var currentFraction = (down.position.x / width).coerceIn(0f, 1f)
                    dragging = true
                    dragFraction = currentFraction
                    currentOnValueChange(currentFraction)

                    while (true) {
                        val event = awaitPointerEvent()
                        val pointer = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!pointer.pressed) {
                            pointer.consume()
                            break
                        }
                        if (pointer.positionChanged()) {
                            currentFraction = (pointer.position.x / width).coerceIn(0f, 1f)
                            dragFraction = currentFraction
                            currentOnValueChange(currentFraction)
                            pointer.consume()
                        }
                    }

                    dragging = false
                    dragFraction = null
                    currentOnValueChangeFinished?.invoke()
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(
            Modifier
                .fillMaxWidth()
                .height(canvasSlotHeight),
        ) {
            val barHeight = height.toPx()
            val barTop = (size.height - barHeight) / 2f
            val radius = CornerRadius(barHeight / 2f)
            drawRoundRect(
                color = inactiveColor,
                topLeft = Offset(0f, barTop),
                size = Size(size.width, barHeight),
                cornerRadius = radius,
            )
            // Between the two track colours, and drawn *under* the played fill.
            transitionWindow?.let { window ->
                val from = size.width * window.start.coerceIn(0f, 1f)
                val to = size.width * window.endInclusive.coerceIn(0f, 1f)
                if (to > from) {
                    drawRoundRect(
                        color = markerColor,
                        topLeft = Offset(from, barTop),
                        // Never thinner than the bar is tall, so a short transition still reads as
                        // a dot rather than a hairline.
                        size = Size((to - from).coerceAtLeast(barHeight), barHeight),
                        cornerRadius = radius,
                    )
                }
            }
            val effectiveFraction = if (dragging && dragFraction != null) dragFraction!! else value
            val filled = size.width * effectiveFraction.coerceIn(0f, 1f)
            if (filled > 0f && !mixing) {
                drawRoundRect(
                    color = activeColor,
                    topLeft = Offset(0f, barTop),
                    size = Size(filled.coerceAtLeast(barHeight), barHeight),
                    cornerRadius = radius,
                )
            }

            // Circular thumb indicator when hovering or dragging
            if (drawThumb && isElevated && size.width > 0f) {
                val rPx = thumbRadius.toPx()
                val cx = if (size.width >= rPx * 2f) {
                    filled.coerceIn(rPx, size.width - rPx)
                } else {
                    filled
                }
                val cy = size.height / 2f
                // Drop shadow
                drawCircle(
                    color = Color.Black.copy(alpha = 0.35f),
                    radius = rPx + 1.5f,
                    center = Offset(cx, cy + 1f),
                )
                // Solid thumb circle
                drawCircle(
                    color = thumbColor,
                    radius = rPx,
                    center = Offset(cx, cy),
                )
            }
        }
        // Composed only while mixing rather than drawn conditionally inside the Canvas above.
        AnimatedVisibility(
            visible = mixing,
            enter = fadeIn(tween(durationMillis = 420)),
            exit = fadeOut(tween(durationMillis = 520)),
        ) {
            DesktopMixSheen(height = height, activeHeight = activeHeight)
        }
    }
}

/**
 * A single soft highlight travelling the length of the bar, over and over, while two tracks are
 * being mixed.
 */
@Composable
private fun DesktopMixSheen(height: Dp, activeHeight: Dp) {
    val transition = rememberInfiniteTransition(label = "mixSheen")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 500, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "mixSheenPhase",
    )
    Canvas(
        Modifier
            .fillMaxWidth()
            .height(activeHeight),
    ) {
        val barHeight = height.toPx()
        val barTop = (size.height - barHeight) / 2f
        val band = size.width * SHEEN_BAND_FRACTION
        // Travels from fully off the left edge to fully off the right, so the highlight enters and
        // leaves rather than materialising mid-bar.
        val centre = -band + (size.width + band * 2f) * phase
        drawRoundRect(
            brush = Brush.linearGradient(
                colorStops = arrayOf(
                    0f to Color.Transparent,
                    0.5f to Color.White.copy(alpha = 0.95f),
                    1f to Color.Transparent,
                ),
                start = Offset(centre - band / 2f, 0f),
                end = Offset(centre + band / 2f, 0f),
            ),
            topLeft = Offset(0f, barTop),
            size = Size(size.width, barHeight),
            cornerRadius = CornerRadius(barHeight / 2f),
        )
    }
}

/** Width of the travelling highlight, as a fraction of the whole bar. */
private const val SHEEN_BAND_FRACTION = 0.7f
