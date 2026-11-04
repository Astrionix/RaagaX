package com.music.raaga.data

import com.music.raaga.data.innertube.Innertube
import com.music.raaga.data.innertube.InnertubeParser
import com.music.raaga.data.model.Song
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import okhttp3.Request
import org.jsoup.Jsoup
import java.text.DecimalFormatSymbols
import java.time.LocalDate

data class CreditContributor(
    val name: String,
    val roles: List<String>,
    val artistId: String? = null,
)

data class SongCredits(
    val mainArtist: CreditContributor? = null,
    val featuredArtists: List<CreditContributor> = emptyList(),
    val compositionAndLyrics: List<CreditContributor> = emptyList(),
    val production: List<CreditContributor> = emptyList(),
    val engineering: List<CreditContributor> = emptyList(),
    val musicians: List<CreditContributor> = emptyList(),
    val label: String? = null,
    val copyright: String? = null,
    val publisher: String? = null,
    val releaseDate: String? = null,
)

data class SongInfo(
    val album: String? = null,
    val releaseYear: String? = null,
    val releaseDate: String? = null,
    val views: String? = null,
    val likes: String? = null,
    val comments: String? = null,
    val credits: SongCredits? = null,
    val failed: Boolean = false,
)

/**
 * YouTube-style short form of a raw count: 950 -> "950", 1234 -> "1.2K",
 * 100000 -> "100K", 2345678 -> "2.3M". Truncated rather than rounded, as YouTube
 * does, so 999999 never shows as "1000K". Text that isn't a plain number is
 * returned unchanged.
 */
fun compactCount(raw: String): String {
    val n = raw.toLongOrNull()?.takeIf { it >= 0 } ?: return raw
    val (unit, suffix) = when {
        n >= 1_000_000_000 -> 1_000_000_000L to "B"
        n >= 1_000_000 -> 1_000_000L to "M"
        n >= 1_000 -> 1_000L to "K"
        else -> return n.toString()
    }
    val whole = n / unit
    if (whole >= 10) return "$whole$suffix"
    val tenth = n % unit * 10 / unit
    val separator = DecimalFormatSymbols.getInstance().decimalSeparator
    return if (tenth == 0L) "$whole$suffix" else "$whole$separator$tenth$suffix"
}

/** Loaded only when requested. Counts belong to this exact upload, never a search match. */
object SongInfoRepository {

    suspend fun load(song: Song): SongInfo = withContext(Dispatchers.IO) {
        if (song.localUri != null || !Regex("[A-Za-z0-9_-]{11}").matches(song.videoId)) {
            val credits = SongCreditsParser.parse(null, song)
            return@withContext SongInfo(album = song.albumName, credits = credits)
        }
        val statistics = async {
            attempt {
                val url = "https://www.youtube.com/watch?v=${song.videoId}&hl=${Innertube.currentLanguage}"
                val request = Request.Builder()
                    .url(url)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
                    // Without a consent answer an EU request is redirected to
                    // consent.youtube.com, whose page has no player response.
                    // SOCS=CAI is "reject all": it answers the question and
                    // opts into nothing.
                    .header("Cookie", "SOCS=CAI")
                    .build()

                val html = Http.client.newCall(request).execute().use { response ->
                    check(response.isSuccessful) { "HTTP ${response.code}" }
                    response.body?.string().orEmpty()
                }
                SongInfoParser.parse(html, song.videoId, song)
            }
        }
        var album = song.albumName
        var year: String? = null
        val release = attempt {
            val linked = if (song.albumId == null) {
                YtMusicRepository.trackLinks(song.videoId).getOrThrow()
            } else song
            album = album ?: linked.albumName
            linked.albumId?.let { id ->
                val header = InnertubeParser.parseBrowseHeader(Innertube.browse(id))
                album = album ?: header?.title
                year = header?.subtitle?.split(' ')?.map { it.trim() }
                    ?.firstOrNull { it.matches(Regex("(?:19|20)[0-9]{2}")) }
            }
        }
        val baseInfo = statistics.await().getOrNull() ?: SongInfo(failed = true)
        val finalCredits = baseInfo.credits ?: SongCreditsParser.parse(null, song)
        baseInfo.copy(
            album = album,
            releaseYear = year,
            credits = finalCredits,
        ).let { it.copy(failed = it.failed || release.isFailure) }
    }

    private suspend fun <T> attempt(block: suspend () -> T): Result<T> = try {
        Result.success(block())
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        Result.failure(e)
    }
}

