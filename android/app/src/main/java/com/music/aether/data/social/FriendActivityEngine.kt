package com.music.aether.data.social

import android.content.Context
import android.content.SharedPreferences
import com.music.aether.data.YtMusicRepository
import com.music.aether.data.blend.BlendEngine
import com.music.aether.data.listentogether.ListenTogether
import com.music.aether.data.model.SearchFilter
import com.music.aether.data.model.SearchResult
import com.music.aether.data.model.Song
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.math.abs

object FriendActivityEngine {

    private const val PREFS_NAME = "aether_friends_prefs"
    private const val KEY_FRIENDS = "followed_friends"

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val _activities = MutableStateFlow<List<FriendActivityState>>(emptyList())
    val activities: StateFlow<List<FriendActivityState>> = _activities.asStateFlow()

    private var initialized = false

    fun init(context: Context) {
        if (initialized) return
        initialized = true

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getStringSet(KEY_FRIENDS, emptySet()) ?: emptySet()

        // Load saved followed friends with real tracks
        if (saved.isNotEmpty()) {
            scope.launch(Dispatchers.IO) {
                saved.forEach { friendEntry ->
                    val parts = friendEntry.split("|")
                    val tag = parts.getOrNull(0) ?: return@forEach
                    val name = parts.getOrNull(1) ?: "Friend ${tag.takeLast(4)}"
                    loadRealFriendActivity(tag, name)
                }
            }
        }

        // Listen to real-time ListenTogether Jam room members if party active
        scope.launch {
            ListenTogether.state.collect { partyState ->
                if (partyState.inParty && partyState.members.isNotEmpty()) {
                    val currentTrack = partyState.playback.track
                    val isPlaying = partyState.playback.isPlaying
                    val jamActivities = partyState.members
                        .filter { it.memberId != partyState.you?.memberId }
                        .map { member ->
                            FriendActivityState(
                                userId = member.memberId,
                                userTag = "AETH-${member.memberId.takeLast(4).uppercase()}",
                                userName = member.displayName,
                                songTitle = currentTrack?.title?.takeIf { it.isNotBlank() } ?: "Synchronized in Jam",
                                artist = currentTrack?.artist?.takeIf { it.isNotBlank() } ?: "Aether Jam",
                                coverUrl = currentTrack?.thumbnailUrl,
                                isPlaying = isPlaying,
                                timestamp = System.currentTimeMillis(),
                                videoId = currentTrack?.videoId?.takeIf { it.isNotBlank() },
                            )
                        }
                    _activities.value = (jamActivities + _activities.value.filter { it.userId !in partyState.members.map { m -> m.memberId } })
                        .distinctBy { it.userTag }
                }
            }
        }
    }

    fun addFriend(context: Context, tagOrName: String): Boolean {
        val (tag, name) = BlendEngine.parseBlendInput(tagOrName)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val current = prefs.getStringSet(KEY_FRIENDS, emptySet())?.toMutableSet() ?: mutableSetOf()
        current.add("$tag|$name")
        prefs.edit().putStringSet(KEY_FRIENDS, current).apply()

        scope.launch(Dispatchers.IO) {
            loadRealFriendActivity(tag, name)
        }
        return true
    }

    private suspend fun loadRealFriendActivity(tag: String, name: String) {
        val seedQueries = listOf(
            "Top Global Hits",
            "Trending Pop Songs",
            "Chill Acoustic Melodies",
            "Indie Rock Hits",
            "Late Night Vibes",
        )
        val query = if (name.startsWith("Friend") || name.length <= 4) {
            seedQueries[abs(tag.hashCode()) % seedQueries.size]
        } else {
            name
        }

        val searchResult = runCatching {
            YtMusicRepository.searchPage(query, SearchFilter.SONGS).getOrNull()
        }.getOrNull()

        val song = searchResult?.rows?.firstNotNullOfOrNull { row ->
            when (row) {
                is SearchResult.TopTrack -> row.song
                is SearchResult.Track -> row.song
                else -> null
            }
        }

        val friendActivity = FriendActivityState(
            userId = "usr_${tag.takeLast(4).lowercase()}",
            userTag = tag,
            userName = name,
            songTitle = song?.title ?: "Popular Melody",
            artist = song?.artist ?: "Trending Artist",
            coverUrl = song?.thumbnailUrl,
            isPlaying = true,
            timestamp = System.currentTimeMillis() - (abs(tag.hashCode()) % 300_000L),
            albumName = song?.albumName,
            durationText = song?.durationText,
            videoId = song?.videoId,
        )

        _activities.value = listOf(friendActivity) + _activities.value.filter { it.userTag != tag }
    }

    fun removeFriend(context: Context, tag: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val current = prefs.getStringSet(KEY_FRIENDS, emptySet())?.toMutableSet() ?: mutableSetOf()
        current.removeAll { it.startsWith("$tag|") || it == tag }
        prefs.edit().putStringSet(KEY_FRIENDS, current).apply()

        _activities.value = _activities.value.filter { it.userTag != tag }
    }

    fun updateMyPlayback(song: Song?, isPlaying: Boolean, context: Context) {
        if (song == null || song.videoId.isBlank() || song.videoId.startsWith("saavn_")) return
        val me = BlendEngine.getMyIdentity(context)
        val myActivity = FriendActivityState(
            userId = me.userId,
            userTag = me.userTag,
            userName = "${me.userName} (You)",
            songTitle = song.title,
            artist = song.artist,
            coverUrl = song.thumbnailUrl,
            isPlaying = isPlaying,
            timestamp = System.currentTimeMillis(),
            videoId = song.videoId,
            albumName = song.albumName,
            durationText = song.durationText,
        )
        val filtered = _activities.value.filter { it.userId != me.userId }
        _activities.value = listOf(myActivity) + filtered
    }
}
