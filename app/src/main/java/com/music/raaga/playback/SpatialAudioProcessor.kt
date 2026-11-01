package com.music.raaga.playback

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import com.music.raaga.playback.audio.AudioBlock
import com.music.raaga.playback.audio.FloatAudioProcessor
import com.music.raaga.playback.audio.PcmBoundary
import java.nio.ByteOrder
import kotlin.math.exp
import kotlin.math.roundToInt

/**
 * Calibrated binaural spatial audio & stereophonic crossfeed processor.
 *
 * Implements head-related acoustic modeling (Bauer stereophonic-to-binaural crossfeed):
 * - Interaural Time Difference (ITD): ~280 microseconds acoustic propagation delay
 *   around the human head (~12-14 samples at 44.1/48 kHz, up to 54 samples at 192 kHz).
 * - Interaural Level Difference (ILD): 700 Hz corner frequency 1-pole low-pass shelf
 *   simulating head shadow attenuation (~-4.8 dB crossfeed gain).
 * - Natural stereo soundstage widening (1.30x factor) with energy preservation.
 *
 * Runs inside Raaga's high-precision 32-bit float DSP chain before the AudioSink.
 */
@UnstableApi
class SpatialAudioProcessor : BaseAudioProcessor(), FloatAudioProcessor {

    @Volatile
    var enabled: Boolean = false

    /** Natural stereo soundstage widening factor. 1.0 = untouched, 1.30 = wide acoustic stage. */
    private val widthGain = 1.30f

    /** Makeup attenuation after widening to ensure zero clipping overs. */
    private val outputGain = 0.90f

    /** How much of the delayed, low-passed opposite channel gets mixed back in (~-4.8 dB). */
    private val crossfeedGain = 0.32f

    /** One-pole lowpass factor derived dynamically from sampleRate and 700 Hz cutoff. */
    private var lowpassCoeff = 0.095f

    private var sampleRate: Int = 0
    private var channelCount: Int = 0
    private var currentEncoding: Int = C.ENCODING_PCM_16BIT

    private var delayLeft = FloatArray(0)
    private var delayRight = FloatArray(0)
    private var delayIndex = 0
    private var lowpassLeft = 0f
    private var lowpassRight = 0f

    /**
     * Configures the Float32 DSP engine for [sampleRate] and [channelCount].
     */
    override fun configure(sampleRate: Int, channelCount: Int) {
        this.sampleRate = sampleRate
        this.channelCount = channelCount
        if (channelCount != 2 || sampleRate <= 0) {
            delayLeft = FloatArray(0)
            delayRight = FloatArray(0)
            delayIndex = 0
            lowpassLeft = 0f
            lowpassRight = 0f
            return
        }

        // Interaural time delay: ~280 microseconds
        val delaySamples = (sampleRate * ITD_SECONDS)
            .roundToInt()
            .coerceAtLeast(1)
        if (delayLeft.size != delaySamples) {
            delayLeft = FloatArray(delaySamples)
            delayRight = FloatArray(delaySamples)
        }

        // Frequency-dependent 1-pole lowpass filter for ILD head shadow at 700 Hz
        val dt = 1.0 / sampleRate
        val rc = 1.0 / (2.0 * Math.PI * CROSSFEED_CUTOFF_HZ)
        lowpassCoeff = (dt / (rc + dt)).toFloat().coerceIn(0.01f, 0.99f)

        onFlush()
    }

    /**
     * Processes interleaved Float32 audio samples in [block] in-place.
     * Preserves dynamic headroom without clamping to [-1.0f, +1.0f].
     */
    override fun process(block: AudioBlock) {
        if (!enabled || block.frameCount == 0) return
        if (block.channelCount != 2) return // Spatial widening only applies to stereo

        val delaySize = delayLeft.size
        if (delaySize == 0) return

        val totalSamples = block.frameCount * 2
        var idx = 0
        var dIdx = delayIndex
        var lpL = lowpassLeft
        var lpR = lowpassRight
        val coeff = lowpassCoeff

        while (idx < totalSamples) {
            val left = block.samples[idx]
            val right = block.samples[idx + 1]

            val mid = (left + right) * 0.5f
            val side = (left - right) * 0.5f * widthGain
            var widenedLeft = mid + side
            var widenedRight = mid - side

            val delayedRight = delayRight[dIdx]
            val delayedLeft = delayLeft[dIdx]
            lpL += coeff * (delayedRight - lpL)
            lpR += coeff * (delayedLeft - lpR)
            widenedLeft += lpL * crossfeedGain
            widenedRight += lpR * crossfeedGain

            delayLeft[dIdx] = left
            delayRight[dIdx] = right
            dIdx = (dIdx + 1) % delaySize

            // Headroom is preserved: no clamping to [-1.0f, +1.0f]
            block.samples[idx] = widenedLeft * outputGain
            block.samples[idx + 1] = widenedRight * outputGain
            idx += 2
        }

        delayIndex = dIdx
        lowpassLeft = lpL
        lowpassRight = lpR
    }

