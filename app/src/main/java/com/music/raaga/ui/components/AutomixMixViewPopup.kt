package com.music.raaga.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
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
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.data.settings.AppSettings
import kotlin.math.sin

/**
 * Real-time DJ Mix View Popup showing overlapping waveforms, beat markers,
 * and tempo easing between Track A and Track B across the active Automix transition window.
 */
@Composable
fun AutomixMixViewPopup(
    visible: Boolean,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val meta by AppSettings.automixMetadata.collectAsStateWithLifecycle()

    AnimatedVisibility(
        visible = visible && meta != null,
        enter = fadeIn() + slideInVertically { it / 2 },
        exit = fadeOut() + slideOutVertically { it / 2 },
        modifier = modifier,
    ) {
        val automix = meta ?: return@AnimatedVisibility

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xE6121418))
                .border(
                    width = 1.dp,
                    brush = Brush.verticalGradient(
                        listOf(Color.White.copy(alpha = 0.25f), Color.White.copy(alpha = 0.05f)),
                    ),
                    shape = RoundedCornerShape(24.dp),
                )
                .padding(16.dp),
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF00E676)),
                        )
                        Text(
                            text = "LIVE MIX VIEW",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF00E676),
                            letterSpacing = 1.sp,
                        )
                    }

                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(28.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Close,
                            contentDescription = "Close",
                            tint = Color.White.copy(alpha = 0.7f),
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }

                // BPM & Style Badges
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    val bpmA = automix.tempoA?.let { "%.1f BPM".format(it) } ?: "-- BPM"
                    val bpmB = automix.tempoB?.let { "%.1f BPM".format(it) } ?: "-- BPM"

                    Column {
                        Text(
                            text = "Track A (Outro)",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.6f),
                        )
                        Text(
                            text = bpmA,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF64B5F6),
                        )
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White.copy(alpha = 0.1f))
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Speed,
                            contentDescription = null,
                            tint = Color(0xFFFFD54F),
                            modifier = Modifier.size(14.dp),
                        )
                        Text(
                            text = automix.style,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFFFFD54F),
                        )
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "Track B (Intro)",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.6f),
                        )
                        Text(
                            text = bpmB,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFFF8A80),
                        )
                    }
                }

                // Dual Overlapping Waveform Canvas with Beat Grid Markers
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(80.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF0A0C0E))
                        .border(0.5.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(12.dp)),
                ) {
                    Canvas(modifier = Modifier.matchParentSize()) {
                        val w = size.width
                        val h = size.height
                        val midY = h / 2f

                        // 1. Beat Markers Grid Lines
                        val beatInterval = (w / 16f).coerceAtLeast(10f)
                        var bx = 0f
                        var beatIndex = 0
                        while (bx < w) {
                            val isDownbeat = beatIndex % 4 == 0
                            val lineAlpha = if (isDownbeat) 0.35f else 0.12f
                            val strokeWidth = if (isDownbeat) 1.5.dp.toPx() else 0.75.dp.toPx()
                            drawLine(
                                color = Color.White.copy(alpha = lineAlpha),
                                start = Offset(bx, 0f),
                                end = Offset(bx, h),
                                strokeWidth = strokeWidth,
                            )
                            bx += beatInterval
                            beatIndex++
                        }

                        // 2. Waveform A (Track A Outro - Fading out left to right)
                        val pathA = Path()
                        pathA.moveTo(0f, midY)
                        for (x in 0..w.toInt() step 4) {
                            val xf = x.toFloat()
                            val fadeFactor = (1f - (xf / w)).coerceIn(0f, 1f)
                            val wave = (sin(xf * 0.05f) * 0.5f + sin(xf * 0.12f) * 0.3f) * (h * 0.38f) * fadeFactor
                            pathA.lineTo(xf, midY - wave)
                        }
                        for (x in w.toInt() downTo 0 step 4) {
                            val xf = x.toFloat()
                            val fadeFactor = (1f - (xf / w)).coerceIn(0f, 1f)
                            val wave = (sin(xf * 0.05f) * 0.5f + sin(xf * 0.12f) * 0.3f) * (h * 0.38f) * fadeFactor
                            pathA.lineTo(xf, midY + wave)
                        }
                        pathA.close()
                        drawPath(pathA, color = Color(0x6664B5F6))

                        // 3. Waveform B (Track B Intro - Fading in left to right)
                        val pathB = Path()
                        pathB.moveTo(0f, midY)
                        for (x in 0..w.toInt() step 4) {
                            val xf = x.toFloat()
                            val fadeInFactor = (xf / w).coerceIn(0f, 1f)
                            val wave = (sin(xf * 0.06f) * 0.4f + sin(xf * 0.15f) * 0.4f) * (h * 0.38f) * fadeInFactor
                            pathB.lineTo(xf, midY - wave)
                        }
                        for (x in w.toInt() downTo 0 step 4) {
                            val xf = x.toFloat()
                            val fadeInFactor = (xf / w).coerceIn(0f, 1f)
                            val wave = (sin(xf * 0.06f) * 0.4f + sin(xf * 0.15f) * 0.4f) * (h * 0.38f) * fadeInFactor
                            pathB.lineTo(xf, midY + wave)
                        }
                        pathB.close()
                        drawPath(pathB, color = Color(0x66FF8A80))

                        // Center Transition Point Line
                        drawLine(
                            color = Color(0xFF00E676),
                            start = Offset(w / 2f, 0f),
                            end = Offset(w / 2f, h),
                            strokeWidth = 2.dp.toPx(),
                        )
                    }
                }

                // Footer Info
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    val fadeSec = (automix.transitionDurationMs / 1000f)
                    Text(
                        text = "Transition Window: %.1fs".format(fadeSec),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.7f),
                    )
                    Text(
                        text = "Phase Lock Active",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF00E676),
                    )
                }
            }
        }
    }
}

