package com.music.raaga.playback.haptics

import com.music.raaga.data.settings.AppSettings
import com.music.raaga.data.settings.MusicHapticsIntensity
import com.music.raaga.data.settings.MusicHapticsStyle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.cos
import kotlin.math.sin

class MusicHapticsEngineTest {

    @Test
    fun `intensity enum scales correctly`() {
        assertEquals(0.4f, MusicHapticsIntensity.SUBTLE.scale, 0.001f)
        assertEquals(0.75f, MusicHapticsIntensity.BALANCED.scale, 0.001f)
        assertEquals(1.0f, MusicHapticsIntensity.STRONG.scale, 0.001f)

        assertEquals(MusicHapticsIntensity.SUBTLE, MusicHapticsIntensity.fromString("SUBTLE"))
        assertEquals(MusicHapticsIntensity.BALANCED, MusicHapticsIntensity.fromString("BALANCED"))
        assertEquals(MusicHapticsIntensity.STRONG, MusicHapticsIntensity.fromString("STRONG"))
        assertEquals(MusicHapticsIntensity.BALANCED, MusicHapticsIntensity.fromString("UNKNOWN"))
    }

    @Test
    fun `style enum parses correctly`() {
        assertEquals(MusicHapticsStyle.FULL_GROOVE, MusicHapticsStyle.fromString("FULL_GROOVE"))
        assertEquals(MusicHapticsStyle.BASSLINE, MusicHapticsStyle.fromString("BASSLINE"))
        assertEquals(MusicHapticsStyle.HEARTBEAT, MusicHapticsStyle.fromString("HEARTBEAT"))
        assertEquals(MusicHapticsStyle.FULL_GROOVE, MusicHapticsStyle.fromString("INVALID"))
        assertEquals(MusicHapticsStyle.FULL_GROOVE, MusicHapticsStyle.fromString(null))
    }

    @Test
    fun `engine is inactive when disabled in settings`() {
        AppSettings.musicHapticsEnabled.value = false
        MusicHapticsEngine.setPlaying(true)
        assertFalse(MusicHapticsEngine.isActive)

        AppSettings.musicHapticsEnabled.value = true
        MusicHapticsEngine.setPlaying(false)
        assertFalse(MusicHapticsEngine.isActive)

        MusicHapticsEngine.setPlaying(true)
        assertTrue(MusicHapticsEngine.isActive)

        // Reset
        AppSettings.musicHapticsEnabled.value = false
        MusicHapticsEngine.setPlaying(false)
    }

    @Test
    fun `direct-form II transposed biquad lowpass attenuates treble and preserves bass`() {
        val sampleRate = 48000
        val cutoffHz = 140f
        val q = 0.85f

        val w0 = (2.0 * Math.PI * cutoffHz / sampleRate).toFloat()
        val alpha = (sin(w0.toDouble()) / (2.0 * q)).toFloat()
        val cosw0 = cos(w0.toDouble()).toFloat()
        val a0 = 1f + alpha
        val b0 = ((1f - cosw0) / 2f) / a0
        val b1 = (1f - cosw0) / a0
        val b2 = ((1f - cosw0) / 2f) / a0
        val a1 = (-2f * cosw0) / a0
        val a2 = (1f - alpha) / a0

        fun processFilter(freqHz: Float, numFrames: Int): Float {
            var z1 = 0f
            var z2 = 0f
            var energySum = 0f

            for (i in 0 until numFrames) {
                val input = sin(2.0 * Math.PI * freqHz * i / sampleRate).toFloat()
                val y = b0 * input + z1
                z1 = b1 * input + z2 - a1 * y
                z2 = b2 * input - a2 * y

                // Measure settled state
                if (i > numFrames / 2) {
                    energySum += y * y
                }
            }
            return energySum / (numFrames / 2)
        }

        val bassEnergy = processFilter(60f, 4000)
        val trebleEnergy = processFilter(3500f, 4000)

        // Bass energy must be dramatically higher than treble through the lowpass filter
        assertTrue("Bass energy ($bassEnergy) should exceed treble energy ($trebleEnergy)", bassEnergy > trebleEnergy * 50f)
    }

    @Test
    fun `direct-form II transposed biquad bandpass preserves 3500Hz and rejects low frequencies`() {
        val sampleRate = 48000
        val centerHz = 3500f
        val q = 0.70f

        val w0 = (2.0 * Math.PI * centerHz / sampleRate).toFloat()
        val alpha = (sin(w0.toDouble()) / (2.0 * q)).toFloat()
        val cosw0 = cos(w0.toDouble()).toFloat()
        val a0 = 1f + alpha
        val b0 = alpha / a0
        val b1 = 0f
        val b2 = -alpha / a0
        val a1 = (-2f * cosw0) / a0
        val a2 = (1f - alpha) / a0

        fun processFilter(freqHz: Float, numFrames: Int): Float {
            var z1 = 0f
            var z2 = 0f
            var energySum = 0f

            for (i in 0 until numFrames) {
                val input = sin(2.0 * Math.PI * freqHz * i / sampleRate).toFloat()
                val y = b0 * input + z1
                z1 = b1 * input + z2 - a1 * y
                z2 = b2 * input - a2 * y

                if (i > numFrames / 2) {
                    energySum += y * y
                }
            }
            return energySum / (numFrames / 2)
        }

        val centerEnergy = processFilter(3500f, 4000)
        val subBassEnergy = processFilter(80f, 4000)

        // Snare/hi-hat center energy should vastly exceed sub-bass through bandpass
        assertTrue("Center energy ($centerEnergy) should exceed sub-bass ($subBassEnergy)", centerEnergy > subBassEnergy * 20f)
    }
}
