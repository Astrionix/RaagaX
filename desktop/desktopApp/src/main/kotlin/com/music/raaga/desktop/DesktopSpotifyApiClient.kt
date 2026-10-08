package com.music.raaga.desktop

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.util.regex.Pattern

object DesktopSpotifyApiClient {
    private const val BASE_URL = "https://api.spotify.com/v1"

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    private val http: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .followRedirects(HttpClient.Redirect.NORMAL)
        .build()

    private val URL_REGEX = Pattern.compile(
        """(?:https?://)?(?:open\.)?spotify\.com/(?:[a-zA-Z-]+/)?(playlist|album)/([a-zA-Z0-9]+)""",
        Pattern.CASE_INSENSITIVE
    )

    private val URI_REGEX = Pattern.compile(
        """spotify:(playlist|album):([a-zA-Z0-9]+)""",
        Pattern.CASE_INSENSITIVE
    )

    private fun getJson(url: String, token: String): String? {
        val req = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofSeconds(15))
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .GET()
            .build()
        val resp = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
        return if (resp.statusCode() in 200..299) resp.body() else null
    }

    /**
     * Fetches current logged in user profile.
     */
    suspend fun getUserProfile(accessToken: String): Result<DesktopSpotifyUserProfile> = withContext(Dispatchers.IO) {
        try {
            val body = getJson("$BASE_URL/me", accessToken)
                ?: return@withContext Result.failure(Exception("Could not fetch user profile from Spotify /me"))

            val obj = json.parseToJsonElement(body).jsonObject
            val id = obj["id"]?.jsonPrimitive?.content ?: "unknown"
            val displayName = obj["display_name"]?.jsonPrimitive?.content ?: id
            val email = obj["email"]?.jsonPrimitive?.contentOrNull
            val product = obj["product"]?.jsonPrimitive?.contentOrNull
            val avatarUrl = obj["images"]?.jsonArray?.firstOrNull()?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull

            Result.success(
                DesktopSpotifyUserProfile(
                    id = id,
                    displayName = displayName,
                    email = email,
                    avatarUrl = avatarUrl,
                    product = product,
                )
            )
        } catch (e: Exception) {
            DesktopTrackLog.log("DesktopSpotifyApiClient: getUserProfile error: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Paginates through all saved / liked tracks of current user.
     */
    suspend fun getLikedSongs(
        accessToken: String,
        onProgress: ((loaded: Int, total: Int) -> Unit)? = null,
    ): Result<List<DesktopSpotifyTrack>> = withContext(Dispatchers.IO) {
        val tracks = mutableListOf<DesktopSpotifyTrack>()
        var offset = 0
        val limit = 50
        var total = 0
        var hasNext = true

        try {
            while (hasNext) {
                val url = "$BASE_URL/me/tracks?limit=$limit&offset=$offset"
                val body = getJson(url, accessToken)
                    ?: return@withContext Result.failure(Exception("Failed to fetch liked tracks at offset $offset"))

                val obj = json.parseToJsonElement(body).jsonObject
                total = obj["total"]?.jsonPrimitive?.intOrNull ?: total
                val items = obj["items"]?.jsonArray.orEmpty()

                for (item in items) {
                    val trackObj = item.jsonObject["track"]?.jsonObject ?: continue
                    val name = trackObj["name"]?.jsonPrimitive?.content?.trim().orEmpty()
                    if (name.isEmpty()) continue

                    val trackId = trackObj["id"]?.jsonPrimitive?.contentOrNull
                    val artists = trackObj["artists"]?.jsonArray?.mapNotNull {
                        it.jsonObject["name"]?.jsonPrimitive?.contentOrNull
                    }?.joinToString(", ").orEmpty()
                    val durationMs = trackObj["duration_ms"]?.jsonPrimitive?.longOrNull
                    val isrc = trackObj["external_ids"]?.jsonObject?.get("isrc")?.jsonPrimitive?.contentOrNull

                    tracks.add(
                        DesktopSpotifyTrack(
                            title = name,
                            artist = artists,
                            durationMs = durationMs,
                            id = trackId,
                            isrc = isrc,
                        )
                    )
                }

                onProgress?.invoke(tracks.size, total)

                val nextUrl = obj["next"]?.jsonPrimitive?.contentOrNull
                if (nextUrl != null && tracks.size < total) {
                    offset += limit
                } else {
                    hasNext = false
                }
            }

            Result.success(tracks)
        } catch (e: Exception) {
            DesktopTrackLog.log("DesktopSpotifyApiClient: getLikedSongs error: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Paginates through all playlists owned or followed by current user.
     */
    suspend fun getUserPlaylists(
        accessToken: String,
        onProgress: ((loaded: Int, total: Int) -> Unit)? = null,
    ): Result<List<DesktopSpotifyUserPlaylistSummary>> = withContext(Dispatchers.IO) {
        val playlists = mutableListOf<DesktopSpotifyUserPlaylistSummary>()
        var offset = 0
        val limit = 50
        var total = 0
        var hasNext = true

        try {
            val me = getUserProfile(accessToken).getOrNull()
            val myUserId = me?.id.orEmpty()

            while (hasNext) {
                val url = "$BASE_URL/me/playlists?limit=$limit&offset=$offset"
                val body = getJson(url, accessToken)
                    ?: return@withContext Result.failure(Exception("Failed to fetch playlists at offset $offset"))

                val obj = json.parseToJsonElement(body).jsonObject
                total = obj["total"]?.jsonPrimitive?.intOrNull ?: total
                val items = obj["items"]?.jsonArray.orEmpty()

                for (item in items) {
                    val playlistObj = item.jsonObject
                    val id = playlistObj["id"]?.jsonPrimitive?.contentOrNull ?: continue
                    val name = playlistObj["name"]?.jsonPrimitive?.contentOrNull?.trim().orEmpty()
                    if (name.isEmpty()) continue

                    val description = playlistObj["description"]?.jsonPrimitive?.contentOrNull
                    val coverArtUrl = playlistObj["images"]?.jsonArray?.firstOrNull()?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull
                    val trackCount = playlistObj["tracks"]?.jsonObject?.get("total")?.jsonPrimitive?.intOrNull ?: 0
                    val ownerObj = playlistObj["owner"]?.jsonObject
                    val ownerId = ownerObj?.get("id")?.jsonPrimitive?.contentOrNull
                    val ownerName = ownerObj?.get("display_name")?.jsonPrimitive?.contentOrNull ?: ownerId
                    val isOwner = ownerId != null && (myUserId.isEmpty() || ownerId == myUserId)

                    playlists.add(
                        DesktopSpotifyUserPlaylistSummary(
                            id = id,
                            name = name,
                            description = description,
                            coverArtUrl = coverArtUrl,
                            trackCount = trackCount,
                            isOwner = isOwner,
                            ownerName = ownerName,
                        )
                    )
                }

                onProgress?.invoke(playlists.size, total)

                val nextUrl = obj["next"]?.jsonPrimitive?.contentOrNull
                if (nextUrl != null && playlists.size < total) {
                    offset += limit
                } else {
                    hasNext = false
                }
            }

            Result.success(playlists)
        } catch (e: Exception) {
            DesktopTrackLog.log("DesktopSpotifyApiClient: getUserPlaylists error: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Fetches all tracks of a specific playlist.
     */
    suspend fun getPlaylistTracks(
        accessToken: String,
        playlistId: String,
        onProgress: ((loaded: Int, total: Int) -> Unit)? = null,
    ): Result<List<DesktopSpotifyTrack>> = withContext(Dispatchers.IO) {
        val tracks = mutableListOf<DesktopSpotifyTrack>()
        var offset = 0
        val limit = 50
        var total = 0
        var hasNext = true

        try {
            while (hasNext) {
                val url = "$BASE_URL/playlists/$playlistId/tracks?limit=$limit&offset=$offset"
                val body = getJson(url, accessToken)
                    ?: return@withContext Result.failure(Exception("Failed to fetch tracks for playlist $playlistId at offset $offset"))

                val obj = json.parseToJsonElement(body).jsonObject
                total = obj["total"]?.jsonPrimitive?.intOrNull ?: total
                val items = obj["items"]?.jsonArray.orEmpty()

                for (item in items) {
                    val trackObj = item.jsonObject["track"]?.jsonObject ?: continue
                    val name = trackObj["name"]?.jsonPrimitive?.content?.trim().orEmpty()
                    if (name.isEmpty()) continue

                    val trackId = trackObj["id"]?.jsonPrimitive?.contentOrNull
                    val artists = trackObj["artists"]?.jsonArray?.mapNotNull {
                        it.jsonObject["name"]?.jsonPrimitive?.contentOrNull
                    }?.joinToString(", ").orEmpty()
                    val durationMs = trackObj["duration_ms"]?.jsonPrimitive?.longOrNull
                    val isrc = trackObj["external_ids"]?.jsonObject?.get("isrc")?.jsonPrimitive?.contentOrNull

                    tracks.add(
                        DesktopSpotifyTrack(
                            title = name,
                            artist = artists,
                            durationMs = durationMs,
                            id = trackId,
                            isrc = isrc,
                        )
                    )
                }

                onProgress?.invoke(tracks.size, total)

                val nextUrl = obj["next"]?.jsonPrimitive?.contentOrNull
                if (nextUrl != null && tracks.size < total) {
                    offset += limit
                } else {
                    hasNext = false
                }
            }

            Result.success(tracks)
        } catch (e: Exception) {
            DesktopTrackLog.log("DesktopSpotifyApiClient: getPlaylistTracks error: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Extracts target ID and type from Spotify link or URI.
     */
    fun parseTarget(input: String): Pair<String, String>? {
        val trimmed = input.trim()
        val urlMatch = URL_REGEX.matcher(trimmed)
        if (urlMatch.find()) {
            return Pair(urlMatch.group(1).lowercase(), urlMatch.group(2))
        }
        val uriMatch = URI_REGEX.matcher(trimmed)
        if (uriMatch.find()) {
            return Pair(uriMatch.group(1).lowercase(), uriMatch.group(2))
        }
        if (trimmed.length in 20..24 && trimmed.matches(Regex("^[a-zA-Z0-9]+$"))) {
            return Pair("playlist", trimmed)
        }
        return null
    }

    /**
     * Fetches public playlist or album from URL or ID.
     */
    suspend fun fetchPlaylistFromUrl(
        urlOrId: String,
        token: String?,
    ): Result<DesktopSpotifyPlaylistInfo> = withContext(Dispatchers.IO) {
        val target = parseTarget(urlOrId)
            ?: return@withContext Result.failure(IllegalArgumentException("Invalid Spotify URL or ID: $urlOrId"))
        val (type, id) = target

        // If we have a token, fetch via Web API
        if (!token.isNullOrBlank()) {
            val endpoint = if (type == "album") "$BASE_URL/albums/$id" else "$BASE_URL/playlists/$id"
            val body = getJson(endpoint, token)
            if (body != null) {
                val obj = json.parseToJsonElement(body).jsonObject
                val title = obj["name"]?.jsonPrimitive?.contentOrNull ?: "Imported Spotify Playlist"
                val coverArtUrl = obj["images"]?.jsonArray?.firstOrNull()?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull
                val author = if (type == "album") {
                    obj["artists"]?.jsonArray?.mapNotNull { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull }?.joinToString(", ")
                } else {
                    obj["owner"]?.jsonObject?.get("display_name")?.jsonPrimitive?.contentOrNull
                }

                val tracksResult = if (type == "album") {
                    getAlbumTracks(token, id)
                } else {
                    getPlaylistTracks(token, id)
                }
                val tracks = tracksResult.getOrDefault(emptyList())

                return@withContext Result.success(
                    DesktopSpotifyPlaylistInfo(
                        id = id,
                        type = type,
                        title = title,
                        author = author,
                        coverArtUrl = coverArtUrl,
                        tracks = tracks,
                    )
                )
            }
        }

        // Web embed scraper fallback if no token or token declined
        try {
            val embedUrl = "https://open.spotify.com/embed/$type/$id"
            val req = HttpRequest.newBuilder(URI.create(embedUrl))
                .timeout(Duration.ofSeconds(12))
                .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                .GET()
                .build()
            val resp = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
            val html = resp.body()

            val scriptMatch = Regex("""<script\s+id="__NEXT_DATA__"\s+type="application/json">([\s\S]*?)</script>""")
                .find(html)
            if (scriptMatch != null) {
                val jsonText = scriptMatch.groupValues[1]
                val root = json.parseToJsonElement(jsonText).jsonObject
                val entity = root["props"]?.jsonObject
                    ?.get("pageProps")?.jsonObject
                    ?.get("state")?.jsonObject
                    ?.get("data")?.jsonObject
                    ?.get("entity")?.jsonObject

                if (entity != null) {
                    val title = entity["name"]?.jsonPrimitive?.contentOrNull ?: "Imported Spotify Playlist"
                    val coverArtUrl = entity["coverArt"]?.jsonObject?.get("sources")?.jsonArray
                        ?.firstOrNull()?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull
                    val trackList = entity["trackList"]?.jsonArray.orEmpty()
                    val tracks = trackList.mapNotNull { item ->
                        val t = item.jsonObject
                        val name = t["title"]?.jsonPrimitive?.contentOrNull?.trim().orEmpty()
                        if (name.isEmpty()) null
                        else DesktopSpotifyTrack(
                            title = name,
                            artist = t["subtitle"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                            durationMs = t["duration"]?.jsonPrimitive?.longOrNull,
                        )
                    }

                    return@withContext Result.success(
                        DesktopSpotifyPlaylistInfo(
                            id = id,
                            type = type,
                            title = title,
                            author = null,
                            coverArtUrl = coverArtUrl,
                            tracks = tracks,
                        )
                    )
                }
            }
            Result.failure(Exception("Could not extract Spotify tracks from embed"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun getAlbumTracks(accessToken: String, albumId: String): Result<List<DesktopSpotifyTrack>> = withContext(Dispatchers.IO) {
        val tracks = mutableListOf<DesktopSpotifyTrack>()
        try {
            val url = "$BASE_URL/albums/$albumId/tracks?limit=50"
            val body = getJson(url, accessToken) ?: return@withContext Result.failure(Exception("Failed to fetch album tracks"))
            val obj = json.parseToJsonElement(body).jsonObject
            val items = obj["items"]?.jsonArray.orEmpty()
            for (item in items) {
                val trackObj = item.jsonObject
                val name = trackObj["name"]?.jsonPrimitive?.content?.trim().orEmpty()
                if (name.isEmpty()) continue
                val trackId = trackObj["id"]?.jsonPrimitive?.contentOrNull
                val artists = trackObj["artists"]?.jsonArray?.mapNotNull {
                    it.jsonObject["name"]?.jsonPrimitive?.contentOrNull
                }?.joinToString(", ").orEmpty()
                val durationMs = trackObj["duration_ms"]?.jsonPrimitive?.longOrNull
                tracks.add(
                    DesktopSpotifyTrack(
                        title = name,
                        artist = artists,
                        durationMs = durationMs,
                        id = trackId,
                    )
                )
            }
            Result.success(tracks)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
