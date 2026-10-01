package com.music.raaga

import com.music.raaga.data.applemusic.AppleMusicParser
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppleMusicParserTest {

    @Test
    fun testParseLinkVariants() = runBlocking {
        // Editorial playlist
        val playlistUrl = "https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb"
        val parsed = AppleMusicParser.parseLink(playlistUrl)
        assertNotNull(parsed)
        assertEquals("us", parsed?.storefront)
        assertEquals("playlist", parsed?.type)
        assertEquals("pl.f4d106fed2bd41149aaacabb233eb5eb", parsed?.id)

        // User-shared playlist with pl.u- and hyphens
        val userPlaylistUrl = "https://music.apple.com/in/playlist/my-telugu-mix/pl.u-11zBJomIN8L8W8"
        val parsedUser = AppleMusicParser.parseLink(userPlaylistUrl)
        assertNotNull(parsedUser)
        assertEquals("in", parsedUser?.storefront)
        assertEquals("playlist", parsedUser?.type)
        assertEquals("pl.u-11zBJomIN8L8W8", parsedUser?.id)

        // Album link
        val albumUrl = "https://music.apple.com/in/album/rockstar-original-motion-picture-soundtrack/1121782299"
        val parsedAlbum = AppleMusicParser.parseLink(albumUrl)
        assertNotNull(parsedAlbum)
        assertEquals("in", parsedAlbum?.storefront)
        assertEquals("album", parsedAlbum?.type)
        assertEquals("1121782299", parsedAlbum?.id)
    }

    @Test
    fun testLooksLikeAppleMusicUrl() {
        assertTrue(AppleMusicParser.looksLikeAppleMusicUrl("https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb"))
        assertTrue(AppleMusicParser.looksLikeAppleMusicUrl("music.apple.com/in/album/something/12345"))
    }

    @Test
    fun testFetchRealPlaylist() = runBlocking {
        val target = AppleMusicParser.ParsedTarget(
            originalUrl = "https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb",
            storefront = "us",
            type = "playlist",
            id = "pl.f4d106fed2bd41149aaacabb233eb5eb"
        )
        val result = AppleMusicParser.fetchPlaylist(target)
        assertTrue("fetchPlaylist should succeed: ${result.exceptionOrNull()?.message}", result.isSuccess)
        val info = result.getOrThrow()
        println("Fetched ${info.tracks.size} tracks from Apple Music: ${info.title}")
        assertTrue("Expected tracks, got ${info.tracks.size}", info.tracks.isNotEmpty())
    }
}
