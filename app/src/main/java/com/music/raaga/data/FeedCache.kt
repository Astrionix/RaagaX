package com.music.raaga.data

import android.content.Context
import com.music.raaga.data.model.HomeShelf
import com.music.raaga.data.model.MoodGenre
import com.music.raaga.data.model.MoodGenreSection
import com.music.raaga.data.model.ShelfItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Fast disk cache for Home and Explore feeds providing instant Stale-While-Revalidate (SWR) rendering.
 *
 * Persists parsed shelf structures so app opening displays the previous session's
 * shelves with 0ms delay while quiet background requests fetch fresh content.
 */
object FeedCache {
    private var cacheDir: File? = null

    fun init(context: Context) {
        cacheDir = context.filesDir
    }

    suspend fun getCachedHome(): List<HomeShelf>? = withContext(Dispatchers.IO) {
        val dir = cacheDir ?: return@withContext null
        val file = File(dir, "home_feed_cache.json")
        if (!file.exists() || file.length() == 0L) return@withContext null
        runCatching {
            val text = file.readText()
            val array = JSONArray(text)
            val shelves = ArrayList<HomeShelf>(array.length())
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val title = obj.getString("title")
                val subtitle = obj.optString("subtitle", "")
                val moreBrowseId = if (obj.has("moreBrowseId")) obj.getString("moreBrowseId") else null
                val moreParams = if (obj.has("moreParams")) obj.getString("moreParams") else null
                val itemsArray = obj.getJSONArray("items")
                val items = ArrayList<ShelfItem>(itemsArray.length())
                for (j in 0 until itemsArray.length()) {
                    val itemObj = itemsArray.getJSONObject(j)
                    items.add(
                        ShelfItem(
                            title = itemObj.getString("title"),
                            subtitle = itemObj.optString("subtitle", ""),
                            thumbnailUrl = if (itemObj.has("thumbnailUrl")) itemObj.getString("thumbnailUrl") else null,
                            videoId = if (itemObj.has("videoId")) itemObj.getString("videoId") else null,
                            browseId = if (itemObj.has("browseId")) itemObj.getString("browseId") else null,
                            isVideo = itemObj.optBoolean("isVideo", false),
                        )
                    )
                }
                shelves.add(
                    HomeShelf(
                        title = title,
                        items = items,
                        subtitle = subtitle,
                        moreBrowseId = moreBrowseId,
                        moreParams = moreParams,
                    )
                )
            }
            shelves
        }.getOrNull()
    }

    suspend fun saveCachedHome(shelves: List<HomeShelf>) = withContext(Dispatchers.IO) {
        val dir = cacheDir ?: return@withContext
        val file = File(dir, "home_feed_cache.json")
        runCatching {
            val array = JSONArray()
            // Keep up to 10 shelves to keep file compact and load within a few ms
            shelves.take(10).forEach { shelf ->
                val obj = JSONObject()
                obj.put("title", shelf.title)
                obj.put("subtitle", shelf.subtitle)
                shelf.moreBrowseId?.let { obj.put("moreBrowseId", it) }
                shelf.moreParams?.let { obj.put("moreParams", it) }
                val itemsArray = JSONArray()
                shelf.items.forEach { item ->
                    val itemObj = JSONObject()
                    itemObj.put("title", item.title)
                    itemObj.put("subtitle", item.subtitle)
                    item.thumbnailUrl?.let { itemObj.put("thumbnailUrl", it) }
                    item.videoId?.let { itemObj.put("videoId", it) }
                    item.browseId?.let { itemObj.put("browseId", it) }
                    itemObj.put("isVideo", item.isVideo)
                    itemsArray.put(itemObj)
                }
                obj.put("items", itemsArray)
                array.put(obj)
            }
            file.writeText(array.toString())
        }
    }

    suspend fun getCachedExplore(): List<MoodGenreSection>? = withContext(Dispatchers.IO) {
        val dir = cacheDir ?: return@withContext null
        val file = File(dir, "explore_feed_cache.json")
        if (!file.exists() || file.length() == 0L) return@withContext null
        runCatching {
            val text = file.readText()
            val array = JSONArray(text)
            val sections = ArrayList<MoodGenreSection>(array.length())
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val title = obj.getString("title")
                val itemsArray = obj.getJSONArray("items")
                val items = ArrayList<MoodGenre>(itemsArray.length())
                for (j in 0 until itemsArray.length()) {
                    val itemObj = itemsArray.getJSONObject(j)
                    items.add(
                        MoodGenre(
                            title = itemObj.getString("title"),
                            browseId = itemObj.getString("browseId"),
                            params = if (itemObj.has("params")) itemObj.getString("params") else null,
                            thumbnailUrl = if (itemObj.has("thumbnailUrl")) itemObj.getString("thumbnailUrl") else null,
                            stripeColor = if (itemObj.has("stripeColor")) itemObj.getLong("stripeColor") else null,
                        )
                    )
                }
                sections.add(MoodGenreSection(title = title, items = items))
            }
            sections
        }.getOrNull()
    }

    suspend fun saveCachedExplore(sections: List<MoodGenreSection>) = withContext(Dispatchers.IO) {
        val dir = cacheDir ?: return@withContext
        val file = File(dir, "explore_feed_cache.json")
        runCatching {
            val array = JSONArray()
            sections.forEach { section ->
                val obj = JSONObject()
                obj.put("title", section.title)
                val itemsArray = JSONArray()
                section.items.forEach { item ->
                    val itemObj = JSONObject()
                    itemObj.put("title", item.title)
                    itemObj.put("browseId", item.browseId)
                    item.params?.let { itemObj.put("params", it) }
                    item.thumbnailUrl?.let { itemObj.put("thumbnailUrl", it) }
                    item.stripeColor?.let { itemObj.put("stripeColor", it) }
                    itemsArray.put(itemObj)
                }
                obj.put("items", itemsArray)
                array.put(obj)
            }
            file.writeText(array.toString())
        }
    }
}

