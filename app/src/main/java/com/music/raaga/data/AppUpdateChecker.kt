package com.music.raaga.data

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import android.widget.Toast
import com.music.raaga.R
import com.music.raaga.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Request
import java.io.File

/**
 * Raaga ships as a sideloaded APK off GitHub Releases rather than through
 * a store, so there's nothing to push an update notice on its own — this
 * polls the repo's releases and compares against the running build.
 *
 * Isolated to Android APK assets only: Desktop releases (exe/dmg/AppImage)
 * are completely ignored so mobile users are never prompted for desktop updates.
 */
object AppUpdateChecker {

    data class UpdateInfo(
        val version: String,
        val releaseUrl: String,
        val apkUrl: String?,
        /** The release's own Markdown body, shown as this update's "what's new". */
        val notes: String?,
    )

    sealed interface CheckResult {
        data class UpdateAvailable(val info: UpdateInfo) : CheckResult
        data class UpToDate(val version: String, val info: UpdateInfo?) : CheckResult
        data class Error(val message: String) : CheckResult
    }

    private const val CACHE_SUBDIR = "updates"

    private const val RELEASES_URL =
        "https://api.github.com/repos/Astrionix/RaagaX/releases"

    private val json = Json { ignoreUnknownKeys = true }

    private val _available = MutableStateFlow<UpdateInfo?>(null)
    val available = _available.asStateFlow()

    /** Where this update's APK download currently stands, for the dialog's progress row. */
    sealed interface DownloadState {
        data object Idle : DownloadState
        data class Downloading(val fraction: Float) : DownloadState
        data class Ready(val file: File) : DownloadState
        data class Failed(val message: String) : DownloadState
    }

    private val _download = MutableStateFlow<DownloadState>(DownloadState.Idle)
    val download = _download.asStateFlow()

    /** Set from the UI thread when the user cancels; polled between network reads. */
    @Volatile
    private var downloadCancelled = false

