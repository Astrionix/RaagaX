package com.music.raaga.data.canvas

import com.music.raaga.data.Http
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import okhttp3.Request
import java.net.URLEncoder
import java.util.Locale

/**
 * A handwritten signature image for an artist, served by a user-configured
 * or built-in artist-signature API.
 */
data class ArtistSignature(
    val imageUrl: String,
    val aspect: Float,
    val format: String = "",
)

object ArtistSignatureRepository {
    const val PRIMARY_SIGNATURE_API_URL = "https://proud-cascade-1654.de.deplexo.com"
    const val SECONDARY_SIGNATURE_API_URL = "https://yellow-king-f562.chandu3319r.workers.dev"

    val BUILTIN_SIGNATURE_ENDPOINTS = listOf(
        PRIMARY_SIGNATURE_API_URL,
        SECONDARY_SIGNATURE_API_URL,
    )

    private val json = Json { ignoreUnknownKeys = true }
    private val signatures = mutableMapOf<String, ArtistSignature?>()
    private val _updates = MutableStateFlow(0)
    val updates: StateFlow<Int> = _updates

    var enabled: Boolean = true

    suspend fun get(artistName: String, forceRefresh: Boolean = false): ArtistSignature? = withContext(Dispatchers.IO) {
        if (!enabled) return@withContext null
        val key = artistName.normalized()
        if (key.isBlank()) return@withContext null

        if (!forceRefresh) {
            synchronized(signatures) {
                if (signatures.containsKey(key)) return@withContext signatures[key]
            }
        }

        val encoded = runCatching { URLEncoder.encode(artistName, "UTF-8") }.getOrNull() ?: return@withContext null

        var result: ArtistSignature? = null
        for (baseUrl in BUILTIN_SIGNATURE_ENDPOINTS) {
            result = fetchSignatureFromBaseUrl(baseUrl, encoded)
            if (result != null) break
        }

        synchronized(signatures) {
            signatures[key] = result
        }
        _updates.value++
        result
    }

    private fun fetchSignatureFromBaseUrl(baseUrl: String, encodedArtist: String): ArtistSignature? {
        val cleanBase = baseUrl.trim().trimEnd('/')
        if (cleanBase.isBlank()) return null

        val candidateUrls = when {
            cleanBase.contains("deplexo.com") -> listOf("$cleanBase/v1/signatures?artist=$encodedArtist")
            cleanBase.contains("workers.dev") -> listOf("$cleanBase/v1/artist/$encodedArtist/signatures")
            else -> listOf(
                "$cleanBase/v1/signatures?artist=$encodedArtist",
                "$cleanBase/v1/artist/$encodedArtist/signatures",
            )
        }

        for (url in candidateUrls) {
            val body = runCatching { fetch(url) }.getOrNull() ?: continue
            val parsed = parse(body)
            if (parsed != null) return parsed
        }
        return null
    }

    fun clear() {
        synchronized(signatures) {
            signatures.clear()
        }
        _updates.value++
    }

    internal fun parse(body: String): ArtistSignature? {
        val root = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull() ?: return null
        val signaturesArray = root["signatures"] as? JsonArray ?: return null
        var best: ArtistSignature? = null
        var bestScore = Int.MIN_VALUE
        var bestArea = -1L

        for (el in signaturesArray) {
            val sig = el as? JsonObject ?: continue
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

    private fun extractFormat(sig: JsonObject, url: String): String {
        val assetFormat = sig["asset"]?.let { if (it is JsonObject) it["format"]?.jsonPrimitive?.content else null }
            ?.lowercase(Locale.ROOT)
        if (!assetFormat.isNullOrBlank()) return assetFormat

        val format = sig["format"]?.jsonPrimitive?.content?.lowercase(Locale.ROOT)
        if (!format.isNullOrBlank()) return format

        return url.substringBefore('?').substringAfterLast('.', "").lowercase(Locale.ROOT)
    }

    private fun rank(sig: JsonObject, url: String): Int {
        val licenseStatus = sig["license"]?.let { if (it is JsonObject) it["status"]?.jsonPrimitive?.content else null }
            .orEmpty().lowercase(Locale.ROOT)
        val license = when (licenseStatus) {
            "known" -> 2
            "requires_review" -> 1
            else -> 0
        }
        val formatScore = when (extractFormat(sig, url)) {
            "svg" -> 2
            "png" -> 1
            else -> 0
        }
        val verification = sig["verification"]?.jsonPrimitive?.content.orEmpty().lowercase(Locale.ROOT)
        val verificationScore = when (verification) {
            "artist_verified" -> 3
            "verified" -> 2
            "unverified" -> 1
            else -> 0
        }
        val panoramic = if (extractAspect(sig) >= 1.4f) 1 else 0
        return license * 1000 + formatScore * 100 + verificationScore * 10 + panoramic
    }

    private fun extractUrl(sig: JsonObject): String? {
        val assetObj = sig["asset"] as? JsonObject
        assetObj?.get("url")?.jsonPrimitive?.content?.takeIf { it.startsWith("http") }?.let { return it }
        sig["asset"]?.jsonPrimitive?.content?.takeIf { it.startsWith("http") }?.let { return it }
        sig["url"]?.jsonPrimitive?.content?.takeIf { it.startsWith("http") }?.let { return it }
        sig["original_url"]?.jsonPrimitive?.content?.takeIf { it.startsWith("http") }?.let { return it }
        sig["originalUrl"]?.jsonPrimitive?.content?.takeIf { it.startsWith("http") }?.let { return it }
        return null
    }

    private fun extractAspect(sig: JsonObject): Float {
        val assetObj = sig["asset"] as? JsonObject
        val w = sig["width"]?.jsonPrimitive?.intOrNull ?: assetObj?.get("width")?.jsonPrimitive?.intOrNull
        val h = sig["height"]?.jsonPrimitive?.intOrNull ?: assetObj?.get("height")?.jsonPrimitive?.intOrNull
        return if (w != null && h != null && h > 0) w.toFloat() / h else 2.5f
    }

    private fun extractArea(sig: JsonObject): Long {
        val assetObj = sig["asset"] as? JsonObject
        val w = (sig["width"]?.jsonPrimitive?.longOrNull ?: assetObj?.get("width")?.jsonPrimitive?.longOrNull) ?: 0L
        val h = (sig["height"]?.jsonPrimitive?.longOrNull ?: assetObj?.get("height")?.jsonPrimitive?.longOrNull) ?: 0L
        return w * h
    }

    private fun fetch(url: String): String? {
        val request = Request.Builder().url(url).get().build()
        Http.client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return null
            return response.body.string()
        }
    }

    private fun String.normalized(): String =
        java.text.Normalizer.normalize(lowercase(Locale.ROOT), java.text.Normalizer.Form.NFD)
            .filter { it.isLetterOrDigit() }
}
