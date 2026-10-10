package com.music.raaga.ui.player

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.ui.graphics.Brush
import dev.chrisbanes.haze.HazeStyle
import dev.chrisbanes.haze.HazeTint
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Speaker
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.ui.components.optimizedHazeEffect
import com.music.raaga.ui.utils.containSheetGestures
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.materials.ExperimentalHazeMaterialsApi
import dev.chrisbanes.haze.materials.HazeMaterials
import kotlin.math.roundToInt

import com.music.raaga.ui.components.LiquidGlassTokens
import com.music.raaga.ui.components.liquidGlassSurface
import com.music.raaga.ui.components.liquidGlassCard

import androidx.compose.foundation.Canvas
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut

internal val DRAWER_SHAPE = RoundedCornerShape(24.dp)

/**
 * The widest the drawer itself gets, however wide the window behind it is.
 */
internal val DRAWER_MAX_WIDTH = 480.dp
internal val ROW_SHAPE = RoundedCornerShape(18.dp)
internal val SCRIM_COLOR = Color.Black.copy(alpha = 0.40f)

/**
 * How much of its own height the drawer has to be dragged before letting go
 * dismisses it rather than springing back. A quarter is enough to be a decision
 * and little enough that a flick reads as one.
 */
private const val DISMISS_DRAG_FRACTION = 0.25f

/**
 * The floating optical Liquid Glass lens shell for player sheets:
 * [AudioOutputSheet] and [ListenTogetherMembersSheet] alike.
 */
@OptIn(ExperimentalHazeMaterialsApi::class)
@Composable
fun PlayerDrawer(
    hazeState: HazeState,
    title: String,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    /** Air between the title and whatever the drawer opens with. */
    titleGap: Dp = 14.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    val reduceDynamicBlur by PlayerSettings.reduceDynamicBlur.collectAsStateWithLifecycle()

    var drag by remember { mutableFloatStateOf(0f) }
    var height by remember { mutableIntStateOf(0) }
    val offset by animateFloatAsState(
        targetValue = drag,
        animationSpec = spring(stiffness = Spring.StiffnessMediumLow),
        label = "playerDrawerOffset",
    )
    val scrimAlpha = if (height > 0) (1f - offset / height).coerceIn(0f, 1f) else 1f

    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }

    val dismissOnRelease: () -> Unit = {
        if (height > 0 && drag > height * DISMISS_DRAG_FRACTION) onDismiss() else drag = 0f
    }
    val drawerScroll = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                if (drag <= 0f || available.y >= 0f) return Offset.Zero
                val used = available.y.coerceAtLeast(-drag)
                drag += used
                return Offset(0f, used)
            }

            override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                if (source == NestedScrollSource.UserInput && available.y > 0f) drag += available.y
                if (drag > 0f && available.y < 0f) {
                    val used = available.y.coerceAtLeast(-drag)
                    drag += used
                    return Offset(0f, used)
                }
                return available
            }

            override suspend fun onPreFling(available: Velocity): Velocity {
                if (drag <= 0f) return Velocity.Zero
                dismissOnRelease()
                return available
            }

            override suspend fun onPostFling(consumed: Velocity, available: Velocity) = available
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .containSheetGestures()
            .background(SCRIM_COLOR.copy(alpha = SCRIM_COLOR.alpha * scrimAlpha))
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
                onClick = onDismiss,
            ),
        contentAlignment = Alignment.Center,
    ) {
        AnimatedVisibility(
            visible = shown,
            enter = scaleIn(
                animationSpec = spring(
                    dampingRatio = 0.82f,
                    stiffness = Spring.StiffnessMediumLow,
                ),
                initialScale = 0.94f,
            ) + fadeIn(tween(220, easing = FastOutSlowInEasing)),
            exit = scaleOut(tween(180)) + fadeOut(tween(150)),
        ) {
            Box(
                modifier = Modifier
                    .padding(horizontal = 16.dp, vertical = 20.dp)
                    .widthIn(max = DRAWER_MAX_WIDTH)
                    .fillMaxWidth()
                    .onSizeChanged { height = it.height }
                    .offset { IntOffset(0, offset.roundToInt()) }
                    .shadow(
                        elevation = 24.dp,
                        shape = DRAWER_SHAPE,
                        spotColor = Color.Black.copy(alpha = 0.35f),
                        ambientColor = Color.Transparent,
                    )
                    .clip(DRAWER_SHAPE)
                    .then(
                        if (reduceDynamicBlur) {
                            Modifier.background(Color(0xFF0F172A))
                        } else {
                            Modifier.liquidGlassSurface(hazeState = hazeState, shape = DRAWER_SHAPE)
                        }
                    )
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() },
                        onClick = {},
                    )
                    .then(if (drawerFollowsListScroll) Modifier.nestedScroll(drawerScroll) else Modifier)
                    .pointerInput(height) {
                        detectVerticalDragGestures(
                            onDragEnd = dismissOnRelease,
                            onDragCancel = { drag = 0f },
                        ) { _, delta ->
                            drag = (drag + delta).coerceAtLeast(0f)
                        }
                    }
                    .padding(horizontal = 18.dp, vertical = 14.dp),
            ) {
                // Internal optical water droplet meniscus & specular caustics
                Canvas(Modifier.matchParentSize()) {
                    val cornerRadius = CornerRadius(32.dp.toPx())

                    // 1. Diagonal crystal specular refraction streak
                    drawRoundRect(
                        brush = Brush.linearGradient(
                            listOf(
                                Color.Transparent,
                                Color.White.copy(alpha = 0.05f),
                                Color.White.copy(alpha = 0.12f),
                                Color.White.copy(alpha = 0.04f),
                                Color.Transparent,
                            ),
                            start = Offset(size.width * 0.10f, size.height * 0.15f),
                            end = Offset(size.width * 0.95f, size.height * 0.55f),
                        ),
                        size = size,
                        cornerRadius = cornerRadius,
                    )

                    // 2. Corner luminous water droplet flare
                    drawCircle(
                        brush = Brush.radialGradient(
                            listOf(
                                Color.White.copy(alpha = 0.14f),
                                Color.White.copy(alpha = 0.05f),
                                Color.Transparent,
                            ),
                            center = Offset(size.width * 0.92f, size.height * 0.94f),
                            radius = size.width * 0.35f,
                        ),
                        center = Offset(size.width * 0.92f, size.height * 0.94f),
                        radius = size.width * 0.35f,
                    )
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 580.dp)
                        .verticalScroll(rememberScrollState()),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    // The water drop grab handle capsule
                    Box(
                        Modifier
                            .padding(bottom = 8.dp)
                            .size(width = 38.dp, height = 4.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.horizontalGradient(
                                    listOf(
                                        Color.White.copy(alpha = 0.25f),
                                        Color.White.copy(alpha = 0.75f),
                                        Color.White.copy(alpha = 0.25f),
                                    )
                                )
                            ),
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 2.dp, end = 2.dp, bottom = titleGap),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(34.dp)
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.12f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Speaker,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(19.dp),
                                )
                            }
                            Spacer(Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = title,
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = Color.White,
                                )
                                Text(
                                    text = "Select output device & routing",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.White.copy(alpha = 0.65f),
                                )
                            }
                        }
                        IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                            Icon(
                                imageVector = Icons.Rounded.Close,
                                contentDescription = "Close",
                                tint = Color.White.copy(alpha = 0.65f),
                                modifier = Modifier.size(18.dp),
                            )
                        }
                    }
                    content()
                }
            }
        }
    }
}
