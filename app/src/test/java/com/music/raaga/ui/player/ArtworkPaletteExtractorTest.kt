package com.music.raaga.ui.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Before
import org.junit.Test

class ArtworkPaletteExtractorTest {

    @Before
    fun setUp() {
        ArtworkPaletteExtractor.clearCache()
    }

    @Test
    fun nullBitmapYieldsDefaultPalette() {
        val result = ArtworkPaletteExtractor.extract(null)
        assertEquals(AmbientArtworkPalette.Default, result)
        assertFalse(result.isMonochrome)
    }

    @Test
    fun nullBitmapWithKeyYieldsDefaultPalette() {
        val result = ArtworkPaletteExtractor.extract(null, "some_track_art")
        assertEquals(AmbientArtworkPalette.Default, result)
    }

    @Test
    fun defaultPaletteContainsHarmonicAtmosphericColors() {
        val defaultPalette = AmbientArtworkPalette.Default
        assertNotNull(defaultPalette.dominant)
        assertNotNull(defaultPalette.vibrant)
        assertNotNull(defaultPalette.secondary)
        assertNotNull(defaultPalette.accent)
        assertNotNull(defaultPalette.primaryGlow)
        assertNotNull(defaultPalette.secondaryGlow)
        assertNotNull(defaultPalette.accentGlow)
        assertNotNull(defaultPalette.darkVignetteBase)
    }
}

