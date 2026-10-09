package com.music.raaga.desktop

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.io.FileOutputStream
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

/**
 * Handles checking, in-app downloading, and installing OTA updates for Desktop.
 *
 * Isolated to desktop assets only (.exe / .msi / .dmg / .AppImage). Mobile APK releases
 * are completely ignored so desktop is never disturbed by mobile updates.
 */
internal object DesktopUpdateChecker {

    sealed interface DownloadState {
        object Idle : DownloadState
        data class Downloading(val progress: Float, val downloadedBytes: Long, val totalBytes: Long) : DownloadState
        data class Ready(val file: File, val version: String) : DownloadState
        data class Failed(val message: String) : DownloadState
    }

    data class UpdateInfo(
        val version: String,
        val releaseUrl: String,
        val downloadUrl: String?,
        val notes: String?,
        val fileName: String? = null,
    )

    val currentVersion: String = System.getProperty("raaga.version") ?: "1.9.6"

    private const val RELEASES_URL =
        "https://api.github.com/repos/Astrionix/RaagaX/releases"

    private val json = Json { ignoreUnknownKeys = true }

    private val httpClient by lazy {
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build()
    }

    private val _downloadState = MutableStateFlow<DownloadState>(DownloadState.Idle)
    val downloadState: StateFlow<DownloadState> = _downloadState.asStateFlow()

