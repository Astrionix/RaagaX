package com.music.raaga.playback.audio

import android.util.Log
import com.music.raaga.playback.AudioRouting
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale
import kotlin.math.log10
import kotlin.math.sqrt

/**
 * Diagnostic engine auditing playback loudness, gain staging, peak/RMS levels,
 * DSP processors, and USB DAC routing in real-time.
 */
object AudioDiagnostics {
    const val TAG = "RaagaAudioDiag"

    data class PcmMetrics(
        val peakLinear: Float = 0f,
        val peakDbfs: Float = -100f,
        val rmsLinear: Float = 0f,
        val rmsDbfs: Float = -100f,
        val isClipping: Boolean = false,
        val timestampMs: Long = 0L,
    )

    data class LiveSnapshot(
        val playerVolume: Float = 1.0f,
        val pcmMetrics: PcmMetrics = PcmMetrics(),
        val routeKind: AudioRouting.Kind = AudioRouting.Kind.PHONE,
        val isUsbDac: Boolean = false,
        val dacProductName: String = "Internal / Default",
        val sourceCodec: String = "Opus / AAC",
        val sourceSampleRate: Int = 44100,
        val sourceBitDepth: String = "16-bit",
        val outputEncoding: String = "PCM_FLOAT",
        val outputSampleRate: Int = 48000,
        val spatialAudioActive: Boolean = false,
        val equalizerActive: Boolean = false,
        val equalizerPreampDb: Float = 0f,
        val hardwareLoudnessEnhancerActive: Boolean = false,
        val systemEffectsBroadcastActive: Boolean = false,
        val loudnessProcessorActive: Boolean = false,
        val loudnessTargetLufs: Float = -16f,
        val loudnessAppliedGainDb: Float = 0f,
        val loudnessMeasuredLufs: Float? = null,
    )

    private val _snapshot = MutableStateFlow(LiveSnapshot())
    val snapshot = _snapshot.asStateFlow()

    @Volatile
    var diagnosticLoggingEnabled: Boolean = true

    private var lastLogTimeMs: Long = 0L
    private const val LOG_INTERVAL_MS = 3000L // Log every 3 seconds during active playback

    /**
     * Calculates peak, RMS and dBFS across a block of Float32 audio samples.
     */
    fun analyzeBlock(samples: FloatArray, frameCount: Int, channelCount: Int) {
        val total = frameCount * channelCount
        if (total <= 0) return

        var maxSample = 0f
        var sumSquares = 0.0
        val len = minOf(total, samples.size)
        for (i in 0 until len) {
            val s = kotlin.math.abs(samples[i])
            if (s > maxSample) maxSample = s
            sumSquares += (s * s)
        }
        val rms = if (len > 0) sqrt(sumSquares / len).toFloat() else 0f
        val peakDb = if (maxSample > 1e-5f) (20.0 * log10(maxSample.toDouble())).toFloat() else -100f
        val rmsDb = if (rms > 1e-5f) (20.0 * log10(rms.toDouble())).toFloat() else -100f
        val clipping = maxSample > 1.0f

        val metrics = PcmMetrics(
            peakLinear = maxSample,
            peakDbfs = peakDb,
            rmsLinear = rms,
            rmsDbfs = rmsDb,
            isClipping = clipping,
            timestampMs = System.currentTimeMillis(),
        )

        val current = _snapshot.value
        val updated = current.copy(pcmMetrics = metrics)
        _snapshot.value = updated

        val now = System.currentTimeMillis()
        if (diagnosticLoggingEnabled && now - lastLogTimeMs >= LOG_INTERVAL_MS) {
            lastLogTimeMs = now
            logDiagnostics(updated)
        }
    }

