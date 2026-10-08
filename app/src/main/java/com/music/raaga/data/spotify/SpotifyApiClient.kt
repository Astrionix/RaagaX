package com.music.raaga.data.spotify

import com.music.raaga.data.DebugLog as Log
import com.music.raaga.data.Http
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import okhttp3.Request

object SpotifyApiClient {
    private const val TAG = "SpotifyApiClient"
    private const val BASE_URL = "https://api.spotify.com/v1"

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    /**
     * Fetches the current logged in user's profile.
     */
    suspend fun getUserProfile(accessToken: String): Result<SpotifyUserProfile> = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$BASE_URL/me")
            .header("Authorization", "Bearer $accessToken")
            .build()

        try {
            Http.client.newCall(req).execute().use { resp ->
                val body = resp.body?.string().orEmpty()
                if (!resp.isSuccessful) {
                    return@withContext Result.failure(Exception("Spotify /me returned HTTP ${resp.code}: $body"))
                }

                val obj = json.parseToJsonElement(body).jsonObject
                val id = obj["id"]?.jsonPrimitive?.content ?: "unknown"
                val displayName = obj["display_name"]?.jsonPrimitive?.content ?: id
                val email = obj["email"]?.jsonPrimitive?.content
                val product = obj["product"]?.jsonPrimitive?.content
                val avatarUrl = obj["images"]?.jsonArray?.firstOrNull()?.jsonObject?.get("url")?.jsonPrimitive?.content

                Result.success(
                    SpotifyUserProfile(
                        id = id,
                        displayName = displayName,
                        email = email,
                        avatarUrl = avatarUrl,
                        product = product,
                    )
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "getUserProfile error: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Paginates through all saved / liked tracks of the current user.
     * GET /v1/me/tracks?limit=50&offset=X
     */
    suspend fun getLikedSongs(
        accessToken: String,
        onProgress: ((loaded: Int, total: Int) -> Unit)? = null,
    ): Result<List<SpotifyTrack>> = withContext(Dispatchers.IO) {
        val tracks = mutableListOf<SpotifyTrack>()
        var offset = 0
        val limit = 50
        var total = 0
        var hasNext = true

        try {
            while (hasNext) {
                val url = "$BASE_URL/me/tracks?limit=$limit&offset=$offset"
                val req = Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $accessToken")
                    .build()

                Http.client.newCall(req).execute().use { resp ->
                    val body = resp.body?.string().orEmpty()
                    if (!resp.isSuccessful) {
                        return@withContext Result.failure(Exception("HTTP ${resp.code} fetching liked tracks: $body"))
                    }

                    val obj = json.parseToJsonElement(body).jsonObject
                    total = obj["total"]?.jsonPrimitive?.intOrNull ?: total
                    val items = obj["items"]?.jsonArray.orEmpty()

                    for (item in items) {
                        val trackObj = item.jsonObject["track"]?.jsonObject ?: continue
                        val name = trackObj["name"]?.jsonPrimitive?.content?.trim().orEmpty()
                        if (name.isEmpty()) continue

                        val trackId = trackObj["id"]?.jsonPrimitive?.content
                        val artists = trackObj["artists"]?.jsonArray?.mapNotNull {
                            it.jsonObject["name"]?.jsonPrimitive?.content
                        }?.joinToString(", ").orEmpty()

                        val durationMs = trackObj["duration_ms"]?.jsonPrimitive?.longOrNull
                        val isrc = trackObj["external_ids"]?.jsonObject?.get("isrc")?.jsonPrimitive?.content

                        tracks.add(
                            SpotifyTrack(
                                title = name,
                                artist = artists,
                                durationMs = durationMs,
                                id = trackId,
                                isrc = isrc,
                            )
                        )
                    }

                    onProgress?.invoke(tracks.size, total)

                    val nextUrl = obj["next"]?.jsonPrimitive?.content
                    if (nextUrl != null && items.isNotEmpty()) {
                        offset += limit
                    } else {
                        hasNext = false
                    }
                }
            }
            Result.success(tracks)
        } catch (e: Exception) {
            Log.w(TAG, "getLikedSongs failed: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Fetches all playlists owned or followed by the user.
     * GET /v1/me/playlists?limit=50&offset=X
     */
    suspend fun getUserPlaylists(accessToken: String): Result<List<SpotifyUserPlaylistSummary>> = withContext(Dispatchers.IO) {
        val playlists = mutableListOf<SpotifyUserPlaylistSummary>()
        var offset = 0
        val limit = 50
        var hasNext = true

        try {
            while (hasNext) {
                val url = "$BASE_URL/me/playlists?limit=$limit&offset=$offset"
                val req = Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $accessToken")
                    .build()

                Http.client.newCall(req).execute().use { resp ->
                    val body = resp.body?.string().orEmpty()
                    if (!resp.isSuccessful) {
                        return@withContext Result.failure(Exception("HTTP ${resp.code} fetching playlists: $body"))
                    }

                    val obj = json.parseToJsonElement(body).jsonObject
                    val items = obj["items"]?.jsonArray.orEmpty()

                    for (item in items) {
                        val itemObj = item.jsonObject
                        val id = itemObj["id"]?.jsonPrimitive?.content ?: continue
                        val name = itemObj["name"]?.jsonPrimitive?.content.orEmpty()
                        val desc = itemObj["description"]?.jsonPrimitive?.content
                        val coverUrl = itemObj["images"]?.jsonArray?.firstOrNull()?.jsonObject?.get("url")?.jsonPrimitive?.content
                        val trackCount = itemObj["tracks"]?.jsonObject?.get("total")?.jsonPrimitive?.intOrNull ?: 0
                        val ownerObj = itemObj["owner"]?.jsonObject
                        val ownerName = ownerObj?.get("display_name")?.jsonPrimitive?.content
                        val ownerId = ownerObj?.get("id")?.jsonPrimitive?.content

                        playlists.add(
                            SpotifyUserPlaylistSummary(
                                id = id,
                                name = name,
                                description = desc,
                                coverArtUrl = coverUrl,
                                trackCount = trackCount,
                                isOwner = true,
                                ownerName = ownerName ?: ownerId,
                            )
                        )
                    }

                    val nextUrl = obj["next"]?.jsonPrimitive?.content
                    if (nextUrl != null && items.isNotEmpty()) {
                        offset += limit
                    } else {
                        hasNext = false
                    }
                }
            }
            Result.success(playlists)
        } catch (e: Exception) {
            Log.w(TAG, "getUserPlaylists error: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Fetches all tracks of a specific playlist by ID.
     * GET /v1/playlists/{playlist_id}/tracks?limit=50&offset=X
     */
    suspend fun getPlaylistTracks(
        accessToken: String,
        playlistId: String,
        onProgress: ((loaded: Int, total: Int) -> Unit)? = null,
    ): Result<List<SpotifyTrack>> = withContext(Dispatchers.IO) {
        val tracks = mutableListOf<SpotifyTrack>()
        var offset = 0
        val limit = 50
        var total = 0
        var hasNext = true

        try {
            while (hasNext) {
                val url = "$BASE_URL/playlists/$playlistId/tracks?limit=$limit&offset=$offset"
                val req = Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $accessToken")
                    .build()

                Http.client.newCall(req).execute().use { resp ->
                    val body = resp.body?.string().orEmpty()
                    if (!resp.isSuccessful) {
                        return@withContext Result.failure(Exception("HTTP ${resp.code} fetching playlist tracks: $body"))
                    }

                    val obj = json.parseToJsonElement(body).jsonObject
                    total = obj["total"]?.jsonPrimitive?.intOrNull ?: total
                    val items = obj["items"]?.jsonArray.orEmpty()

                    for (item in items) {
                        val trackObj = item.jsonObject["track"]?.jsonObject ?: continue
                        val name = trackObj["name"]?.jsonPrimitive?.content?.trim().orEmpty()
                        if (name.isEmpty()) continue

                        val trackId = trackObj["id"]?.jsonPrimitive?.content
                        val artists = trackObj["artists"]?.jsonArray?.mapNotNull {
                            it.jsonObject["name"]?.jsonPrimitive?.content
                        }?.joinToString(", ").orEmpty()

                        val durationMs = trackObj["duration_ms"]?.jsonPrimitive?.longOrNull
                        val isrc = trackObj["external_ids"]?.jsonObject?.get("isrc")?.jsonPrimitive?.content

                        tracks.add(
                            SpotifyTrack(
                                title = name,
                                artist = artists,
                                durationMs = durationMs,
                                id = trackId,
                                isrc = isrc,
                            )
                        )
                    }

                    onProgress?.invoke(tracks.size, total)

                    val nextUrl = obj["next"]?.jsonPrimitive?.content
                    if (nextUrl != null && items.isNotEmpty()) {
                        offset += limit
                    } else {
                        hasNext = false
                    }
                }
            }
            Result.success(tracks)
        } catch (e: Exception) {
            Log.w(TAG, "getPlaylistTracks failed: ${e.message}")
            Result.failure(e)
        }
    }
}
