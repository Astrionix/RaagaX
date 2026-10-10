package com.music.raaga.desktop

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.hazeEffect

/** What the column beside the page is showing. */
internal enum class DesktopSidePanel { LYRICS, QUEUE, CONNECT }

/**
 * Apple Music's right-hand sidebar: the lyrics, the queue or connect to device in a floating
 * optical liquid glass column beside the page, mirroring the left sidebar.
 */
@Composable
internal fun DesktopSidePanelColumn(
    panel: DesktopSidePanel?,
    onClose: () -> Unit,
    content: @Composable (DesktopSidePanel) -> Unit,
) {
    // Held through the exit, so the column slides out with what it had in it rather than empty.
    var shown by remember { mutableStateOf(panel) }
    if (panel != null) shown = panel

    val haze = LocalDesktopHaze.current
    val reduceDynamicBlur by DesktopAppearanceSettings.reduceDynamicBlur.collectAsState()
    val panelShape = RoundedCornerShape(24.dp)

    // Pure Optical Water Droplet Meniscus Border with sharp top specular highlight
    val glassRim = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.85f),
            Color.White.copy(alpha = 0.28f),
            Color.White.copy(alpha = 0.06f),
            Color.White.copy(alpha = 0.22f),
        ),
    )

    // Genuine Transparent Water Droplet Sheen - crystal transmission, zero dark slate
    val glassSheen = Brush.verticalGradient(
        listOf(
            Color.White.copy(alpha = 0.16f),
            Color.White.copy(alpha = 0.03f),
            Color.White.copy(alpha = 0.01f),
            Color.White.copy(alpha = 0.05f),
        ),
    )

    AnimatedVisibility(
        visible = panel != null,
        enter = expandHorizontally(tween(SLIDE_MS, easing = FastOutSlowInEasing), expandFrom = Alignment.Start) +
            fadeIn(tween(SLIDE_MS)),
        exit = shrinkHorizontally(tween(SLIDE_MS, easing = FastOutSlowInEasing), shrinkTowards = Alignment.Start) +
            fadeOut(tween(SLIDE_MS / 2)),
    ) {
        Box(
            modifier = Modifier
                .width(SIDE_PANEL_WIDTH)
                .fillMaxHeight()
                .padding(start = 6.dp, top = 12.dp, bottom = 14.dp, end = 14.dp),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .shadow(
                        elevation = 12.dp,
                        shape = panelShape,
                        spotColor = Color.Black.copy(alpha = 0.28f),
                        ambientColor = Color.Transparent,
                    )
                    .clip(panelShape)
                    .then(
                        if (haze != null && !reduceDynamicBlur) {
                            Modifier.hazeEffect(state = haze) {
                                blurEnabled = true
                                backgroundColor = Color.Transparent
                                blurRadius = 24.dp
                                noiseFactor = 0f
                                tints = listOf(
                                    HazeTint(Color.White.copy(alpha = 0.03f)),
                                )
                            }
                        } else {
                            Modifier.background(
                                Brush.verticalGradient(
                                    listOf(
                                        Color.White.copy(alpha = 0.14f),
                                        Color.White.copy(alpha = 0.04f),
                                        Color.White.copy(alpha = 0.02f),
                                        Color.White.copy(alpha = 0.06f),
                                    ),
                                ),
                            )
                        }
                    )
                    .background(glassSheen)
                    .border(1.dp, glassRim, panelShape)
                    .clip(panelShape),
            ) {
                Crossfade(
                    targetState = shown ?: return@Box,
                    modifier = Modifier.fillMaxSize().clip(panelShape),
                    animationSpec = tween(CROSSFADE_MS),
                    label = "sidePanel",
                ) { which ->
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(panelShape),
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(if (which == DesktopSidePanel.QUEUE) 38.dp else 50.dp)
                                .padding(start = 18.dp, end = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (which != DesktopSidePanel.QUEUE) {
                                Text(
                                    text = when (which) {
                                        DesktopSidePanel.LYRICS -> DesktopStrings["lyrics", "Lyrics"]
                                        DesktopSidePanel.CONNECT -> DesktopStrings["connect_to_device", "Connect to a device"]
                                        DesktopSidePanel.QUEUE -> ""
                                    },
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.weight(1f),
                                )
                            } else {
                                Spacer(Modifier.weight(1f))
                            }
                            // Tactile Frosted Glass Close Pod
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .shadow(2.dp, CircleShape, spotColor = Color.Black.copy(alpha = 0.25f))
                                    .clip(CircleShape)
                                    .background(
                                        Brush.verticalGradient(
                                            listOf(
                                                Color.White.copy(alpha = 0.20f),
                                                Color.White.copy(alpha = 0.08f),
                                            ),
                                        ),
                                    )
                                    .border(
                                        width = 0.8.dp,
                                        brush = Brush.verticalGradient(
                                            listOf(
                                                Color.White.copy(alpha = 0.50f),
                                                Color.White.copy(alpha = 0.15f),
                                            ),
                                        ),
                                        shape = CircleShape,
                                    )
                                    .clickable(onClick = onClose),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Rounded.Close,
                                    DesktopStrings["close", "Close"],
                                    tint = Color.White.copy(alpha = 0.90f),
                                    modifier = Modifier.size(15.dp),
                                )
                            }
                        }
                        if (which != DesktopSidePanel.QUEUE) {
                            HorizontalDivider(
                                color = Color.White.copy(alpha = 0.08f),
                                thickness = 0.5.dp,
                                modifier = Modifier.padding(horizontal = 14.dp),
                            )
                        }
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .weight(1f)
                                .clip(RoundedCornerShape(bottomStart = 24.dp, bottomEnd = 24.dp))
                                .padding(
                                    start = if (which == DesktopSidePanel.LYRICS) 16.dp else 12.dp,
                                    end = if (which == DesktopSidePanel.LYRICS) 16.dp else 8.dp,
                                    top = 6.dp,
                                    bottom = 12.dp,
                                ),
                        ) {
                            content(which)
                        }
                    }
                }
            }
        }
    }
}

private val SIDE_PANEL_WIDTH = 360.dp
private const val SLIDE_MS = 260
private const val CROSSFADE_MS = 180
