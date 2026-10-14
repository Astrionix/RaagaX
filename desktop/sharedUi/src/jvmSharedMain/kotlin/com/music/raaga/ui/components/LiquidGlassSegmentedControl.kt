package com.music.raaga.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Apple Music-inspired Liquid Glass segmented control.
 *
 * Implements:
 * 1. Horizontally elongated rounded capsule outer track with near-black translucent fill,
 *    subtle hairline border, and restrained glass reflections.
 * 2. Independently rounded active capsule for the selected option ("Apple Music") with
 *    subtle outline, dark translucent obsidian glass surface, delicate specular edge highlight,
 *    and physical layering / shadow elevation above the outer container.
 * 3. Centered, crisp white medium-weight typography for the active segment, and transparent,
 *    visually integrated inactive segments.
 * 4. Physics-based animated sliding transition between segments.
 * 5. Absolutely zero neon glow, garish colors, or exaggerated blur.
 */
@Composable
fun LiquidGlassSegmentedControl(
    items: List<String>,
    selectedIndex: Int,
    onItemSelected: (Int) -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 32.dp,
    trackPadding: Dp = 2.5.dp,
) {
    if (items.isEmpty()) return

    // 01. Outer Container Materials (Crystal water surface tension track)
    val outerTrackFill = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.05f),
            Color.White.copy(alpha = 0.015f),
        ),
    )

    val outerTrackSheen = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.08f),
            Color.White.copy(alpha = 0.02f),
            Color.Transparent,
        ),
    )

    val outerTrackBorder = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.25f), // subtle meniscus rim
            Color.White.copy(alpha = 0.08f),
            Color.White.copy(alpha = 0.03f),
            Color.White.copy(alpha = 0.12f),
        ),
    )

    // 02. Active Capsule Materials (Pure Apple Water Droplet: Crystal fluid body with specular meniscus glint)
    val activeCapsuleFill = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.16f), // top surface tension
            Color.White.copy(alpha = 0.04f), // crystal clear water center
            Color.White.copy(alpha = 0.09f), // bottom refraction
        ),
    )

    val activeCapsuleSheen = Brush.verticalGradient(
        0.0f to Color.White.copy(alpha = 0.38f), // bright sunlight glint on water
        0.42f to Color.White.copy(alpha = 0.05f),
        1.0f to Color.Transparent,
    )

    val activeCapsuleBorder = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.90f), // razor sharp meniscus crest reflection
            Color.White.copy(alpha = 0.35f),
            Color.White.copy(alpha = 0.06f),
            Color.White.copy(alpha = 0.22f), // bottom internal refraction
        ),
    )

    val count = items.size
    val safeSelectedIndex = selectedIndex.coerceIn(0, count - 1)

    BoxWithConstraints(
        modifier = modifier
            .height(height)
            .clip(CircleShape)
            .background(outerTrackFill)
            .background(outerTrackSheen)
            .border(0.75.dp, outerTrackBorder, CircleShape)
            .padding(trackPadding),
    ) {
        val totalWidth = maxWidth
        val segmentWidth = totalWidth / count

        // Fluid spring sliding motion
        val animatedOffset by animateDpAsState(
            targetValue = segmentWidth * safeSelectedIndex,
            animationSpec = spring(
                dampingRatio = 0.82f,
                stiffness = Spring.StiffnessMediumLow,
            ),
            label = "liquidSegmentOffset",
        )

        // Independently rounded active capsule physically layered above the outer container
        Box(
            modifier = Modifier
                .offset(x = animatedOffset)
                .width(segmentWidth)
                .fillMaxHeight()
                .shadow(
                    elevation = 3.dp,
                    shape = CircleShape,
                    spotColor = Color.Black.copy(alpha = 0.14f),
                    ambientColor = Color.Transparent,
                )
                .clip(CircleShape)
                .background(activeCapsuleFill)
                .background(activeCapsuleSheen)
                .border(1.dp, activeCapsuleBorder, CircleShape),
        )

        // Interactive segment labels
        Row(
            modifier = Modifier.fillMaxSize(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            items.forEachIndexed { index, label ->
                val isSelected = index == safeSelectedIndex
                val interaction = remember { MutableInteractionSource() }
                val isHovered by interaction.collectIsHoveredAsState()

                val textColor by animateColorAsState(
                    targetValue = when {
                        isSelected -> Color.White
                        isHovered -> Color.White.copy(alpha = 0.90f)
                        else -> Color.White.copy(alpha = 0.58f)
                    },
                    animationSpec = tween(140),
                    label = "segmentTextColor",
                )

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clip(CircleShape)
                        .clickable(
                            interactionSource = interaction,
                            indication = null,
                            onClick = { onItemSelected(index) },
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = label,
                        color = textColor,
                        fontSize = 12.5.sp,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                        letterSpacing = 0.15.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}

/**
 * Item model for [LiquidGlassVerticalSegmentedNavigation].
 */
data class LiquidGlassNavItem(
    val icon: ImageVector,
    val label: String,
    val selected: Boolean,
    val onClick: () -> Unit,
)

/**
 * Apple Music-inspired Vertical Liquid Glass Segmented Navigation.
 *
 * Designed specifically for primary sidebar navigation items (Home, Explore, Library, Search).
 *
 * Features:
 * - Independently rounded active capsule that fluidly slides vertically with spring physics.
 * - Obsidian dark translucent glass surface with top optical sheen and specular edge rim.
 * - Soft layered drop shadow elevation.
 * - Graceful fade-out when a destination outside this primary group is active.
 * - Subtle hover glass highlight on inactive items.
 */
@Composable
fun LiquidGlassVerticalSegmentedNavigation(
    items: List<LiquidGlassNavItem>,
    modifier: Modifier = Modifier,
    itemHeight: Dp = 40.dp,
    itemSpacing: Dp = 3.dp,
) {
    if (items.isEmpty()) return

    val selectedIndex = items.indexOfFirst { it.selected }
    val hasSelection = selectedIndex >= 0

    // Pure Apple Water Droplet Meniscus Materials
    val activeCapsuleFill = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.16f), // top surface tension
            Color.White.copy(alpha = 0.04f), // crystal clear water belly
            Color.White.copy(alpha = 0.09f), // bottom meniscus
        ),
    )

    val activeCapsuleSheen = Brush.verticalGradient(
        0.0f to Color.White.copy(alpha = 0.38f), // bright water lens reflection
        0.42f to Color.White.copy(alpha = 0.05f),
        1.0f to Color.Transparent,
    )

    val activeCapsuleBorder = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.90f), // razor sharp meniscus crest
            Color.White.copy(alpha = 0.35f),
            Color.White.copy(alpha = 0.06f),
            Color.White.copy(alpha = 0.22f), // bottom internal reflection
        ),
    )

    val itemShape = RoundedCornerShape(12.dp)
    val step = itemHeight + itemSpacing

    val animatedOffset by animateDpAsState(
        targetValue = if (hasSelection) step * selectedIndex else 0.dp,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioNoBouncy,
            stiffness = Spring.StiffnessMediumLow,
        ),
        label = "liquidVerticalOffset",
    )

    val activeAlpha by animateFloatAsState(
        targetValue = if (hasSelection) 1f else 0f,
        animationSpec = tween(180),
        label = "liquidVerticalAlpha",
    )

    Box(modifier = modifier.fillMaxWidth()) {
        // Sliding active Liquid Glass capsule
        if (activeAlpha > 0.001f) {
            Box(
                modifier = Modifier
                    .offset(y = animatedOffset)
                    .fillMaxWidth()
                    .height(itemHeight)
                    .graphicsLayer { alpha = activeAlpha }
                    .shadow(
                        elevation = 3.dp,
                        shape = itemShape,
                        spotColor = Color.Black.copy(alpha = 0.14f),
                        ambientColor = Color.Transparent,
                    )
                    .clip(itemShape)
                    .background(activeCapsuleFill)
                    .background(activeCapsuleSheen)
                    .border(1.dp, activeCapsuleBorder, itemShape),
            )
        }

        // Navigation Item Rows
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(itemSpacing),
        ) {
            items.forEachIndexed { index, item ->
                val interaction = remember { MutableInteractionSource() }
                val isHovered by interaction.collectIsHoveredAsState()
                val isPressed by interaction.collectIsPressedAsState()
                val pressScale by animateFloatAsState(
                    targetValue = if (isPressed) 0.96f else 1f,
                    animationSpec = spring(
                        dampingRatio = Spring.DampingRatioNoBouncy,
                        stiffness = Spring.StiffnessMediumLow,
                    ),
                    label = "navPressScale",
                )
                val iconScale by animateFloatAsState(
                    targetValue = if (item.selected) 1.08f else 1f,
                    animationSpec = spring(
                        dampingRatio = Spring.DampingRatioMediumBouncy,
                        stiffness = Spring.StiffnessMediumLow,
                    ),
                    label = "navIconScale",
                )
                val hoverAlpha by animateFloatAsState(
                    targetValue = if (isHovered && !item.selected) 0.07f else 0f,
                    animationSpec = tween(140),
                    label = "navHoverAlpha",
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(itemHeight)
                        .graphicsLayer {
                            scaleX = pressScale
                            scaleY = pressScale
                        }
                        .clip(itemShape)
                        .hoverable(interaction)
                        .then(
                            if (hoverAlpha > 0.001f) {
                                Modifier
                                    .background(Color.White.copy(alpha = hoverAlpha))
                                    .border(0.5.dp, Color.White.copy(alpha = hoverAlpha * 1.5f), itemShape)
                            } else {
                                Modifier
                            }
                        )
                        .clickable(
                            interactionSource = interaction,
                            indication = null,
                            onClick = item.onClick,
                        )
                        .padding(horizontal = 11.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = item.icon,
                        contentDescription = item.label,
                        tint = if (item.selected) Color.White else Color.White.copy(alpha = if (isHovered) 0.95f else 0.65f),
                        modifier = Modifier
                            .size(19.dp)
                            .graphicsLayer {
                                scaleX = iconScale
                                scaleY = iconScale
                            },
                    )

                    Spacer(Modifier.width(12.dp))

                    Text(
                        text = item.label,
                        color = if (item.selected) Color.White else Color.White.copy(alpha = if (isHovered) 1f else 0.78f),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 13.5.sp,
                            fontWeight = if (item.selected) FontWeight.SemiBold else FontWeight.Normal,
                            letterSpacing = 0.1.sp,
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

