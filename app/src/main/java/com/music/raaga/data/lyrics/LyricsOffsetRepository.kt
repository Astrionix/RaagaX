package com.music.raaga.data.lyrics

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Persists per-track lyric timing calibration offsets (-5000ms to +5000ms in 100ms steps).
 */
object LyricsOffsetRepository {

    private const val PREFS_NAME = "raaga_lyrics_offsets"
    private lateinit var prefs: SharedPreferences

    private val _offsets = MutableStateFlow<Map<String, Int>>(emptyMap())
    val offsets: StateFlow<Map<String, Int>> = _offsets.asStateFlow()

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val loaded = mutableMapOf<String, Int>()
        prefs.all.forEach { (k, v) ->
            if (v is Int) loaded[k] = v
            else if (v is Number) loaded[k] = v.toInt()
        }
        _offsets.value = loaded
    }

    fun getOffset(trackId: String?): Int {
        if (trackId.isNullOrBlank()) return 0
        return _offsets.value[trackId] ?: 0
    }

    fun setOffset(trackId: String?, offsetMs: Int) {
        if (trackId.isNullOrBlank()) return
        val clamped = offsetMs.coerceIn(-5000, 5000)
        val rounded = (clamped / 100) * 100

        val current = _offsets.value.toMutableMap()
        if (rounded == 0) {
            current.remove(trackId)
            if (::prefs.isInitialized) prefs.edit().remove(trackId).apply()
        } else {
            current[trackId] = rounded
            if (::prefs.isInitialized) prefs.edit().putInt(trackId, rounded).apply()
        }
        _offsets.value = current
    }

    fun adjustOffset(trackId: String?, deltaMs: Int) {
        val current = getOffset(trackId)
        setOffset(trackId, current + deltaMs)
    }
}

