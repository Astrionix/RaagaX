package com.music.raaga.desktop

import com.music.raaga.data.model.LikeStatus
import com.music.raaga.data.model.PlaylistPrivacy
import com.music.raaga.data.model.SearchFilter
import com.music.raaga.data.model.SearchResult
import com.music.raaga.data.model.Song
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext

sealed interface DesktopSpotifySyncProgress {
    data object Idle : DesktopSpotifySyncProgress
    data class FetchingTracks(val current: Int, val total: Int) : DesktopSpotifySyncProgress
    data class Matching(
        val current: Int,
        val total: Int,
        val currentTrack: String,
        val playlistName: String? = null,
        val playlistIndex: Int = 1,
        val totalPlaylists: Int = 1,
    ) : DesktopSpotifySyncProgress
    data class Completed(
        val matchedCount: Int,
        val totalCount: Int,
        val message: String,
    ) : DesktopSpotifySyncProgress
    data class Error(val message: String) : DesktopSpotifySyncProgress
}

object DesktopSpotifySyncManager {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var activeJob: Job? = null

    private val _syncState = MutableStateFlow<DesktopSpotifySyncProgress>(DesktopSpotifySyncProgress.Idle)
    val syncState: StateFlow<DesktopSpotifySyncProgress> = _syncState.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    fun cancelSync() {
        activeJob?.cancel()
        activeJob = null
        _isSyncing.value = false
        _syncState.value = DesktopSpotifySyncProgress.Idle
    }