internal object SongInfoParser {
    fun parse(html: String, videoId: String, song: Song? = null): SongInfo {
        val scripts = Jsoup.parse(html).select("script").map { it.data() }
        val player = scripts.firstNotNullOfOrNull { extract(it, "ytInitialPlayerResponse") }
            ?: error("Missing player metadata")
        val details = player.obj("videoDetails")
        check(details.str("videoId") == videoId) { "Metadata belongs to another track" }
        val data = scripts.firstNotNullOfOrNull { extract(it, "ytInitialData") }
        // Only the current video's primary renderer: recommendations also carry counts.
        val primary = data?.find("videoPrimaryInfoRenderer")?.firstOrNull()
        val oldLike = primary?.find("toggleButtonRenderer")?.firstOrNull {
            it.obj("defaultIcon").str("iconType") == "LIKE"
        }?.get("defaultText")?.text()
        val newLike = primary?.find("likeButtonViewModel")?.firstOrNull()
            ?.find("buttonViewModel")?.firstOrNull()?.str("title")
        val comments = data?.find("commentsHeaderRenderer")?.firstNotNullOfOrNull {
            it["countText"]?.text()?.withCount()
        }
            ?: data?.find("commentsEntryPointHeaderRenderer")?.firstOrNull()
                ?.get("commentCount")?.text()?.withCount()
            ?: data?.find("engagementPanelSectionListRenderer")?.firstOrNull {
                it.str("targetId") == "engagement-panel-comments-section" ||
                    it.str("panelIdentifier") == "engagement-panel-comments-section"
            }?.find("engagementPanelTitleHeaderRenderer")?.firstOrNull()
                ?.get("contextualInfo")?.text()?.withCount()
        val description = details.str("shortDescription")
        val credits = if (song != null) SongCreditsParser.parse(description, song) else null
        return SongInfo(
            releaseDate = releaseDate(description),
            views = details.str("viewCount")?.takeIf { it.toLongOrNull()?.let { n -> n >= 0 } == true },
            likes = (newLike ?: oldLike)?.withCount(),
            comments = comments,
            credits = credits,
            failed = data == null,
        )
    }

    /** Catalogue uploads explicitly state this in their description. Upload/publish dates
     * describe the video and must never substitute for a recording's release date. */
    private fun releaseDate(description: String?): String? {
        val date = description?.lineSequence()?.firstNotNullOfOrNull { line ->
            Regex("Released on:\\s*(\\d{4}-\\d{2}-\\d{2})", RegexOption.IGNORE_CASE)
                .matchEntire(line.trim())?.groupValues?.get(1)
        } ?: return null
        return runCatching { LocalDate.parse(date).toString() }.getOrNull()
    }

    /** Balanced JSON extraction tolerates braces inside titles and trailing script statements. */
    private fun extract(script: String, name: String): JsonObject? {
        val assignment = Regex("(?:var\\s+)?${name}\\s*=\\s*").find(script) ?: return null
        val start = assignment.range.last + 1
        if (script.getOrNull(start) != '{') return null
        var depth = 0
        var quoted = false
        var escaped = false
        for (i in start until script.length) {
            val c = script[i]
            if (quoted) {
                if (escaped) escaped = false
                else if (c == '\\') escaped = true
                else if (c == '"') quoted = false
            } else when (c) {
                '"' -> quoted = true
                '{' -> depth++
                '}' -> if (--depth == 0) return runCatching {
                    Json.parseToJsonElement(script.substring(start, i + 1)) as? JsonObject
                }.getOrNull()
            }
        }
        return null
    }

    private fun JsonObject.obj(key: String) = this[key] as? JsonObject ?: JsonObject(emptyMap())
    private fun JsonObject.str(key: String) = (this[key] as? JsonPrimitive)?.contentOrNull
    private fun String.withCount(): String? = takeIf { it.any(Char::isDigit) }
    private fun JsonElement.text(): String? = (this as? JsonObject)?.let {
        it.str("simpleText") ?: (it["runs"] as? JsonArray)?.joinToString("") { run ->
            (run as? JsonObject)?.str("text").orEmpty()
        }
    }?.takeIf { it.isNotBlank() }
    private fun JsonElement.find(key: String): List<JsonObject> = when (this) {
        is JsonObject -> listOfNotNull(this[key] as? JsonObject) + values.flatMap { it.find(key) }
        is JsonArray -> flatMap { it.find(key) }
        else -> emptyList()
    }
}

internal object SongCreditsParser {
    private val ARTIST_SPLIT_REGEX = Regex(""",\s*|\s*&\s*|\s+(?:feat\.?|ft\.?|with|x)\s+""", RegexOption.IGNORE_CASE)

