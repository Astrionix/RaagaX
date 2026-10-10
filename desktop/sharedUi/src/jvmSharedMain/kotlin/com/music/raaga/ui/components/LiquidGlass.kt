package com.music.raaga.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeStyle
import dev.chrisbanes.haze.HazeTint

/**
 * Aether Desktop / Raaga Liquid Glass Design System
 *
 * Implements physical optical materials:
 * 1. Surface Tension & Meniscus (asymmetric 4-stop specular highlights, convex top edge & lower rim)
 * 2. Optical Refraction & Warm Saturation Bleed (crystal translucency with warm copper/amber undertones)
 * 3. Tactile Droplet Pods (concentric radial lens containers)
 * 4. Recessed Optical Channels (concave groove tracks with luminous fluid fill)
 * 5. Dynamic Active Glow & Internal Lens Illumination (vivid emerald / cyan radiance)
 */
object LiquidGlassTokens {
    val DrawerShape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp)
    val PanelShape = RoundedCornerShape(24.dp)
    val CardShape = RoundedCornerShape(18.dp)
    val SubCardShape = RoundedCornerShape(14.dp)
    val PillShape = RoundedCornerShape(50)

    val ScrimColor = Color.Black.copy(alpha = 0.05f)

    // 01. Specular Meniscus Borders (Curved light-bending reflections with 4-stop depth)
    val MeniscusBorderDrawer = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.82f),
            Color.White.copy(alpha = 0.22f),
            Color.White.copy(alpha = 0.04f),
            Color.White.copy(alpha = 0.12f),
        ),
    )

    val MeniscusBorderCard = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.55f),
            Color.White.copy(alpha = 0.16f),
            Color.White.copy(alpha = 0.03f),
            Color.White.copy(alpha = 0.09f),
        ),
    )

    val MeniscusBorderActive = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.92f),
            Color.White.copy(alpha = 0.35f),
            Color.White.copy(alpha = 0.08f),
            Color.White.copy(alpha = 0.25f),
        ),
    )

    // 02. Optical Translucency & Crystal Liquid Sheen
    val SurfaceSheen = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.10f),
            Color.White.copy(alpha = 0.02f),
            Color.White.copy(alpha = 0.005f),
            Color.White.copy(alpha = 0.035f),
        ),
    )

    val CardSheenInactive = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.10f),
            Color.White.copy(alpha = 0.03f),
            Color.White.copy(alpha = 0.01f),
            Color.White.copy(alpha = 0.04f),
        ),
    )

    val CardSheenActive = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.14f),
            Color.White.copy(alpha = 0.04f),
            Color.White.copy(alpha = 0.06f),
        ),
    )

    // 03. Lens-like Radial Pod Sheen
    val PodInactive = Brush.radialGradient(
        listOf(
            Color.White.copy(alpha = 0.20f),
            Color.White.copy(alpha = 0.04f),
        ),
    )

    val PodActive = Brush.radialGradient(
        listOf(
            Color.White.copy(alpha = 0.35f),
            Color.White.copy(alpha = 0.08f),
        ),
    )

    // 04. Recessed Optical Glass Groove Channels
    val RecessedChannelSheen = Brush.verticalGradient(
        listOf(
            Color.Black.copy(alpha = 0.35f),
            Color.Black.copy(alpha = 0.15f),
            Color.White.copy(alpha = 0.08f),
        ),
    )

    val RecessedChannelBorder = Brush.verticalGradient(
        listOf(
            Color.Black.copy(alpha = 0.45f),
            Color.White.copy(alpha = 0.08f),
            Color.White.copy(alpha = 0.24f),
        ),
    )

    val LuminousFluidFill = Brush.horizontalGradient(
        listOf(
            Color.White.copy(alpha = 0.85f),
            Color.White,
            Color.White.copy(alpha = 0.90f),
        ),
    )
}

/**
 * Applies full Liquid Glass material with Haze diffusion, refraction sheen, and specular meniscus border.
 */
