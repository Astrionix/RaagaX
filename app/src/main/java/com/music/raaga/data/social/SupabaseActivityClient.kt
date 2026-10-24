package com.music.raaga.data.social

import android.util.Log
import com.music.raaga.BuildConfig
import com.music.raaga.data.Http
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import java.time.format.DateTimeFormatter

/**
 * Client for publishing and syncing real-time user playback activity with Supabase.
 */
object SupabaseActivityClient {

    private const val TAG = "SupabaseActivity"
    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    private val json = Json { ignoreUnknownKeys = true }

    private val supabaseUrl: String
        get() = runCatching {
            BuildConfig::class.java.getField("SUPABASE_URL").get(null) as String
        }.getOrDefault("https://qbqnlmfdmfayeztagvkj.supabase.co").trimEnd('/')

    private val anonKey: String
        get() = runCatching {
            BuildConfig::class.java.getField("SUPABASE_ANON_KEY").get(null) as String
        }.getOrDefault("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFicW5sbWZkbWZheWV6dGFndmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMDAzNDksImV4cCI6MjEwMTc3NjM0OX0.Xjj4PQmu1LLYu7Yk0XiijVEDqzd4PqSsZzACaKkWLXk")

    /**
     * Publishes the user's current playback state to Supabase `user_activity` table.
     */
    suspend fun publishMyActivity(
        userTag: String,
        userName: String,
        songTitle: String,
        artist: String,
        videoId: String?,
        coverUrl: String?,
        albumName: String? = null,
        durationText: String? = null,
        isPlaying: Boolean = true,
        joinedAt: String? = null,
    ): Boolean = withContext(Dispatchers.IO) {
        if (supabaseUrl.isBlank() || anonKey.isBlank() || userTag.isBlank()) {
            return@withContext false
        }

        runCatching {
            fun createPayload(withJoinedAt: Boolean) = buildJsonObject {
                put("user_tag", userTag)
                put("user_name", userName)
                put("song_title", songTitle)
                put("artist", artist)
                put("video_id", videoId ?: "")
                put("cover_url", coverUrl ?: "")
                put("album_name", albumName ?: "")
                put("duration_text", durationText ?: "")
                put("is_playing", isPlaying)
                put("updated_at", DateTimeFormatter.ISO_INSTANT.format(Instant.now()))
                if (withJoinedAt && !joinedAt.isNullOrBlank()) {
                    put("joined_at", joinedAt)
                }
            }.toString()

            val url = "$supabaseUrl/rest/v1/user_activity"
            fun buildReq(jsonPayload: String) = Request.Builder()
                .url(url)
                .post(jsonPayload.toRequestBody(JSON_MEDIA_TYPE))
                .header("apikey", anonKey)
                .header("Authorization", "Bearer $anonKey")
                .header("Content-Type", "application/json")
                .header("Prefer", "resolution=merge-duplicates")
                .build()

            val primaryPayload = createPayload(withJoinedAt = !joinedAt.isNullOrBlank())
            var ok = false
            Http.client.newCall(buildReq(primaryPayload)).execute().use { response ->
                if (response.isSuccessful) {
                    ok = true
                } else if (!joinedAt.isNullOrBlank()) {
                    val body = response.body?.string().orEmpty()
                    // Fallback gracefully if Supabase table does not yet have joined_at column
                    if (body.contains("joined_at") || body.contains("PGRST204")) {
                        Http.client.newCall(buildReq(createPayload(withJoinedAt = false))).execute().use { fallbackResp ->
                            ok = fallbackResp.isSuccessful
                        }
                    } else {
                        Log.w(TAG, "Failed to publish activity to Supabase: HTTP ${response.code}")
                    }
                } else {
                    Log.w(TAG, "Failed to publish activity to Supabase: HTTP ${response.code}")
                }
            }
            ok
        }.getOrElse { e ->
            Log.w(TAG, "Error publishing activity to Supabase", e)
            false
        }
    }

    /**
     * Fetches the latest playback activity for a set of friend userTags from Supabase.
     */
    suspend fun fetchFriendsActivity(tags: Set<String>): List<FriendActivityState> = withContext(Dispatchers.IO) {
        if (supabaseUrl.isBlank() || anonKey.isBlank() || tags.isEmpty()) {
            return@withContext emptyList()
        }

        runCatching {
            val formattedTags = tags.joinToString(",") { tag ->
                // Clean tag e.g. AETH-7W4Q
                tag.trim()
            }
            val url = "$supabaseUrl/rest/v1/user_activity?user_tag=in.($formattedTags)&order=updated_at.desc"

            val request = Request.Builder()
                .url(url)
                .get()
                .header("apikey", anonKey)
                .header("Authorization", "Bearer $anonKey")
                .header("Accept", "application/json")
                .build()

            Http.client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    Log.w(TAG, "Failed to fetch friends from Supabase: HTTP ${response.code}")
                    return@withContext emptyList()
                }

                val body = response.body.string()
                val array = json.parseToJsonElement(body).jsonArray

                array.mapNotNull { element ->
                    val obj = element.jsonObject
                    val userTag = obj["user_tag"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                    val userName = obj["user_name"]?.jsonPrimitive?.contentOrNull ?: "Friend"
                    val songTitle = obj["song_title"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                    val artist = obj["artist"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                    val videoId = obj["video_id"]?.jsonPrimitive?.contentOrNull
                    val coverUrl = obj["cover_url"]?.jsonPrimitive?.contentOrNull
                    val albumName = obj["album_name"]?.jsonPrimitive?.contentOrNull
                    val durationText = obj["duration_text"]?.jsonPrimitive?.contentOrNull
                    val isPlaying = obj["is_playing"]?.jsonPrimitive?.booleanOrNull ?: false
                    val updatedAtStr = obj["updated_at"]?.jsonPrimitive?.contentOrNull

                    val timestamp = updatedAtStr?.let {
                        runCatching { Instant.parse(it).toEpochMilli() }.getOrNull()
                    } ?: System.currentTimeMillis()

                    FriendActivityState(
                        userId = "usr_${userTag.takeLast(4).lowercase()}",
                        userTag = userTag,
                        userName = userName,
                        songTitle = songTitle,
                        artist = artist,
                        coverUrl = coverUrl,
                        isPlaying = isPlaying,
                        timestamp = timestamp,
                        albumName = albumName,
                        durationText = durationText,
                        videoId = videoId,
                    )
                }
            }
        }.getOrElse { e ->
            Log.w(TAG, "Error fetching friends activity from Supabase", e)
            emptyList()
        }
    }

    /**
     * Completely removes user's live playback record from Supabase (Private Session / Offline).
     */
    suspend fun clearMyActivity(userTag: String): Boolean = withContext(Dispatchers.IO) {
        if (supabaseUrl.isBlank() || anonKey.isBlank() || userTag.isBlank()) {
            return@withContext false
        }
        runCatching {
            val url = "$supabaseUrl/rest/v1/user_activity?user_tag=eq.$userTag"
            val request = Request.Builder()
                .url(url)
                .delete()
                .header("apikey", anonKey)
                .header("Authorization", "Bearer $anonKey")
                .build()

            Http.client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    Log.w(TAG, "Failed to clear activity from Supabase: HTTP ${response.code}")
                }
                response.isSuccessful
            }
        }.getOrElse { e ->
            Log.w(TAG, "Error clearing activity from Supabase", e)
            false
        }
    }
}