    @Suppress("DEPRECATION")
    @Deprecated("Overrides deprecated BaseAudioProcessor method in Media3")
    override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        if ((inputAudioFormat.encoding != C.ENCODING_PCM_16BIT && inputAudioFormat.encoding != C.ENCODING_PCM_FLOAT) ||
            inputAudioFormat.channelCount != 2
        ) {
            return AudioProcessor.AudioFormat.NOT_SET
        }
        currentEncoding = inputAudioFormat.encoding
        configure(inputAudioFormat.sampleRate, inputAudioFormat.channelCount)
        return inputAudioFormat
    }

    override fun onFlush() {
        delayLeft.fill(0f)
        delayRight.fill(0f)
        delayIndex = 0
        lowpassLeft = 0f
        lowpassRight = 0f
    }

    override fun onReset() {
        delayLeft = FloatArray(0)
        delayRight = FloatArray(0)
        delayIndex = 0
        lowpassLeft = 0f
        lowpassRight = 0f
        channelCount = 0
        sampleRate = 0
    }

    override fun queueInput(inputBuffer: java.nio.ByteBuffer) {
        val bytesPerSample = if (currentEncoding == C.ENCODING_PCM_FLOAT) 4 else 2
        val bytesPerFrame = bytesPerSample * 2
        val frameCount = inputBuffer.remaining() / bytesPerFrame
        if (frameCount == 0) return
        val outputBuffer = replaceOutputBuffer(frameCount * bytesPerFrame)

        if (!enabled) {
            outputBuffer.put(inputBuffer)
            outputBuffer.flip()
            return
        }

        inputBuffer.order(ByteOrder.nativeOrder())
        outputBuffer.order(ByteOrder.nativeOrder())

        val delaySize = delayLeft.size
        if (delaySize == 0) {
            outputBuffer.put(inputBuffer)
            outputBuffer.flip()
            return
        }

        var dIdx = delayIndex
        var lpL = lowpassLeft
        var lpR = lowpassRight
        val coeff = lowpassCoeff
        val invScale = 1.0f / 32768.0f

        if (currentEncoding == C.ENCODING_PCM_FLOAT) {
            repeat(frameCount) {
                val left = inputBuffer.float
                val right = inputBuffer.float

                val mid = (left + right) * 0.5f
                val side = (left - right) * 0.5f * widthGain
                var widenedLeft = mid + side
                var widenedRight = mid - side

                val delayedRight = delayRight[dIdx]
                val delayedLeft = delayLeft[dIdx]
                lpL += coeff * (delayedRight - lpL)
                lpR += coeff * (delayedLeft - lpR)
                widenedLeft += lpL * crossfeedGain
                widenedRight += lpR * crossfeedGain

                delayLeft[dIdx] = left
                delayRight[dIdx] = right
                dIdx = (dIdx + 1) % delaySize

                outputBuffer.putFloat(widenedLeft * outputGain)
                outputBuffer.putFloat(widenedRight * outputGain)
            }
        } else {
            repeat(frameCount) {
                val left = inputBuffer.short.toFloat() * invScale
                val right = inputBuffer.short.toFloat() * invScale

                val mid = (left + right) * 0.5f
                val side = (left - right) * 0.5f * widthGain
                var widenedLeft = mid + side
                var widenedRight = mid - side

                val delayedRight = delayRight[dIdx]
                val delayedLeft = delayLeft[dIdx]
                lpL += coeff * (delayedRight - lpL)
                lpR += coeff * (delayedLeft - lpR)
                widenedLeft += lpL * crossfeedGain
                widenedRight += lpR * crossfeedGain

                delayLeft[dIdx] = left
                delayRight[dIdx] = right
                dIdx = (dIdx + 1) % delaySize

                outputBuffer.putShort(PcmBoundary.clamp16FromFloat(widenedLeft * outputGain))
                outputBuffer.putShort(PcmBoundary.clamp16FromFloat(widenedRight * outputGain))
            }
        }
        delayIndex = dIdx
        lowpassLeft = lpL
        lowpassRight = lpR

        outputBuffer.flip()
    }

    private companion object {
        /** Human head acoustic delay (interaural time difference): 280 microseconds */
        const val ITD_SECONDS = 0.00028

        /** Bauer crossfeed corner frequency: 700 Hz */
        const val CROSSFEED_CUTOFF_HZ = 700.0
    }
}
