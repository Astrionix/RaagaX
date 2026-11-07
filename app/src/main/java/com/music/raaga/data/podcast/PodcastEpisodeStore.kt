package com.music.raaga.data.podcast

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Persistent storage for podcast episode resume positions and completed status.
 */
object PodcastEpisodeStore {

    private const val PREFS_NAME = "raaga_podcast_episodes"
    private const val KEY_PREFIX_POS = "pos_"
    private const val KEY_PREFIX_COMPLETED = "comp_"

    private lateinit var prefs: SharedPreferences
    private val _positions = MutableStateFlow<Map<String, Long>>(emptyMap())
    val positions: StateFlow<Map<String, Long>> = _positions.asStateFlow()

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        loadAll()
    }

    private fun loadAll() {
        val map = mutableMapOf<String, Long>()
        for ((key, value) in prefs.all) {
            if (key.startsWith(KEY_PREFIX_POS) && value is Long) {
                map[key.removePrefix(KEY_PREFIX_POS)] = value
            }
        }
        _positions.value = map
    }

    /**
     * Records current playback position for [episodeId].
     * Marks as completed if within 15 seconds of the end or if [completed] is true.
     */
    fun savePosition(episodeId: String, positionMs: Long, totalDurationMs: Long = 0L) {
        if (!::prefs.isInitialized || episodeId.isBlank()) return
        val current = _positions.value[episodeId]
        if (current != null && kotlin.math.abs(current - positionMs) < 2_000L) return
        val isCompleted = (totalDurationMs > 0 && (totalDurationMs - positionMs) <= 15_000L)
        prefs.edit()
            .putLong(KEY_PREFIX_POS + episodeId, positionMs)
            .putBoolean(KEY_PREFIX_COMPLETED + episodeId, isCompleted)
            .apply()

        val updated = _positions.value.toMutableMap()
        updated[episodeId] = positionMs
        _positions.value = updated
    }

    /** Returns saved position for [episodeId], or 0L if none. */
    fun getPosition(episodeId: String): Long {
        if (!::prefs.isInitialized || episodeId.isBlank()) return 0L
        return prefs.getLong(KEY_PREFIX_POS + episodeId, 0L)
    }

    /** Returns whether [episodeId] has been listened to completion. */
    fun isCompleted(episodeId: String): Boolean {
        if (!::prefs.isInitialized || episodeId.isBlank()) return false
        return prefs.getBoolean(KEY_PREFIX_COMPLETED + episodeId, false)
    }

    /** Clears position for an episode (e.g. mark as unplayed). */
    fun clearEpisode(episodeId: String) {
        if (!::prefs.isInitialized || episodeId.isBlank()) return
        prefs.edit()
            .remove(KEY_PREFIX_POS + episodeId)
            .remove(KEY_PREFIX_COMPLETED + episodeId)
            .apply()
        val updated = _positions.value.toMutableMap()
        updated.remove(episodeId)
        _positions.value = updated
    }
}

