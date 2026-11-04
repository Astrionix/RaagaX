package com.music.raaga.data

import com.music.raaga.data.model.Song
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BehindTheMusicCreditsTest {

    @Test
    fun parseFullCreditsFromDescription() {
        val song = Song(
            videoId = "abcdefghijk",
            title = "Starboy",
            artist = "The Weeknd, Daft Punk",
            thumbnailUrl = null,
            artistId = "channel_weeknd",
            albumName = "Starboy",
            albumId = "album_starboy",
        )

        val description = """
            Provided to YouTube by Universal Music Group

            Starboy · The Weeknd · Daft Punk

            Starboy

            ℗ 2016 The Weeknd XO, Inc.

            Released on: 2016-11-25

            Producer, Composer Lyricist: Abel "The Weeknd" Tesfaye
            Producer, Keyboards: Guy-Manuel de Homem-Christo
            Producer, Keyboards: Thomas Bangalter
            Co- Producer: Doc McKinney
            Studio Personnel, Mixer: Serban Ghenea
            Studio Personnel, Mastering Engineer: Tom Coyne
            Associated Performer, Vocals: Abel "The Weeknd" Tesfaye
            Associated Performer, Additional Vocals: Daft Punk
            Published by XO Music Publishing
        """.trimIndent()

        val credits = SongCreditsParser.parse(description, song)

        // 1. Artist
        assertNotNull(credits.mainArtist)
        assertEquals("The Weeknd", credits.mainArtist?.name)
        assertEquals(listOf("Main Artist"), credits.mainArtist?.roles)
        assertEquals("channel_weeknd", credits.mainArtist?.artistId)

        assertEquals(1, credits.featuredArtists.size)
        assertEquals("Daft Punk", credits.featuredArtists[0].name)
        assertEquals(listOf("Featured Artist"), credits.featuredArtists[0].roles)

        // 2. Composition & Lyrics
        val composers = credits.compositionAndLyrics
        assertTrue(composers.any { it.name.contains("Abel") })

        // 3. Production
        val producers = credits.production
        assertTrue(producers.any { it.name.contains("Guy-Manuel") })
        assertTrue(producers.any { it.name.contains("Doc McKinney") })

        // 4. Engineering
        val engineering = credits.engineering
        assertTrue(engineering.any { it.name == "Serban Ghenea" })
        assertTrue(engineering.any { it.name == "Tom Coyne" })

        // 5. Musicians
        val musicians = credits.musicians
        assertTrue(musicians.any { it.name.contains("Abel") })
        assertTrue(musicians.any { it.name == "Daft Punk" })

        // 6. Additional
        assertEquals("Universal Music Group", credits.label)
        assertEquals("℗ 2016 The Weeknd XO, Inc.", credits.copyright)
        assertEquals("2016-11-25", credits.releaseDate)
        assertEquals("XO Music Publishing", credits.publisher)
    }

    @Test
    fun parseGracefulFallbackWhenDescriptionMissing() {
        val song = Song(
            videoId = "local_123",
            title = "Acoustic Melody",
            artist = "Acoustic Duo feat. John Doe",
            thumbnailUrl = null,
            artistId = null,
            albumName = "Unplugged Live",
        )

        val credits = SongCreditsParser.parse(null, song)

        assertEquals("Acoustic Duo", credits.mainArtist?.name)
        assertEquals(1, credits.featuredArtists.size)
        assertEquals("John Doe", credits.featuredArtists[0].name)
        assertTrue(credits.compositionAndLyrics.isEmpty())
        assertTrue(credits.production.isEmpty())
        assertTrue(credits.engineering.isEmpty())
        assertTrue(credits.musicians.isEmpty())
        assertEquals(null, credits.releaseDate)
    }
}
