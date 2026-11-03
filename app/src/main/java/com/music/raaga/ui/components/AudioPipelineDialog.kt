package com.music.raaga.ui.components

import android.media.AudioFormat
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutLinearInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.InsertDriveFile
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Memory
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.R
import com.music.raaga.data.NerdStats
import com.music.raaga.data.settings.AppSettings
import com.music.raaga.playback.AudioOutputStatus
import com.music.raaga.playback.audio.AudioDiagnostics
import com.music.raaga.playback.audio.TransportType
import com.music.raaga.ui.screens.library.RaagaCobaltBlue
import com.music.raaga.ui.utils.containSheetGestures
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.materials.ExperimentalHazeMaterialsApi
import dev.chrisbanes.haze.materials.HazeMaterials
import java.util.Locale
import kotlin.math.roundToInt

private val SHEET_CORNER = 26.dp
private val SHEET_MAX_WIDTH = 560.dp
private val SHEET_BG_COLOR = Color(0xFF141416)
private val SUMMARY_BG_COLOR = Color(0xFF1C1C1E)
private val TEXT_MUTED = Color(0xFF8E8E93)
private val PIPELINE_SCRIM_COLOR = Color.Black.copy(alpha = 0.55f)

/**
 * Whether decoded samples are reaching the output unaltered, and what is
 * altering them when they aren't.
 */
private fun bitExactVerdict(
    outputExact: Boolean,
    outputExactDetail: String?,
    loudnessActive: Boolean,
    eqActive: Boolean,
    spatialActive: Boolean,
): String = when {
    loudnessActive -> "No — loudness normalization"
    eqActive -> "No — equalizer"
    spatialActive -> "No — spatial audio"
    outputExact -> "Yes${outputExactDetail?.let { " ($it)" }.orEmpty()}"
    else -> "No — ${outputExactDetail ?: "converted downstream"}"
}

/**
 * Compact & Minimal Audio Pipeline diagnostics bottom sheet.
 *
 * Displays live, authoritative details for each stage in the audio pipeline:
 * Track Info -> Decoder -> Resampler -> DSP -> Output Device.
 */
