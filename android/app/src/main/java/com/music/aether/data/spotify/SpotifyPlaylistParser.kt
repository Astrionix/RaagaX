package com.music.aether.data.spotify

import com.music.aether.data.DebugLog as Log
import com.music.aether.data.Http
import com.music.aether.data.canvas.SpotifyToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import okhttp3.Request
import java.net.URLEncoder
import java.util.regex.Pattern

data class SpotifyTrack(
    val title: String,
    val artist: String,
    val durationMs: Long? = null,
)

data class SpotifyPlaylistInfo(
    val id: String,
    val type: String, // "playlist" or "album"
    val title: String,
    val author: String?,
    val coverArtUrl: String?,
    val tracks: List<SpotifyTrack>,
    val isPartial: Boolean = false,
)

object SpotifyPlaylistParser {
    private const val TAG = "SpotifyPlaylistParser"
    private const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    private val URL_REGEX = Pattern.compile(
        """(?:https?://)?(?:open\.)?spotify\.com/(?:[a-zA-Z-]+/)?(playlist|album)/([a-zA-Z0-9]+)""",
        Pattern.CASE_INSENSITIVE
    )

    private val URI_REGEX = Pattern.compile(
        """spotify:(playlist|album):([a-zA-Z0-9]+)""",
        Pattern.CASE_INSENSITIVE
    )

    private val SCRIPT_JSON_REGEX = Pattern.compile(
        """<script\s+id="__NEXT_DATA__"\s+type="application/json">([\s\S]*?)</script>"""
    )

    data class ParsedTarget(val type: String, val id: String)

    /**
     * Extracts the entity type ("playlist" or "album") and Spotify ID from a URL, URI,
     * or shortened link.
     */
    suspend fun parseLink(input: String): ParsedTarget? = withContext(Dispatchers.IO) {
        val trimmed = input.trim()
        if (trimmed.isEmpty()) return@withContext null

        // If it's a short link like spotify.link/xyz, resolve redirect
        val resolvedUrl = if (trimmed.contains("spotify.link")) {
            runCatching {
                val req = Request.Builder()
                    .url(trimmed)
                    .header("User-Agent", USER_AGENT)
                    .build()
                Http.client.newCall(req).execute().use { resp ->
                    resp.request.url.toString()
                }
            }.getOrDefault(trimmed)
        } else {
            trimmed
        }

        // Try Spotify URI (spotify:playlist:xxx)
        val uriMatcher = URI_REGEX.matcher(resolvedUrl)
        if (uriMatcher.find()) {
            val type = uriMatcher.group(1)?.lowercase() ?: "playlist"
            val id = uriMatcher.group(2) ?: return@withContext null
            return@withContext ParsedTarget(type, id)
        }

        // Try standard web URL
        val urlMatcher = URL_REGEX.matcher(resolvedUrl)
        if (urlMatcher.find()) {
            val type = urlMatcher.group(1)?.lowercase() ?: "playlist"
            val id = urlMatcher.group(2) ?: return@withContext null
            return@withContext ParsedTarget(type, id)
        }

        null
    }

