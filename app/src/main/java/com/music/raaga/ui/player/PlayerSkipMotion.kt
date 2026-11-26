package com.music.raaga.ui.player

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationState
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.animateTo
import androidx.compose.animation.core.isFinished
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathNode
import androidx.compose.ui.graphics.vector.VectorPath
import androidx.compose.ui.graphics.vector.toPath
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.vectorResource
import androidx.compose.ui.unit.Dp
import com.music.raaga.R
import com.music.raaga.ui.rememberIsForeground
import kotlinx.coroutines.flow.first

private object SkipMotion {
    const val DurationMs = 600
    const val FrontGone = 0.35f
    const val Settled = 0.90f
    const val NewOnset = 0.28f
    const val CircleDiameter = 1.7f
    const val CircleAlpha = 0.08f
    const val CircleFeatherStart = 0.92f
    const val CircleInMs = 45
    const val CircleOutMs = 100
    const val CircleHoldMs = 125
    const val MaxStartSlope = 2f
    const val MillisPerSecond = 1000f
}

/** Visual intent only. The owner still calls its original playback action on click. */
class PlayerSkipMotion internal constructor(
    internal val active: State<Boolean>,
    internal val reduceMotion: State<Boolean>,
) {
    internal var cycles by mutableStateOf(AnimationState(0f))
    internal var requestedCycles by mutableIntStateOf(0)
    internal var targetCycles by mutableStateOf(0f)

    fun onTap() {
        targetCycles = playerSkipTarget(cycles.value, targetCycles)
        requestedCycles++
    }
}

internal fun playerSkipTarget(cycles: Float, target: Float): Float {
    val boundary = cycles - cycles % 1f + 1f
    return if (cycles < target) boundary + 1f else boundary
}

@Composable
fun rememberPlayerSkipMotion(active: Boolean, reduceMotion: Boolean): PlayerSkipMotion {
    val foreground = rememberIsForeground()
    val activeState = rememberUpdatedState(active && foreground)
    val reduceMotionState = rememberUpdatedState(reduceMotion)
    val motion = remember { PlayerSkipMotion(activeState, reduceMotionState) }
    LaunchedEffect(motion.requestedCycles, active, foreground, reduceMotion) {
        val cycles = motion.cycles
        val target = motion.targetCycles
        val distance = target - cycles.value
        if (!active || !foreground || reduceMotion) {
            motion.cycles = AnimationState(target)
        } else if (distance > 0f) {
            val continuing = !cycles.isFinished
            val velocity = if (continuing && cycles.velocity > 0f) cycles.velocity else 0f
            val baseSpeed = SkipMotion.MillisPerSecond / SkipMotion.DurationMs
            val initialVelocity = if (continuing) velocity else baseSpeed
            val startSlope = (initialVelocity / (distance * baseSpeed)).coerceIn(0f, SkipMotion.MaxStartSlope)
            val duration = (distance * SkipMotion.DurationMs).toInt().coerceAtLeast(1)
            cycles.animateTo(
                targetValue = target,
                animationSpec = tween(durationMillis = duration, easing = ConveyorEase(startSlope)),
                sequentialAnimation = continuing,
            )
        }
    }
    return motion
}

internal class ConveyorEase(private val startSlope: Float) : Easing {
    override fun transform(fraction: Float): Float {
        val t = fraction.coerceIn(0f, 1f)
        val s = startSlope.coerceIn(0f, SkipMotion.MaxStartSlope)
        val inv = 1f - t
        return 3f * (1f - s / 3f) * inv * t * t + t * t * t + s * inv * inv * t
    }
}

internal data class PlayerSkipPose(
    val frontScale: Float,
    val frontAlpha: Float,
    val survivorTravel: Float,
    val newScale: Float,
    val newAlpha: Float,
)

internal fun playerSkipPose(progress: Float): PlayerSkipPose {
    val p = progress.coerceIn(0f, 1f)
    val frontScale = if (p < SkipMotion.FrontGone) (1f - p / SkipMotion.FrontGone).coerceAtLeast(0f) else 0f
    val frontAlpha = if (p < SkipMotion.FrontGone) (1f - p / SkipMotion.FrontGone).coerceAtLeast(0f) else 0f
    val survivorTravel = if (p < SkipMotion.Settled) (p / SkipMotion.Settled).coerceIn(0f, 1f) else 1f
    val newProgress = if (p >= SkipMotion.NewOnset) {
        ((p - SkipMotion.NewOnset) / (SkipMotion.Settled - SkipMotion.NewOnset)).coerceIn(0f, 1f)
    } else 0f
    val newScale = newProgress
    val newAlpha = newProgress
    return PlayerSkipPose(frontScale, frontAlpha, survivorTravel, newScale, newAlpha)
}

