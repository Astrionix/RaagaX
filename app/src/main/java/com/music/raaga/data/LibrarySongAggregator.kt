package com.music.raaga.data

import android.content.Context
import com.music.raaga.data.model.ShelfItem
import com.music.raaga.data.model.Song
import com.music.raaga.download.Downloads
import com.music.raaga.ui.screens.library.AdditionSourceType
import com.music.raaga.ui.screens.library.RecentlyAddedTrack
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Singleton repository holding cached, deduplicated cross-playlist library songs,
 * offline/downloaded tracks, and song-only Recently Added smart collection across the entire app session.
 *
 * Prevents screens (SongsSubScreen, DownloadedSubScreen, RecentlyAddedSubScreen) from re-querying
 * the network or Android MediaStore from 0 on every navigation or recomposition.
 */
object LibrarySongAggregator {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val aggregationMutex = Mutex()
    private val offlineMutex = Mutex()

    private val _aggregatedSongs = MutableStateFlow<List<Song>>(emptyList())
    val aggregatedSongs: StateFlow<List<Song>> = _aggregatedSongs.asStateFlow()

    private val _playlistSongIds = MutableStateFlow<Set<String>>(emptySet())
    val playlistSongIds: StateFlow<Set<String>> = _playlistSongIds.asStateFlow()

    private val _isAggregating = MutableStateFlow(false)
    val isAggregating: StateFlow<Boolean> = _isAggregating.asStateFlow()

    private val _offlineSongs = MutableStateFlow<List<Song>>(emptyList())
    val offlineSongs: StateFlow<List<Song>> = _offlineSongs.asStateFlow()

    private val _isLoadingOffline = MutableStateFlow(false)
    val isLoadingOffline: StateFlow<Boolean> = _isLoadingOffline.asStateFlow()

    private val _recentlyAddedTracks = MutableStateFlow<List<RecentlyAddedTrack>>(emptyList())
    val recentlyAddedTracks: StateFlow<List<RecentlyAddedTrack>> = _recentlyAddedTracks.asStateFlow()