    private var downloadJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO)

    suspend fun check(): UpdateInfo? = withContext(Dispatchers.IO) {
        runCatching {
            val request = HttpRequest.newBuilder()
                .uri(URI.create(RELEASES_URL))
                .header("User-Agent", "RaagaDesktop")
                .header("Accept", "application/vnd.github.v3+json")
                .timeout(Duration.ofSeconds(15))
                .GET()
                .build()

            val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() !in 200..299) return@runCatching null

            val jsonElement = json.parseToJsonElement(response.body())
            val releases = (jsonElement as? JsonArray)?.mapNotNull { it as? JsonObject }
                ?: listOfNotNull(jsonElement as? JsonObject)

            // Strictly filter for releases that have a desktop binary for this platform
            val candidate = releases.firstNotNullOfOrNull { release ->
                val tagName = release["tag_name"]?.jsonPrimitive?.contentOrNull ?: return@firstNotNullOfOrNull null
                val htmlUrl = release["html_url"]?.jsonPrimitive?.contentOrNull ?: return@firstNotNullOfOrNull null
                val notes = release["body"]?.jsonPrimitive?.contentOrNull
                val latest = tagName.removePrefix("v").trim()
                if (!isNewer(latest, currentVersion)) return@firstNotNullOfOrNull null
                val asset = findPlatformAsset(release) ?: return@firstNotNullOfOrNull null
                UpdateInfo(
                    version = latest,
                    releaseUrl = htmlUrl,
                    downloadUrl = asset.first,
                    fileName = asset.second,
                    notes = notes,
                )
            }
            candidate
        }.getOrNull()
    }

    private fun findPlatformAsset(release: JsonObject): Pair<String, String>? {
        val os = System.getProperty("os.name").lowercase()
        val assets = release["assets"]?.jsonArray?.mapNotNull { it as? JsonObject } ?: return null

        val matchPredicate: (String) -> Boolean = when {
            os.contains("windows") || os.contains("win") -> { name ->
                name.endsWith("-windows-setup.msi", ignoreCase = true) ||
                    name.endsWith(".msi", ignoreCase = true) ||
                    name.endsWith("-windows-setup.exe", ignoreCase = true) ||
                    name.endsWith(".exe", ignoreCase = true)
            }
            os.contains("mac") -> { name ->
                name.endsWith(".dmg", ignoreCase = true) || name.endsWith(".pkg", ignoreCase = true)
            }
            else -> { name ->
                name.endsWith(".AppImage", ignoreCase = true) || name.endsWith(".deb", ignoreCase = true)
            }
        }

        val found = assets.firstOrNull { asset ->
            val name = asset["name"]?.jsonPrimitive?.contentOrNull.orEmpty()
            val state = asset["state"]?.jsonPrimitive?.contentOrNull
            (state == null || state == "uploaded") && matchPredicate(name)
        } ?: return null

        val url = found["browser_download_url"]?.jsonPrimitive?.contentOrNull ?: return null
        val name = found["name"]?.jsonPrimitive?.contentOrNull ?: "update-installer.exe"
        return url to name
    }

    fun startDownload(update: UpdateInfo) {
        val url = update.downloadUrl ?: return
        downloadJob?.cancel()
        _downloadState.value = DownloadState.Downloading(0f, 0L, 0L)

        downloadJob = scope.launch {
            try {
                val tempDir = File(System.getProperty("java.io.tmpdir"), "RaagaUpdates")
                tempDir.mkdirs()
                val targetFile = File(tempDir, update.fileName ?: "Raaga-Setup-${update.version}.exe")

                val request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "RaagaDesktop")
                    .timeout(Duration.ofMinutes(10))
                    .GET()
                    .build()

                val response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream())
                if (response.statusCode() !in 200..299) {
                    _downloadState.value = DownloadState.Failed("Server returned HTTP ${response.statusCode()}")
                    return@launch
                }

                val contentLength = response.headers().firstValueAsLong("Content-Length").orElse(0L)
                var downloaded = 0L

                response.body().use { input ->
                    FileOutputStream(targetFile).use { output ->
                        val buffer = ByteArray(64 * 1024)
                        var read: Int
                        var lastReportTime = System.currentTimeMillis()

                        while (input.read(buffer).also { read = it } != -1) {
                            output.write(buffer, 0, read)
                            downloaded += read

                            val now = System.currentTimeMillis()
                            if (now - lastReportTime > 150) {
                                val progress = if (contentLength > 0) downloaded.toFloat() / contentLength.toFloat() else 0f
                                _downloadState.value = DownloadState.Downloading(progress.coerceIn(0f, 1f), downloaded, contentLength)
                                lastReportTime = now
                            }
                        }
                    }
                }

                if (targetFile.exists() && targetFile.length() > 0) {
                    _downloadState.value = DownloadState.Ready(targetFile, update.version)
                } else {
                    _downloadState.value = DownloadState.Failed("Downloaded file is empty")
                }
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) {
                    _downloadState.value = DownloadState.Idle
                } else {
                    _downloadState.value = DownloadState.Failed(e.message ?: "Download failed")
                }
            }
        }
    }

    fun cancelDownload() {
        downloadJob?.cancel()
        downloadJob = null
        _downloadState.value = DownloadState.Idle
    }

    fun installUpdate(file: File) {
        try {
            val os = System.getProperty("os.name").lowercase()
            when {
                os.contains("win") -> {
                    val filePath = file.absolutePath
                    val cmd = if (file.name.endsWith(".msi", ignoreCase = true)) {
                        "timeout /t 2 /nobreak >nul & start \"\" msiexec /i \"$filePath\" MSIRESTARTMANAGERCONTROL=Disable"
                    } else {
                        "timeout /t 2 /nobreak >nul & start \"\" \"$filePath\""
                    }
                    ProcessBuilder("cmd.exe", "/c", cmd).start()
                }
                os.contains("mac") -> {
                    ProcessBuilder("open", file.absolutePath).start()
                }
                else -> {
                    file.setExecutable(true)
                    ProcessBuilder(file.absolutePath).start()
                }
            }
            kotlin.system.exitProcess(0)
        } catch (e: Exception) {
            _downloadState.value = DownloadState.Failed("Failed to launch installer: ${e.message}")
        }
    }

    private class Parsed(val parts: List<Int>, val preRelease: Boolean)

    private fun parse(raw: String): Parsed {
        val dash = raw.indexOf('-')
        val base = if (dash >= 0) raw.substring(0, dash) else raw
        return Parsed(base.split('.').map { it.toIntOrNull() ?: 0 }, dash >= 0)
    }

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
