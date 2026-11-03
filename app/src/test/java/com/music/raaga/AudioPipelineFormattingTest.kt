package com.music.raaga

import com.music.raaga.ui.components.formatUsbCapability
import org.junit.Assert.assertEquals
import org.junit.Test

class AudioPipelineFormattingTest {

    @Test
    fun `formatUsbCapability converts raw formats to human-readable labels`() {
        val raw = "PCM32 44100 Hz, Float32 96000 Hz, PCM24 192000 Hz, PCM16 48000 Hz"
        val formatted = formatUsbCapability(raw)

        assertEquals(
            "PCM 32-bit 44.1 kHz, Float 32-bit 96 kHz, PCM 24-bit 192 kHz, PCM 16-bit 48 kHz",
            formatted,
        )
    }

    @Test
    fun `formatUsbCapability handles fractional sample rates correctly`() {
        val raw = "PCM24 88200 Hz, PCM32 176400 Hz"
        val formatted = formatUsbCapability(raw)

        assertEquals(
            "PCM 24-bit 88.2 kHz, PCM 32-bit 176.4 kHz",
            formatted,
        )
    }
}

