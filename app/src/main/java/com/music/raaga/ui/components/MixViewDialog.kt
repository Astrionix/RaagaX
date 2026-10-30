package com.music.raaga.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.R
import com.music.raaga.data.settings.AppSettings
import dev.chrisbanes.haze.HazeState
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.math.roundToInt

/**
 * Frosted pop-up displaying live Automix status, beat-matching metrics, and
 * transition settings — mirroring BitChord v1.9's new Automix mix view popup.
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
    val performanceMode by AppSettings.automixPerformanceMode.collectAsStateWithLifecycle()

    AudioPopupCard(
        hazeState = hazeState,
        title = "Automix",
        subtitle = "DJ-Style Loop Mix & Beat Sync",
        doneLabel = stringResource(R.string.done),
        onDismiss = onDismiss,
        modifier = modifier,
    ) {
        val scrollState = rememberScrollState()
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(scrollState)
                .padding(vertical = 4.dp),
        ) {
            // Live Status Card
            val isBlending = smartMixBlend != null
            val accentColor = when {
                isBlending -> Color(0xFF30D158) // iOS green
                smartFadeEnabled -> Color(0xFF0A84FF) // iOS blue
                else -> Color.White.copy(alpha = 0.35f)
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(accentColor.copy(alpha = 0.12f))
                    .border(1.dp, accentColor.copy(alpha = 0.28f), RoundedCornerShape(12.dp))
                    .padding(14.dp),
            ) {
                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(accentColor),
                        )
                        Text(
                            text = when {
                                isBlending -> "LIVE BLEND IN PROGRESS"
                                smartFadeEnabled -> "AUTOMIX STANDBY"
                                else -> "AUTOMIX DISABLED"
                            },
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp,
                            ),
                            color = accentColor,
                        )
                    }

                    Spacer(Modifier.height(6.dp))

                    val bpm = smartMixBlend?.beatMs?.takeIf { it > 0f }?.let { (60_000f / it).roundToInt() }
                    Text(
                        text = when {
                            isBlending && bpm != null -> "Phase-Locked • Tempo synced at $bpm BPM"
                            isBlending -> "Phase-Locked • Beat-matching active"
                            transitionWindow != null -> {
                                val start = (transitionWindow!!.start * 100).toInt()
                                val end = (transitionWindow!!.end * 100).toInt()
                                "Transition armed at $start% – $end% duration"
                            }
                            smartFadeEnabled -> "Analyzing beat grid and track energy"
                            else -> "Enable Smart Transitions below to mix tracks"
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.9f),
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            // 4-Beat Bar Grid Visualizer
            Text(
                text = "BEAT GRID",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp,
                ),
                color = Color.White.copy(alpha = 0.5f),
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
            )

            Spacer(Modifier.height(4.dp))

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
                        targetValue = if (isCurrent) accentColor.copy(alpha = 0.35f) else Color.White.copy(alpha = 0.06f),
                        label = "beatBg$b",
                    )
                    val beatBorder by animateColorAsState(
                        targetValue = if (isCurrent) accentColor else Color.White.copy(alpha = 0.12f),
                        label = "beatBorder$b",
                    )
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(36.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(beatBg)
                            .border(1.dp, beatBorder, RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "$b",
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                            color = if (isCurrent) Color.White else Color.White.copy(alpha = 0.5f),
                        )
                    }
                }
            }

            Spacer(Modifier.height(18.dp))

            // Engine capabilities
            MixFeatureRow(
                icon = Icons.Rounded.Speed,
                title = "Tempo Ease & Beat Stretch",
                description = "WSOLA & Signalsmith time-stretch adapts tempo between tracks",
            )
            MixFeatureRow(
                icon = Icons.Rounded.GraphicEq,
                title = "Frequency Equalization",
                description = "Bass handoff and filter sweeps avoid vocal and kick clashes",
            )
            MixFeatureRow(
                icon = Icons.Rounded.Tune,
                title = "Analysis Mode",
                description = "Mode: ${performanceMode.name.lowercase().replaceFirstChar { it.uppercase() }}",
            )

            Spacer(Modifier.height(14.dp))

            // Smart Fade Toggle
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White.copy(alpha = 0.05f))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        text = "Smart Automix",
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                        color = Color.White,
                    )
                    Text(
                        text = "Beat-aware smart loop transitions",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.6f),
                    )
                }
                Switch(
                    checked = smartFadeEnabled,
                    onCheckedChange = AppSettings::setSmartFadeEnabled,
                    colors = SwitchDefaults.colors(
                        checkedTrackColor = MaterialTheme.colorScheme.primary,
                        checkedBorderColor = MaterialTheme.colorScheme.primary,
                    ),
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
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = Color.White.copy(alpha = 0.7f),
            modifier = Modifier.size(20.dp),
        )
        Column(Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                color = Color.White,
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.6f),
            )
        }
    }
}
