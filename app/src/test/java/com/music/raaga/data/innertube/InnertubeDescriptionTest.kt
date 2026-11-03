package com.music.raaga.data.innertube

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class InnertubeDescriptionTest {

    @Test
    fun `cleanDescription returns null for null or blank text`() {
        assertNull(InnertubeParser.cleanDescription(null))
        assertNull(InnertubeParser.cleanDescription(""))
        assertNull(InnertubeParser.cleanDescription("   \n\t  "))
    }

    @Test
    fun `cleanDescription strips wikipedia and creative commons attribution`() {
        val raw = "An artist bio.\n\nFrom Wikipedia, the free encyclopedia."
        val cleaned = InnertubeParser.cleanDescription(raw)
        assertEquals("An artist bio.", cleaned)

        val rawWithCc = "An album blurb. (Under Creative Commons Attribution-ShareAlike)"
        val cleanedCc = InnertubeParser.cleanDescription(rawWithCc)
        assertEquals("An album blurb.", cleanedCc)
    }

    @Test
    fun `cleanDescription normalizes multiple spaces and excessive newlines`() {
        val raw = "A.   R.   Rahman   is   an   Indian   composer.   \n\n\n\nHe   won   two   Academy   Awards."
        val cleaned = InnertubeParser.cleanDescription(raw)
        assertEquals(
            "A. R. Rahman is an Indian composer.\n\nHe won two Academy Awards.",
            cleaned,
        )
    }
}

