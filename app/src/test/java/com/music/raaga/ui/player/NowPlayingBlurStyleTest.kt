package com.music.raaga.ui.player

import com.music.raaga.data.settings.NowPlayingBlurStyle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class NowPlayingBlurStyleTest {

    @Test
    fun fromKeyMapsCorrectly() {
        assertEquals(NowPlayingBlurStyle.NEW, NowPlayingBlurStyle.fromKey("new"))
        assertEquals(NowPlayingBlurStyle.NEW, NowPlayingBlurStyle.fromKey("NEW"))
        assertEquals(NowPlayingBlurStyle.LEGACY, NowPlayingBlurStyle.fromKey("legacy"))
        assertEquals(NowPlayingBlurStyle.LEGACY, NowPlayingBlurStyle.fromKey("LEGACY"))
        assertEquals(NowPlayingBlurStyle.OLD, NowPlayingBlurStyle.fromKey("old"))
        assertEquals(NowPlayingBlurStyle.OLD, NowPlayingBlurStyle.fromKey("OLD"))
    }

    @Test
    fun fromKeyFallsBackToNewForUnknownOrNull() {
        assertEquals(NowPlayingBlurStyle.NEW, NowPlayingBlurStyle.fromKey(null))
        assertEquals(NowPlayingBlurStyle.NEW, NowPlayingBlurStyle.fromKey(""))
        assertEquals(NowPlayingBlurStyle.NEW, NowPlayingBlurStyle.fromKey("unknown_style"))
    }

    @Test
    fun allStylesHaveResourcesAndDistinctKeys() {
        val keys = NowPlayingBlurStyle.entries.map { it.key }
        assertEquals(keys.size, keys.distinct().size)

        for (style in NowPlayingBlurStyle.entries) {
            assertNotNull(style.key)
            assert(style.titleRes != 0)
            assert(style.subtitleRes != 0)
        }
    }
}

