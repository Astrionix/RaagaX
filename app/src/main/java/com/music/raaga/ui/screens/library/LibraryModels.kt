package com.music.raaga.ui.screens.library

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Album
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Folder
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.QueueMusic
import androidx.compose.material.icons.rounded.Replay
import androidx.compose.material.icons.rounded.Storage
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.Color
import com.music.raaga.R
import com.music.raaga.data.model.ShelfItem
import com.music.raaga.data.model.Song

/**
 * Top-level categories shown in the Library Hub list.
 */
enum class LibraryCategory(
    val id: String,
    @StringRes val titleRes: Int,
    val icon: ImageVector,
) {
    PLAYLISTS("PLAYLISTS", R.string.playlists, Icons.Rounded.QueueMusic),
    ARTISTS("ARTISTS", R.string.artists, Icons.Rounded.Mic),
    ALBUMS("ALBUMS", R.string.albums, Icons.Rounded.Album),
    SONGS("SONGS", R.string.songs, Icons.Rounded.MusicNote),
    DOWNLOADED("DOWNLOADED", R.string.downloaded, Icons.Rounded.Download),
    IMPORT_AND_SOURCES("IMPORT_AND_SOURCES", R.string.import_and_sources, Icons.Rounded.Storage),
    REPLAY("REPLAY", R.string.replay, Icons.Rounded.Replay),
    RECENTLY_ADDED("RECENTLY_ADDED", R.string.recently_added, Icons.Rounded.QueueMusic);

    companion object {
        fun fromId(id: String): LibraryCategory? = entries.firstOrNull { it.id == id }
    }
}

/**
 * Pinned card item shown in the horizontal hero carousel.
 */
data class PinnedCollection(
    val id: String,
    val title: String,
    val subtitle: String? = null,
    val artworkUrl: String? = null,
    val isFavoriteSongs: Boolean = false,
    val shelfItem: ShelfItem? = null,
)

/**
 * Playlist folder grouping multiple playlists.
 */
data class PlaylistFolder(
    val id: String,
    val name: String,
    val playlistIds: List<String> = emptyList(),
)

enum class PlaylistSortOption(val id: String, @StringRes val labelRes: Int) {
    TYPE("TYPE", R.string.playlist_type),
    TITLE("TITLE", R.string.title),
    RECENTLY_ADDED("RECENTLY_ADDED", R.string.recently_added),
    RECENTLY_PLAYED("RECENTLY_PLAYED", R.string.recently_played),
    RECENTLY_UPDATED("RECENTLY_UPDATED", R.string.recently_updated);

    companion object {
        fun fromId(id: String): PlaylistSortOption =
            entries.firstOrNull { it.id == id } ?: TYPE
    }
}

enum class PlaylistFilter(val id: String, @StringRes val labelRes: Int) {
    ALL("ALL", R.string.all_playlists),
    CREATED("CREATED", R.string.created_playlists),
    FOLLOWED("FOLLOWED", R.string.followed_playlists),
    FAVORITES("FAVORITES", R.string.favorite_songs);

    companion object {
        fun fromId(id: String): PlaylistFilter =
            entries.firstOrNull { it.id == id } ?: ALL
    }
}

enum class LibraryViewMode(val id: String, @StringRes val labelRes: Int) {
    GRID("GRID", R.string.grid_view),
    LIST("LIST", R.string.list_view),
}

enum class ArtistSortOption(val id: String, @StringRes val labelRes: Int) {
    NAME("NAME", R.string.name),
    RECENTLY_ADDED("RECENTLY_ADDED", R.string.recently_added);

    companion object {
        fun fromId(id: String): ArtistSortOption =
            entries.firstOrNull { it.id == id } ?: NAME
    }
}

enum class AlbumSortOption(val id: String, @StringRes val labelRes: Int) {
    RECENTLY_ADDED("RECENTLY_ADDED", R.string.recently_added),
    TITLE("TITLE", R.string.title),
    ARTIST("ARTIST", R.string.artist),
    RELEASE_DATE("RELEASE_DATE", R.string.release_date);

    companion object {
        fun fromId(id: String): AlbumSortOption =
            entries.firstOrNull { it.id == id } ?: RECENTLY_ADDED
    }
}

enum class SongSortOption(val id: String, @StringRes val labelRes: Int) {
    RECENTLY_ADDED("RECENTLY_ADDED", R.string.recently_added),
    TITLE("TITLE", R.string.title),
    ARTIST("ARTIST", R.string.artist),
    ALBUM("ALBUM", R.string.album),
    DURATION("DURATION", R.string.duration),
    MOST_PLAYED("MOST_PLAYED", R.string.most_played);

    companion object {
        fun fromId(id: String): SongSortOption =
            entries.firstOrNull { it.id == id } ?: RECENTLY_ADDED
    }
}



/**
 * Origin categories for newly added songs in the Library.
 */
enum class AdditionSourceType(val label: String) {
    ALL("All"),
    ALBUM("Albums"),
    PLAYLIST("Playlists"),
    SONG("Songs"),
    IMPORT("Imports");
}

/**
 * A track in Recently Added with its addition timestamp and origin source.
 */
