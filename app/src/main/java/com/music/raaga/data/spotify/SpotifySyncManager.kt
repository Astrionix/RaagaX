package com.music.raaga.data.spotify

import com.music.raaga.data.DebugLog as Log
import com.music.raaga.data.LikeState
import com.music.raaga.data.YtMusicRepository
import com.music.raaga.data.innertube.Innertube
import com.music.raaga.data.model.LikeStatus
import com.music.raaga.data.model.PlaylistPrivacy
import com.music.raaga.data.model.SearchFilter
import com.music.raaga.data.model.SearchResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext

sealed interface SpotifySyncProgress {
    data object Idle : SpotifySyncProgress
    data class FetchingTracks(val current: Int, val total: Int) : SpotifySyncProgress
    data class Matching(
        val current: Int,
        val total: Int,
        val currentTrack: String,
        val playlistName: String? = null,
        val playlistIndex: Int = 1,
        val totalPlaylists: Int = 1,
    ) : SpotifySyncProgress
    data class Completed(
        val matchedCount: Int,
        val totalCount: Int,
        val message: String,
    ) : SpotifySyncProgress
    data class Error(val message: String) : SpotifySyncProgress
}

object SpotifySyncManager {
    private const val TAG = "SpotifySyncManager"

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var activeJob: Job? = null

    private val _syncState = MutableStateFlow<SpotifySyncProgress>(SpotifySyncProgress.Idle)
    val syncState: StateFlow<SpotifySyncProgress> = _syncState.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    fun cancelSync() {
        activeJob?.cancel()
        activeJob = null
        _isSyncing.value = false
        _syncState.value = SpotifySyncProgress.Idle
    }

    /**
     * Syncs Spotify "Liked Songs" directly into Raaga:
     * 1. Fetches all saved tracks from Spotify API.
     * 2. Resolves each track to a YouTube Music video ID.
     * 3. Marks them as Liked in LikeState & rates via Innertube.
     * 4. Populates a dedicated "Spotify Liked Songs" playlist in the user's library.
     */
    fun syncLikedSongs(
        createDedicatedPlaylist: Boolean = true,
        onComplete: ((Result<Int>) -> Unit)? = null,
    ) {
        cancelSync()
        _isSyncing.value = true

        activeJob = scope.launch {
            try {
                val token = SpotifyAuthManager.getValidAccessToken()
                if (token.isNullOrBlank()) {
                    val err = "Spotify not connected or token expired. Please connect Spotify first."
                    _syncState.value = SpotifySyncProgress.Error(err)
                    _isSyncing.value = false
                    onComplete?.invoke(Result.failure(IllegalStateException(err)))
                    return@launch
                }

                _syncState.value = SpotifySyncProgress.FetchingTracks(0, 0)
                val tracksResult = SpotifyApiClient.getLikedSongs(token) { loaded, total ->
                    _syncState.value = SpotifySyncProgress.FetchingTracks(loaded, total)
                }

                val tracks = tracksResult.getOrElse { err ->
                    val msg = err.message ?: "Failed to fetch liked tracks from Spotify"
                    _syncState.value = SpotifySyncProgress.Error(msg)
                    _isSyncing.value = false
                    onComplete?.invoke(Result.failure(Exception(msg)))
                    return@launch
                }

                if (tracks.isEmpty()) {
                    _syncState.value = SpotifySyncProgress.Completed(0, 0, "No liked songs found on Spotify")
                    _isSyncing.value = false
                    onComplete?.invoke(Result.success(0))
                    return@launch
                }

                val total = tracks.size
                val matchedVideoIds = java.util.Collections.synchronizedList(mutableListOf<Pair<Int, String>>())
                val processedCount = java.util.concurrent.atomic.AtomicInteger(0)
                val semaphore = Semaphore(3)

                coroutineScope {
                    tracks.forEachIndexed { index, track ->
                        launch {
                            semaphore.withPermit {
                                if (!isActive) return@launch
                                val query = "${track.title} ${track.artist}".trim()
                                val videoId = searchWithRetry(query)
                                if (videoId != null) {
                                    matchedVideoIds.add(index to videoId)
                                    // Mark liked immediately in session
                                    LikeState.set(videoId, LikeStatus.LIKE)
                                    // Rate in background if signed in
                                    runCatching { Innertube.rate(videoId, LikeStatus.LIKE) }
                                }
                                val processed = processedCount.incrementAndGet()
                                _syncState.value = SpotifySyncProgress.Matching(
                                    current = processed,
                                    total = total,
                                    currentTrack = "${track.title} · ${track.artist}",
                                    playlistName = "Liked Songs",
                                )
                                delay(35L)
                            }
                        }
                    }
                }

                if (!isActive) return@launch

                val sortedVideoIds = matchedVideoIds.sortedBy { it.first }.map { it.second }

                // Create or append to "Spotify Liked Songs" playlist
                if (createDedicatedPlaylist && sortedVideoIds.isNotEmpty()) {
                    val firstBatch = sortedVideoIds.take(50)
                    val remainingBatches = sortedVideoIds.drop(50).chunked(4)

                    val createRes = YtMusicRepository.createPlaylist(
                        title = "Spotify Liked Songs",
                        privacy = PlaylistPrivacy.PRIVATE,
                        videoIds = firstBatch,
                    )
                    createRes.onSuccess { playlistId ->
                        for (batch in remainingBatches) {
                            if (!isActive) break
                            runCatching { YtMusicRepository.addToPlaylist(playlistId, batch) }
                            delay(100L)
                        }
                    }
                }

                val msg = "Successfully synced ${sortedVideoIds.size} of $total songs from Spotify Liked Songs"
                _syncState.value = SpotifySyncProgress.Completed(sortedVideoIds.size, total, msg)
                _isSyncing.value = false
                onComplete?.invoke(Result.success(sortedVideoIds.size))

            } catch (e: CancellationException) {
                Log.d(TAG, "Liked songs sync cancelled")
                _isSyncing.value = false
            } catch (e: Exception) {
                Log.w(TAG, "Liked songs sync failed: ${e.message}")
                _syncState.value = SpotifySyncProgress.Error(e.message ?: "Sync failed")
                _isSyncing.value = false
                onComplete?.invoke(Result.failure(e))
            }
        }
    }

