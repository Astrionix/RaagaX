package com.music.raaga.data.applemusic

import com.music.raaga.data.DebugLog as Log
import com.music.raaga.data.Http
import com.music.raaga.data.spotify.SpotifyPlaylistInfo
import com.music.raaga.data.spotify.SpotifyTrack
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import okhttp3.Request
import java.util.regex.Pattern

/**
 * Parses Apple Music playlist and album links, fetching track metadata without
 * requiring user authentication. Supports both public editorial playlists/albums
 * and user-shared playlists (pl.u-...).
 */
object AppleMusicParser {

    private const val TAG = "AppleMusicParser"
    private const val USER_AGENT =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/124.0.0.0 Safari/537.36"

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    // Matches: music.apple.com/{storefront?}/{playlist|album}/{optional-slug?}/{id}
    // Supports ids with hyphens (e.g. user playlists pl.u-XXXX), alphanumeric and periods.
    private val URL_REGEX = Pattern.compile(
        """(?:https?://)?(?:embed\.)?music\.apple\.com/(?:([a-z]{2,3})/)?(playlist|album)/(?:[^/]+/)?([a-zA-Z0-9.\-_]+)""",
        Pattern.CASE_INSENSITIVE,
    )

    private val JWT_REGEX = Regex("""eyJ[A-Za-z0-9\-_]{15,}\.[A-Za-z0-9\-_]{15,}\.[A-Za-z0-9\-_]{15,}""")

    data class ParsedTarget(
        val originalUrl: String,
        val storefront: String,
        val type: String,
        val id: String,
    )

    /**
     * Returns a [ParsedTarget] if [input] is a recognisable Apple Music URL, null otherwise.
     */
    suspend fun parseLink(input: String): ParsedTarget? = withContext(Dispatchers.IO) {
        val trimmed = input.trim()
        val matcher = URL_REGEX.matcher(trimmed)
        if (!matcher.find()) return@withContext null
        val storefront = matcher.group(1)?.lowercase() ?: "us"
        val type = matcher.group(2)?.lowercase() ?: return@withContext null
        val id = matcher.group(3) ?: return@withContext null
        ParsedTarget(trimmed, storefront, type, id)
    }

    /**
     * Fetches the full track list for [target] and returns it as a [SpotifyPlaylistInfo]
     * so the existing import flow (MainViewModel.importPlaylistFromSpotify) can handle it.
     */
    suspend fun fetchPlaylist(target: ParsedTarget): Result<SpotifyPlaylistInfo> =
        withContext(Dispatchers.IO) {
            runCatching {
                // 1. Fetch web page HTML. Try original URL first, then canonical fallbacks.
                val html = fetchPageHtml(target)

                // 2. User-shared playlists (pl.u-...) are NOT in the Catalog API and return 404
                //    there. Parse their tracks directly from the page HTML/embedded JSON.
                val isUserPlaylist = target.id.startsWith("pl.u-", ignoreCase = true)
                if (isUserPlaylist) {
                    Log.d(TAG, "Parsing user playlist directly from page HTML: ${target.id}")
                    return@runCatching parseFromPageHtml(html, target)
                }

                // 3. For catalog playlists and albums, try developer token + Catalog API
                //    for complete pagination. If no token or Catalog API 404s, fall back to page JSON.
                val devToken = runCatching { extractToken(html) }.getOrNull()
                if (devToken != null) {
                    Log.d(TAG, "Using Catalog API for ${target.id}")
                    val catalogResult = runCatching { fetchViaCatalogApi(target, devToken) }
                    if (catalogResult.isSuccess) {
                        return@runCatching catalogResult.getOrThrow()
                    }
                    Log.w(TAG, "Catalog API call failed (${catalogResult.exceptionOrNull()?.message}) — falling back to page HTML")
                }

                // Fallback: parse tracks from page HTML
                parseFromPageHtml(html, target)
            }
        }

    private fun fetchPageHtml(target: ParsedTarget): String {
        val urlsToTry = mutableListOf<String>()

        // 1. The original URL pasted by user (has the correct storefront and slug)
        if (target.originalUrl.startsWith("http", ignoreCase = true)) {
            // Strip tracking query params if needed
            val cleanUrl = target.originalUrl.split("?").first()
            urlsToTry.add(cleanUrl)
            urlsToTry.add(target.originalUrl)
        }

        // 2. Canonical web URL without slug
        urlsToTry.add("https://music.apple.com/${target.storefront}/${target.type}/${target.id}")

        // 3. Embed URL (handles user-shared playlists without login requirement)
        urlsToTry.add("https://embed.music.apple.com/${target.storefront}/${target.type}/${target.id}")

        var lastError: Exception? = null
        for (url in urlsToTry.distinct()) {
            try {
                val html = getHtml(url)
                if (html.isNotBlank() && (html.contains("serialized-server-data") || html.contains("application/ld+json"))) {
                    return html
                }
            } catch (e: Exception) {
                lastError = e
            }
        }

        throw lastError ?: IllegalStateException("Could not load Apple Music page for ${target.id}")
    }

