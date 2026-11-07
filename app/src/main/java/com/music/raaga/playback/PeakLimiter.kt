package com.music.raaga.playback

import kotlin.math.exp
import kotlin.math.log10
import kotlin.math.pow

/**
 * Dynamics compressor / peak limiter node inserted at the end of the DSP / equalizer chain
 * to prevent clipping when EQ bands are boosted.
 *
 * Parameters:
 * - Threshold: -0.3 dBFS (~0.966f)
 * - Compression ratio: 20:1
 * - Attack time: 0.001s (1ms)
 * - Release time: 0.100s (100ms)
 */
class PeakLimiter(
    val thresholdDb: Float = -0.3f,
    val ratio: Float = 20.0f,
    val attackSeconds: Double = 0.001,
    val releaseSeconds: Double = 0.1,
) {

    private val thresholdLinear: Float = 10.0.pow(thresholdDb.toDouble() / 20.0).toFloat()
    private var attackCoef = 1f
    private var releaseCoef = 1f
    private var envelope = 0f
    private var reduction = 1f

    fun configure(sampleRate: Int) {
        if (sampleRate <= 0) {
            attackCoef = 1f
            releaseCoef = 1f
        } else {
            attackCoef = (1.0 - exp(-1.0 / (attackSeconds * sampleRate))).toFloat()
            releaseCoef = (1.0 - exp(-1.0 / (releaseSeconds * sampleRate))).toFloat()
        }
        envelope = 0f
        reduction = 1f
    }

    /** Lets go at once, for a seek or a bypass: there is nothing left to be continuous with. */
    fun reset() {
        envelope = 0f
        reduction = 1f
    }

    /** What to multiply a frame by, given the magnitude of its loudest channel. */
    fun gainFor(peak: Float): Float {
        val coef = if (peak > envelope) attackCoef else releaseCoef
        envelope += coef * (peak - envelope)

        val envDb = if (envelope > 1e-6f) 20f * log10(envelope) else -120f
        val wantedGain = if (envDb > thresholdDb) {
            val overDb = envDb - thresholdDb
            val compressedOverDb = overDb / ratio
            val targetGainDb = thresholdDb + compressedOverDb - envDb
            10.0.pow(targetGainDb.toDouble() / 20.0).toFloat().coerceIn(0.01f, 1.0f)
        } else {
            1.0f
        }

        val gainCoef = if (wantedGain < reduction) attackCoef else releaseCoef
        reduction += gainCoef * (wantedGain - reduction)
        return reduction.coerceIn(0.01f, 1.0f)
    }

    companion object {
        /** Peak ceiling at -0.3 dBFS. */
        const val CEILING = 0.9660508f
        const val RELEASE_SECONDS = 0.1
    }
}