    /**
     * Imports a batch of user playlists from Spotify in sequence.
     */
    fun importPlaylists(
        playlists: List<SpotifyUserPlaylistSummary>,
        onComplete: ((Result<Int>) -> Unit)? = null,
    ) {
        cancelSync()
        if (playlists.isEmpty()) {
            onComplete?.invoke(Result.success(0))
            return
        }

        _isSyncing.value = true
        activeJob = scope.launch {
            try {
                val token = SpotifyAuthManager.getValidAccessToken()
                if (token.isNullOrBlank()) {
                    val err = "Spotify not connected. Please connect first."
                    _syncState.value = SpotifySyncProgress.Error(err)
                    _isSyncing.value = false
                    onComplete?.invoke(Result.failure(IllegalStateException(err)))
                    return@launch
                }

                var totalImportedPlaylists = 0

                for ((pIndex, playlist) in playlists.withIndex()) {
                    if (!isActive) break

                    _syncState.value = SpotifySyncProgress.Matching(
                        current = 0,
                        total = playlist.trackCount,
                        currentTrack = "Loading playlist tracks…",
                        playlistName = playlist.name,
                        playlistIndex = pIndex + 1,
                        totalPlaylists = playlists.size,
                    )

                    val tracksRes = SpotifyApiClient.getPlaylistTracks(token, playlist.id)
                    val tracks = tracksRes.getOrNull().orEmpty()
                    if (tracks.isEmpty()) continue

                    val totalTracks = tracks.size
                    val matchedVideoIds = java.util.Collections.synchronizedList(mutableListOf<Pair<Int, String>>())
                    val processedCount = java.util.concurrent.atomic.AtomicInteger(0)
                    val semaphore = Semaphore(3)

                    coroutineScope {
                        tracks.forEachIndexed { sIndex, track ->
                            launch {
                                semaphore.withPermit {
                                    if (!isActive) return@launch
                                    val query = "${track.title} ${track.artist}".trim()
                                    val videoId = searchWithRetry(query)
                                    if (videoId != null) {
                                        matchedVideoIds.add(sIndex to videoId)
                                    }
                                    val processed = processedCount.incrementAndGet()
                                    _syncState.value = SpotifySyncProgress.Matching(
                                        current = processed,
                                        total = totalTracks,
                                        currentTrack = "${track.title} · ${track.artist}",
                                        playlistName = playlist.name,
                                        playlistIndex = pIndex + 1,
                                        totalPlaylists = playlists.size,
                                    )
                                    delay(35L)
                                }
                            }
                        }
                    }

                    if (!isActive) break

                    val sortedVideoIds = matchedVideoIds.sortedBy { it.first }.map { it.second }
                    if (sortedVideoIds.isNotEmpty()) {
                        val firstBatch = sortedVideoIds.take(50)
                        val remainingBatches = sortedVideoIds.drop(50).chunked(4)

                        val createRes = YtMusicRepository.createPlaylist(
                            title = playlist.name,
                            privacy = PlaylistPrivacy.PRIVATE,
                            videoIds = firstBatch,
                        )
                        createRes.onSuccess { newPlaylistId ->
                            totalImportedPlaylists++
                            for (batch in remainingBatches) {
                                if (!isActive) break
                                runCatching { YtMusicRepository.addToPlaylist(newPlaylistId, batch) }
                                delay(100L)
                            }
                        }
                    }
                }

                val msg = "Successfully imported $totalImportedPlaylists of ${playlists.size} playlists"
                _syncState.value = SpotifySyncProgress.Completed(totalImportedPlaylists, playlists.size, msg)
                _isSyncing.value = false
                onComplete?.invoke(Result.success(totalImportedPlaylists))

            } catch (e: CancellationException) {
                Log.d(TAG, "Playlist import cancelled")
                _isSyncing.value = false
            } catch (e: Exception) {
                Log.w(TAG, "Library import failed: ${e.message}")
                _syncState.value = SpotifySyncProgress.Error(e.message ?: "Import failed")
                _isSyncing.value = false
                onComplete?.invoke(Result.failure(e))
            }
        }
    }

    private suspend fun searchWithRetry(query: String, maxRetries: Int = 2): String? {
        repeat(maxRetries + 1) { attempt ->
            if (attempt > 0) {
                delay(400L * attempt)
            }
            val result = runCatching {
                val searchRes = YtMusicRepository.searchPage(query, SearchFilter.SONGS).getOrNull()
                searchRes?.rows?.firstNotNullOfOrNull { row ->
                    when (row) {
                        is SearchResult.TopTrack -> row.song.videoId
                        is SearchResult.Track -> row.song.videoId
                        else -> null
                    }
                }
            }.getOrNull()
            if (result != null) return result
        }
        return null
    }
}