    /**
     * Fetches playlist metadata and track list from Spotify's embed endpoint without requiring login.
     * If user has configured Spotify in settings, attempts to paginate further tracks beyond 50.
     */
    suspend fun fetchPlaylist(target: ParsedTarget): Result<SpotifyPlaylistInfo> = withContext(Dispatchers.IO) {
        runCatching {
            val embedUrl = "https://open.spotify.com/embed/${target.type}/${target.id}"
            val request = Request.Builder()
                .url(embedUrl)
                .header("User-Agent", USER_AGENT)
                .header("Accept-Language", "en-US,en;q=0.9")
                .build()

            val html = Http.client.newCall(request).execute().use { resp ->
                if (!resp.isSuccessful) throw IllegalStateException("HTTP ${resp.code} fetching Spotify embed")
                resp.body?.string() ?: throw IllegalStateException("Empty body from Spotify embed")
            }

            val scriptMatcher = SCRIPT_JSON_REGEX.matcher(html)
            if (!scriptMatcher.find()) {
                throw IllegalStateException("Spotify playlist data structure could not be found")
            }

            val jsonContent = scriptMatcher.group(1) ?: throw IllegalStateException("Empty script payload")
            val root = json.parseToJsonElement(jsonContent).jsonObject

            val entity = root["props"]?.jsonObject
                ?.get("pageProps")?.jsonObject
                ?.get("state")?.jsonObject
                ?.get("data")?.jsonObject
                ?.get("entity")?.jsonObject
                ?: throw IllegalStateException("Could not find playlist entity in Spotify response")

            val title = entity["title"]?.jsonPrimitive?.contentOrNull
                ?: entity["name"]?.jsonPrimitive?.contentOrNull
                ?: (if (target.type == "album") "Imported Album" else "Imported Playlist")

            val author = entity["subtitle"]?.jsonPrimitive?.contentOrNull
            val coverArtUrl = extractCoverArt(entity)

            val sessionToken = root["props"]?.jsonObject
                ?.get("pageProps")?.jsonObject
                ?.get("state")?.jsonObject
                ?.get("settings")?.jsonObject
                ?.get("session")?.jsonObject
                ?.get("accessToken")?.jsonPrimitive?.contentOrNull

            val tracks = mutableListOf<SpotifyTrack>()
            val trackListArray = entity["trackList"]?.jsonArray
            trackListArray?.forEach { element ->
                val trackObj = element.jsonObject
                val trackTitle = trackObj["title"]?.jsonPrimitive?.contentOrNull?.trim()
                val trackSubtitle = trackObj["subtitle"]?.jsonPrimitive?.contentOrNull
                    ?.replace("\u00A0", " ")?.trim() // replace non-breaking spaces
                val durationMs = trackObj["duration"]?.jsonPrimitive?.contentOrNull?.toLongOrNull()

                if (!trackTitle.isNullOrBlank()) {
                    tracks.add(
                        SpotifyTrack(
                            title = trackTitle,
                            artist = trackSubtitle.orEmpty(),
                            durationMs = durationMs,
                        )
                    )
                }
            }

            if (tracks.isEmpty()) {
                throw IllegalStateException("No tracks found in Spotify ${target.type}")
            }

            // If the playlist has 50+ tracks (which is Spotify embed's maximum), paginate to fetch all remaining tracks
            var isPartial = false
            if (target.type == "playlist" && tracks.size >= 50) {
                val fetchResult = fetchAdditionalTracks(target.id, currentCount = tracks.size, token = sessionToken)
                if (fetchResult.tracks.isNotEmpty()) {
                    tracks.addAll(fetchResult.tracks)
                }
                isPartial = !fetchResult.isComplete
            }

            SpotifyPlaylistInfo(
                id = target.id,
                type = target.type,
                title = title,
                author = author,
                coverArtUrl = coverArtUrl,
                tracks = tracks,
                isPartial = isPartial,
            )
        }
    }

    private fun extractCoverArt(entity: kotlinx.serialization.json.JsonObject): String? {
        // Option 1: visualIdentity -> image (last item has highest resolution, e.g. 640x640)
        val images = entity["visualIdentity"]?.jsonObject?.get("image")?.jsonArray
        images?.lastOrNull()?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull?.let { return it }

        // Option 2: coverArt -> sources
        val coverSources = entity["coverArt"]?.jsonObject?.get("sources")?.jsonArray
        coverSources?.firstOrNull()?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull?.let { return it }

        // Option 3: attributes -> image_url
        val attributes = entity["attributes"]?.jsonArray
        val attrImg = attributes?.firstOrNull {
            it.jsonObject["key"]?.jsonPrimitive?.contentOrNull == "image_url"
        }?.jsonObject?.get("value")?.jsonPrimitive?.contentOrNull
        if (!attrImg.isNullOrBlank()) return attrImg

        return null
    }

    private data class FetchResult(
        val tracks: List<SpotifyTrack>,
        val isComplete: Boolean,
    )

