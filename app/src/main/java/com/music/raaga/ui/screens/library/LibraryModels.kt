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
    MADE_FOR_YOU("MADE_FOR_YOU", R.string.made_for_you, Icons.Rounded.Person),
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
 * Mix item for Made for You personalized mixes.
 */
data class MadeForYouMix(
    val id: String,
    val title: String,
    val subtitle: String,
    val artworkUrl: String? = null,
    val gradientColors: List<Color> = listOf(Color(0xFFE53935), Color(0xFF1E88E5)),
    val playlistId: String? = null,
    val shelfItem: ShelfItem? = null,
)

/**
 * Origin categories for newly added songs in the Library.
 */
enum class AdditionSourceType(val label: String) {
    ALL("All Songs"),
    ALBUM("Albums"),
    PLAYLIST("Playlists"),
    IMPORT("Imports"),
    SONG("Songs"),
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

