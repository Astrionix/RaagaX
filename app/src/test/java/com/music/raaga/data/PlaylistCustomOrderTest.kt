package com.music.raaga.data

import com.music.raaga.data.model.Song
import com.music.raaga.data.settings.SongSort
import com.music.raaga.data.settings.PlaylistCustomOrderStore
import com.music.raaga.ui.screens.sortedForDetail
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class PlaylistCustomOrderTest {

    private val playlistId = "VLPL_test_custom_order"

    private fun testSong(
        id: String,
        title: String,
        artist: String,
        durationText: String? = null,
        setVideoId: String? = null,
    ) = Song(
        videoId = id,
        title = title,
        artist = artist,
        thumbnailUrl = null,
        durationText = durationText,
        setVideoId = setVideoId,
    )

    private val songA = testSong("vid_a", "Blinding Lights", "The Weeknd", "3:20")
    private val songB = testSong("vid_b", "Starboy", "The Weeknd", "3:50")
    private val songC = testSong("vid_c", "Slow Down", "Chase Atlantic", "4:15")
    private val songD = testSong("vid_d", "The Fate of Ophelia", "Taylor Swift", "2:45")

    @Before
    fun setUp() {
        PlaylistCustomOrderStore.clearAll()
    }

    @After
    fun tearDown() {
        PlaylistCustomOrderStore.clearAll()
    }

    @Test
    fun customOrder_persistsAndOrdersTracks() {
        val originalList = listOf(songA, songB, songC, songD)
        val customSequence = listOf(songC, songA, songD, songB)

        PlaylistCustomOrderStore.saveCustomOrder(playlistId, customSequence)
        assertTrue(PlaylistCustomOrderStore.hasCustomOrder(playlistId))

        val ordered = PlaylistCustomOrderStore.applyCustomOrder(playlistId, originalList)
        assertEquals(listOf("vid_c", "vid_a", "vid_d", "vid_b"), ordered.map { it.videoId })
    }

    @Test
    fun customOrder_newlyAddedSongAppendsToEnd() {
        val initialSongs = listOf(songA, songB)
        PlaylistCustomOrderStore.saveCustomOrder(playlistId, initialSongs)

        // User adds songC to playlist
        PlaylistCustomOrderStore.appendSong(playlistId, songC)

        val fullList = listOf(songA, songB, songC)
        val ordered = PlaylistCustomOrderStore.applyCustomOrder(playlistId, fullList)

        // songC must be at the end, not at top or random
        assertEquals(listOf("vid_a", "vid_b", "vid_c"), ordered.map { it.videoId })
    }

    @Test
    fun customOrder_unindexedIncomingSongsAppendToEnd() {
        // Saved custom order only has A and B
        PlaylistCustomOrderStore.saveCustomOrder(playlistId, listOf(songB, songA))

        // Incoming server response has C at the top, then B and A
        val serverList = listOf(songC, songB, songA)
        val ordered = PlaylistCustomOrderStore.applyCustomOrder(playlistId, serverList)

        // B and A preserve their relative custom order (B then A), and unindexed C is appended to the end
        assertEquals(listOf("vid_b", "vid_a", "vid_c"), ordered.map { it.videoId })
    }

    @Test
    fun customOrder_supportsDuplicateTracksWithSetVideoId() {
        val duplicate1 = testSong(
            id = "shared_id",
            title = "Track A",
            artist = "Artist",
            setVideoId = "set_item_1",
        )
        val duplicate2 = testSong(
            id = "shared_id",
            title = "Track A (Reprise)",
            artist = "Artist",
            setVideoId = "set_item_2",
        )

        // User orders duplicate2 before duplicate1
        PlaylistCustomOrderStore.saveCustomOrder(playlistId, listOf(duplicate2, duplicate1))

        val list = listOf(duplicate1, duplicate2)
        val ordered = PlaylistCustomOrderStore.applyCustomOrder(playlistId, list)

        assertEquals("set_item_2", ordered[0].setVideoId)
        assertEquals("set_item_1", ordered[1].setVideoId)
    }

    @Test
    fun customOrder_removeSongsRemovesFromSequence() {
        PlaylistCustomOrderStore.saveCustomOrder(playlistId, listOf(songA, songB, songC))

        PlaylistCustomOrderStore.removeSongs(playlistId, listOf(songB))

        val remaining = listOf(songA, songC)
        val ordered = PlaylistCustomOrderStore.applyCustomOrder(playlistId, remaining)

        assertEquals(listOf("vid_a", "vid_c"), ordered.map { it.videoId })
        assertEquals(listOf("vid_a", "vid_c"), PlaylistCustomOrderStore.getCustomOrder(playlistId))
    }

    @Test
    fun sortedForDetail_customOrderSortsCorrectly() {
        PlaylistCustomOrderStore.saveCustomOrder(playlistId, listOf(songD, songB, songA, songC))

        val raw = listOf(songA, songB, songC, songD)
        val sorted = raw.sortedForDetail(SongSort.CUSTOM_ORDER, playlistId)

        assertEquals(listOf("vid_d", "vid_b", "vid_a", "vid_c"), sorted.map { it.videoId })
    }

    @Test
    fun sortedForDetail_sortingByArtistOrDurationDoesNotOverwriteCustomOrder() {
        PlaylistCustomOrderStore.saveCustomOrder(playlistId, listOf(songD, songC, songB, songA))

        val raw = listOf(songA, songB, songC, songD)

        // Sort by Artist
        val byArtist = raw.sortedForDetail(SongSort.ARTIST_ASC, playlistId)
        assertEquals("Chase Atlantic", byArtist[0].artist)
        assertEquals("Taylor Swift", byArtist[1].artist)

        // Sort by Duration (longest first: songC 4:15, songB 3:50, songA 3:20, songD 2:45)
        val byDuration = raw.sortedForDetail(SongSort.DURATION_DESC, playlistId)
        assertEquals(listOf("vid_c", "vid_b", "vid_a", "vid_d"), byDuration.map { it.videoId })

        // Switch back to CUSTOM_ORDER: custom sequence is completely intact!
        val backToCustom = raw.sortedForDetail(SongSort.CUSTOM_ORDER, playlistId)
        assertEquals(listOf("vid_d", "vid_c", "vid_b", "vid_a"), backToCustom.map { it.videoId })
    }
}