@Composable
fun PlayerSkipGlyph(
    motion: PlayerSkipMotion,
    contentDescription: String,
    tint: Color,
    modifier: Modifier = Modifier,
    previous: Boolean = false,
) {
    val resource = if (previous) R.drawable.ic_player_previous else R.drawable.ic_player_next
    val vector = ImageVector.vectorResource(resource)
    if (vector.root.size == 0) {
        Icon(
            painter = painterResource(resource),
            contentDescription = contentDescription,
            tint = tint,
            modifier = modifier,
        )
        return
    }
    val nodes = (vector.root[0] as VectorPath).pathData
    val arrows = remember(nodes) { SkipArrows(nodes) }
    Icon(
        painter = painterResource(resource),
        contentDescription = contentDescription,
        tint = tint,
        modifier = modifier.drawWithContent {
            val p = motion.cycles.value % 1f
            if (!motion.active.value || motion.reduceMotion.value || p == 0f || p >= SkipMotion.Settled) {
                drawContent()
            } else {
                val pose = playerSkipPose(p)
                scale(size.width / vector.viewportWidth, size.height / vector.viewportHeight,
                    pivot = Offset.Zero) {
                    if (pose.frontAlpha > 0f && pose.frontScale > 0f) {
                        scale(pose.frontScale, pivot = arrows.frontCenter) {
                            drawPath(arrows.front, tint, alpha = pose.frontAlpha)
                        }
                    }
                    translate(arrows.shiftX * pose.survivorTravel, arrows.shiftY * pose.survivorTravel) {
                        drawPath(arrows.back, tint)
                    }
                    if (pose.newAlpha > 0f && pose.newScale > 0f) {
                        scale(pose.newScale, pivot = arrows.backCenter) {
                            drawPath(arrows.back, tint, alpha = pose.newAlpha)
                        }
                    }
                }
            }
        },
    )
}

/** The drawable's two arrowhead contours, split once at its last MoveTo. */
private class SkipArrows(nodes: List<PathNode>) {
    val back: Path
    val front: Path
    val backCenter: Offset
    val frontCenter: Offset
    val shiftX: Float
    val shiftY: Float

    init {
        val split = nodes.indexOfLast { it is PathNode.MoveTo }
        back = nodes.subList(0, split).toPath()
        front = nodes.subList(split, nodes.size).toPath()
        backCenter = back.getBounds().center
        frontCenter = front.getBounds().center
        shiftX = frontCenter.x - backCenter.x
        shiftY = frontCenter.y - backCenter.y
    }
}

/** Expanded player only. No pointer handler, touch target, or semantics changes. */
@Composable
internal fun Modifier.playerSkipPressCircle(
    motion: PlayerSkipMotion,
    interactionSource: MutableInteractionSource,
    enabled: Boolean,
    tint: Color,
    glyphSize: Dp,
    diameter: Dp,
): Modifier {
    val target = motion.targetCycles
    return playerPressCircle(
        interactionSource = interactionSource,
        trigger = motion.requestedCycles,
        enabled = enabled && motion.active.value,
        reduceMotion = motion.reduceMotion.value,
        tint = tint,
        glyphSize = glyphSize,
        diameter = diameter,
        minimumHoldMs = SkipMotion.CircleHoldMs,
        hasMotion = { motion.cycles.value < target },
        settled = { true },
    )
}

/** Draw-only feedback shared by expanded transport controls, never mini buttons. */
@Composable
internal fun Modifier.playerPressCircle(
    interactionSource: MutableInteractionSource,
    trigger: Int,
    enabled: Boolean,
    reduceMotion: Boolean,
    tint: Color,
    glyphSize: Dp,
    diameter: Dp,
    hasMotion: () -> Boolean,
    settled: () -> Boolean,
    minimumHoldMs: Int = 0,
): Modifier {
    val pressed by interactionSource.collectIsPressedAsState()
    val foreground = rememberIsForeground()
    val opacity = remember { Animatable(0f) }
    val hold = remember { Animatable(0f) }
    var consumedTrigger by remember { mutableIntStateOf(trigger) }
    val currentSettled by rememberUpdatedState(settled)
    LaunchedEffect(pressed, trigger, foreground, enabled, reduceMotion) {
        val clicked = trigger != consumedTrigger
        consumedTrigger = trigger
        if (!foreground || !enabled || reduceMotion) {
            opacity.snapTo(0f)
        } else if (pressed || clicked || hasMotion()) {
            opacity.animateTo(1f, tween(SkipMotion.CircleInMs, easing = LinearOutSlowInEasing))
            if (!pressed) {
                if (minimumHoldMs > 0) {
                    hold.snapTo(0f)
                    hold.animateTo(1f, tween(minimumHoldMs))
                }
                snapshotFlow { currentSettled() }.first { it }
                opacity.animateTo(0f, tween(SkipMotion.CircleOutMs))
            }
        } else {
            opacity.animateTo(0f, tween(SkipMotion.CircleOutMs))
        }
    }
    return drawWithCache {
        val circleSize = minOf(diameter.toPx(), glyphSize.toPx() * SkipMotion.CircleDiameter)
        val radius = circleSize / 2f
        val fill = tint.copy(alpha = tint.alpha * SkipMotion.CircleAlpha)
        val brush = Brush.radialGradient(
            0f to fill,
            SkipMotion.CircleFeatherStart to fill,
            1f to tint.copy(alpha = 0f),
            center = Offset(size.width / 2f, size.height / 2f),
            radius = radius,
        )
        onDrawBehind {
            if (enabled && foreground && !reduceMotion) {
                drawCircle(brush, radius = radius, alpha = opacity.value)
            }
        }
    }
}
