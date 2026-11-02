package com.music.raaga

import com.music.raaga.data.LibrarySongAggregator
import com.music.raaga.data.model.Song
import com.music.raaga.ui.screens.library.AdditionSourceType
import com.music.raaga.ui.screens.library.RecentlyAddedItem
import com.music.raaga.ui.screens.library.RecentlyAddedTrack
import com.music.raaga.ui.screens.library.playableSongs
import com.music.raaga.ui.screens.library.toRecentlyAddedItems
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RecentlyAddedAggregationTest {

    private fun makeTrack(
        id: String,
        albumId: String? = null,
        albumName: String? = null,
        sourceType: AdditionSourceType = AdditionSourceType.SONG,
        sourceId: String? = null,
        sourceTitle: String? = null,
    ): RecentlyAddedTrack {
        val song = Song(
            videoId = id,
            title = "Track $id",
            artist = "Artist $id",
            thumbnailUrl = null,
            albumId = albumId,
            albumName = albumName,
        )
        return RecentlyAddedTrack(
            song = song,
            addedAtEpochSeconds = System.currentTimeMillis() / 1000L,
            sourceType = sourceType,
            sourceId = sourceId,
            sourceTitle = sourceTitle,
        )
    }

    @Test
    fun aggregatesTracksWithAlbumIntoAlbumItem() {
        val tracks = listOf(
            makeTrack(id = "1", albumId = "alb1", albumName = "Album 1"),
            makeTrack(id = "2", albumId = "alb1", albumName = "Album 1"),
            makeTrack(id = "3", albumId = null, albumName = null),
        )

        val items = tracks.toRecentlyAddedItems(maxItems = 10)
        assertEquals(2, items.size)
        assertTrue(items[0] is RecentlyAddedItem.Album)
        val album = items[0] as RecentlyAddedItem.Album
        assertEquals("alb1", album.albumBrowseId)
        assertEquals("Album 1", album.title)
        assertEquals(2, album.songs.size)

        assertTrue(items[1] is RecentlyAddedItem.SingleSong)
        assertEquals("3", (items[1] as RecentlyAddedItem.SingleSong).song.videoId)
    }

    @Test
    fun limitsTotalItemsToRequestedMaxItems() {
        val tracks = (1..20).map {
            makeTrack(id = "track_$it", albumId = null, albumName = null)
        }

        val items = tracks.toRecentlyAddedItems(maxItems = 10)
        assertEquals(10, items.size)
    }

    @Test
    fun respectsAlbumSourceTypeEvenWithoutAlbumId() {
        val tracks = listOf(
            makeTrack(id = "s1", albumId = null, albumName = "Standalone Album", sourceType = AdditionSourceType.ALBUM)
        )

        val items = tracks.toRecentlyAddedItems(maxItems = 10)
        assertEquals(1, items.size)
        assertTrue(items[0] is RecentlyAddedItem.Album)
        assertEquals("Standalone Album", (items[0] as RecentlyAddedItem.Album).title)
    }

    @Test
    fun aggregatesPlaylistsAndFiltersByCategory() {
        val tracks = listOf(
            makeTrack(id = "p1", sourceType = AdditionSourceType.PLAYLIST, sourceId = "pl1", sourceTitle = "Roadtrip"),
            makeTrack(id = "p2", sourceType = AdditionSourceType.PLAYLIST, sourceId = "pl1", sourceTitle = "Roadtrip"),
            makeTrack(id = "a1", albumId = "alb99", albumName = "Studio Album"),
            makeTrack(id = "s1", sourceType = AdditionSourceType.SONG),
        )

        // All filter
        val allItems = tracks.toRecentlyAddedItems(maxItems = 10, filterCategory = AdditionSourceType.ALL)
        assertEquals(3, allItems.size) // 1 Playlist, 1 Album, 1 SingleSong

        // Playlists filter
        val playlistItems = tracks.toRecentlyAddedItems(maxItems = 10, filterCategory = AdditionSourceType.PLAYLIST)
        assertEquals(1, playlistItems.size)
        assertTrue(playlistItems[0] is RecentlyAddedItem.Playlist)
        val pl = playlistItems[0] as RecentlyAddedItem.Playlist
        assertEquals("Roadtrip", pl.title)
        assertEquals("pl1", pl.playlistBrowseId)
        assertEquals(2, pl.songs.size)

        // Albums filter
        val albumItems = tracks.toRecentlyAddedItems(maxItems = 10, filterCategory = AdditionSourceType.ALBUM)
        assertEquals(1, albumItems.size)
        assertTrue(albumItems[0] is RecentlyAddedItem.Album)

        // Songs filter
        val songItems = tracks.toRecentlyAddedItems(maxItems = 10, filterCategory = AdditionSourceType.SONG)
        assertEquals(4, songItems.size)
    }

    @Test
    fun removeFromLibraryNonDestructivelyRemovesSongsFromAggregator() {
        val song1 = Song(videoId = "rm1", title = "Removable 1", artist = "Artist", thumbnailUrl = null)
        val song2 = Song(videoId = "rm2", title = "Removable 2", artist = "Artist", thumbnailUrl = null)
        val song3 = Song(videoId = "keep", title = "Keep Me", artist = "Artist", thumbnailUrl = null)

        LibrarySongAggregator.recordRecentlyAdded(song1)
        LibrarySongAggregator.recordRecentlyAdded(song2)
        LibrarySongAggregator.recordRecentlyAdded(song3)

        assertTrue(LibrarySongAggregator.recentlyAddedTracks.value.any { it.song.videoId == "rm1" })
        assertTrue(LibrarySongAggregator.recentlyAddedTracks.value.any { it.song.videoId == "rm2" })

        // Remove song1 and song2
        LibrarySongAggregator.removeFromLibrary(listOf(song1, song2))

        assertFalse(LibrarySongAggregator.recentlyAddedTracks.value.any { it.song.videoId == "rm1" })
        assertFalse(LibrarySongAggregator.recentlyAddedTracks.value.any { it.song.videoId == "rm2" })
        assertTrue(LibrarySongAggregator.recentlyAddedTracks.value.any { it.song.videoId == "keep" })
    }
}