    // ── Token extraction ─────────────────────────────────────────────────────

    private fun extractToken(html: String): String? {
        // Try directly from inline HTML
        JWT_REGEX.findAll(html).firstOrNull()?.value?.let { return it }

        // Find the main JS chunk URL referenced in the page and fetch it
        val jsSrcRegex = Regex("""<script[^>]+src="(/assets/[^"]*index[^"]*\.js)"""")
        val jsSrc = jsSrcRegex.find(html)?.groupValues?.getOrNull(1) ?: return null
        val jsUrl = "https://music.apple.com$jsSrc"
        return runCatching {
            val js = getHtml(jsUrl)
            JWT_REGEX.findAll(js).firstOrNull()?.value
        }.getOrNull()
    }

    // ── Catalog API path (for public editorial playlists/albums) ──────────────

    private fun fetchViaCatalogApi(target: ParsedTarget, token: String): SpotifyPlaylistInfo {
        val apiType = if (target.type == "album") "albums" else "playlists"
        val tracks = mutableListOf<SpotifyTrack>()
        var title = "Imported ${target.type.replaceFirstChar { it.uppercase() }}"
        var author: String? = null
        var coverArtUrl: String? = null

        val firstUrl = "https://api.music.apple.com/v1/catalog/${target.storefront}/$apiType/${target.id}?include=tracks&limit=100"
        val firstResponse = catalogGet(firstUrl, token)

        val dataItem = firstResponse["data"]?.jsonArray?.firstOrNull()?.jsonObject
            ?: throw IllegalStateException("Unexpected Apple Music API response structure")

        val attrs = dataItem["attributes"]?.jsonObject
        title = attrs?.get("name")?.jsonPrimitive?.contentOrNull ?: title
        author = attrs?.get("curatorName")?.jsonPrimitive?.contentOrNull
            ?: attrs?.get("artistName")?.jsonPrimitive?.contentOrNull

        attrs?.get("artwork")?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull?.let { url ->
            coverArtUrl = url.replace("{w}", "600").replace("{h}", "600").replace("{f}", "jpg")
        }

        val tracksRel = dataItem["relationships"]?.jsonObject?.get("tracks")?.jsonObject
        parseSongsInto(tracksRel?.get("data")?.jsonArray, tracks)

        // Paginate through remaining tracks
        var nextPath = tracksRel?.get("next")?.jsonPrimitive?.contentOrNull
        var page = 0
        while (!nextPath.isNullOrBlank() && page < 30) {
            val nextUrl = if (nextPath.startsWith("http")) nextPath
                         else "https://api.music.apple.com$nextPath"
            val nextResponse = runCatching { catalogGet(nextUrl, token) }.getOrNull() ?: break
            parseSongsInto(nextResponse["data"]?.jsonArray, tracks)
            nextPath = nextResponse["next"]?.jsonPrimitive?.contentOrNull
            page++
        }

        if (tracks.isEmpty()) throw IllegalStateException("No tracks found in Apple Music catalog")

        return SpotifyPlaylistInfo(
            id = target.id,
            type = target.type,
            title = title,
            author = author,
            coverArtUrl = coverArtUrl,
            tracks = tracks,
        )
    }

    private fun catalogGet(url: String, token: String): JsonObject {
        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/json")
            .header("Origin", "https://music.apple.com")
            .header("Referer", "https://music.apple.com/")
            .build()

        val body = Http.client.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) throw IllegalStateException("Apple Catalog API HTTP ${resp.code}")
            resp.body.string()
        }
        return json.parseToJsonElement(body).jsonObject
    }

    // ── Page HTML Parsing (Works for all playlists, user playlists, albums) ──

    private fun parseFromPageHtml(html: String, target: ParsedTarget): SpotifyPlaylistInfo {
        val tracks = mutableListOf<SpotifyTrack>()
        var title = "Imported Playlist"
        var author: String? = null
        var coverArtUrl: String? = null

        // 1. Try serialized-server-data script tag (attributes may be in any order)
        val serverDataRegex = Regex("""<script[^>]*id=["']serialized-server-data["'][^>]*>([\s\S]*?)</script>""")
        val scriptContent = serverDataRegex.find(html)?.groupValues?.getOrNull(1)

        if (!scriptContent.isNullOrBlank()) {
            runCatching {
                val root = json.parseToJsonElement(scriptContent)
                val sections = root.jsonObject["data"]?.jsonArray
                    ?.firstOrNull()?.jsonObject
                    ?.get("data")?.jsonObject
                    ?.get("sections")?.jsonArray

                sections?.forEach { secEl ->
                    val sec = secEl.jsonObject
                    val secId = sec["id"]?.jsonPrimitive?.contentOrNull.orEmpty()

                    // Header section: get title, author, artwork
                    if (secId.contains("header", ignoreCase = true)) {
                        val headerItems = sec["items"]?.jsonArray
                        val firstItem = headerItems?.firstOrNull()?.jsonObject
                        if (firstItem != null) {
                            firstItem["title"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }?.let { title = it }
                            firstItem["quaternaryTitle"]?.jsonPrimitive?.contentOrNull?.let { author = it }
                            if (author == null) {
                                firstItem["artistName"]?.jsonPrimitive?.contentOrNull?.let { author = it }
                            }
                            firstItem["artwork"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull?.let { url ->
                                coverArtUrl = url.replace("{w}", "600").replace("{h}", "600").replace("{f}", "jpg")
                            }
                        }
                    }

                    // Track list section: extract songs
                    if (secId.contains("track-list", ignoreCase = true)) {
                        val items = sec["items"]?.jsonArray
                        items?.forEach { itemEl ->
                            val item = itemEl.jsonObject
                            val songTitle = item["title"]?.jsonPrimitive?.contentOrNull?.trim()
                            if (!songTitle.isNullOrBlank()) {
                                var songArtist = item["artistName"]?.jsonPrimitive?.contentOrNull?.trim()
                                if (songArtist.isNullOrBlank()) {
                                    val subLinks = item["subtitleLinks"]?.jsonArray
                                    songArtist = subLinks?.firstOrNull()?.jsonObject?.get("title")?.jsonPrimitive?.contentOrNull?.trim()
                                }
                                val duration = item["duration"]?.jsonPrimitive?.longOrNull
                                tracks.add(SpotifyTrack(songTitle, songArtist.orEmpty(), duration))
                            }
                        }
                    }
                }
            }
        }

        // 2. Fallback: Schema.org application/ld+json
        if (tracks.isEmpty()) {
            val ldRegex = Regex("""<script[^>]*type=["']application/ld\+json["'][^>]*>([\s\S]*?)</script>""")
            ldRegex.findAll(html).forEach { match ->
                val content = match.groupValues.getOrNull(1) ?: return@forEach
                runCatching {
                    val root = json.parseToJsonElement(content).jsonObject
                    val type = root["@type"]?.jsonPrimitive?.contentOrNull
                    if (type == "MusicPlaylist" || type == "MusicAlbum") {
                        root["name"]?.jsonPrimitive?.contentOrNull?.let { title = it }
                        val authorObj = root["author"]?.jsonObject ?: root["byArtist"]?.jsonObject
                        authorObj?.get("name")?.jsonPrimitive?.contentOrNull?.let { author = it }

                        val trackArray = root["track"]?.jsonArray
                        trackArray?.forEach { trEl ->
                            val tr = trEl.jsonObject
                            val name = tr["name"]?.jsonPrimitive?.contentOrNull?.trim()
                            if (!name.isNullOrBlank()) {
                                tracks.add(SpotifyTrack(name, author.orEmpty(), null))
                            }
                        }
                    }
                }
            }
        }

        if (tracks.isEmpty()) {
            throw IllegalStateException("No tracks found in Apple Music link. Please ensure the link is public.")
        }

        return SpotifyPlaylistInfo(
            id = target.id,
            type = target.type,
            title = title,
            author = author,
            coverArtUrl = coverArtUrl,
            tracks = tracks,
            isPartial = false,
        )
    }

    private fun parseSongsInto(dataArray: JsonArray?, into: MutableList<SpotifyTrack>) {
        dataArray?.forEach { element ->
            val obj = (element as? JsonObject) ?: return@forEach
            val attrs = obj["attributes"]?.jsonObject ?: return@forEach
            val name = attrs["name"]?.jsonPrimitive?.contentOrNull?.trim() ?: return@forEach
            if (name.isBlank()) return@forEach
            val artist = attrs["artistName"]?.jsonPrimitive?.contentOrNull?.trim().orEmpty()
            val dur = attrs["durationInMillis"]?.jsonPrimitive?.longOrNull
            into.add(SpotifyTrack(name, artist, dur))
        }
    }

    private fun getHtml(url: String): String {
        val request = Request.Builder()
            .url(url)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .header("Accept-Language", "en-US,en;q=0.9")
            .build()
        return Http.client.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) throw IllegalStateException("HTTP ${resp.code} for $url")
            resp.body.string()
        }
    }

    /** Returns true if [input] looks like an Apple Music URL. */
    fun looksLikeAppleMusicUrl(input: String): Boolean =
        input.contains("music.apple.com", ignoreCase = true)
}