    /**
     * Seeds initial library songs immediately so UI displays instantly on frame 1,
     * aggregates user playlists and albums concurrently in bounded batches, and constructs
     * the song-only Recently Added collection across all categories.
     */
    fun syncAggregatedSongs(
        initialSongs: List<Song>,
        playlists: List<ShelfItem>,
        albums: List<ShelfItem> = emptyList(),
        forceRefresh: Boolean = false,
    ) {
        // If we already have aggregated songs and aren't forcing a refresh, retain cache
        if (_aggregatedSongs.value.isNotEmpty() && !forceRefresh) {
            if (initialSongs.isNotEmpty()) {
                val existingMap = _aggregatedSongs.value.associateBy { it.videoId }.toMutableMap()
                var added = false
                initialSongs.forEach { song ->
                    if (!existingMap.containsKey(song.videoId)) {
                        existingMap[song.videoId] = song
                        added = true
                    }
                }
                if (added) {
                    _aggregatedSongs.value = existingMap.values.toList()
                }
            }
            return
        }

        scope.launch {
            aggregationMutex.withLock {
                _isAggregating.value = true
                try {
                    val map = LinkedHashMap<String, Song>()
                    val pSongIds = HashSet<String>()
                    val recentList = mutableListOf<RecentlyAddedTrack>()
                    val now = System.currentTimeMillis() / 1000L

                    // 1. Retain existing items if not a forced full wipe
                    if (!forceRefresh) {
                        _aggregatedSongs.value.forEach { map[it.videoId] = it }
                        _playlistSongIds.value.forEach { pSongIds.add(it) }
                        recentList.addAll(_recentlyAddedTracks.value)
                    }

                    // 2. Add initial songs (Liked Music / Library Songs)
                    initialSongs.forEachIndexed { index, song ->
                        map.putIfAbsent(song.videoId, song)
                        val addedTime = song.localDateAddedSeconds?.takeIf { it > 0 } ?: (now - (index * 1800L))
                        recentList.add(
                            RecentlyAddedTrack(
                                song = song,
                                addedAtEpochSeconds = addedTime,
                                sourceType = AdditionSourceType.SONG,
                                sourceTitle = "Favorite Music",
                            )
                        )
                    }

                    // 2.5. Seed initial saved albums immediately so Album cards show up on frame 1
                    albums.forEachIndexed { index, al ->
                        val id = al.browseId ?: return@forEachIndexed
                        val addedTime = now - (index * 3600L) - 30L
                        recentList.add(
                            RecentlyAddedTrack(
                                song = Song(
                                    videoId = "album_seed_${id}",
                                    title = al.title,
                                    artist = al.subtitle.orEmpty(),
                                    thumbnailUrl = al.thumbnailUrl,
                                    albumId = id,
                                    albumName = al.title,
                                ),
                                addedAtEpochSeconds = addedTime,
                                sourceType = AdditionSourceType.ALBUM,
                                sourceId = id,
                                sourceTitle = al.title,
                            )
                        )
                    }

                    // Immediate publish of initial library songs if cache was empty
                    if (map.isNotEmpty() && _aggregatedSongs.value.isEmpty()) {
                        _aggregatedSongs.value = map.values.toList()
                        _recentlyAddedTracks.value = recentList.sortedByDescending { it.addedAtEpochSeconds }
                    }

                    // 3. Filter valid user playlists
                    val validPlaylists = playlists.filter { playlist ->
                        val id = playlist.browseId
                        !id.isNullOrBlank() && (id.startsWith("VL") || id.startsWith("PL") || id.startsWith("FEmusic"))
                    }.take(20)

                    // 4. Concurrently fetch tracks across playlists in batches of 4
                    validPlaylists.chunked(4).forEachIndexed { chunkIndex, batch ->
                        val results = batch.map { pl ->
                            async {
                                val tracks = runCatching {
                                    YtMusicRepository.allSongs(pl.browseId!!).getOrNull()
                                }.getOrNull().orEmpty()
                                pl to tracks
                            }
                        }.awaitAll()

                        var changed = false
                        results.forEachIndexed { itemIndex, (pl, tracks) ->
                            val plAddedTime = now - ((chunkIndex * 4 + itemIndex + 1) * 7200L)
                            tracks.forEach { track ->
                                pSongIds.add(track.videoId)
                                if (!map.containsKey(track.videoId)) {
                                    map[track.videoId] = track
                                    changed = true
                                }
                                recentList.add(
                                    RecentlyAddedTrack(
                                        song = track,
                                        addedAtEpochSeconds = plAddedTime,
                                        sourceType = AdditionSourceType.PLAYLIST,
                                        sourceId = pl.browseId,
                                        sourceTitle = pl.title,
                                    )
                                )
                            }
                        }

                        if (changed) {
                            _aggregatedSongs.value = map.values.toList()
                            _playlistSongIds.value = pSongIds.toSet()
                            _recentlyAddedTracks.value = recentList.sortedByDescending { it.addedAtEpochSeconds }
                        }
                    }

                    // 5. Concurrently fetch tracks for newly added albums
                    val validAlbums = albums.filter { album ->
                        val id = album.browseId
                        !id.isNullOrBlank()
                    }.take(15)

                    validAlbums.chunked(4).forEachIndexed { chunkIndex, batch ->
                        val albumResults = batch.map { al ->
                            async {
                                val tracks = runCatching {
                                    YtMusicRepository.allSongs(al.browseId!!).getOrNull()
                                }.getOrNull().orEmpty()
                                al to tracks
                            }
                        }.awaitAll()

                        albumResults.forEachIndexed { itemIndex, (al, tracks) ->
                            val alAddedTime = now - ((chunkIndex * 4 + itemIndex + 1) * 14400L)
                            recentList.removeAll { it.song.videoId == "album_seed_${al.browseId}" }
                            tracks.forEach { track ->
                                if (!map.containsKey(track.videoId)) {
                                    map[track.videoId] = track
                                }
                                val enriched = track.copy(
                                    albumName = track.albumName?.takeIf { it.isNotBlank() } ?: al.title,
                                    albumId = track.albumId?.takeIf { it.isNotBlank() } ?: al.browseId,
                                )
                                recentList.add(
                                    RecentlyAddedTrack(
                                        song = enriched,
                                        addedAtEpochSeconds = alAddedTime,
                                        sourceType = AdditionSourceType.ALBUM,
                                        sourceId = al.browseId,
                                        sourceTitle = al.title,
                                    )
                                )
                            }
                        }
                    }

                    // 6. Include offline tracks as imported songs
                    _offlineSongs.value.forEach { track ->
                        val importAddedTime = track.localDateAddedSeconds?.takeIf { it > 0 }
                            ?: track.localDateModifiedSeconds?.takeIf { it > 0 }
                            ?: (now - 3600L)
                        recentList.add(
                            RecentlyAddedTrack(
                                song = track,
                                addedAtEpochSeconds = importAddedTime,
                                sourceType = AdditionSourceType.IMPORT,
                                sourceTitle = "Device Audio",
                            )
                        )
                    }

                    _aggregatedSongs.value = map.values.toList()
                    _playlistSongIds.value = pSongIds.toSet()
                    _recentlyAddedTracks.value = recentList.sortedByDescending { it.addedAtEpochSeconds }
                } catch (e: Exception) {
                    DebugLog.e("Raaga", "Error aggregating songs", e)
                } finally {
                    _isAggregating.value = false
                }
            }
        }
    }