    private const val PATHFINDER_URL = "https://api-partner.spotify.com/pathfinder/v1/query"
    private const val FETCH_PLAYLIST_SHA256 = "a65e12194ed5fc443a1cdebed5fabe33ca5b07b987185d63c72483867ad13cb4"
    private const val MAX_TOTAL_TRACKS = 2000

    private fun String.urlEncoded(): String = URLEncoder.encode(this, "UTF-8")

    /**
     * Fetches all remaining tracks beyond [currentCount] for a playlist.
     * Tries the web player's Pathfinder GraphQL endpoint first (which supports anonymous tokens
     * embedded directly in the page), and falls back to the standard Web API.
     */
    private suspend fun fetchAdditionalTracks(
        playlistId: String,
        currentCount: Int,
        token: String?,
    ): FetchResult {
        val validToken = token
            ?: runCatching { SpotifyToken.accessToken(allowAnonymous = true) }.getOrNull()
            ?: return FetchResult(emptyList(), isComplete = false)

        // 1. Try Spotify Pathfinder GraphQL API (primary method, works without login)
        val pathfinderResult = runCatching {
            fetchAdditionalTracksViaPathfinder(playlistId, currentCount, validToken)
        }.getOrNull()

        if (pathfinderResult != null && (pathfinderResult.tracks.isNotEmpty() || pathfinderResult.isComplete)) {
            Log.d(TAG, "Fetched ${pathfinderResult.tracks.size} extra tracks via Pathfinder (complete=${pathfinderResult.isComplete})")
            return pathfinderResult
        }

        // 2. Fallback to Spotify Web API
        return runCatching {
            fetchAdditionalTracksViaWebApi(playlistId, currentCount, validToken)
        }.getOrDefault(FetchResult(emptyList(), isComplete = false))
    }

    private fun fetchAdditionalTracksViaPathfinder(
        playlistId: String,
        currentCount: Int,
        token: String,
    ): FetchResult {
        val additional = mutableListOf<SpotifyTrack>()
        var offset = currentCount
        val limit = 100
        var isComplete = false

        while (offset < MAX_TOTAL_TRACKS) {
            val variables = buildJsonObject {
                put("uri", "spotify:playlist:$playlistId")
                put("offset", offset)
                put("limit", limit)
                put("enableWatchFeedEntrypoint", false)
            }
            val extensions = buildJsonObject {
                putJsonObject("persistedQuery") {
                    put("version", 1)
                    put("sha256Hash", FETCH_PLAYLIST_SHA256)
                }
            }

            val url = "$PATHFINDER_URL?operationName=fetchPlaylist" +
                    "&variables=${variables.toString().urlEncoded()}" +
                    "&extensions=${extensions.toString().urlEncoded()}"

            val req = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .header("app-platform", "WebPlayer")
                .header("User-Agent", USER_AGENT)
                .build()

            val body = runCatching {
                Http.client.newCall(req).execute().use { resp ->
                    if (resp.isSuccessful) resp.body?.string() else null
                }
            }.getOrNull() ?: break

            val root = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull() ?: break
            val content = root["data"]?.jsonObject
                ?.get("playlistV2")?.jsonObject
                ?.get("content")?.jsonObject ?: break

            val totalCount = content["totalCount"]?.jsonPrimitive?.intOrNull
            val items = content["items"]?.jsonArray ?: break
            if (items.isEmpty()) {
                isComplete = (totalCount == null || offset >= totalCount)
                break
            }

            for (item in items) {
                val itemObj = item.jsonObject
                val itemV2Data = itemObj["itemV2"]?.jsonObject?.get("data")?.jsonObject
                val identityTrait = itemObj["itemV3"]?.jsonObject?.get("data")?.jsonObject
                    ?.get("identityTrait")?.jsonObject
                val trackObj = itemObj["track"]?.jsonObject

                val trackTitle = (
                    itemV2Data?.get("name")?.jsonPrimitive?.contentOrNull
                        ?: identityTrait?.get("name")?.jsonPrimitive?.contentOrNull
                        ?: trackObj?.get("name")?.jsonPrimitive?.contentOrNull
                )?.trim() ?: continue

                val artists = itemV2Data?.get("artists")?.jsonObject?.get("items")?.jsonArray?.mapNotNull {
                    it.jsonObject["profile"]?.jsonObject?.get("name")?.jsonPrimitive?.contentOrNull
                }?.joinToString(", ")?.takeIf { it.isNotBlank() }
                    ?: identityTrait?.get("contributors")?.jsonObject?.get("items")?.jsonArray?.mapNotNull {
                        it.jsonObject["name"]?.jsonPrimitive?.contentOrNull
                    }?.joinToString(", ")?.takeIf { it.isNotBlank() }
                    ?: trackObj?.get("artists")?.jsonArray?.mapNotNull {
                        it.jsonObject["name"]?.jsonPrimitive?.contentOrNull
                    }?.joinToString(", ")
                    ?: ""

                val durationMs = itemV2Data?.get("trackDuration")?.jsonObject
                    ?.get("totalMilliseconds")?.jsonPrimitive?.longOrNull
                    ?: itemObj["itemV3"]?.jsonObject?.get("data")?.jsonObject
                        ?.get("consumptionExperienceTrait")?.jsonObject
                        ?.get("duration")?.jsonObject
                        ?.get("seconds")?.jsonPrimitive?.longOrNull?.let { it * 1000L }
                    ?: trackObj?.get("duration_ms")?.jsonPrimitive?.longOrNull

                additional.add(
                    SpotifyTrack(
                        title = trackTitle,
                        artist = artists.replace("\u00A0", " ").trim(),
                        durationMs = durationMs
                    )
                )
            }

            offset += items.size
            if (totalCount != null && offset >= totalCount) {
                isComplete = true
                break
            }
            if (items.size < limit) {
                isComplete = true
                break
            }
        }

        return FetchResult(additional, isComplete = isComplete)
    }