fun Modifier.liquidGlassSurface(
    hazeState: HazeState,
    shape: Shape = LiquidGlassTokens.DrawerShape,
    blurRadius: Dp = 3.dp,
): Modifier = this
    .clip(shape)
    .optimizedHazeEffect(
        state = hazeState,
        style = HazeStyle(
            backgroundColor = Color.Transparent,
            tints = listOf(
                HazeTint(Color.White.copy(alpha = 0.04f)),
            ),
            blurRadius = blurRadius,
            noiseFactor = 0f,
        ),
    )
    .background(LiquidGlassTokens.SurfaceSheen)
    .border(1.dp, LiquidGlassTokens.MeniscusBorderDrawer, shape)

/**
 * Applies a tactile Liquid Glass card material to rows, devices, and action cards.
 */
fun Modifier.liquidGlassCard(
    active: Boolean = false,
    shape: Shape = LiquidGlassTokens.CardShape,
    accentBorder: Color? = null,
): Modifier = this
    .clip(shape)
    .background(
        if (active) LiquidGlassTokens.CardSheenActive
        else LiquidGlassTokens.CardSheenInactive,
    )
    .border(
        width = 1.dp,
        brush = if (accentBorder != null) {
            Brush.verticalGradient(
                listOf(accentBorder.copy(alpha = 0.85f), accentBorder.copy(alpha = 0.35f)),
            )
        } else if (active) {
            LiquidGlassTokens.MeniscusBorderActive
        } else {
            LiquidGlassTokens.MeniscusBorderCard
        },
        shape = shape,
    )

/**
 * Interactive version of liquidGlassCard with spring-driven hover luminance and tactile press compression.
 */
@Composable
fun Modifier.interactiveLiquidGlassCard(
    active: Boolean = false,
    shape: Shape = LiquidGlassTokens.CardShape,
    accentBorder: Color? = null,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
): Modifier {
    val isHovered by interactionSource.collectIsHoveredAsState()
    val isPressed by interactionSource.collectIsPressedAsState()

    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.985f else if (isHovered) 1.008f else 1.0f,
        animationSpec = spring(stiffness = 500f, dampingRatio = 0.8f),
        label = "liquidCardScale",
    )

    val hoverAlpha by animateFloatAsState(
        targetValue = if (isHovered) 0.16f else 0.0f,
        animationSpec = spring(stiffness = 400f),
        label = "liquidCardHoverAlpha",
    )

    return this
        .scale(scale)
        .clip(shape)
        .background(
            if (active) LiquidGlassTokens.CardSheenActive
            else Brush.verticalGradient(
                listOf(
                    Color.White.copy(alpha = 0.12f + hoverAlpha),
                    Color.White.copy(alpha = 0.03f + hoverAlpha * 0.5f),
                    Color.White.copy(alpha = 0.01f),
                    Color.White.copy(alpha = 0.05f),
                )
            ),
        )
        .border(
            width = 1.dp,
            brush = if (accentBorder != null) {
                Brush.verticalGradient(
                    listOf(accentBorder.copy(alpha = 0.85f), accentBorder.copy(alpha = 0.35f)),
                )
            } else if (active) {
                LiquidGlassTokens.MeniscusBorderActive
            } else if (isHovered) {
                Brush.verticalGradient(
                    listOf(
                        Color.White.copy(alpha = 0.75f),
                        Color.White.copy(alpha = 0.28f),
                        Color.White.copy(alpha = 0.06f),
                        Color.White.copy(alpha = 0.18f),
                    )
                )
            } else {
                LiquidGlassTokens.MeniscusBorderCard
            },
            shape = shape,
        )
}

/**
 * Circular lens-like icon/avatar container with radial highlight.
 */
fun Modifier.liquidDropletPod(
    active: Boolean = false,
): Modifier = this
    .clip(CircleShape)
    .background(
        if (active) LiquidGlassTokens.PodActive
        else LiquidGlassTokens.PodInactive,
    )
    .border(
        width = 1.dp,
        color = if (active) Color.White.copy(alpha = 0.65f) else Color.White.copy(alpha = 0.22f),
        shape = CircleShape,
    )

/**
 * Recessed optical glass groove channel for sliders and volume controls.
 */
fun Modifier.recessedGlassChannel(
    shape: Shape = CircleShape,
): Modifier = this
    .clip(shape)
    .background(LiquidGlassTokens.RecessedChannelSheen)
    .border(1.dp, LiquidGlassTokens.RecessedChannelBorder, shape)
