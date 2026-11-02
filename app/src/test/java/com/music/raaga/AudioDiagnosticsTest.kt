package com.music.raaga

import com.music.raaga.playback.AudioRouting
import com.music.raaga.playback.audio.AudioDiagnostics
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

class AudioDiagnosticsTest {

    @Test
    fun `analyzeBlock measures peak and RMS accurately for sine wave`() {
        val frameCount = 1000
        val channelCount = 2
        val samples = FloatArray(frameCount * channelCount)

        // Generate full-scale sine wave (amplitude 0.90f)
        val amplitude = 0.90f
        for (i in samples.indices) {
            samples[i] = (amplitude * kotlin.math.sin(i * 0.1)).toFloat()
        }

        AudioDiagnostics.analyzeBlock(samples, frameCount, channelCount)
        val metrics = AudioDiagnostics.snapshot.value.pcmMetrics

        // Peak should be approximately 0.90
        assertTrue("Peak should be close to 0.90 but was ${metrics.peakLinear}", abs(metrics.peakLinear - 0.90f) < 0.02f)
        // Peak dBFS should be approx 20 * log10(0.90) = -0.91 dBFS
        assertTrue("Peak dBFS should be ~ -0.91 but was ${metrics.peakDbfs}", abs(metrics.peakDbfs - (-0.91f)) < 0.3f)
        // RMS of sine wave is amplitude / sqrt(2) = 0.90 / 1.414 = ~0.636
        assertTrue("RMS should be close to 0.636 but was ${metrics.rmsLinear}", abs(metrics.rmsLinear - 0.636f) < 0.05f)
        // No clipping
        assertFalse(metrics.isClipping)
    }

    @Test
    fun `analyzeBlock detects clipping when sample exceeds full scale 1_0`() {
        val samples = floatArrayOf(0.5f, 0.8f, 1.25f, 0.2f)
        AudioDiagnostics.analyzeBlock(samples, 2, 2)
        val metrics = AudioDiagnostics.snapshot.value.pcmMetrics

        assertTrue("Should detect clipping on sample 1.25", metrics.isClipping)
        assertEquals(1.25f, metrics.peakLinear, 0.001f)
        assertTrue("Peak dBFS should be positive (> 0)", metrics.peakDbfs > 0f)
    }

    @Test
    fun `updatePipelineStatus reflects USB DAC routing and clean bypass state`() {
        AudioDiagnostics.updatePipelineStatus(
            playerVolume = 1.0f,
            routeKind = AudioRouting.Kind.USB,
            isUsbDac = true,
            dacProductName = "Apple USB-C DAC",
            sourceCodec = "FLAC",
            sourceSampleRate = 96000,
            sourceBitDepth = "24-bit",
            outputEncoding = "PCM_FLOAT",
            outputSampleRate = 96000,
            spatialAudioActive = false,
            equalizerActive = false,
            equalizerPreampDb = 0f,
            hardwareLoudnessEnhancerActive = false,
            systemEffectsBroadcastActive = false,
            loudnessProcessorActive = true,
            loudnessTargetLufs = -16f,
            loudnessAppliedGainDb = -6.2f,
            loudnessMeasuredLufs = -9.8f,
        )

        val snap = AudioDiagnostics.snapshot.value
        assertEquals(1.0f, snap.playerVolume, 0.001f)
        assertTrue(snap.isUsbDac)
        assertEquals("Apple USB-C DAC", snap.dacProductName)
        assertEquals(96000, snap.sourceSampleRate)
        assertEquals(96000, snap.outputSampleRate)
        assertFalse(snap.spatialAudioActive)
        assertFalse(snap.equalizerActive)
        assertFalse(snap.hardwareLoudnessEnhancerActive)
        assertFalse(snap.systemEffectsBroadcastActive)
        assertTrue(snap.loudnessProcessorActive)
        assertEquals(-16f, snap.loudnessTargetLufs, 0.01f)
        assertEquals(-6.2f, snap.loudnessAppliedGainDb, 0.01f)
        assertEquals(-9.8f, snap.loudnessMeasuredLufs!!, 0.01f)
    }
}