    private fun fetchAdditionalTracksViaWebApi(
        playlistId: String,
        currentCount: Int,
        token: String,
    ): FetchResult {
        val clientToken = runCatching { SpotifyToken.clientToken() }.getOrNull()
        val additional = mutableListOf<SpotifyTrack>()
        var offset = currentCount
        val limit = 50
        var isComplete = false

        while (offset < MAX_TOTAL_TRACKS) {
            val url = "https://api.spotify.com/v1/playlists/$playlistId/tracks?offset=$offset&limit=$limit"
            val reqBuilder = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .header("User-Agent", USER_AGENT)

            if (!clientToken.isNullOrBlank()) {
                reqBuilder.header("Client-Token", clientToken)
            }

            val body = runCatching {
                Http.client.newCall(reqBuilder.build()).execute().use { resp ->
                    if (resp.isSuccessful) resp.body?.string() else null
                }
            }.getOrNull() ?: break

            val root = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull() ?: break
            val items = root["items"]?.jsonArray ?: break
            if (items.isEmpty()) {
                isComplete = true
                break
            }

            for (item in items) {
                val trackObj = item.jsonObject["track"]?.jsonObject ?: continue
                val trackTitle = trackObj["name"]?.jsonPrimitive?.contentOrNull?.trim() ?: continue
                val artists = trackObj["artists"]?.jsonArray?.mapNotNull {
                    it.jsonObject["name"]?.jsonPrimitive?.contentOrNull
                }?.joinToString(", ") ?: ""
                val durationMs = trackObj["duration_ms"]?.jsonPrimitive?.contentOrNull?.toLongOrNull()

                additional.add(
                    SpotifyTrack(
                        title = trackTitle,
                        artist = artists.replace("\u00A0", " ").trim(),
                        durationMs = durationMs
                    )
                )
            }

            offset += items.size
            val next = root["next"]?.jsonPrimitive?.contentOrNull
            if (next.isNullOrBlank() || items.size < limit) {
                isComplete = true
                break
            }
        }

        return FetchResult(additional, isComplete = isComplete)
    }
}
