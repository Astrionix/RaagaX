package com.music.raaga.data.canvas

import com.music.raaga.data.DebugLog as Log
import com.music.raaga.data.Http
import com.music.raaga.data.settings.AppSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.util.Locale

/**
 * A handwritten signature image for an artist, served by a user-configured
 * artist-signature API.
 *
 * [imageUrl] is the served mirror URL when present, else the upstream
 * original_url. [aspect] is width over height for sizing without decode.
 */
data class ArtistSignature(
    val imageUrl: String,
    val aspect: Float,
    /** Lowercased asset format (`svg`, `png`, ...); "" when unknown. */
    val format: String = "",
)

/**
 * Name-keyed lookup against a custom base URL.
 */
object ArtistSignatureRepository {
    private val signatures = mutableMapOf<String, ArtistSignature?>()
    private val _updates = MutableStateFlow(0)
    val updates: StateFlow<Int> = _updates

    suspend fun get(artistName: String): ArtistSignature? = withContext(Dispatchers.IO) {
        if (!AppSettings.signatureApiEnabled.value) return@withContext null
        val baseUrl = AppSettings.signatureApiUrl.value.trim().trimEnd('/')
            .ifBlank { AppSettings.DEFAULT_SIGNATURE_API_URL }
        if (baseUrl.isBlank()) return@withContext null
        val key = artistName.normalized()
        if (key.isBlank()) return@withContext null

        synchronized(signatures) {
            if (signatures.containsKey(key)) return@withContext signatures[key]
        }

        val encoded = runCatching { URLEncoder.encode(artistName, "UTF-8") }.getOrNull() ?: return@withContext null
        val url = "$baseUrl/v1/artist/$encoded/signatures"
        val body = runCatching { fetch(url) }.getOrNull()
        val result = body?.let { parse(it) }

        synchronized(signatures) {
            signatures[key] = result
        }
        _updates.value++
        result
    }

    fun clear() {
        synchronized(signatures) {
            signatures.clear()
        }
        _updates.value++
    }

    fun isValidBaseUrl(url: String): Boolean =
        url.isNotBlank() && (url.startsWith("http://") || url.startsWith("https://"))

    suspend fun checkHealth(baseUrl: String): Boolean = withContext(Dispatchers.IO) {
        val url = baseUrl.trim().trimEnd('/') + "/v1/health"
        val request = Request.Builder().url(url).get().build()
        runCatching {
            Http.client.newCall(request).execute().use { response ->
                response.isSuccessful
            }
        }.getOrDefault(false)
    }

    internal fun parse(body: String): ArtistSignature? {
        val root = runCatching { JSONObject(body) }.getOrNull() ?: return null
        if (!root.has("signatures") && root.has("matches")) return null
        val signatures = root.optJSONArray("signatures") ?: return null
        var best: ArtistSignature? = null
        var bestScore = Int.MIN_VALUE
        var bestArea = -1L
        for (i in 0 until signatures.length()) {
            val sig = signatures.optJSONObject(i) ?: continue
            val url = extractUrl(sig) ?: continue
            val lowerUrl = url.lowercase(Locale.ROOT)
            if (lowerUrl.contains("logo") && !lowerUrl.contains("sig") && !lowerUrl.contains("autograph")) {
                continue
            }
            val score = rank(sig, url)
            val area = extractArea(sig)
            if (best == null || score > bestScore || (score == bestScore && area > bestArea)) {
                bestScore = score
                bestArea = area
                best = ArtistSignature(
                    imageUrl = url,
                    aspect = extractAspect(sig),
                    format = extractFormat(sig, url),
                )
            }
        }
        return best
    }

    private fun extractFormat(sig: JSONObject, url: String): String {
        sig.optJSONObject("asset")?.optString("format")?.lowercase(Locale.ROOT)
            ?.takeIf { it.isNotBlank() }?.let { return it }
        sig.optString("format").lowercase(Locale.ROOT)
            .takeIf { it.isNotBlank() }?.let { return it }
        return url.substringBefore('?').substringAfterLast('.', "").lowercase(Locale.ROOT)
    }

    private fun rank(sig: JSONObject, url: String): Int {
        val status = sig.optJSONObject("license")?.optString("status").orEmpty().lowercase(Locale.ROOT)
        val license = when (status) {
            "known" -> 2
            "requires_review" -> 1
            else -> 0
        }
        val formatScore = when (extractFormat(sig, url)) {
            "svg" -> 2
            "png" -> 1
            else -> 0
        }
        val verification = sig.optString("verification").lowercase(Locale.ROOT)
        val verificationScore = when (verification) {
            "artist_verified" -> 3
            "verified" -> 2
            "unverified" -> 1
            else -> 0
        }
        val panoramic = if (extractAspect(sig) >= 1.4f) 1 else 0
        return license * 1000 + formatScore * 100 + verificationScore * 10 + panoramic
    }

    private fun extractUrl(sig: JSONObject): String? {
        sig.optJSONObject("asset")?.optString("url")?.takeIf { it.startsWith("http") }?.let { return it }
        sig.optString("asset").takeIf { it.startsWith("http") }?.let { return it }
        sig.optString("url").takeIf { it.startsWith("http") }?.let { return it }
        sig.optString("original_url").takeIf { it.startsWith("http") }?.let { return it }
        sig.optString("originalUrl").takeIf { it.startsWith("http") }?.let { return it }
        return null
    }

    private fun extractAspect(sig: JSONObject): Float {
        val asset = sig.optJSONObject("asset")
        val w = sig.optInt("width").takeIf { it > 0 }
            ?: asset?.optInt("width")?.takeIf { it > 0 }
        val h = sig.optInt("height").takeIf { it > 0 }
            ?: asset?.optInt("height")?.takeIf { it > 0 }
        return if (w != null && h != null && h > 0) w.toFloat() / h else 2.5f
    }

    private fun extractArea(sig: JSONObject): Long {
        val asset = sig.optJSONObject("asset")
        val w = sig.optInt("width").takeIf { it > 0 }
            ?: asset?.optInt("width")?.takeIf { it > 0 } ?: return 0
        val h = sig.optInt("height").takeIf { it > 0 }
            ?: asset?.optInt("height")?.takeIf { it > 0 } ?: return 0
        return w.toLong() * h
    }

    private fun fetch(url: String): String? {
        val request = Request.Builder().url(url).get().build()
        Http.client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return null
            return response.body?.string()
        }
    }

    private fun String.normalized(): String =
        java.text.Normalizer.normalize(lowercase(Locale.ROOT), java.text.Normalizer.Form.NFD)
            .filter { it.isLetterOrDigit() }
}