    /**
     * Syncs Spotify "Liked Songs" directly into Raaga:
     * 1. Fetches all saved tracks from Spotify API.
     * 2. Resolves each track to a YouTube Music video ID.
     * 3. Marks them as Liked in DesktopPersistence and rates via YouTube.
     * 4. Populates a dedicated "Spotify Liked Songs" playlist in the user's library.
     */
    fun syncLikedSongs(
        createDedicatedPlaylist: Boolean = true,
        onLikedIdsChanged: ((Set<String>) -> Unit)? = null,
        onPlaylistsChanged: ((List<DesktopPlaylist>) -> Unit)? = null,
        onComplete: ((Result<Int>) -> Unit)? = null,
    ) {
        cancelSync()
        _isSyncing.value = true

        activeJob = scope.launch {
            try {
                val token = DesktopSpotifyAuthManager.getValidAccessToken()
                if (token.isNullOrBlank()) {
                    val err = "Spotify not connected or token expired. Please connect Spotify first."
                    _syncState.value = DesktopSpotifySyncProgress.Error(err)
                    _isSyncing.value = false
                    onComplete?.invoke(Result.failure(IllegalStateException(err)))
                    return@launch
                }

                _syncState.value = DesktopSpotifySyncProgress.FetchingTracks(0, 0)
                val tracksResult = DesktopSpotifyApiClient.getLikedSongs(token) { loaded, total ->
                    _syncState.value = DesktopSpotifySyncProgress.FetchingTracks(loaded, total)
                }

                val tracks = tracksResult.getOrElse { err ->
                    val msg = err.message ?: "Failed to fetch liked tracks from Spotify"
                    _syncState.value = DesktopSpotifySyncProgress.Error(msg)
                    _isSyncing.value = false
                    onComplete?.invoke(Result.failure(Exception(msg)))
                    return@launch
                }

                if (tracks.isEmpty()) {
                    _syncState.value = DesktopSpotifySyncProgress.Completed(0, 0, "No liked songs found on Spotify account.")
                    _isSyncing.value = false
                    onComplete?.invoke(Result.success(0))
                    return@launch
                }

                val totalTracks = tracks.size
                var matchedCount = 0
                val matchedSongs = mutableListOf<Song>()
                val matchedVideoIds = mutableListOf<String>()

                val persistence = DesktopPersistence()
                var currentLiked = persistence.likedIds()

                val semaphore = Semaphore(3)

                for ((idx, track) in tracks.withIndex()) {
                    if (!isActive) break

                    _syncState.value = DesktopSpotifySyncProgress.Matching(
                        current = idx + 1,
                        total = totalTracks,
                        currentTrack = "${track.title} - ${track.artist}",
                        playlistName = "Liked Songs",
                        playlistIndex = 1,
                        totalPlaylists = 1,
                    )

                    val matchedSong = semaphore.withPermit {
                        resolveTrack(track)
                    }

                    if (matchedSong != null) {
                        matchedCount++
                        matchedSongs.add(matchedSong)
                        matchedVideoIds.add(matchedSong.videoId)

                        // Apply like locally
                        if (matchedSong.videoId !in currentLiked) {
                            currentLiked = currentLiked + matchedSong.videoId
                            persistence.saveLikedIds(currentLiked)
                            onLikedIdsChanged?.invoke(currentLiked)

                            // Apply like on YouTube Music backend asynchronously
                            scope.launch {
                                DesktopSearchClient.rate(matchedSong.videoId, LikeStatus.LIKE)
                            }
                        }
                    }

                    delay(80)
                }

                // If dedicated playlist requested, create/update "Spotify Liked Songs"
                if (createDedicatedPlaylist && matchedSongs.isNotEmpty()) {
                    val playlistTitle = "Spotify Liked Songs"
                    val existingPlaylists = persistence.playlists().toMutableList()
                    val existingIdx = existingPlaylists.indexOfFirst { it.title.equals(playlistTitle, ignoreCase = true) }

                    if (existingIdx >= 0) {
                        val currentList = existingPlaylists[existingIdx]
                        val existingIds = currentList.songs.map { it.videoId }.toSet()
                        val newToAdd = matchedSongs.filter { it.videoId !in existingIds }
                        val updatedSongs = currentList.songs + newToAdd
                        existingPlaylists[existingIdx] = currentList.copy(songs = updatedSongs)
                    } else {
                        existingPlaylists.add(
                            0,
                            DesktopPlaylist(
                                title = playlistTitle,
                                songs = matchedSongs,
                            )
                        )
                    }

                    persistence.savePlaylists(existingPlaylists)
                    onPlaylistsChanged?.invoke(existingPlaylists)

                    // Also create on YouTube Music account if signed in
                    if (DesktopYouTubeAuth.isSignedIn) {
                        scope.launch {
                            DesktopSearchClient.createPlaylist(
                                title = playlistTitle,
                                privacy = PlaylistPrivacy.PRIVATE,
                                videoIds = matchedVideoIds,
                            )
                        }
                    }
                }

                val resultMessage = "Synced $matchedCount of $totalTracks Spotify Liked Songs directly into Raaga!"
                _syncState.value = DesktopSpotifySyncProgress.Completed(
                    matchedCount = matchedCount,
                    totalCount = totalTracks,
                    message = resultMessage,
                )
                _isSyncing.value = false
                onComplete?.invoke(Result.success(matchedCount))

            } catch (e: CancellationException) {
                _syncState.value = DesktopSpotifySyncProgress.Idle
                _isSyncing.value = false
            } catch (e: Exception) {
                DesktopTrackLog.log("DesktopSpotifySyncManager: syncLikedSongs error: ${e.message}")
                _syncState.value = DesktopSpotifySyncProgress.Error(e.message ?: "An unexpected error occurred during sync")
                _isSyncing.value = false
                onComplete?.invoke(Result.failure(e))
            }
        }
    }