data class RecentlyAddedTrack(
    val song: Song,
    val addedAtEpochSeconds: Long,
    val sourceType: AdditionSourceType,
    val sourceId: String? = null,
    val sourceTitle: String? = null,
)

/**
 * Returns human-readable relative calendar date headers (Today, Yesterday, etc.).
 */
fun getRelativeDateHeader(epochSeconds: Long): String {
    val now = System.currentTimeMillis()
    val addedMillis = epochSeconds * 1000L
    val diffMillis = (now - addedMillis).coerceAtLeast(0L)
    val oneDayMillis = 24 * 60 * 60 * 1000L

    val calNow = java.util.Calendar.getInstance().apply { timeInMillis = now }
    val calAdded = java.util.Calendar.getInstance().apply { timeInMillis = addedMillis }

    val isToday = calNow.get(java.util.Calendar.YEAR) == calAdded.get(java.util.Calendar.YEAR) &&
        calNow.get(java.util.Calendar.DAY_OF_YEAR) == calAdded.get(java.util.Calendar.DAY_OF_YEAR)

    val isYesterday = calNow.get(java.util.Calendar.YEAR) == calAdded.get(java.util.Calendar.YEAR) &&
        calNow.get(java.util.Calendar.DAY_OF_YEAR) - calAdded.get(java.util.Calendar.DAY_OF_YEAR) == 1

    return when {
        isToday -> "Today"
        isYesterday -> "Yesterday"
        diffMillis < 7 * oneDayMillis -> "Earlier This Week"
        diffMillis < 30 * oneDayMillis -> "This Month"
        else -> "Earlier"
    }
}

/**
 * Polymorphic item representing an Album, Playlist or Standalone Single in the Recently Added section.
 */
sealed class RecentlyAddedItem {
    abstract val key: String
    abstract val title: String
    abstract val subtitle: String
    abstract val artworkUrl: String?
    abstract val addedAtEpochSeconds: Long
    abstract val isAlbum: Boolean

    data class Album(
        override val key: String,
        override val title: String,
        override val subtitle: String,
        override val artworkUrl: String?,
        override val addedAtEpochSeconds: Long,
        val albumBrowseId: String?,
        val artist: String,
        val representativeSong: Song,
        val songs: List<Song> = emptyList(),
    ) : RecentlyAddedItem() {
        override val isAlbum: Boolean = true
    }

    data class Playlist(
        override val key: String,
        override val title: String,
        override val subtitle: String,
        override val artworkUrl: String?,
        override val addedAtEpochSeconds: Long,
        val playlistBrowseId: String,
        val representativeSong: Song? = null,
        val songs: List<Song> = emptyList(),
    ) : RecentlyAddedItem() {
        override val isAlbum: Boolean = false
    }

    data class SingleSong(
        override val key: String,
        override val title: String,
        override val subtitle: String,
        override val artworkUrl: String?,
        override val addedAtEpochSeconds: Long,
        val song: Song,
    ) : RecentlyAddedItem() {
        override val isAlbum: Boolean = false
    }
}

val RecentlyAddedItem.playableSongs: List<Song>
    get() = when (this) {
        is RecentlyAddedItem.Album -> songs.ifEmpty { listOf(representativeSong) }
        is RecentlyAddedItem.Playlist -> songs.ifEmpty { listOfNotNull(representativeSong) }
        is RecentlyAddedItem.SingleSong -> listOf(song)
    }

/**
 * Converts a stream of [RecentlyAddedTrack] into aggregated, deduplicated [RecentlyAddedItem]s (Albums, Playlists, Singles).
 * - Tracks belonging to an album are grouped under a single Album card.
 * - Tracks added to a playlist or library with an album tag display as the Album.
 * - User playlists display as Playlist cards under the Playlists filter.
 * - Single tracks without album/playlist groupings appear as SingleSong cards.
 * - Caps at [maxItems] (default 10) to fill the 8-10 slots grid.
 */
