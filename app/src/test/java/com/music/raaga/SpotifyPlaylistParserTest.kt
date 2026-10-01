package com.music.raaga

import com.music.raaga.data.spotify.SpotifyPlaylistParser
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SpotifyPlaylistParserTest {

    @Test
    fun testParseLinkVariants() = runBlocking {
        val webUrl = "https://open.spotify.com/playlist/37i9dQZF1DX4o1oenSJRJd?si=abc"
        val parsedWeb = SpotifyPlaylistParser.parseLink(webUrl)
        assertNotNull(parsedWeb)
        assertEquals("playlist", parsedWeb?.type)
        assertEquals("37i9dQZF1DX4o1oenSJRJd", parsedWeb?.id)

        val uri = "spotify:playlist:37i9dQZF1DX4o1oenSJRJd"
        val parsedUri = SpotifyPlaylistParser.parseLink(uri)
        assertNotNull(parsedUri)
        assertEquals("playlist", parsedUri?.type)
        assertEquals("37i9dQZF1DX4o1oenSJRJd", parsedUri?.id)

        val albumUrl = "https://open.spotify.com/album/4LH4d3cOWNNXdJwFd4G1kv"
        val parsedAlbum = SpotifyPlaylistParser.parseLink(albumUrl)
        assertNotNull(parsedAlbum)
        assertEquals("album", parsedAlbum?.type)
        assertEquals("4LH4d3cOWNNXdJwFd4G1kv", parsedAlbum?.id)
    }

    @Test
    fun testFetchPlaylistWithOverFiftyTracks() = runBlocking {
        // "All Out 2000s" Spotify public playlist has 150 songs
        val target = SpotifyPlaylistParser.ParsedTarget(type = "playlist", id = "37i9dQZF1DX4o1oenSJRJd")
        val result = SpotifyPlaylistParser.fetchPlaylist(target)
        assertTrue("fetchPlaylist should succeed: ${result.exceptionOrNull()?.message}", result.isSuccess)

        val info = result.getOrThrow()
        println("Fetched ${info.tracks.size} tracks for playlist: ${info.title}")
        assertTrue("Expected more than 50 tracks to be imported, found: ${info.tracks.size}", info.tracks.size >= 100)
    }

    @Test
    fun testFetchLargePlaylistOverTwoHundredTracks() = runBlocking {
        // "Jazz Classics" has ~245 songs
        val target = SpotifyPlaylistParser.ParsedTarget(type = "playlist", id = "37i9dQZF1DXbITWG1ZJKYt")
        val result = SpotifyPlaylistParser.fetchPlaylist(target)
        assertTrue("fetchPlaylist should succeed: ${result.exceptionOrNull()?.message}", result.isSuccess)

        val info = result.getOrThrow()
        println("Fetched ${info.tracks.size} tracks for large playlist: ${info.title}")
        assertTrue("Expected over 200 tracks to be imported, found: ${info.tracks.size}", info.tracks.size >= 200)
    }
}