    /**
     * Batch imports multiple Spotify playlists into Raaga.
     */
    fun importPlaylists(
        playlists: List<DesktopSpotifyUserPlaylistSummary>,
        onPlaylistsChanged: ((List<DesktopPlaylist>) -> Unit)? = null,
        onComplete: ((Result<Int>) -> Unit)? = null,
    ) {
        cancelSync()
        _isSyncing.value = true

        activeJob = scope.launch {
            try {
                val token = DesktopSpotifyAuthManager.getValidAccessToken()
                if (token.isNullOrBlank()) {
                    val err = "Spotify not connected or token expired. Please connect Spotify first."
                    _syncState.value = DesktopSpotifySyncProgress.Error(err)
                    _isSyncing.value = false
                    onComplete?.invoke(Result.failure(IllegalStateException(err)))
                    return@launch
                }

                val totalPlaylists = playlists.size
                var totalImportedPlaylists = 0
                var totalMatchedSongs = 0
                val semaphore = Semaphore(3)
                val persistence = DesktopPersistence()
                var currentPlaylists = persistence.playlists()

                for ((pIndex, playlist) in playlists.withIndex()) {
                    if (!isActive) break

                    _syncState.value = DesktopSpotifySyncProgress.FetchingTracks(pIndex + 1, totalPlaylists)

                    val tracksRes = DesktopSpotifyApiClient.getPlaylistTracks(token, playlist.id)
                    val tracks = tracksRes.getOrDefault(emptyList())

                    val playlistSongs = mutableListOf<Song>()
                    val playlistVideoIds = mutableListOf<String>()

                    for ((tIndex, track) in tracks.withIndex()) {
                        if (!isActive) break

                        _syncState.value = DesktopSpotifySyncProgress.Matching(
                            current = tIndex + 1,
                            total = tracks.size,
                            currentTrack = "${track.title} - ${track.artist}",
                            playlistName = playlist.name,
                            playlistIndex = pIndex + 1,
                            totalPlaylists = totalPlaylists,
                        )

                        val song = semaphore.withPermit {
                            resolveTrack(track)
                        }

                        if (song != null) {
                            playlistSongs.add(song)
                            playlistVideoIds.add(song.videoId)
                            totalMatchedSongs++
                        }

                        delay(60)
                    }

                    if (playlistSongs.isNotEmpty()) {
                        totalImportedPlaylists++

                        // Save local playlist
                        val newPlaylist = DesktopPlaylist(
                            title = playlist.name,
                            songs = playlistSongs,
                        )
                        currentPlaylists = listOf(newPlaylist) + currentPlaylists.filterNot { it.title.equals(playlist.name, ignoreCase = true) }
                        persistence.savePlaylists(currentPlaylists)
                        onPlaylistsChanged?.invoke(currentPlaylists)

                        // If user is signed in to YouTube, also create on YouTube
                        if (DesktopYouTubeAuth.isSignedIn) {
                            scope.launch {
                                DesktopSearchClient.createPlaylist(
                                    title = playlist.name,
                                    privacy = PlaylistPrivacy.PUBLIC,
                                    videoIds = playlistVideoIds,
                                )
                            }
                        }
                    }
                }

                val msg = "Imported $totalImportedPlaylists playlists ($totalMatchedSongs tracks) into Raaga Library!"
                _syncState.value = DesktopSpotifySyncProgress.Completed(
                    matchedCount = totalMatchedSongs,
                    totalCount = totalMatchedSongs,
                    message = msg,
                )
                _isSyncing.value = false
                onComplete?.invoke(Result.success(totalImportedPlaylists))

            } catch (e: CancellationException) {
                _syncState.value = DesktopSpotifySyncProgress.Idle
                _isSyncing.value = false
            } catch (e: Exception) {
                DesktopTrackLog.log("DesktopSpotifySyncManager: importPlaylists error: ${e.message}")
                _syncState.value = DesktopSpotifySyncProgress.Error(e.message ?: "Failed to import playlists")
                _isSyncing.value = false
                onComplete?.invoke(Result.failure(e))
            }
        }
    }

    /**
     * Resolves a Spotify track to a YouTube Music Song object.
     */
    suspend fun resolveTrack(track: DesktopSpotifyTrack): Song? = withContext(Dispatchers.IO) {
        val query1 = "${track.title} ${track.artist}".trim()
        val res1 = searchWithRetry(query1)
        if (res1 != null) return@withContext res1

        // Strip suffixes like (feat. ...), (with ...), etc.
        val cleanTitle = track.title
            .replace(Regex("""\s*\([fF]eat\..*?\)"""), "")
            .replace(Regex("""\s*\(with.*?\)"""), "")
            .replace(Regex("""\s*\[.*?\]"""), "")
            .trim()

        if (cleanTitle != track.title) {
            val query2 = "$cleanTitle ${track.artist}".trim()
            val res2 = searchWithRetry(query2)
            if (res2 != null) return@withContext res2
        }

        // Just title
        val res3 = searchWithRetry(track.title)
        return@withContext res3
    }

    private suspend fun searchWithRetry(query: String, retries: Int = 2): Song? {
        repeat(retries) { attempt ->
            try {
                val results = DesktopSearchClient.search(query, SearchFilter.SONGS).getOrNull()
                val topSong = results?.firstOrNull()?.toSong()
                if (topSong != null) return topSong
            } catch (e: Exception) {
                if (attempt == retries - 1) return null
                delay(200L * (attempt + 1))
            }
        }
        return null
    }

    private fun SearchResult.toSong(): Song? = when (this) {
        is SearchResult.TopTrack -> song
        is SearchResult.Track -> song
        is SearchResult.Browse -> null
    }
}