@OptIn(ExperimentalHazeMaterialsApi::class)
@Composable
fun AudioPipelineDialog(
    hazeState: HazeState,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    isPlaying: Boolean = false,
) {
    val nerdStats by NerdStats.current.collectAsStateWithLifecycle()
    val outputStatus by AudioOutputStatus.current.collectAsStateWithLifecycle()
    val reduceDynamicBlur by AppSettings.reduceDynamicBlur.collectAsStateWithLifecycle()

    val eqEnabled by AppSettings.equalizerEnabled.collectAsStateWithLifecycle()
    val eqPreset by AppSettings.equalizerPreset.collectAsStateWithLifecycle()
    val spatialAudio by AppSettings.spatialAudio.collectAsStateWithLifecycle()
    val loudnessNormalization by AppSettings.loudnessNormalization.collectAsStateWithLifecycle()
    val diagSnapshot by AudioDiagnostics.snapshot.collectAsStateWithLifecycle()
    val bypassOnUsb by AppSettings.bypassSystemEffectsOnUsb.collectAsStateWithLifecycle()

    val configuration = LocalConfiguration.current
    val density = LocalDensity.current
    val maxSheetHeight = (configuration.screenHeightDp.dp * 0.88f).coerceIn(400.dp, 720.dp)

    // Bottom sheet slide animation state
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }

    // Gesture physics: Drag down to dismiss
    var dragOffset by remember { mutableFloatStateOf(0f) }
    val animatedDragOffset by animateFloatAsState(
        targetValue = dragOffset,
        animationSpec = spring(stiffness = Spring.StiffnessMediumLow),
        label = "audioPipelineSheetDrag",
    )

    val dismissThresholdPx = with(density) { 110.dp.toPx() }
    val dismissOnRelease: (Float) -> Unit = { velocityY ->
        if (velocityY > 750f || dragOffset > dismissThresholdPx) {
            onDismiss()
        } else {
            dragOffset = 0f
        }
    }

    val nestedScrollConnection = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                if (dragOffset > 0f && available.y < 0f) {
                    val consumed = available.y.coerceAtLeast(-dragOffset)
                    dragOffset += consumed
                    return Offset(0f, consumed)
                }
                return Offset.Zero
            }

            override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                if (source == NestedScrollSource.UserInput && available.y > 0f) {
                    dragOffset += available.y
                    return Offset(0f, available.y)
                }
                return Offset.Zero
            }

            override suspend fun onPreFling(available: Velocity): Velocity {
                if (dragOffset > 0f) {
                    dismissOnRelease(available.y)
                    return available
                }
                return Velocity.Zero
            }
        }
    }

    // Outer full-screen scrim container
    Box(
        modifier = modifier
            .fillMaxSize()
            .containSheetGestures()
            .background(PIPELINE_SCRIM_COLOR)
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
                onClick = onDismiss,
            ),
        contentAlignment = Alignment.BottomCenter,
    ) {
        AnimatedVisibility(
            visible = shown,
            enter = slideInVertically(
                animationSpec = spring(
                    dampingRatio = Spring.DampingRatioNoBouncy,
                    stiffness = Spring.StiffnessMediumLow,
                ),
            ) { it },
            exit = slideOutVertically(
                animationSpec = tween(
                    durationMillis = 180,
                    easing = FastOutLinearInEasing,
                ),
            ) { it },
        ) {
            Column(
                modifier = Modifier
                    .widthIn(max = SHEET_MAX_WIDTH)
                    .fillMaxWidth()
                    .heightIn(max = maxSheetHeight)
                    .offset { IntOffset(0, animatedDragOffset.roundToInt()) }
                    .clip(RoundedCornerShape(topStart = SHEET_CORNER, topEnd = SHEET_CORNER))
                    .then(
                        if (reduceDynamicBlur) {
                            Modifier.background(SHEET_BG_COLOR)
                        } else {
                            Modifier
                                .optimizedHazeEffect(
                                    state = hazeState,
                                    style = HazeMaterials.regular(SHEET_BG_COLOR),
                                )
                                .background(SHEET_BG_COLOR.copy(alpha = 0.96f))
                        }
                    )
                    .border(
                        width = 0.75.dp,
                        brush = Brush.verticalGradient(
                            listOf(
                                Color.White.copy(alpha = 0.16f),
                                Color.White.copy(alpha = 0.04f),
                                Color.Transparent,
                            ),
                        ),
                        shape = RoundedCornerShape(topStart = SHEET_CORNER, topEnd = SHEET_CORNER),
                    )
                    .nestedScroll(nestedScrollConnection)
                    .pointerInput(Unit) {
                        val velocityTracker = VelocityTracker()
                        detectVerticalDragGestures(
                            onDragStart = { velocityTracker.resetTracking() },
                            onDragEnd = {
                                val velocityY = velocityTracker.calculateVelocity().y
                                dismissOnRelease(velocityY)
                            },
                            onDragCancel = { dragOffset = 0f },
                        ) { change, delta ->
                            velocityTracker.addPosition(change.uptimeMillis, change.position)
                            if (delta > 0 || dragOffset > 0) {
                                dragOffset = (dragOffset + delta).coerceAtLeast(0f)
                            }
                        }
                    }
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() },
                        onClick = {}, // Prevent tap through
                    ),
            ) {
                // Drag handle
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp, bottom = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        modifier = Modifier
                            .size(width = 36.dp, height = 4.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.25f)),
                    )
                }

                // Scrollable content area
                Column(
                    modifier = Modifier
                        .weight(1f, fill = false)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp),
                ) {
                    // Header (Center-aligned)
                    Text(
                        text = stringResource(R.string.audio_pipeline),
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontSize = 22.sp,
                            fontWeight = FontWeight.SemiBold,
                        ),
                        color = Color.White,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text(
                        text = stringResource(R.string.audio_pipeline_subtitle),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 14.sp,
                        ),
                        color = TEXT_MUTED,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 2.dp, bottom = 14.dp),
                    )

                    // Pipeline Summary Data Calculations
                    val dspActive = (loudnessNormalization && outputStatus.loudnessGainDb != null) || eqEnabled || spatialAudio
                    val isDirectUsb = outputStatus.transportType == TransportType.DIRECT_USB || outputStatus.isUsb
                    val isDirectTrack = outputStatus.directPlaybackActual
                    val inRate = nerdStats?.sampleRateHz ?: 44100
                    val outRate = outputStatus.actualSampleRateHz ?: inRate
                    val isBitExact = outputStatus.outputExact && !dspActive && (inRate == outRate)
                    val isHiRes = (nerdStats?.isHiRes == true) || (outRate > 48000)

                    val routeTag = when {
                        isDirectUsb -> "USB DAC"
                        outputStatus.routeKind == com.music.raaga.playback.AudioRouting.Kind.BLUETOOTH -> "Bluetooth"
                        outputStatus.routeKind == com.music.raaga.playback.AudioRouting.Kind.WIRED -> "Headphones"
                        else -> "Speaker"
                    }

                    val srcCodec = NerdStats.codecLabel(nerdStats?.mimeType) ?: nerdStats?.mimeType ?: "PCM"
                    val srcDepth = nerdStats?.bitDepth?.let { "$it-bit" }
                        ?: nerdStats?.claimed?.bitDepth?.let { "$it-bit" }
                        ?: "16-bit"
                    val srcRate = nerdStats?.sampleRateHz?.let { "%.1f kHz".format(Locale.ROOT, it / 1000f) } ?: "44.1 kHz"
                    val srcSummary = "$srcCodec $srcDepth / $srcRate"

                    val dstDepth = when (outputStatus.actualEncoding) {
                        AudioFormat.ENCODING_PCM_FLOAT -> "32-bit Float"
                        AudioFormat.ENCODING_PCM_24BIT_PACKED -> "24-bit"
                        AudioFormat.ENCODING_PCM_32BIT -> "32-bit"
                        else -> "16-bit"
                    }
                    val dstRate = (outputStatus.actualSampleRateHz ?: inRate).let { "%.1f kHz".format(Locale.ROOT, it / 1000f) }
                    val dstSummary = "DAC $dstDepth / $dstRate"

                    val devLabel = outputStatus.directUsbProbe?.productName
                        ?: outputStatus.deviceName.ifBlank { null }

                    // Compact Signal Summary Container
                    CompactSignalSummary(
                        dspActive = dspActive,
                        isBitExact = isBitExact,
                        isDirectUsb = isDirectUsb,
                        isDirectTrack = isDirectTrack,
                        isHiRes = isHiRes,
                        routeTag = routeTag,
                        srcSummary = srcSummary,
                        dstSummary = dstSummary,
                        devLabel = devLabel,
                    )

                    Spacer(Modifier.height(18.dp))

                    // 1. Track Info Stage
                    val sourceName = nerdStats?.sourceName ?: "—"
                    val format = NerdStats.codecLabel(nerdStats?.mimeType) ?: nerdStats?.mimeType ?: "—"
                    val bitDepth = nerdStats?.bitDepth?.let { "$it-bit" }
                        ?: nerdStats?.claimed?.bitDepth?.let { "$it-bit" }
                        ?: "—"
                    val sampleRate = nerdStats?.sampleRateHz?.let { "$it Hz" }
                        ?: nerdStats?.claimed?.sampleRateHz?.let { "$it Hz" }
                        ?: "—"
                    val bitrate = nerdStats?.bitrateKbps?.let { "$it kbps" } ?: "—"
                    val channels = when (nerdStats?.channels) {
                        1 -> stringResource(R.string.mono)
                        2 -> stringResource(R.string.stereo)
                        null -> "—"
                        else -> "${nerdStats?.channels} (Surround)"
                    }

                    PipelineStage(
                        icon = Icons.AutoMirrored.Rounded.InsertDriveFile,
                        title = stringResource(R.string.pipeline_track_info),
                        isFirst = true,
                        isLast = false,
                        isPlaying = isPlaying,
                    ) {
                        PipelinePropertyRow(stringResource(R.string.pipeline_source), sourceName)
                        PipelinePropertyRow(stringResource(R.string.pipeline_format), format)
                        PipelinePropertyRow(stringResource(R.string.pipeline_bit_depth), bitDepth)
                        PipelinePropertyRow(stringResource(R.string.pipeline_sample_rate), sampleRate)
                        PipelinePropertyRow(stringResource(R.string.pipeline_bitrate), bitrate)
                        PipelinePropertyRow(stringResource(R.string.pipeline_channels), channels)
                    }

                    // 2. Decoder Stage
                    val decoderName = outputStatus.decoderName ?: "—"
                    val decoderFormat = outputStatus.decoderOutputEncoding
                        ?: (nerdStats?.bitDepth?.let { "PCM $it-bit" } ?: "PCM 16-bit")

                    PipelineStage(
                        icon = Icons.Rounded.Memory,
                        title = stringResource(R.string.pipeline_decoder),
                        isFirst = false,
                        isLast = false,
                        isPlaying = isPlaying,
                    ) {
                        PipelinePropertyRow(stringResource(R.string.pipeline_decoder_name), decoderName)
                        PipelinePropertyRow(stringResource(R.string.pipeline_format), decoderFormat)
                    }

                    // 3. Resampler Stage
                    val rawInRate = nerdStats?.sampleRateHz
                    val rawOutRate = outputStatus.actualSampleRateHz ?: rawInRate
                    val isPassthrough = rawInRate != null && rawOutRate != null && rawInRate == rawOutRate
                    val ioRateText = if (rawInRate != null && rawOutRate != null) {
                        "$rawInRate Hz → $rawOutRate Hz"
                    } else if (rawInRate != null) {
                        "$rawInRate Hz → —"
                    } else if (rawOutRate != null) {
                        "— → $rawOutRate Hz"
                    } else {
                        "—"
                    }
                    val resamplerType = when {
                        rawInRate == null && rawOutRate == null -> "—"
                        isPassthrough -> "None"
                        else -> "System Resampler"
                    }
                    val cutoffText = if (isPassthrough) "None (Passthrough)" else "Nyquist (Optimal)"
                    val qualityText = when {
                        rawInRate == null && rawOutRate == null -> "—"
                        isPassthrough -> "Passthrough"
                        else -> "Resampled"
                    }

                    PipelineStage(
                        icon = Icons.Rounded.Tune,
                        title = stringResource(R.string.pipeline_resampler),
                        isFirst = false,
                        isLast = false,
                        isPlaying = isPlaying,
                    ) {
                        PipelinePropertyRow(stringResource(R.string.pipeline_io_rate), ioRateText)
                        PipelinePropertyRow(stringResource(R.string.pipeline_type), resamplerType)
                        PipelinePropertyRow(stringResource(R.string.pipeline_cutoff), cutoffText)
                        PipelinePropertyRow(stringResource(R.string.pipeline_quality), qualityText)
                    }

                    // 4. DSP Stage
                    val pcmFormat = outputStatus.dspFormat
                    val activeEffectsList = mutableListOf<String>()
                    if (eqEnabled) {
                        val presetName = eqPreset.name.lowercase().replace('_', ' ').replaceFirstChar { it.uppercase() }
                        activeEffectsList.add("Equalizer ($presetName)")
                    }
                    if (spatialAudio) {
                        activeEffectsList.add("Bauer Spatial Audio")
                    }
                    if (loudnessNormalization && outputStatus.loudnessGainDb != null) {
                        val gainText = "%+.1f dB".format(Locale.ROOT, outputStatus.loudnessGainDb)
                        activeEffectsList.add("Loudness ($gainText)")
                    }
                    val activeEffectsText = if (activeEffectsList.isEmpty()) "None (Direct Pass)" else activeEffectsList.joinToString(", ")

                    val peakDb = diagSnapshot.pcmMetrics.peakDbfs
                    val peakVal = if (peakDb > -90f) {
                        String.format(Locale.US, "%.1f dBFS (%s)", peakDb, if (diagSnapshot.pcmMetrics.isClipping) "Clipping" else "Clean")
                    } else {
                        "Idle"
                    }
                    val rmsDb = diagSnapshot.pcmMetrics.rmsDbfs
                    val rmsVal = if (rmsDb > -90f) String.format(Locale.US, "%.1f dBFS", rmsDb) else "Idle"
                    val pcmMetricsText = "$peakVal / $rmsVal"

                    val buffersText = outputStatus.bufferSize?.let { size ->
                        val rate = outputStatus.actualSampleRateHz
                        val bytesPerSample = when (outputStatus.actualEncoding) {
                            AudioFormat.ENCODING_PCM_FLOAT, AudioFormat.ENCODING_PCM_32BIT -> 4
                            AudioFormat.ENCODING_PCM_24BIT_PACKED -> 3
                            else -> 2
                        }
                        val channelCount = nerdStats?.channels ?: 2
                        val bytesPerFrame = bytesPerSample * channelCount
                        val frames = if (bytesPerFrame > 0) size / bytesPerFrame else 0
                        if (rate != null && rate > 0 && frames > 0) {
                            val ms = (frames * 1000L) / rate
                            "2x (${ms}ms, $frames frames)"
                        } else {
                            "—"
                        }
                    } ?: "—"

                    PipelineStage(
                        icon = Icons.Rounded.GraphicEq,
                        title = stringResource(R.string.pipeline_dsp),
                        isFirst = false,
                        isLast = false,
                        isPlaying = isPlaying,
                    ) {
                        PipelinePropertyRow(stringResource(R.string.pipeline_pcm_format), pcmFormat)
                        PipelinePropertyRow("Active Effects", activeEffectsText)
                        PipelinePropertyRow("PCM Peak / RMS", pcmMetricsText)
                        PipelinePropertyRow(stringResource(R.string.pipeline_buffers), buffersText)
                        PipelinePropertyRow(stringResource(R.string.pipeline_output_api), outputStatus.sink.ifBlank { "AAudio" })
                    }

                    // 5. Output Device Stage
                    val deviceName = outputStatus.deviceName.ifBlank { "System default" }
                    val audioTrackEncoding = when (outputStatus.actualEncoding) {
                        AudioFormat.ENCODING_PCM_FLOAT -> "Float 32-bit"
                        AudioFormat.ENCODING_PCM_24BIT_PACKED -> "PCM 24-bit"
                        AudioFormat.ENCODING_PCM_32BIT -> "PCM 32-bit"
                        AudioFormat.ENCODING_PCM_16BIT -> "PCM 16-bit"
                        else -> "Float 32-bit"
                    }
                    val audioTrackRate = outputStatus.actualSampleRateHz ?: nerdStats?.sampleRateHz ?: 48000
                    val audioTrackRateText = "$audioTrackRate Hz"

                    val channelConfigText = when (nerdStats?.channels) {
                        1 -> "Mono (1.0)"
                        2 -> "Stereo (2.0)"
                        null -> "Stereo (2.0)"
                        else -> "${nerdStats?.channels} Channels"
                    }

                    val exactVerdict = bitExactVerdict(
                        outputExact = outputStatus.outputExact,
                        outputExactDetail = outputStatus.outputExactDetail,
                        loudnessActive = loudnessNormalization && outputStatus.loudnessGainDb != null,
                        eqActive = eqEnabled,
                        spatialActive = spatialAudio,
                    )

                    val directStatusText = when {
                        outputStatus.transportType == TransportType.DIRECT_USB ->
                            "Active (Direct Userspace USB)"
                        outputStatus.directPlaybackActual ->
                            "Active (Direct AudioTrack, Bypasses Mixer)"
                        outputStatus.directPlaybackRejected ->
                            "Rejected"
                        outputStatus.directPlaybackSupported ->
                            "Supported (Framework Mixed)"
                        else ->
                            "Not Supported (Mixed Path)"
                    }

                    PipelineStage(
                        icon = Icons.AutoMirrored.Rounded.VolumeUp,
                        title = stringResource(R.string.pipeline_output_device),
                        isFirst = false,
                        isLast = true,
                        isPlaying = isPlaying,
                    ) {
                        PipelinePropertyRow(stringResource(R.string.pipeline_device_name), deviceName)
                        PipelinePropertyRow("Output Format", audioTrackEncoding)
                        PipelinePropertyRow(stringResource(R.string.pipeline_sample_rate), audioTrackRateText)
                        PipelinePropertyRow("Channel Config", channelConfigText)
                        PipelinePropertyRow(
                            label = "Bit-Perfect",
                            value = exactVerdict,
                            valueColor = if (exactVerdict.startsWith("Yes")) Color(0xFF10B981) else Color.White,
                        )
                        PipelinePropertyRow("Route / Transport", "${outputStatus.routeKind.name} / ${outputStatus.transportType.label}")
                        PipelinePropertyRow("Direct Path", directStatusText)

                        if (outputStatus.isUsb || outputStatus.routeKind == com.music.raaga.playback.AudioRouting.Kind.USB) {
                            PipelinePropertyRow("USB DAC Purity", if (bypassOnUsb) "Bit-Clean (OEM Effects Bypassed)" else "Standard (OEM Effects Active)")
                        }

                        outputStatus.usbEndpointFormat?.let {
                            PipelinePropertyRow("USB Capability", formatUsbCapability(it))
                        }

                        outputStatus.directUsbProbe?.takeIf { it.productName != null }?.let { probe ->
                            val ratesText = "Max ${probe.maxCalculatedSampleRate / 1000} kHz (${probe.supportedBitDepths.joinToString("/")}-bit)"
                            PipelinePropertyRow("Hardware USB DAC", ratesText)
                        }

                        if (outputStatus.routeKind == com.music.raaga.playback.AudioRouting.Kind.BLUETOOTH) {
                            val bt = outputStatus.bluetoothTelemetry
                            val codecLabel = if (bt != null && bt.isConnected && bt.hasNamedCodec) bt.codecName else "System Managed"
                            PipelinePropertyRow("Bluetooth Codec", codecLabel)
                            if (bt != null && bt.isConnected) {
                                bt.bitDepth?.let { PipelinePropertyRow("Codec Bits", "$it-bit") }
                                bt.sampleRateHz?.let { PipelinePropertyRow("Codec Rate", "$it Hz") }
                                PipelinePropertyRow("Codec Bitrate", bt.bitrateLabel)
                            }
                        }

                        if (outputStatus.fallbackReason != com.music.raaga.playback.audio.FallbackReason.NONE) {
                            val fallbackText = outputStatus.fallbackDetail ?: outputStatus.fallbackReason.label
                            PipelinePropertyRow("Fallback", fallbackText)
                        }
                    }

                    Spacer(Modifier.height(14.dp))
                }

                // Fixed Done Button at bottom
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SHEET_BG_COLOR)
                        .navigationBarsPadding()
                        .padding(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 14.dp),
                ) {
                    val buttonInteraction = remember { MutableInteractionSource() }
                    val isPressed by buttonInteraction.collectIsPressedAsState()

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .clip(CircleShape)
                            .background(if (isPressed) RaagaCobaltBlue.copy(alpha = 0.85f) else RaagaCobaltBlue)
                            .clickable(
                                interactionSource = buttonInteraction,
                                indication = null,
                                onClick = onDismiss,
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = stringResource(R.string.done),
                            style = MaterialTheme.typography.bodyLarge.copy(
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold,
                            ),
                            color = Color.White,
                        )
                    }
                }
            }
        }
    }
}

