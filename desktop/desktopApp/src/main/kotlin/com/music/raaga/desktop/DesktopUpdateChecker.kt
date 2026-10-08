package com.music.raaga.desktop

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration




/**
 * Looks at the repo's "latest release" on GitHub once per launch and says whether it is newer
 * than the running build. The installer is not run from here: the dialog opens the asset in the
 * browser, so the user installs it the way they installed the first one.
 *
 * GitHub's "latest" skips pre-releases and drafts, so a `-beta` desktop build is only ever
 * nudged toward a published release.
 */
internal object DesktopUpdateChecker {

    data class UpdateInfo(
        val version: String,
        val releaseUrl: String,
        /** The installer for this platform, or null when the release has none. */
        val downloadUrl: String?,
        val notes: String?,
    )

    val currentVersion: String = System.getProperty("raaga.version")
        ?: "1.9.3"

    private const val LATEST_RELEASE_URL =
        "https://api.github.com/repos/Astrionix/RaagaX/releases/latest"

    private val json = Json { ignoreUnknownKeys = true }

    private val httpClient by lazy {
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build()
    }

    suspend fun check(): UpdateInfo? = withContext(Dispatchers.IO) {
        runCatching {
            val request = HttpRequest.newBuilder()
                .uri(URI.create(LATEST_RELEASE_URL))
                .header("User-Agent", "RaagaDesktop")
                .header("Accept", "application/vnd.github.v3+json")
                .timeout(Duration.ofSeconds(15))
                .GET()
                .build()

            val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() !in 200..299) return@runCatching null

            val root = json.parseToJsonElement(response.body()) as? JsonObject ?: return@runCatching null
            val tagName = root["tag_name"]?.jsonPrimitive?.contentOrNull ?: return@runCatching null
            val htmlUrl = root["html_url"]?.jsonPrimitive?.contentOrNull ?: return@runCatching null
            val notes = root["body"]?.jsonPrimitive?.contentOrNull
            val latest = tagName.removePrefix("v").trim()

            if (!isNewer(latest, currentVersion)) {
                return@runCatching null
            }

            val downloadUrl = findPlatformAssetUrl(root)
            UpdateInfo(
                version = latest,
                releaseUrl = htmlUrl,
                downloadUrl = downloadUrl,
                notes = notes,
            )
        }.getOrNull()
    }

    private fun findPlatformAssetUrl(release: JsonObject): String? {
        val os = System.getProperty("os.name").lowercase()
        val assets = release["assets"]?.jsonArray?.mapNotNull { it as? JsonObject } ?: return null

        val matchPredicate: (String) -> Boolean = when {
            os.contains("windows") || os.contains("win") -> { name ->
                name.endsWith("-windows-x64-setup.exe", ignoreCase = true) ||
                    name.endsWith(".exe", ignoreCase = true) ||
                    name.endsWith(".msi", ignoreCase = true)
            }
            os.contains("mac") -> { name ->
                name.endsWith(".dmg", ignoreCase = true) || name.endsWith(".pkg", ignoreCase = true)
            }
            else -> { name ->
                name.endsWith(".AppImage", ignoreCase = true) || name.endsWith(".deb", ignoreCase = true)
            }
        }

        return assets.firstOrNull { asset ->
            val name = asset["name"]?.jsonPrimitive?.contentOrNull.orEmpty()
            val state = asset["state"]?.jsonPrimitive?.contentOrNull
            (state == null || state == "uploaded") && matchPredicate(name)
        }?.get("browser_download_url")?.jsonPrimitive?.contentOrNull
    }



    private class Parsed(val parts: List<Int>, val preRelease: Boolean)

    private fun parse(raw: String): Parsed {
        val dash = raw.indexOf('-')
        val base = if (dash >= 0) raw.substring(0, dash) else raw
        return Parsed(base.split('.').map { it.toIntOrNull() ?: 0 }, dash >= 0)
    }

    /** Numeric comparison, with a `-betaN` build counted as older than the plain release it leads up to. */
    internal fun isNewer(latest: String, current: String): Boolean {
        val l = parse(latest)
        val c = parse(current)
        for (i in 0 until maxOf(l.parts.size, c.parts.size)) {
            val a = l.parts.getOrElse(i) { 0 }
            val b = c.parts.getOrElse(i) { 0 }
            if (a != b) return a > b
        }
        return c.preRelease && !l.preRelease
    }
}