fun List<RecentlyAddedTrack>.toRecentlyAddedItems(
    maxItems: Int = 10,
    filterCategory: AdditionSourceType = AdditionSourceType.ALL,
): List<RecentlyAddedItem> {
    val items = mutableListOf<RecentlyAddedItem>()
    val albumMap = mutableMapOf<String, RecentlyAddedItem.Album>()
    val playlistMap = mutableMapOf<String, RecentlyAddedItem.Playlist>()
    val seenKeys = mutableSetOf<String>()

    for (track in this) {
        val song = track.song
        val isExplicitAlbum = track.sourceType == AdditionSourceType.ALBUM
        val isExplicitPlaylist = track.sourceType == AdditionSourceType.PLAYLIST
        val hasAlbumName = !song.albumName.isNullOrBlank()
        val hasAlbumId = !song.albumId.isNullOrBlank()

        when (filterCategory) {
            AdditionSourceType.ALBUM -> {
                if (isExplicitAlbum || hasAlbumName || hasAlbumId) {
                    processAlbumTrack(track, song, isExplicitAlbum, maxItems, seenKeys, albumMap, items)
                }
            }
            AdditionSourceType.PLAYLIST -> {
                if (isExplicitPlaylist && !track.sourceId.isNullOrBlank()) {
                    processPlaylistTrack(track, song, maxItems, seenKeys, playlistMap, items)
                }
            }
            AdditionSourceType.SONG -> {
                val songKey = "song:${song.localUri ?: song.videoId}"
                if (!seenKeys.contains(songKey)) {
                    if (items.size >= maxItems) continue
                    seenKeys.add(songKey)
                    items.add(
                        RecentlyAddedItem.SingleSong(
                            key = songKey,
                            title = song.title,
                            subtitle = song.artist,
                            artworkUrl = song.thumbnailUrl,
                            addedAtEpochSeconds = track.addedAtEpochSeconds,
                            song = song,
                        )
                    )
                }
            }
            AdditionSourceType.ALL, AdditionSourceType.IMPORT -> {
                if (isExplicitAlbum || hasAlbumName || hasAlbumId) {
                    processAlbumTrack(track, song, isExplicitAlbum, maxItems, seenKeys, albumMap, items)
                } else if (isExplicitPlaylist && !track.sourceId.isNullOrBlank()) {
                    processPlaylistTrack(track, song, maxItems, seenKeys, playlistMap, items)
                } else {
                    val songKey = "song:${song.localUri ?: song.videoId}"
                    if (!seenKeys.contains(songKey)) {
                        if (items.size >= maxItems) continue
                        seenKeys.add(songKey)
                        items.add(
                            RecentlyAddedItem.SingleSong(
                                key = songKey,
                                title = song.title,
                                subtitle = song.artist,
                                artworkUrl = song.thumbnailUrl,
                                addedAtEpochSeconds = track.addedAtEpochSeconds,
                                song = song,
                            )
                        )
                    }
                }
            }
        }
    }

    return items
}

private fun processAlbumTrack(
    track: RecentlyAddedTrack,
    song: Song,
    isExplicitAlbum: Boolean,
    maxItems: Int,
    seenKeys: MutableSet<String>,
    albumMap: MutableMap<String, RecentlyAddedItem.Album>,
    items: MutableList<RecentlyAddedItem>,
) {
    val albumTitle = song.albumName?.takeIf { it.isNotBlank() }
        ?: (if (isExplicitAlbum) track.sourceTitle else null)
        ?: song.title
    val albumBrowseId = song.albumId?.takeIf { it.isNotBlank() }
        ?: (if (isExplicitAlbum) track.sourceId else null)

    val albumKey = if (!albumBrowseId.isNullOrBlank()) {
        "album:id:$albumBrowseId"
    } else {
        "album:name:${song.artist.trim().lowercase()}:${albumTitle.trim().lowercase()}"
    }

    if (seenKeys.contains(albumKey)) {
        albumMap[albumKey]?.let { existing ->
            if (existing.songs.none { it.videoId == song.videoId }) {
                val updated = existing.copy(songs = existing.songs + song)
                albumMap[albumKey] = updated
                val idx = items.indexOfFirst { it.key == albumKey }
                if (idx >= 0) {
                    items[idx] = updated
                }
            }
        }
    } else {
        if (items.size < maxItems) {
            seenKeys.add(albumKey)
            val albumItem = RecentlyAddedItem.Album(
                key = albumKey,
                title = albumTitle,
                subtitle = song.artist,
                artworkUrl = song.thumbnailUrl,
                addedAtEpochSeconds = track.addedAtEpochSeconds,
                albumBrowseId = albumBrowseId,
                artist = song.artist,
                representativeSong = song,
                songs = listOf(song),
            )
            albumMap[albumKey] = albumItem
            items.add(albumItem)
        }
    }
}

private fun processPlaylistTrack(
    track: RecentlyAddedTrack,
    song: Song,
    maxItems: Int,
    seenKeys: MutableSet<String>,
    playlistMap: MutableMap<String, RecentlyAddedItem.Playlist>,
    items: MutableList<RecentlyAddedItem>,
) {
    val plId = track.sourceId ?: return
    val plKey = "playlist:id:$plId"
    val plTitle = track.sourceTitle ?: "Playlist"

    if (seenKeys.contains(plKey)) {
        playlistMap[plKey]?.let { existing ->
            if (existing.songs.none { it.videoId == song.videoId }) {
                val updatedSongs = existing.songs + song
                val updated = existing.copy(
                    songs = updatedSongs,
                    subtitle = "Playlist • ${updatedSongs.size} songs",
                )
                playlistMap[plKey] = updated
                val idx = items.indexOfFirst { it.key == plKey }
                if (idx >= 0) {
                    items[idx] = updated
                }
            }
        }
    } else {
        if (items.size < maxItems) {
            seenKeys.add(plKey)
            val plItem = RecentlyAddedItem.Playlist(
                key = plKey,
                title = plTitle,
                subtitle = "Playlist • 1 song",
                artworkUrl = song.thumbnailUrl,
                addedAtEpochSeconds = track.addedAtEpochSeconds,
                playlistBrowseId = plId,
                representativeSong = song,
                songs = listOf(song),
            )
            playlistMap[plKey] = plItem
            items.add(plItem)
        }
    }
}