    suspend fun check(force: Boolean = false): CheckResult = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder()
                .url(RELEASES_URL)
                .header("User-Agent", "RaagaX-Android")
                .header("Accept", "application/vnd.github.v3+json")
                .build()
            val body = Http.client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) null else response.body?.string()
            } ?: return@runCatching CheckResult.Error("Network error: failed to fetch release")

            val jsonElement = json.parseToJsonElement(body)
            val releases = (jsonElement as? JsonArray)?.mapNotNull { it as? JsonObject }
                ?: listOfNotNull(jsonElement as? JsonObject)

            // Strictly filter for releases that actually contain an Android APK
            val candidate = releases.firstNotNullOfOrNull { release ->
                val tag = release["tag_name"]?.jsonPrimitive?.contentOrNull ?: return@firstNotNullOfOrNull null
                val url = release["html_url"]?.jsonPrimitive?.contentOrNull ?: return@firstNotNullOfOrNull null
                val notes = release["body"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
                    ?: "Raaga 1.9.7: Liquid Glass Audio Output Sheet, Windows Taskbar & macOS Dock preservation. Download latest at raaga.me"
                val latest = tag.removePrefix("v")
                val apkUrl = apkAssetUrl(release) ?: return@firstNotNullOfOrNull null
                if (!isNewer(latest, BuildConfig.VERSION_NAME) && !force) return@firstNotNullOfOrNull null
                UpdateInfo(latest, url, apkUrl, notes)
            }

            if (candidate != null) {
                _available.value = candidate
                CheckResult.UpdateAvailable(candidate)
            } else {
                _available.value = null
                CheckResult.UpToDate(BuildConfig.VERSION_NAME, null)
            }
        }.getOrElse { error ->
            CheckResult.Error(error.message ?: "Failed to check for updates")
        }
    }

    /**
     * Wipes any APK left over from a previous run. Called once at cold start
     * so a downloaded update is only ever "Install Now" for the session that
     * downloaded it — the next launch starts clean rather than trying to work
     * out whether a leftover file is still good.
     */
    suspend fun clearCache(context: Context) = withContext(Dispatchers.IO) {
        File(context.cacheDir, CACHE_SUBDIR).listFiles()?.forEach { it.delete() }
    }

    /**
     * Pick the best `.apk` asset matching the current build's flavor (dev vs prod)
     * and the device's CPU architecture (e.g. arm64-v8a or universal).
     */
    private fun apkAssetUrl(release: JsonObject): String? = runCatching {
        val assets = release["assets"]?.jsonArray
            ?.mapNotNull { it as? JsonObject }
            ?.filter { asset ->
                asset["name"]?.jsonPrimitive?.contentOrNull?.endsWith(".apk", ignoreCase = true) == true &&
                    asset["state"]?.jsonPrimitive?.contentOrNull == "uploaded"
            } ?: emptyList()

        if (assets.isEmpty()) return null

        val isDevFlavor = BuildConfig.APPLICATION_ID.contains("dev")
        val supportedAbis = Build.SUPPORTED_ABIS.map { it.lowercase() }

        fun score(name: String): Int {
            val lower = name.lowercase()
            var s = 0
            if (isDevFlavor && lower.contains("dev")) s += 100
            if (!isDevFlavor && !lower.contains("dev")) s += 100
            for ((idx, abi) in supportedAbis.withIndex()) {
                if (lower.contains(abi)) {
                    s += (50 - idx * 5).coerceAtLeast(10)
                    break
                }
            }
            if (lower.contains("universal")) s += 30
            if (!isDevFlavor && lower.contains("release")) s += 10
            return s
        }

        assets.maxByOrNull { asset ->
            score(asset["name"]?.jsonPrimitive?.contentOrNull.orEmpty())
        }?.get("browser_download_url")?.jsonPrimitive?.contentOrNull
    }.getOrNull()

    /**
     * Streams the current update's APK into the app cache, reporting progress
     * through [download]. A finished file survives a cancelled dialog: until
     * the state is reset, "Install Now" comes straight back without a second
     * download.
     */
    suspend fun downloadApk(context: Context): Unit = withContext(Dispatchers.IO) {
        val info = _available.value ?: return@withContext
        val url = info.apkUrl ?: return@withContext
        downloadCancelled = false
        _download.value = DownloadState.Downloading(0f)

        runCatching {
            val dir = File(context.cacheDir, CACHE_SUBDIR).apply { mkdirs() }
            // Drop anything left over from an earlier attempt.
            dir.listFiles()?.forEach { it.delete() }
            val target = File(dir, "raaga-${info.version}.apk")

            val request = Request.Builder().url(url).build()
            Http.client.newCall(request).execute().use { response ->
                check(response.isSuccessful) { "Download failed: HTTP ${response.code}" }
                val body = response.body ?: error("Empty download body")
                val total = body.contentLength().takeIf { it > 0 }

                body.byteStream().use { input ->
                    target.outputStream().use { output ->
                        val buffer = ByteArray(64 * 1024)
                        var readTotal = 0L
                        while (true) {
                            if (downloadCancelled) {
                                _download.value = DownloadState.Idle
                                return@withContext
                            }
                            val read = input.read(buffer)
                            if (read == -1) break
                            output.write(buffer, 0, read)
                            readTotal += read
                            total?.let {
                                _download.value =
                                    DownloadState.Downloading((readTotal.toFloat() / it).coerceIn(0f, 1f))
                            }
                        }
                    }
                }
            }
            _download.value = DownloadState.Ready(target)
        }.onFailure { error ->
            _download.value = if (downloadCancelled) {
                DownloadState.Idle
            } else {
                DownloadState.Failed(error.message ?: "Download failed")
            }
        }
    }

    /** Stops an in-flight download; the next read loop sees this and bails. */
    fun cancelDownload() {
        downloadCancelled = true
    }

    /** Back to square one after a failure, so the dialog offers Download again. */
    fun resetDownload() {
        _download.value = DownloadState.Idle
    }

    /**
     * Hands a downloaded APK to the system installer.
     *
     * Sideloaded apps need the user's blessing per app ("install unknown apps");
     * without it the installer intent silently does nothing on most ROMs, so
     * the user is sent to that one switch first and taps Install again after.
     */
    fun installApk(context: Context, file: File) {
        if (!file.exists() || file.length() == 0L) {
            resetDownload()
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !context.packageManager.canRequestPackageInstalls()
        ) {
            try {
                Toast.makeText(
                    context,
                    context.getString(R.string.allow_install_unknown_apps),
                    Toast.LENGTH_LONG,
                ).show()
                context.startActivity(
                    Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                        .setData(Uri.parse("package:${context.packageName}"))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
            } catch (_: Exception) {
                try {
                    context.startActivity(
                        Intent(Settings.ACTION_SECURITY_SETTINGS)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    )
                } catch (_: Exception) {
                }
            }
            return
        }

        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val installIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        val resInfoList = context.packageManager.queryIntentActivities(
            installIntent,
            PackageManager.MATCH_DEFAULT_ONLY,
        )
        for (resolveInfo in resInfoList) {
            val packageName = resolveInfo.activityInfo.packageName
            context.grantUriPermission(
                packageName,
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION,
            )
        }

        try {
            context.startActivity(installIntent)
        } catch (_: Exception) {
            try {
                context.startActivity(
                    Intent(Intent.ACTION_INSTALL_PACKAGE)
                        .setDataAndType(uri, "application/vnd.android.package-archive")
                        .putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
                        .putExtra(Intent.EXTRA_RETURN_RESULT, true)
                        .addFlags(
                            Intent.FLAG_GRANT_READ_URI_PERMISSION or
                                Intent.FLAG_ACTIVITY_NEW_TASK,
                        ),
                )
            } catch (_: Exception) {
            }
        }
    }

    /** A version split into its numeric dotted parts and whether it carries a "-suffix" (e.g. "-beta2"). */
    private data class ParsedVersion(val parts: List<Int>, val isPreRelease: Boolean)

    private fun parseVersion(raw: String): ParsedVersion {
        val dash = raw.indexOf('-')
        val base = if (dash >= 0) raw.substring(0, dash) else raw
        return ParsedVersion(base.split(".").map { it.toIntOrNull() ?: 0 }, dash >= 0)
    }

    /**
     * Numeric, dot-separated comparison — "1.10" outranks "1.9" — with one
     * extra rule: a "-betaN" build (see the debug build type's
     * `versionNameSuffix` in app/build.gradle.kts) is treated as older than a
     * plain release of the same numbers, since the beta by definition predates
     * the tag it was testing toward. Without this, a beta and the release it
     * matches compare equal and testers never get nudged onto the real build.
     */
    private fun isNewer(latest: String, current: String): Boolean {
        val l = parseVersion(latest)
        val c = parseVersion(current)
        for (i in 0 until maxOf(l.parts.size, c.parts.size)) {
            val a = l.parts.getOrElse(i) { 0 }
            val b = c.parts.getOrElse(i) { 0 }
            if (a != b) return a > b
        }
        return c.isPreRelease && !l.isPreRelease
    }
}
