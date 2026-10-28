package com.music.raaga.data.connect

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Security utilities for Raaga Connect LAN and Cloud communication.
 * Provides HMAC-SHA256 signature generation and constant-time verification,
 * replay attack prevention via timestamp drift validation, and canonical payload formatting.
 */
object RaagaConnectSecurity {
    private const val HMAC_ALGORITHM = "HmacSHA256"

    /** Allowable clock drift between sender and receiver (60 seconds) */
    const val MAX_CLOCK_SKEW_MS = 60_000L

    /**
     * Builds canonical signature payload:
     * "$method\n$cleanPath\n$timestamp\n$body"
     */
    fun buildSignaturePayload(
        method: String,
        path: String,
        timestamp: String,
        body: String = "",
    ): String {
        val cleanPath = path.substringBefore("?")
        return "${method.uppercase()}\n$cleanPath\n$timestamp\n$body"
    }

    /**
     * Computes HMAC-SHA256 signature over [data] using [key].
     * Returns a lower-case hexadecimal string.
     */
    fun computeHmacSha256(key: String, data: String): String {
        if (key.isBlank()) return ""
        return try {
            val mac = Mac.getInstance(HMAC_ALGORITHM)
            val secretKey = SecretKeySpec(key.toByteArray(StandardCharsets.UTF_8), HMAC_ALGORITHM)
            mac.init(secretKey)
            val hash = mac.doFinal(data.toByteArray(StandardCharsets.UTF_8))
            hash.joinToString("") { "%02x".format(it) }
        } catch (_: Exception) {
            ""
        }
    }

    /**
     * Verifies that [signature] matches the HMAC-SHA256 of [data] with [key] using
     * constant-time byte comparison to protect against timing attacks.
     */
    fun verifySignature(key: String, data: String, signature: String?): Boolean {
        if (key.isBlank() || signature.isNullOrBlank()) return false
        val expected = computeHmacSha256(key, data)
        if (expected.isBlank()) return false
        return MessageDigest.isEqual(
            expected.lowercase().toByteArray(StandardCharsets.UTF_8),
            signature.trim().lowercase().toByteArray(StandardCharsets.UTF_8),
        )
    }

    /**
     * Validates that the request timestamp is within [MAX_CLOCK_SKEW_MS] of [nowMs]
     * to protect against replay attacks.
     */
    fun isTimestampFresh(timestampStr: String?, nowMs: Long = System.currentTimeMillis()): Boolean {
        val ts = timestampStr?.toLongOrNull() ?: return false
        return kotlin.math.abs(nowMs - ts) <= MAX_CLOCK_SKEW_MS
    }
}
