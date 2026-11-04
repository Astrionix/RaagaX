package com.music.raaga.ui.components

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.SwitchColors
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.music.raaga.ui.theme.AccentRed
import com.music.raaga.ui.theme.settingsSwitchColors

/**
 * An Apple-style Liquid Glass toggle switch inspired by 0kzh/glisse physics.
 *
 * Visual & physical properties:
 * - Refractive translucent cavity with directional lighting and specular rim highlight
 * - Spherical 3D glass bead thumb with specular micro-glint and realistic elevation shadow
 * - Fluid spring motion with viscous glass elongation on toggle and press
 * - Built-in tactical haptic feedback on state change
 */
@Composable
fun LiquidGlassSwitch(
    checked: Boolean,
    onCheckedChange: ((Boolean) -> Unit)?,
    modifier: Modifier = Modifier,
    thumbContent: (@Composable () -> Unit)? = null,
    enabled: Boolean = true,
    colors: SwitchColors = settingsSwitchColors(),
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val haptic = LocalHapticFeedback.current
    val density = LocalDensity.current
    val isPressed by interactionSource.collectIsPressedAsState()

    // Dimensions: Apple standard proportions
    val trackWidth = 51.dp
    val trackHeight = 30.dp
    val thumbDiameter = 24.dp
    val horizontalPadding = 3.dp

    // Viscous liquid glass elongation: thumb expands slightly when held/sliding
    val thumbWidth by animateDpAsState(
        targetValue = if (isPressed) 28.dp else thumbDiameter,
        animationSpec = spring(dampingRatio = 0.72f, stiffness = 550f),
        label = "glassSwitchThumbWidth"
    )

    // Fluid spring offset calculation
    val maxOffset = trackWidth - horizontalPadding - thumbWidth
    val thumbOffset by animateDpAsState(
        targetValue = if (checked) maxOffset else horizontalPadding,
        animationSpec = spring(dampingRatio = 0.76f, stiffness = 500f),
        label = "glassSwitchThumbOffset"
    )

    // Glass track cavity brushes
    val trackBrush = if (checked) {
        Brush.linearGradient(
            colors = listOf(
                Color(0xFFFF3358), // Luminous specular top-left bloom
                AccentRed,         // Signature Raaga red body
                Color(0xFFD61834)  // Rich shadow bottom-right
            )
        )
    } else {
        Brush.linearGradient(
            colors = listOf(
                Color(0xFF2B2E36).copy(alpha = 0.75f),
                Color(0xFF16181D).copy(alpha = 0.88f)
            )
        )
    }

    // Directional specular rim highlight (simulating overhead studio light source)
    val rimBorderBrush = if (checked) {
        Brush.linearGradient(
            colors = listOf(
                Color.White.copy(alpha = 0.50f), // Top specular sheen
                Color(0xFFFF8599).copy(alpha = 0.65f),
                Color(0xFF7A0012).copy(alpha = 0.35f)  // Inset bottom shadow
            )
        )
    } else {
        Brush.linearGradient(
            colors = listOf(
                Color.White.copy(alpha = 0.28f), // Crisp top reflection
                Color.White.copy(alpha = 0.07f),
                Color.Black.copy(alpha = 0.50f)  // Deep inset ambient rim
            )
        )
    }

    val toggleModifier = if (onCheckedChange != null) {
        Modifier.toggleable(
            value = checked,
            enabled = enabled,
            role = Role.Switch,
            interactionSource = interactionSource,
            indication = null,
            onValueChange = { newValue ->
                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                onCheckedChange(newValue)
            }
        )
    } else {
        Modifier
    }

    Box(
        modifier = modifier
            .alpha(if (enabled) 1f else 0.38f)
            .then(toggleModifier)
            .size(width = trackWidth, height = trackHeight)
            .clip(CircleShape)
            .background(trackBrush)
            .border(width = 1.1.dp, brush = rimBorderBrush, shape = CircleShape),
        contentAlignment = Alignment.CenterStart
    ) {
        // Internal Convex Glass Sheen (Upper half refraction gloss)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(trackHeight / 2)
                .align(Alignment.TopCenter)
                .clip(RoundedCornerShape(topStart = 15.dp, topEnd = 15.dp))
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.White.copy(alpha = if (checked) 0.26f else 0.12f),
                            Color.White.copy(alpha = 0.02f),
                            Color.Transparent
                        )
                    )
                )
        )

        // Refractive Glass Marble Thumb
        val centerPx = with(density) { Offset(8.dp.toPx(), 8.dp.toPx()) }
        val radiusPx = with(density) { 20.dp.toPx() }

        Box(
            modifier = Modifier
                .offset(x = thumbOffset)
                .width(thumbWidth)
                .height(thumbDiameter)
                .shadow(
                    elevation = 3.dp,
                    shape = CircleShape,
                    ambientColor = Color.Black.copy(alpha = 0.45f),
                    spotColor = Color.Black.copy(alpha = 0.55f)
                )
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            Color.White,
                            Color(0xFFF7F8FA),
                            Color(0xFFE3E5EB)
                        ),
                        center = centerPx,
                        radius = radiusPx
                    )
                )
                .border(
                    width = 0.8.dp,
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color.White.copy(alpha = 0.95f),
                            Color.White.copy(alpha = 0.35f)
                        )
                    ),
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            // Micro-specular glint at top-left of the glass sphere
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(start = 4.5.dp, top = 3.5.dp)
                    .size(width = 4.dp, height = 3.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.90f))
            )

            // Optional thumb content (if any icon or badge passed)
            if (thumbContent != null) {
                thumbContent()
            }
        }
    }
}

