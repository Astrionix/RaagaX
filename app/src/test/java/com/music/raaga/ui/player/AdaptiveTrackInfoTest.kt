package com.music.raaga.ui.player

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.music.raaga.data.settings.AppSettings
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdaptiveTrackInfoTest {

    @Test
    fun defaultSettingsAreEnabled() {
        assertTrue(AppSettings.adaptiveTrackInfo.value)
        assertTrue(AppSettings.lyricsPreview.value)
    }

    @Test
    fun adaptiveTitleShiftComputation() {
        fun computeShift(
            adaptiveEnabled: Boolean,
            showLyricsPreview: Boolean,
            groupTop: Dp,
        ): Dp {
            return if (adaptiveEnabled && !showLyricsPreview) {
                24.dp.coerceAtMost(groupTop + 12.dp)
            } else {
                0.dp
            }
        }

        // When lyrics are visible, title shift is 0 (original layout)
        assertEquals(0.dp, computeShift(adaptiveEnabled = true, showLyricsPreview = true, groupTop = 20.dp))
        assertEquals(0.dp, computeShift(adaptiveEnabled = false, showLyricsPreview = true, groupTop = 20.dp))

        // When lyrics are hidden and adaptive positioning is disabled (fixed layout), shift is 0
        assertEquals(0.dp, computeShift(adaptiveEnabled = false, showLyricsPreview = false, groupTop = 20.dp))

        // When lyrics are hidden and adaptive positioning is enabled, title shifts down into lyrics space
        assertEquals(24.dp, computeShift(adaptiveEnabled = true, showLyricsPreview = false, groupTop = 20.dp))
        // On very compact screens where groupTop is tiny, it clamps safely
        assertEquals(16.dp, computeShift(adaptiveEnabled = true, showLyricsPreview = false, groupTop = 4.dp))
    }
}