    /**
     * Loads offline tracks from Raaga downloads and local storage into memory in parallel.
     */
    fun syncOfflineSongs(context: Context, forceRefresh: Boolean = false) {
        if (_offlineSongs.value.isNotEmpty() && !forceRefresh) return

        scope.launch {
            offlineMutex.withLock {
                _isLoadingOffline.value = true
                try {
                    val raagaDef = async {
                        runCatching {
                            Downloads.getDownloadedSongs(context)
                        }.getOrDefault(emptyList())
                    }
                    val localDef = async {
                        if (LocalMediaRepository.hasStoragePermission(context)) {
                            runCatching {
                                LocalMediaRepository.getLocalMusic(context)
                            }.getOrDefault(emptyList())
                        } else {
                            emptyList()
                        }
                    }

                    val raagaDownloads = raagaDef.await()
                    if (raagaDownloads.isNotEmpty() && _offlineSongs.value.isEmpty()) {
                        _offlineSongs.value = raagaDownloads
                    }

                    val deviceLocal = localDef.await()
                    val combined = (raagaDownloads + deviceLocal).distinctBy { it.localUri ?: it.videoId }
                    _offlineSongs.value = combined

                    // Merge imported tracks into recently added
                    val now = System.currentTimeMillis() / 1000L
                    val importTracks = combined.map { track ->
                        val importAddedTime = track.localDateAddedSeconds?.takeIf { it > 0 }
                            ?: track.localDateModifiedSeconds?.takeIf { it > 0 }
                            ?: (now - 3600L)
                        RecentlyAddedTrack(
                            song = track,
                            addedAtEpochSeconds = importAddedTime,
                            sourceType = AdditionSourceType.IMPORT,
                            sourceTitle = "Device Audio",
                        )
                    }
                    val currentRecent = _recentlyAddedTracks.value.toMutableList()
                    currentRecent.addAll(importTracks)
                    _recentlyAddedTracks.value = currentRecent.sortedByDescending { it.addedAtEpochSeconds }
                } catch (e: Exception) {
                    DebugLog.e("Raaga", "Error syncing offline songs", e)
                } finally {
                    _isLoadingOffline.value = false
                }
            }
        }
    }

    /**
     * Instantly updates memory cache when a song is removed from offline storage.
     */
    fun removeOfflineSong(song: Song) {
        _offlineSongs.value = _offlineSongs.value.filterNot {
            (song.localUri != null && it.localUri == song.localUri) ||
                (song.videoId.isNotEmpty() && it.videoId == song.videoId)
        }
        _recentlyAddedTracks.value = _recentlyAddedTracks.value.filterNot {
            (song.localUri != null && it.song.localUri == song.localUri) ||
                (song.videoId.isNotEmpty() && it.song.videoId == song.videoId)
        }
    }

