package com.music.raaga.playback.haptics

import com.music.raaga.data.settings.AppSettings
import com.music.raaga.data.settings.MusicHapticsIntensity
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
    fun `low-pass filter attenuates high frequencies and preserves sub-bass`() {
        // Simple biquad test replicating the lowpass logic in MusicHapticsEngine
        val sampleRate = 48000
        val cutoffHz = 115f
        val q = 0.7071f

        val omega = 2f * Math.PI.toFloat() * (cutoffHz / sampleRate)
        val alpha = sin(omega.toDouble()).toFloat() / (2f * q)
        val cosw = cos(omega.toDouble()).toFloat()
        val a0 = 1f + alpha
        val b0 = ((1f - cosw) / 2f) / a0
        val b1 = (1f - cosw) / a0
        val b2 = ((1f - cosw) / 2f) / a0
        val a1 = (-2f * cosw) / a0
        val a2 = (1f - alpha) / a0

        fun processFilter(freqHz: Float, numFrames: Int): Float {
            var x1 = 0f
            var x2 = 0f
            var y1 = 0f
            var y2 = 0f
            var energySum = 0f

            for (i in 0 until numFrames) {
                val input = sin(2.0 * Math.PI * freqHz * i / sampleRate).toFloat()
                val y = b0 * input + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
                x2 = x1
                x1 = input
                y2 = y1
                y1 = y
                // Skip initial transient
                if (i > numFrames / 2) {
                    energySum += y * y
                }
            }
            return energySum / (numFrames / 2)
        }

        val bassEnergy = processFilter(60f, 4000)
        val trebleEnergy = processFilter(3000f, 4000)

        // Bass energy should be orders of magnitude higher than treble
        assertTrue("Bass energy ($bassEnergy) should exceed treble energy ($trebleEnergy)", bassEnergy > trebleEnergy * 50f)
    }
}

