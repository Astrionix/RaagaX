package com.music.raaga.data.spotify

import com.music.raaga.data.DebugLog as Log
import com.music.raaga.data.Http
import com.music.raaga.data.canvas.SpotifyToken
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
                resp.body.string()
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
                ?: Regex(""""accessToken"\s*:\s*"([^"]+)"""").find(jsonContent)?.groupValues?.get(1)

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

            // For playlists, fetch full track list (bypassing embed limit to get all songs, e.g. 300+ tracks)
            var isPartial = false
            if (target.type == "playlist") {
                // Strategy 1: Pathfinder GraphQL (from offset 0, full pagination)
                val pathfinderResult = fetchTracksViaPathfinder(target.id, startOffset = 0, token = sessionToken)
                when {
                    // Pathfinder succeeded and is definitively complete — use its result
                    pathfinderResult.isComplete && pathfinderResult.tracks.isNotEmpty() -> {
                        tracks.clear()
                        tracks.addAll(pathfinderResult.tracks)
                        isPartial = false
                        Log.d(TAG, "Pathfinder complete: ${tracks.size} tracks")
                    }
                    // Pathfinder returned more tracks than embed (partial but better) — use & mark partial
                    pathfinderResult.tracks.size > tracks.size -> {
                        tracks.clear()
                        tracks.addAll(pathfinderResult.tracks)
                        isPartial = true
                        Log.d(TAG, "Pathfinder partial: ${tracks.size} tracks, trying Web API supplement")
                        // Supplement what pathfinder missed via Web API
                        if (tracks.size >= 50) {
                            val webApiResult = fetchAllTracksViaWebApi(target.id, startOffset = tracks.size, token = sessionToken)
                            if (webApiResult.tracks.isNotEmpty()) {
                                tracks.addAll(webApiResult.tracks)
                                isPartial = !webApiResult.isComplete
                            }
                        }
                    }
                    // Pathfinder failed or returned same/fewer — try Web API from scratch (offset 0)
                    else -> {
                        Log.d(TAG, "Pathfinder returned ${pathfinderResult.tracks.size} (embed has ${tracks.size}), trying Web API from offset 0")
                        val webApiResult = fetchAllTracksViaWebApi(target.id, startOffset = 0, token = sessionToken)
                        when {
                            webApiResult.tracks.size > tracks.size -> {
                                tracks.clear()
                                tracks.addAll(webApiResult.tracks)
                                isPartial = !webApiResult.isComplete
                                Log.d(TAG, "Web API: ${tracks.size} tracks (complete=${webApiResult.isComplete})")
                            }
                            // Web API also failed — try appending from the embed's cutoff point
                            tracks.size >= 50 -> {
                                val appendResult = fetchAdditionalTracks(target.id, currentCount = tracks.size, token = sessionToken)
                                if (appendResult.tracks.isNotEmpty()) {
                                    tracks.addAll(appendResult.tracks)
                                }
                                isPartial = !appendResult.isComplete
                                Log.d(TAG, "Appended ${appendResult.tracks.size} extra tracks, total=${tracks.size}")
                            }
                            else -> isPartial = true
                        }
                    }
                }
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

    private val PATHFINDER_URLS = listOf(
        "https://api-partner.spotify.com/pathfinder/v1/query",
        "https://api-partner.spotify.com/pathfinder/v2/query",
    )
    private val PATHFINDER_HASHES = listOf(
        "7982b11e21535cd2594badc40030b745671b61a1fa66766e569d45e6364f3422",
        "a65e12194ed5fc443a1cdebed5fabe33ca5b07b987185d63c72483867ad13cb4",
    )
    private const val MAX_TOTAL_TRACKS = 2500

    private fun String.urlEncoded(): String = URLEncoder.encode(this, "UTF-8")

    /**
     * Attempts to fetch tracks from Spotify Pathfinder GraphQL API across supported hashes and URLs.
     */
    private suspend fun fetchTracksViaPathfinder(
        playlistId: String,
        startOffset: Int,
        token: String?,
    ): FetchResult {
        val validToken = token
            ?: runCatching { SpotifyToken.accessToken(allowAnonymous = true) }.getOrNull()
            ?: return FetchResult(emptyList(), isComplete = false)

        val clientToken = runCatching { SpotifyToken.clientToken() }.getOrNull()

        for (hash in PATHFINDER_HASHES) {
            for (baseUrl in PATHFINDER_URLS) {
                val result = runCatching {
                    executePathfinderLoop(playlistId, startOffset, validToken, clientToken, baseUrl, hash)
                }.getOrNull()

                if (result != null && result.tracks.isNotEmpty()) {
                    Log.d(TAG, "Fetched ${result.tracks.size} tracks using $baseUrl (hash=${hash.take(8)}, complete=${result.isComplete})")
                    return result
                }
            }
        }

        return FetchResult(emptyList(), isComplete = false)
    }

    /**
     * Executes the pagination loop against a specific Pathfinder endpoint and query hash.
     */
    private fun executePathfinderLoop(
        playlistId: String,
        startOffset: Int,
        token: String,
        clientToken: String?,
        baseUrl: String,
        hash: String,
    ): FetchResult {
        val allTracks = mutableListOf<SpotifyTrack>()
        var offset = startOffset
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
                    put("sha256Hash", hash)
                }
            }

            val url = "$baseUrl?operationName=fetchPlaylist" +
                    "&variables=${variables.toString().urlEncoded()}" +
                    "&extensions=${extensions.toString().urlEncoded()}"

            val reqBuilder = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .header("app-platform", "WebPlayer")
                .header("User-Agent", USER_AGENT)
                .header("Accept", "application/json")
                .header("Accept-Language", "en-US,en;q=0.9")

            if (!clientToken.isNullOrBlank()) {
                reqBuilder.header("client-token", clientToken)
            }

            val body = runCatching {
                Http.client.newCall(reqBuilder.build()).execute().use { resp ->
                    if (resp.isSuccessful) resp.body.string() else null
                }
            }.getOrNull() ?: break

            val root = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull() ?: break
            val playlistData = root["data"]?.jsonObject?.get("playlistV2")?.jsonObject
                ?: root["data"]?.jsonObject?.get("playlist")?.jsonObject
                ?: root["data"]?.jsonObject?.get("album")?.jsonObject
                ?: root["data"]?.jsonObject?.get("albumV2")?.jsonObject
                ?: break

            val content = playlistData["content"]?.jsonObject
                ?: playlistData["tracks"]?.jsonObject
                ?: playlistData

            val totalCount = content["totalCount"]?.jsonPrimitive?.intOrNull
                ?: playlistData["totalTracks"]?.jsonPrimitive?.intOrNull
                ?: playlistData["total"]?.jsonPrimitive?.intOrNull

            val items = content["items"]?.jsonArray
                ?: playlistData["items"]?.jsonArray
                ?: content["trackList"]?.jsonArray
                ?: break

            if (items.isEmpty()) {
                isComplete = (totalCount == null || offset >= totalCount)
                break
            }

            for (item in items) {
                val itemObj = item.jsonObject
                val itemV2Data = itemObj["itemV2"]?.jsonObject?.get("data")?.jsonObject
                val itemV3Data = itemObj["itemV3"]?.jsonObject?.get("data")?.jsonObject
                val identityTrait = itemV3Data?.get("identityTrait")?.jsonObject
                val trackObj = itemObj["track"]?.jsonObject ?: itemObj["item"]?.jsonObject

                val trackTitle = (
                    itemV2Data?.get("name")?.jsonPrimitive?.contentOrNull
                        ?: identityTrait?.get("name")?.jsonPrimitive?.contentOrNull
                        ?: trackObj?.get("name")?.jsonPrimitive?.contentOrNull
                        ?: itemObj["data"]?.jsonObject?.get("name")?.jsonPrimitive?.contentOrNull
                        ?: itemObj["name"]?.jsonPrimitive?.contentOrNull
                )?.trim() ?: continue

                val artists = itemV2Data?.get("artists")?.jsonObject?.get("items")?.jsonArray?.mapNotNull {
                    it.jsonObject["profile"]?.jsonObject?.get("name")?.jsonPrimitive?.contentOrNull
                        ?: it.jsonObject["name"]?.jsonPrimitive?.contentOrNull
                }?.joinToString(", ")?.takeIf { it.isNotBlank() }
                    ?: identityTrait?.get("contributors")?.jsonObject?.get("items")?.jsonArray?.mapNotNull {
                        it.jsonObject["name"]?.jsonPrimitive?.contentOrNull
                    }?.joinToString(", ")?.takeIf { it.isNotBlank() }
                    ?: trackObj?.get("artists")?.jsonArray?.mapNotNull {
                        it.jsonObject["name"]?.jsonPrimitive?.contentOrNull
                    }?.joinToString(", ")
                    ?: itemObj["data"]?.jsonObject?.get("artists")?.jsonArray?.mapNotNull {
                        it.jsonObject["name"]?.jsonPrimitive?.contentOrNull
                    }?.joinToString(", ")
                    ?: ""

                val durationMs = itemV2Data?.get("trackDuration")?.jsonObject
                    ?.get("totalMilliseconds")?.jsonPrimitive?.longOrNull
                    ?: itemV3Data?.get("consumptionExperienceTrait")?.jsonObject
                        ?.get("duration")?.jsonObject
                        ?.get("seconds")?.jsonPrimitive?.longOrNull?.let { it * 1000L }
                    ?: trackObj?.get("duration_ms")?.jsonPrimitive?.longOrNull
                    ?: itemObj["duration_ms"]?.jsonPrimitive?.longOrNull

                allTracks.add(
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

        return FetchResult(allTracks, isComplete = isComplete)
    }

    /**
     * Fetches ALL tracks for a playlist via Spotify Web API starting from [startOffset].
     * When startOffset=0 this replaces the embed completely. Uses the session token from embed
     * which is a real Spotify access token that works with api.spotify.com.
     */
    private suspend fun fetchAllTracksViaWebApi(
        playlistId: String,
        startOffset: Int,
        token: String?,
    ): FetchResult = withContext(Dispatchers.IO) {
        val validToken = token
            ?: runCatching { SpotifyToken.accessToken(allowAnonymous = true) }.getOrNull()
            ?: return@withContext FetchResult(emptyList(), isComplete = false)

        runCatching {
            fetchAllTracksViaWebApiInternal(playlistId, startOffset, validToken)
        }.getOrDefault(FetchResult(emptyList(), isComplete = false))
    }

    /**
     * Fetches all remaining tracks beyond [currentCount] for a playlist.
     * Tries the web player's Pathfinder GraphQL endpoint first, and falls back to the Web API.
     */
    private suspend fun fetchAdditionalTracks(
        playlistId: String,
        currentCount: Int,
        token: String?,
    ): FetchResult {
        // 1. Try Pathfinder starting at currentCount
        val pathfinderResult = fetchTracksViaPathfinder(playlistId, startOffset = currentCount, token = token)
        if (pathfinderResult.tracks.isNotEmpty() || pathfinderResult.isComplete) {
            Log.d(TAG, "Fetched ${pathfinderResult.tracks.size} extra tracks via Pathfinder (complete=${pathfinderResult.isComplete})")
            return pathfinderResult
        }

        // 2. Fallback to Spotify Web API from currentCount
        return fetchAllTracksViaWebApi(playlistId, startOffset = currentCount, token = token)
    }

    /**
     * Core Web API pagination — fetches tracks starting at [startOffset] from
     * api.spotify.com using the given [token]. When startOffset=0 this returns
     * the complete playlist.
     */
    private fun fetchAllTracksViaWebApiInternal(
        playlistId: String,
        startOffset: Int,
        token: String,
    ): FetchResult {
        val clientToken = runCatching { SpotifyToken.clientToken() }.getOrNull()
        val result = mutableListOf<SpotifyTrack>()
        var offset = startOffset
        val limit = 100
        var isComplete = false
        var consecutiveFailures = 0

        while (offset < MAX_TOTAL_TRACKS) {
            // Include fields to reduce payload size and avoid 400 errors on large playlists
            val url = "https://api.spotify.com/v1/playlists/$playlistId/tracks" +
                "?offset=$offset&limit=$limit" +
                "&fields=items(track(name,duration_ms,artists(name))),next,total"

            val reqBuilder = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .header("User-Agent", USER_AGENT)
                .header("Accept", "application/json")
                .header("Accept-Language", "en-US,en;q=0.9")

            if (!clientToken.isNullOrBlank()) {
                reqBuilder.header("client-token", clientToken)
            }

            val (respCode, body) = runCatching {
                Http.client.newCall(reqBuilder.build()).execute().use { resp ->
                    resp.code to if (resp.isSuccessful) resp.body.string() else null
                }
            }.getOrDefault(-1 to null)

            if (body == null) {
                // 401 = token expired, 403 = forbidden — no point retrying
                if (respCode == 401 || respCode == 403) break
                consecutiveFailures++
                if (consecutiveFailures >= 3) break
                continue
            }
            consecutiveFailures = 0

            val root = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull() ?: break
            val total = root["total"]?.jsonPrimitive?.intOrNull
            val items = root["items"]?.jsonArray ?: break

            if (items.isEmpty()) {
                isComplete = true
                break
            }

            for (item in items) {
                val obj = item.jsonObject
                // Tracks can be null (e.g., local files or removed items)
                val trackObj = obj["track"]?.jsonObject ?: continue
                // Skip local-only or null tracks
                if (trackObj["id"]?.jsonPrimitive?.contentOrNull == null &&
                    trackObj["name"]?.jsonPrimitive?.contentOrNull == null) continue
                val trackTitle = trackObj["name"]?.jsonPrimitive?.contentOrNull?.trim() ?: continue
                if (trackTitle.isBlank()) continue

                val artists = trackObj["artists"]?.jsonArray?.mapNotNull {
                    it.jsonObject["name"]?.jsonPrimitive?.contentOrNull
                }?.filter { it.isNotBlank() }?.joinToString(", ").orEmpty()

                val durationMs = trackObj["duration_ms"]?.jsonPrimitive?.longOrNull

                result.add(
                    SpotifyTrack(
                        title = trackTitle,
                        artist = artists.replace("\u00A0", " ").trim(),
                        durationMs = durationMs,
                    )
                )
            }

            offset += items.size

            // Check if we've fetched everything
            val next = root["next"]?.jsonPrimitive?.contentOrNull
            if (next.isNullOrBlank()) {
                isComplete = true
                break
            }
            if (total != null && offset >= total) {
                isComplete = true
                break
            }
            if (items.size < limit) {
                isComplete = true
                break
            }
        }

        return FetchResult(result, isComplete = isComplete)
    }
}
