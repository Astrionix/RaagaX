package com.music.raaga.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.R
import com.music.raaga.data.settings.AppSettings
import com.music.raaga.ui.theme.settingsSwitchColors
import dev.chrisbanes.haze.HazeState
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.math.roundToInt

/**
 * Frosted pop-up displaying live Automix status, beat-matching metrics, and
 * transition settings.
 */
@Composable
fun MixViewDialog(
    hazeState: HazeState,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val smartFadeEnabled by AppSettings.smartFadeEnabled.collectAsStateWithLifecycle()
    val smartMixBlend by AppSettings.smartMixBlend.collectAsStateWithLifecycle()
    val transitionWindow by AppSettings.smartTransitionWindow.collectAsStateWithLifecycle()

    AudioPopupCard(
        hazeState = hazeState,
        title = "Automix",
        subtitle = "DJ-Style Loop Mix & Beat Sync",
        doneLabel = stringResource(R.string.done),
        onDismiss = onDismiss,
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
        ) {
            val isBlending = smartMixBlend != null
            val accentColor = when {
                isBlending -> Color(0xFF30D158) // iOS green
                smartFadeEnabled -> Color(0xFF0A84FF) // iOS blue
                else -> Color.White.copy(alpha = 0.35f)
            }

            // Subtle pulsing animation for active state
            val infiniteTransition = rememberInfiniteTransition(label = "mixPulse")
            val pulseAlpha by infiniteTransition.animateFloat(
                initialValue = 0.45f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(900, easing = LinearEasing),
                    repeatMode = RepeatMode.Reverse,
                ),
                label = "pulseAlpha",
            )

            // --- 1. Live Status Hero Card ---
            val statusGradient = when {
                isBlending -> Brush.verticalGradient(
                    listOf(Color(0xFF1B3828), Color(0xFF102218))
                )
                smartFadeEnabled -> Brush.verticalGradient(
                    listOf(Color(0xFF142B47), Color(0xFF0E1A2B))
                )
                else -> Brush.verticalGradient(
                    listOf(Color(0xFF222224), Color(0xFF18181A))
                )
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(statusGradient)
                    .border(
                        width = 1.dp,
                        color = accentColor.copy(alpha = if (isBlending || smartFadeEnabled) 0.35f else 0.15f),
                        shape = RoundedCornerShape(14.dp),
                    )
                    .padding(horizontal = 14.dp, vertical = 13.dp),
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        // Badge / Status Chip
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(7.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (isBlending || smartFadeEnabled) {
                                            accentColor.copy(alpha = pulseAlpha)
                                        } else {
                                            accentColor
                                        }
                                    ),
                            )
                            Text(
                                text = when {
                                    isBlending -> "LIVE MIX ACTIVE"
                                    smartFadeEnabled -> "MIX STANDBY"
                                    else -> "DISABLED"
                                },
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp,
                                    fontSize = 11.sp,
                                ),
                                color = accentColor,
                            )
                        }

                        // Tempo / BPM pill tag
                        val bpm = smartMixBlend?.beatMs?.takeIf { it > 0f }?.let { (60_000f / it).roundToInt() }
                        if (bpm != null) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(accentColor.copy(alpha = 0.18f))
                                    .padding(horizontal = 7.dp, vertical = 2.dp),
                            ) {
                                Text(
                                    text = "$bpm BPM",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 10.sp,
                                    ),
                                    color = accentColor,
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(8.dp))

                    val window = transitionWindow
                    val (primaryText, secondaryText) = when {
                        isBlending -> {
                            "Phase-Locked Beat Match" to "Smoothly transitioning to next song"
                        }
                        window != null -> {
                            val start = (window.start * 100).toInt()
                            val end = (window.end * 100).toInt()
                            val timingText = if (start == end || kotlin.math.abs(start - end) <= 1) {
                                "Transition starts at $start%"
                            } else {
                                "Transition window: $start% – $end%"
                            }
                            "Ready to Crossfade" to timingText
                        }
                        smartFadeEnabled -> {
                            "Analyzing Track Rhythm" to "Detecting BPM & optimal phrase boundaries"
                        }
                        else -> {
                            "Automix is Turned Off" to "Enable below for seamless DJ mixing"
                        }
                    }

                    Text(
                        text = primaryText,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                        ),
                        color = Color.White,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = secondaryText,
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontSize = 12.sp,
                        ),
                        color = Color.White.copy(alpha = 0.7f),
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            // --- 2. Dynamic 4-Beat Meter ---
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 2.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "BEAT SYNC PHRASE",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.8.sp,
                        fontSize = 10.sp,
                    ),
                    color = Color.White.copy(alpha = 0.5f),
                )
                Text(
                    text = if (isBlending) "Phase Lock 4/4" else "4-Beat Measure",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium,
                    ),
                    color = if (isBlending) accentColor else Color.White.copy(alpha = 0.4f),
                )
            }

            Spacer(Modifier.height(6.dp))

            var activeBeat by remember { mutableIntStateOf(1) }
            val blend = smartMixBlend
            LaunchedEffect(blend) {
                if (blend != null && blend.playing && blend.beatMs > 0f) {
                    val beatMs = blend.beatMs.toLong().coerceAtLeast(100L)
                    while (isActive) {
                        val elapsedNanos = System.nanoTime() - blend.beatAnchorNanos
                        val beatIndex = ((elapsedNanos / (beatMs * 1_000_000L)) % 4).toInt()
                        activeBeat = (if (beatIndex < 0) beatIndex + 4 else beatIndex) + 1
                        delay(20L)
                    }
                } else {
                    activeBeat = 1
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                for (b in 1..4) {
                    val isCurrent = isBlending && activeBeat == b
                    val beatBg by animateColorAsState(
                        targetValue = if (isCurrent) accentColor.copy(alpha = 0.35f) else Color.White.copy(alpha = 0.05f),
                        label = "beatBg$b",
                    )
                    val beatBorder by animateColorAsState(
                        targetValue = if (isCurrent) accentColor else Color.White.copy(alpha = 0.12f),
                        label = "beatBorder$b",
                    )
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(34.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(beatBg)
                            .border(1.dp, beatBorder, RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            if (isCurrent) {
                                Box(
                                    modifier = Modifier
                                        .size(5.dp)
                                        .clip(CircleShape)
                                        .background(accentColor),
                                )
                            }
                            Text(
                                text = "Beat $b",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium,
                                    fontSize = 11.sp,
                                ),
                                color = if (isCurrent) Color.White else Color.White.copy(alpha = 0.45f),
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(14.dp))

            // --- 3. Grouped Features Container ---
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White.copy(alpha = 0.05f))
                    .padding(horizontal = 12.dp, vertical = 4.dp),
            ) {
                MixFeatureRow(
                    icon = Icons.Rounded.Speed,
                    title = "Tempo Alignment",
                    description = "Adapts BPM smoothly without pitch distortion",
                )
                HorizontalDivider(
                    thickness = 0.5.dp,
                    color = Color.White.copy(alpha = 0.07f),
                )
                MixFeatureRow(
                    icon = Icons.Rounded.GraphicEq,
                    title = "Harmonic Bass Handoff",
                    description = "Swaps low frequencies to prevent muddy sound",
                )
                HorizontalDivider(
                    thickness = 0.5.dp,
                    color = Color.White.copy(alpha = 0.07f),
                )
                MixFeatureRow(
                    icon = Icons.Rounded.Tune,
                    title = "Seamless In/Out Points",
                    description = "Crossfades at natural musical phrase boundaries",
                )
            }

            Spacer(Modifier.height(12.dp))

            // --- 4. Smart Automix Switch Card ---
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White.copy(alpha = 0.08f))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        text = "Smart Automix",
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                        ),
                        color = Color.White,
                    )
                    Spacer(Modifier.height(1.dp))
                    Text(
                        text = "Continuous DJ transitions between songs",
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontSize = 12.sp,
                        ),
                        color = Color.White.copy(alpha = 0.65f),
                    )
                }
                Spacer(Modifier.width(8.dp))
                Switch(
                    checked = smartFadeEnabled,
                    onCheckedChange = AppSettings::setSmartFadeEnabled,
                    colors = settingsSwitchColors(),
                )
            }
        }
    }
}

@Composable
private fun MixFeatureRow(
    icon: ImageVector,
    title: String,
    description: String,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color.White.copy(alpha = 0.08f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.85f),
                modifier = Modifier.size(17.dp),
            )
        }
        Column(Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                ),
                color = Color.White,
            )
            Spacer(Modifier.height(1.dp))
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall.copy(
                    fontSize = 11.5.sp,
                    lineHeight = 15.sp,
                ),
                color = Color.White.copy(alpha = 0.65f),
            )
        }
    }
}