    /**
     * Dynamically records a single newly added song/album into Recently Added in real-time.
     * Updates [recentlyAddedTracks] and [aggregatedSongs] immediately so UI recomposes instantly.
     */
    fun recordRecentlyAdded(
        song: Song,
        sourceType: AdditionSourceType = AdditionSourceType.PLAYLIST,
        sourceId: String? = null,
        sourceTitle: String? = null,
    ) {
        val now = System.currentTimeMillis() / 1000L
        val track = RecentlyAddedTrack(
            song = song,
            addedAtEpochSeconds = now,
            sourceType = sourceType,
            sourceId = sourceId,
            sourceTitle = sourceTitle,
        )
        // Add to aggregated songs cache if not already present
        if (song.videoId.isNotEmpty() && !song.videoId.startsWith("album_seed_")) {
            val currentAggregated = _aggregatedSongs.value.toMutableList()
            if (currentAggregated.none { it.videoId == song.videoId }) {
                currentAggregated.add(0, song)
                _aggregatedSongs.value = currentAggregated
            }
        }
        if (sourceType == AdditionSourceType.PLAYLIST && song.videoId.isNotEmpty()) {
            _playlistSongIds.value = _playlistSongIds.value + song.videoId
        }
        // Update recently added list
        val currentRecent = _recentlyAddedTracks.value.toMutableList()
        currentRecent.removeAll {
            (song.localUri != null && it.song.localUri == song.localUri) ||
                (song.videoId.isNotEmpty() && it.song.videoId == song.videoId)
        }
        currentRecent.add(0, track)
        _recentlyAddedTracks.value = currentRecent
    }

    /**
     * Dynamically records a batch of songs (e.g. from an album or playlist) into Recently Added in real-time.
     */
    /**
     * Removes specified songs from the active library aggregation and recently added stream
     * WITHOUT deleting downloaded audio files from physical disk.
     */
    fun removeFromLibrary(songsToRemove: List<Song>) {
        if (songsToRemove.isEmpty()) return
        val removeIds = songsToRemove.map { it.localUri ?: it.videoId }.toSet()
        _aggregatedSongs.value = _aggregatedSongs.value.filterNot { (it.localUri ?: it.videoId) in removeIds }
        _recentlyAddedTracks.value = _recentlyAddedTracks.value.filterNot { (it.song.localUri ?: it.song.videoId) in removeIds }
        _playlistSongIds.value = _playlistSongIds.value - songsToRemove.map { it.videoId }.toSet()
    }

    fun recordRecentlyAddedBatch(
        songs: List<Song>,
        sourceType: AdditionSourceType = AdditionSourceType.ALBUM,
        sourceId: String? = null,
        sourceTitle: String? = null,
    ) {
        if (songs.isEmpty()) return
        val now = System.currentTimeMillis() / 1000L
        val newTracks = songs.mapIndexed { idx, song ->
            val enriched = if (sourceType == AdditionSourceType.ALBUM) {
                song.copy(
                    albumName = song.albumName?.takeIf { it.isNotBlank() } ?: sourceTitle,
                    albumId = song.albumId?.takeIf { it.isNotBlank() } ?: sourceId,
                )
            } else {
                song
            }
            RecentlyAddedTrack(
                song = enriched,
                addedAtEpochSeconds = now - idx,
                sourceType = sourceType,
                sourceId = sourceId,
                sourceTitle = sourceTitle,
            )
        }
        val currentAggregated = _aggregatedSongs.value.toMutableList()
        val existingMap = currentAggregated.associateBy { it.videoId }.toMutableMap()
        songs.forEach { song ->
            if (song.videoId.isNotEmpty() && !song.videoId.startsWith("album_seed_") && !existingMap.containsKey(song.videoId)) {
                existingMap[song.videoId] = song
                currentAggregated.add(0, song)
            }
        }
        _aggregatedSongs.value = currentAggregated

        val currentRecent = _recentlyAddedTracks.value.toMutableList()
        val newIds = songs.map { it.localUri ?: it.videoId }.toSet()
        currentRecent.removeAll { (it.song.localUri ?: it.song.videoId) in newIds }
        if (sourceId != null) {
            currentRecent.removeAll { it.song.videoId == "album_seed_${sourceId}" }
        }
        currentRecent.addAll(0, newTracks)
        _recentlyAddedTracks.value = currentRecent
    }
}