/**
 * Small, horizontally balanced signal summary container.
 */
@Composable
private fun CompactSignalSummary(
    dspActive: Boolean,
    isBitExact: Boolean,
    isDirectUsb: Boolean,
    isDirectTrack: Boolean,
    isHiRes: Boolean,
    routeTag: String,
    srcSummary: String,
    dstSummary: String,
    devLabel: String?,
) {
    val statusText = when {
        isBitExact && (isDirectUsb || isDirectTrack) -> "BIT-PERFECT"
        isBitExact -> "BIT-PERFECT"
        isHiRes && (isDirectTrack || isDirectUsb) && !dspActive -> "HI-RES DIRECT"
        dspActive -> "DSP ACTIVE"
        else -> "ACTIVE SIGNAL"
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(SUMMARY_BG_COLOR)
            .border(0.75.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Status indicator row with badge
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(RaagaCobaltBlue),
                )
                Text(
                    text = statusText,
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.8.sp,
                        fontSize = 11.sp,
                    ),
                    color = RaagaCobaltBlue,
                )
            }
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(Color.White.copy(alpha = 0.08f))
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            ) {
                Text(
                    text = routeTag,
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                    ),
                    color = Color.White.copy(alpha = 0.75f),
                )
            }
        }

        // Horizontal Signal Flow: Input -> Arrow -> Output
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = srcSummary,
                style = MaterialTheme.typography.bodySmall.copy(
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Medium,
                ),
                color = Color.White.copy(alpha = 0.85f),
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "→",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                ),
                color = RaagaCobaltBlue,
                modifier = Modifier.padding(horizontal = 8.dp),
            )
            Text(
                text = dstSummary,
                style = MaterialTheme.typography.bodySmall.copy(
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                ),
                color = Color.White,
                textAlign = TextAlign.End,
                modifier = Modifier.weight(1f),
            )
        }

        if (!devLabel.isNullOrBlank()) {
            Text(
                text = devLabel,
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 10.5.sp,
                ),
                color = Color.White.copy(alpha = 0.45f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/**
 * Clean vertical timeline stage with small circular outline icon and connecting line.
 */
@Composable
private fun PipelineStage(
    icon: ImageVector,
    title: String,
    isFirst: Boolean = false,
    isLast: Boolean = false,
    isPlaying: Boolean = false,
    content: @Composable () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min),
    ) {
        // Left Column: Timeline Icon (32dp) + Continuous Line centered at x = 18dp
        Box(
            modifier = Modifier
                .width(36.dp)
                .fillMaxHeight()
                .drawBehind {
                    val centerX = size.width / 2f
                    val iconCenterY = 16.dp.toPx()
                    val lineColor = if (isPlaying) RaagaCobaltBlue.copy(alpha = 0.35f) else Color.White.copy(alpha = 0.12f)
                    val strokeW = 1.5.dp.toPx()

                    // Line from top down to icon center (if not first stage)
                    if (!isFirst) {
                        drawLine(
                            color = lineColor,
                            start = Offset(centerX, 0f),
                            end = Offset(centerX, iconCenterY),
                            strokeWidth = strokeW,
                            cap = StrokeCap.Round,
                        )
                    }
                    // Line from icon center down to bottom of stage (if not last stage)
                    if (!isLast) {
                        drawLine(
                            color = lineColor,
                            start = Offset(centerX, iconCenterY),
                            end = Offset(centerX, size.height),
                            strokeWidth = strokeW,
                            cap = StrokeCap.Round,
                        )
                    }
                },
            contentAlignment = Alignment.TopCenter,
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .background(SHEET_BG_COLOR, CircleShape)
                    .border(
                        1.dp,
                        if (isPlaying) RaagaCobaltBlue.copy(alpha = 0.70f) else Color.White.copy(alpha = 0.22f),
                        CircleShape,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = if (isPlaying) RaagaCobaltBlue else Color.White.copy(alpha = 0.85f),
                    modifier = Modifier.size(15.dp),
                )
            }
        }

        Spacer(Modifier.width(12.dp))

        // Right Column: Section Header & Property Table
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(bottom = if (isLast) 4.dp else 16.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall.copy(
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                ),
                color = Color.White,
                modifier = Modifier.padding(top = 5.dp, bottom = 6.dp),
            )
            content()

            if (!isLast) {
                HorizontalDivider(
                    modifier = Modifier.padding(top = 10.dp),
                    thickness = 0.5.dp,
                    color = Color.White.copy(alpha = 0.07f),
                )
            }
        }
    }
}

