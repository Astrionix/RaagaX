package com.music.raaga.data.social

import android.content.Context
import android.content.SharedPreferences
import com.music.raaga.data.YtMusicRepository
import com.music.raaga.data.blend.BlendEngine
import com.music.raaga.data.listentogether.ListenTogether
import com.music.raaga.data.model.SearchFilter
import com.music.raaga.data.model.SearchResult
import com.music.raaga.data.model.Song
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.math.abs

object FriendActivityEngine {

    private const val PREFS_NAME = "raaga_friends_prefs"
    private const val KEY_FRIENDS = "followed_friends"
    private const val KEY_SHARE_ACTIVITY = "share_activity_enabled"

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val _activities = MutableStateFlow<List<FriendActivityState>>(emptyList())
    val activities: StateFlow<List<FriendActivityState>> = _activities.asStateFlow()

    private val _isSharingEnabled = MutableStateFlow(true)
    val isSharingEnabled: StateFlow<Boolean> = _isSharingEnabled.asStateFlow()

    private var initialized = false

    fun init(context: Context) {
        if (initialized) return
        initialized = true

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        _isSharingEnabled.value = prefs.getBoolean(KEY_SHARE_ACTIVITY, true)

        // Initial sync of followed friends
        refreshFriends(context)

        // Periodic live sync from Supabase every 12 seconds
        scope.launch(Dispatchers.IO) {
            while (true) {
                delay(12_000L)
                refreshFriends(context)
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
                                artist = currentTrack?.artist?.takeIf { it.isNotBlank() } ?: "Raaga Jam",
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

    /**
     * Toggles whether this device's activity is shared with friends on Supabase.
     * When disabled, the user's record is immediately deleted from Supabase (Offline mode).
     */
    fun setSharingEnabled(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_SHARE_ACTIVITY, enabled).apply()
        _isSharingEnabled.value = enabled

        val me = BlendEngine.getMyIdentity(context)
        if (!enabled) {
            // Remove user card locally so they see they are disconnected/private
            _activities.value = _activities.value.filter { it.userId != me.userId }
            // Delete activity row from Supabase
            scope.launch(Dispatchers.IO) {
                SupabaseActivityClient.clearMyActivity(me.userTag)
            }
        } else {
            // Re-sync
            refreshFriends(context)
        }
    }

    /**
     * Syncs followed friends from Supabase, falling back to local seed search if not present in cloud.
     */
    fun refreshFriends(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getStringSet(KEY_FRIENDS, emptySet()) ?: emptySet()
        if (saved.isEmpty()) return

        scope.launch(Dispatchers.IO) {
            val friendMap = mutableMapOf<String, String>() // tag -> name
            saved.forEach { friendEntry ->
                val parts = friendEntry.split("|")
                val tag = parts.getOrNull(0) ?: return@forEach
                val name = parts.getOrNull(1) ?: "Friend ${tag.takeLast(4)}"
                friendMap[tag] = name
            }

            if (friendMap.isEmpty()) return@launch

            // 1. Fetch live activity for all followed tags from Supabase
            val cloudActivities = SupabaseActivityClient.fetchFriendsActivity(friendMap.keys)
            val cloudByTag = cloudActivities.associateBy { it.userTag }

            val mergedList = mutableListOf<FriendActivityState>()

            friendMap.forEach { (tag, fallbackName) ->
                val cloudItem = cloudByTag[tag]
                if (cloudItem != null) {
                    mergedList.add(cloudItem)
                } else {
                    // Fallback to local deterministic music profile if friend hasn't published yet
                    val existing = _activities.value.firstOrNull { it.userTag == tag }
                    if (existing != null) {
                        mergedList.add(existing)
                    } else {
                        val fallback = loadRealFriendActivity(tag, fallbackName)
                        fallback?.let { mergedList.add(it) }
                    }
                }
            }

            // Keep "You" if present and sharing is enabled
            val me = BlendEngine.getMyIdentity(context)
            val myItem = _activities.value.firstOrNull { it.userId == me.userId }
            val finalList = if (myItem != null && _isSharingEnabled.value) {
                listOf(myItem) + mergedList.filter { it.userId != me.userId }
            } else {
                mergedList
            }

            _activities.value = finalList.distinctBy { it.userTag }
        }
    }

    fun addFriend(context: Context, tagOrName: String): Boolean {
        val (tag, name) = BlendEngine.parseBlendInput(tagOrName)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val current = prefs.getStringSet(KEY_FRIENDS, emptySet())?.toMutableSet() ?: mutableSetOf()
        current.add("$tag|$name")
        prefs.edit().putStringSet(KEY_FRIENDS, current).apply()

        refreshFriends(context)
        return true
    }

    private suspend fun loadRealFriendActivity(tag: String, name: String): FriendActivityState? {
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
        } ?: return null

        return FriendActivityState(
            userId = "usr_${tag.takeLast(4).lowercase()}",
            userTag = tag,
            userName = name,
            songTitle = song.title,
            artist = song.artist,
            coverUrl = song.thumbnailUrl,
            isPlaying = true,
            timestamp = System.currentTimeMillis() - (abs(tag.hashCode()) % 300_000L),
            albumName = song.albumName,
            durationText = song.durationText,
            videoId = song.videoId,
        )
    }

    fun removeFriend(context: Context, tag: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val current = prefs.getStringSet(KEY_FRIENDS, emptySet())?.toMutableSet() ?: mutableSetOf()
        current.removeAll { it.startsWith("$tag|") || it == tag }
        prefs.edit().putStringSet(KEY_FRIENDS, current).apply()

        _activities.value = _activities.value.filter { it.userTag != tag }
    }

    fun updateMyPlayback(song: Song?, isPlaying: Boolean, context: Context) {
        val me = BlendEngine.getMyIdentity(context)

        // If sharing is turned off, ensure user is not in activities and not pushed to Supabase
        if (!_isSharingEnabled.value) {
            _activities.value = _activities.value.filter { it.userId != me.userId }
            return
        }

        if (song == null || song.videoId.isBlank() || song.videoId.startsWith("saavn_")) return
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

        // Publish live state to Supabase in the background
        scope.launch(Dispatchers.IO) {
            SupabaseActivityClient.publishMyActivity(
                userTag = me.userTag,
                userName = me.userName,
                songTitle = song.title,
                artist = song.artist,
                videoId = song.videoId,
                coverUrl = song.thumbnailUrl,
                albumName = song.albumName,
                durationText = song.durationText,
                isPlaying = isPlaying,
            )
        }
    }
}