    fun splitArtists(raw: String): List<String> =
        raw.split(ARTIST_SPLIT_REGEX).map { it.trim() }.filter { it.isNotBlank() }

    fun parse(description: String?, song: Song): SongCredits {
        val artists = splitArtists(song.artist)
        val mainArtistName = artists.firstOrNull() ?: song.artist.ifBlank { "Unknown Artist" }
        val main = CreditContributor(
            name = mainArtistName,
            roles = listOf("Main Artist"),
            artistId = song.artistId,
        )
        val featured = artists.drop(1).map {
            CreditContributor(name = it, roles = listOf("Featured Artist"))
        }

        if (description.isNullOrBlank()) {
            return SongCredits(
                mainArtist = main,
                featuredArtists = featured,
                releaseDate = null,
            )
        }

        var label: String? = null
        var copyright: String? = null
        var publisher: String? = null
        var releaseDate: String? = null

        val compositionMap = linkedMapOf<String, MutableSet<String>>()
        val productionMap = linkedMapOf<String, MutableSet<String>>()
        val engineeringMap = linkedMapOf<String, MutableSet<String>>()
        val musiciansMap = linkedMapOf<String, MutableSet<String>>()

        for (line in description.lineSequence().map { it.trim() }.filter { it.isNotBlank() }) {
            when {
                line.startsWith("Provided to YouTube by", ignoreCase = true) -> {
                    label = line.substringAfter("Provided to YouTube by").trim()
                }
                line.startsWith("℗") || line.startsWith("©") || line.startsWith("(P)") || line.startsWith("(C)") -> {
                    copyright = line
                }
                line.startsWith("Released on:", ignoreCase = true) -> {
                    releaseDate = line.substringAfter("Released on:").trim()
                }
                line.startsWith("Published by", ignoreCase = true) -> {
                    publisher = line.substringAfter("Published by").trim()
                }
                line.contains(":") -> {
                    val colonIdx = line.indexOf(':')
                    val rolePart = line.substring(0, colonIdx).trim()
                    val namePart = line.substring(colonIdx + 1).trim()
                    if (rolePart.isNotBlank() && namePart.isNotBlank() && !rolePart.contains("http", ignoreCase = true)) {
                        val names = namePart.split(',', ';', '·', '/').map { it.trim() }.filter { it.isNotBlank() }
                        val roles = rolePart.split(',', ';', '/').map { it.trim() }.filter { it.isNotBlank() }
                        for (name in names) {
                            for (role in roles) {
                                val lower = role.lowercase()
                                when {
                                    lower.contains("composer") || lower.contains("lyricist") ||
                                        lower.contains("songwriter") || lower.contains("written by") ||
                                        lower.contains("author") -> {
                                        compositionMap.getOrPut(name) { linkedSetOf() }.add(role)
                                    }
                                    lower.contains("producer") -> {
                                        productionMap.getOrPut(name) { linkedSetOf() }.add(role)
                                    }
                                    lower.contains("engineer") || lower.contains("mixer") ||
                                        lower.contains("mix") || lower.contains("master") ||
                                        lower.contains("recording") || lower.contains("studio personnel") -> {
                                        engineeringMap.getOrPut(name) { linkedSetOf() }.add(role)
                                    }
                                    lower.contains("performer") || lower.contains("vocal") ||
                                        lower.contains("guitar") || lower.contains("bass") ||
                                        lower.contains("drum") || lower.contains("keyboard") ||
                                        lower.contains("piano") || lower.contains("strings") ||
                                        lower.contains("instrument") || lower.contains("flute") ||
                                        lower.contains("percussion") -> {
                                        musiciansMap.getOrPut(name) { linkedSetOf() }.add(role)
                                    }
                                    else -> {
                                        compositionMap.getOrPut(name) { linkedSetOf() }.add(role)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return SongCredits(
            mainArtist = main,
            featuredArtists = featured,
            compositionAndLyrics = compositionMap.map { (name, roles) -> CreditContributor(name, roles.toList()) },
            production = productionMap.map { (name, roles) -> CreditContributor(name, roles.toList()) },
            engineering = engineeringMap.map { (name, roles) -> CreditContributor(name, roles.toList()) },
            musicians = musiciansMap.map { (name, roles) -> CreditContributor(name, roles.toList()) },
            label = label,
            copyright = copyright,
            publisher = publisher,
            releaseDate = releaseDate,
        )
    }
}