/**
 * Declarative 2-column property row ensuring consistent alignment across all sections.
 */
@Composable
private fun PipelinePropertyRow(
    label: String,
    value: String,
    valueColor: Color = Color.White,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.5.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall.copy(
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Normal,
                lineHeight = 17.sp,
            ),
            color = TEXT_MUTED,
            modifier = Modifier.width(130.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall.copy(
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Medium,
                lineHeight = 17.sp,
            ),
            color = valueColor,
            modifier = Modifier.weight(1f),
        )
    }
}

internal fun formatUsbCapability(raw: String): String {
    var formatted = raw
        .replace("PCM32", "PCM 32-bit")
        .replace("PCM24", "PCM 24-bit")
        .replace("PCM16", "PCM 16-bit")
        .replace("Float32", "Float 32-bit")

    val hzRegex = Regex("""(\d+)\s*Hz""")
    formatted = hzRegex.replace(formatted) { matchResult ->
        val hz = matchResult.groupValues[1].toIntOrNull()
            ?: return@replace matchResult.value
        "${"%.1f".format(Locale.ROOT, hz / 1000f).removeSuffix(".0")} kHz"
    }
    return formatted
}

/** Hairline separator preserved for backwards compatibility with AudioPopupCard and CastDialog. */
@Composable
internal fun PipelineRule(modifier: Modifier = Modifier.padding(start = 52.dp, end = 16.dp)) {
    Box(
        modifier
            .fillMaxWidth()
            .height(0.5.dp)
            .background(Color.White.copy(alpha = 0.14f)),
    )
}

/** Full-bleed closing action preserved for backwards compatibility with AudioPopupCard. */
@Composable
internal fun PipelineDoneAction(label: String, onClick: () -> Unit) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(ACTION_HEIGHT)
            .background(
                if (pressed) Color.White.copy(alpha = 0.09f) else Color.Transparent,
            )
            .clickable(
                indication = null,
                interactionSource = interactionSource,
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge.copy(
                fontSize = 17.sp,
                fontWeight = FontWeight.W600,
            ),
            color = Color.White,
        )
    }
}

