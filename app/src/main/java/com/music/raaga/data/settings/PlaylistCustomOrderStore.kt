package com.music.raaga.data.settings

import android.content.Context
import android.content.SharedPreferences
import com.music.raaga.data.model.Song
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject

/**
 * Persists user-defined manual / custom ordering for playlist tracks.
 * Keyed by playlist browseId (e.g. "VLPL...", "local:playlist:...").
 *
 * Guarantees:
 * 1. Custom sequence is persisted locally and immediately available across launches.
 * 2. Adding a song to a playlist appends it to the end of the custom order,
 *    never inserting it in arbitrary positions or at the top.
 * 3. Sorting by title or artist does not overwrite or lose the custom order.
 * 4. Tracks no longer in the playlist are pruned, and incoming new tracks
 *    are placed cleanly at the end in their arrival order.
 */
object PlaylistCustomOrderStore {
    private const val PREF_NAME = "raaga_playlist_custom_order"
    private const val KEY_ORDERS = "playlist_orders_json"

    private lateinit var prefs: SharedPreferences

    // Map of browseId -> List of track keys (setVideoId ?: videoId)
    private val _customOrders = MutableStateFlow<Map<String, List<String>>>(emptyMap())
    val customOrders: StateFlow<Map<String, List<String>>> = _customOrders.asStateFlow()

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        load()
    }

    private fun load() {
        if (!this::prefs.isInitialized) return
        val raw = prefs.getString(KEY_ORDERS, null) ?: return
        runCatching {
            val json = JSONObject(raw)
            val map = mutableMapOf<String, List<String>>()
            for (key in json.keys()) {
                val array = json.getJSONArray(key)
                val list = mutableListOf<String>()
                for (i in 0 until array.length()) {
                    list.add(array.getString(i))
                }
                map[key] = list
            }
            _customOrders.value = map
        }
    }

    /**
     * Unique stable key for a song within a playlist.
     * Uses setVideoId if available (for playlists with duplicate tracks), falling back to videoId.
     */
    fun songKey(song: Song): String = song.setVideoId ?: song.videoId

    fun getCustomOrder(browseId: String): List<String>? = _customOrders.value[browseId]

    fun hasCustomOrder(browseId: String): Boolean = _customOrders.value.containsKey(browseId)

    fun saveCustomOrder(browseId: String, songs: List<Song>) {
        val keys = songs.map { songKey(it) }
        saveCustomOrderKeys(browseId, keys)
    }

    fun saveCustomOrderKeys(browseId: String, keys: List<String>) {
        val updated = _customOrders.value + (browseId to keys)
        _customOrders.value = updated
        persist(updated)
    }

    fun appendSong(browseId: String, song: Song) {
        appendSongs(browseId, listOf(song))
    }

    fun appendSongs(browseId: String, songs: List<Song>) {
        val existing = _customOrders.value[browseId]
        val newKeys = songs.map { songKey(it) }
        val updatedKeys = if (existing != null) {
            existing.filterNot { it in newKeys } + newKeys
        } else {
            newKeys
        }
        saveCustomOrderKeys(browseId, updatedKeys)
    }

    fun removeSongs(browseId: String, songsToRemove: List<Song>) {
        val existing = _customOrders.value[browseId] ?: return
        val toRemove = songsToRemove.map { songKey(it) }.toSet()
        val toRemoveVideoIds = songsToRemove.map { it.videoId }.toSet()
        val updatedKeys = existing.filterNot { it in toRemove || it in toRemoveVideoIds }
        saveCustomOrderKeys(browseId, updatedKeys)
    }

    fun clearCustomOrder(browseId: String) {
        val updated = _customOrders.value - browseId
        _customOrders.value = updated
        persist(updated)
    }

    fun clearAll() {
        _customOrders.value = emptyMap()
        if (this::prefs.isInitialized) {
            prefs.edit().remove(KEY_ORDERS).apply()
        }
    }

    /**
     * Applies the custom order to [songs].
     * If a custom order is recorded for [browseId], sorts the songs to match.
     * Any songs not present in the custom order (e.g. freshly added from another client)
     * are placed at the end in their original relative order.
     */
    fun applyCustomOrder(browseId: String, songs: List<Song>): List<Song> {
        val orderKeys = _customOrders.value[browseId] ?: return songs
        if (orderKeys.isEmpty() || songs.isEmpty()) return songs

        val keyToIndex = orderKeys.withIndex().associate { (idx, key) -> key to idx }
        val fallbackIndex = orderKeys.size

        return songs.withIndex()
            .sortedWith(
                compareBy<IndexedValue<Song>> { (_, song) ->
                    val primaryKey = songKey(song)
                    keyToIndex[primaryKey]
                        ?: keyToIndex[song.videoId]
                        ?: (fallbackIndex + 1)
                }.thenBy { (originalIndex, _) ->
                    originalIndex
                },
            )
            .map { it.value }
    }

    private fun persist(map: Map<String, List<String>>) {
        if (!this::prefs.isInitialized) return
        runCatching {
            val json = JSONObject()
            for ((key, list) in map) {
                val array = JSONArray()
                list.forEach { array.put(it) }
                json.put(key, array)
            }
            prefs.edit().putString(KEY_ORDERS, json.toString()).apply()
        }
    }
}