    fun updatePipelineStatus(
        playerVolume: Float,
        routeKind: AudioRouting.Kind,
        isUsbDac: Boolean,
        dacProductName: String,
        sourceCodec: String,
        sourceSampleRate: Int,
        sourceBitDepth: String,
        outputEncoding: String,
        outputSampleRate: Int,
        spatialAudioActive: Boolean,
        equalizerActive: Boolean,
        equalizerPreampDb: Float,
        hardwareLoudnessEnhancerActive: Boolean,
        systemEffectsBroadcastActive: Boolean,
        loudnessProcessorActive: Boolean,
        loudnessTargetLufs: Float,
        loudnessAppliedGainDb: Float,
        loudnessMeasuredLufs: Float?,
    ) {
        val updated = _snapshot.value.copy(
            playerVolume = playerVolume,
            routeKind = routeKind,
            isUsbDac = isUsbDac,
            dacProductName = dacProductName,
            sourceCodec = sourceCodec,
            sourceSampleRate = sourceSampleRate,
            sourceBitDepth = sourceBitDepth,
            outputEncoding = outputEncoding,
            outputSampleRate = outputSampleRate,
            spatialAudioActive = spatialAudioActive,
            equalizerActive = equalizerActive,
            equalizerPreampDb = equalizerPreampDb,
            hardwareLoudnessEnhancerActive = hardwareLoudnessEnhancerActive,
            systemEffectsBroadcastActive = systemEffectsBroadcastActive,
            loudnessProcessorActive = loudnessProcessorActive,
            loudnessTargetLufs = loudnessTargetLufs,
            loudnessAppliedGainDb = loudnessAppliedGainDb,
            loudnessMeasuredLufs = loudnessMeasuredLufs,
        )
        _snapshot.value = updated
    }

    private fun logDiagnostics(snap: LiveSnapshot) {
        val m = snap.pcmMetrics
        val clipStr = if (m.isClipping) "CLIPPING DETECTED (peak=${String.format(Locale.US, "%.2f", m.peakLinear)})" else "None (Full Dynamic Range)"
        val peakStr = String.format(Locale.US, "%.2f (%.1f dBFS)", m.peakLinear, m.peakDbfs)
        val rmsStr = String.format(Locale.US, "%.2f (%.1f dBFS)", m.rmsLinear, m.rmsDbfs)
        val volStr = String.format(Locale.US, "%.2f", snap.playerVolume)
        val lufsStr = snap.loudnessMeasuredLufs?.let { String.format(Locale.US, "%.1f LUFS", it) } ?: "Measuring..."
        val gainStr = String.format(Locale.US, "%+.1f dB", snap.loudnessAppliedGainDb)

        Log.i(
            TAG,
            """
            |===================== RAAGA AUDIO DIAGNOSTICS =====================
            | [Route] Output: ${if (snap.isUsbDac) "USB DAC (${snap.dacProductName})" else "${snap.routeKind} (${snap.dacProductName})"}
            | [Player] ExoPlayer Volume: $volStr ${if (snap.playerVolume == 1.0f) "(Unity Gain 1.0f)" else "(ATTENUATED/SCALED)"}
            | [Source] Format: ${snap.sourceCodec} | ${snap.sourceSampleRate} Hz | ${snap.sourceBitDepth}
            | [Output] AudioTrack: ${snap.outputSampleRate} Hz | ${snap.outputEncoding}
            | [PCM Levels] Peak: $peakStr | RMS: $rmsStr | Clip: $clipStr
            | [Processors]:
            |   - Spatial Crossfeed: ${if (snap.spatialAudioActive) "ACTIVE (Bauer 280µs/700Hz)" else "BYPASSED"}
            |   - Parametric Equalizer: ${if (snap.equalizerActive) "ACTIVE (Preamp: ${snap.equalizerPreampDb} dB)" else "BYPASSED (Flat 0.0 dB)"}
            |   - Hardware LoudnessEnhancer: ${if (snap.hardwareLoudnessEnhancerActive) "ACTIVE (HAL COMPRESSOR)" else "DISABLED (Pure Stream)"}
            |   - System OEM Audio Effects Broadcast: ${if (snap.systemEffectsBroadcastActive) "BROADCAST (Dolby/OEM Active)" else "BYPASSED (Bit-Clean)"}
            |   - 32-bit Float Loudness Normalization: ${if (snap.loudnessProcessorActive) "ACTIVE (Target: ${snap.loudnessTargetLufs} LUFS | Measured: $lufsStr | Applied: $gainStr)" else "OFF"}
            |===================================================================
            """.trimMargin(),
        )
    }
}

