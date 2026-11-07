package com.music.raaga.data.sources

import com.music.raaga.data.TrackLog
import java.text.Normalizer
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max

/**
 * Quality tiers for addon and multi-source stream selection.
 */
enum class StreamQualityTier(
    val label: String,
    val description: String,
    val maxKbps: Int,
    val isLossless: Boolean,
) {
    LOW_AAC("Low (AAC)", "Efficient AAC streaming for data saving (~96 kbps)", 96, false),
    HIGH_OPUS("High (Opus)", "Standard high-fidelity Opus stream (~160 kbps)", 160, false),
    LOSSLESS_FLAC("Lossless (FLAC)", "Bit-perfect CD quality (16-bit / 44.1 kHz)", 1411, true),
    HI_RES_24BIT("Hi-Res Lossless", "Studio master quality (up to 24-bit / 192 kHz)", 9216, true);

    companion object {
        fun fromFormat(format: StreamFormat): StreamQualityTier {
            val bitDepth = format.bitDepth ?: 16
            val sampleRate = format.sampleRateHz ?: 44100
            if (format.isLossless == true && (bitDepth > 16 || sampleRate > 48000)) {
                return HI_RES_24BIT
            }
            if (format.isLossless == true) {
                return LOSSLESS_FLAC
            }
            val kbps = format.kbps ?: 160
            return if (kbps <= 112) LOW_AAC else HIGH_OPUS
        }
    }
}

/**
 * Result of stream and metadata validation gating.
 */
sealed class ValidationResult {
    data class Passed(
        val qualityTier: StreamQualityTier,
        val similarityScore: Double,
        val durationDeltaSec: Int,
    ) : ValidationResult()

    data class Rejected(
        val reason: String,
        val code: RejectionCode,
    ) : ValidationResult()
}

enum class RejectionCode {
    PREVIEW_DETECTED,
    DURATION_MISMATCH,
    LOW_SIMILARITY,
    INVALID_STREAM,
}

/**
 * Strict stream resolution & metadata validation interceptor.
 * Protects playback against 30-second previews, misidentified covers,
 * and tracks failing similarity or duration gates.
 */
object StreamValidationInterceptor {

    private const val TAG = "StreamValidation"
    private const val MIN_SIMILARITY_THRESHOLD = 0.85
    private const val MAX_DURATION_DELTA_SEC = 3

    private val NOISE_TOKENS = setOf(
        "official", "audio", "video", "music", "lyrics", "lyric", "hd", "4k",
        "remix", "ft", "feat", "featuring", "full", "song", "track", "version",
        "clip", "mv", "original", "edit", "mix",
    )

    /**
     * Verifies that a resolved candidate track matches target metadata and duration gates.
     */
    fun validateCandidate(
        target: TrackMatcher.Target,
        candidateTitle: String,
        candidateArtist: String,
        candidateDurationSec: Int?,
        isVideo: Boolean = false,
    ): ValidationResult {
        // 1. 30-Second Preview Gate
        val targetDuration = target.durationSec
        if (targetDuration != null && targetDuration > 60 && candidateDurationSec != null) {
            if (candidateDurationSec in 20..40) {
                val reason = "30-second preview rejected (candidate: ${candidateDurationSec}s vs target: ${targetDuration}s)"
                TrackLog.w(TAG, reason)
                return ValidationResult.Rejected(reason, RejectionCode.PREVIEW_DETECTED)
            }
        }

        // 2. Strict Duration Delta Gate (<= 3s on non-video audio tracks)
        if (targetDuration != null && candidateDurationSec != null && !target.isVideo && !isVideo) {
            val delta = abs(targetDuration - candidateDurationSec)
            if (delta > MAX_DURATION_DELTA_SEC) {
                val reason = "Duration mismatch rejected: delta=${delta}s > ${MAX_DURATION_DELTA_SEC}s threshold (target: ${targetDuration}s, candidate: ${candidateDurationSec}s)"
                TrackLog.w(TAG, reason)
                return ValidationResult.Rejected(reason, RejectionCode.DURATION_MISMATCH)
            }
        }

        // 3. Normalized Title & Artist Similarity Gate (Levenshtein + Token Overlap >= 0.85)
        val similarity = computeMetadataSimilarity(
            targetTitle = target.title,
            candidateTitle = candidateTitle,
            targetArtist = target.artist,
            candidateArtist = candidateArtist,
        )

        if (similarity < MIN_SIMILARITY_THRESHOLD) {
            val reason = "Metadata similarity rejected: score=%.2f < %.2f (target: '${target.title}' by '${target.artist}', candidate: '$candidateTitle' by '$candidateArtist')"
                .format(Locale.ROOT, similarity, MIN_SIMILARITY_THRESHOLD)
            TrackLog.w(TAG, reason)
            return ValidationResult.Rejected(reason, RejectionCode.LOW_SIMILARITY)
        }

        val delta = if (targetDuration != null && candidateDurationSec != null) abs(targetDuration - candidateDurationSec) else 0
        return ValidationResult.Passed(
            qualityTier = StreamQualityTier.HIGH_OPUS,
            similarityScore = similarity,
            durationDeltaSec = delta,
        )
    }

    /**
     * Validates a committed SourceStream against target metadata and stream characteristics.
     */
    fun validateStream(
        target: TrackMatcher.Target,
        stream: SourceStream,
        resolvedDurationSec: Int? = null,
    ): ValidationResult {
        if (stream.url.isBlank()) {
            return ValidationResult.Rejected("Stream URL is blank", RejectionCode.INVALID_STREAM)
        }

        val targetDuration = target.durationSec
        if (targetDuration != null && targetDuration > 60 && resolvedDurationSec != null) {
            if (resolvedDurationSec in 20..40) {
                return ValidationResult.Rejected(
                    "30-second preview stream rejected (${resolvedDurationSec}s)",
                    RejectionCode.PREVIEW_DETECTED,
                )
            }
            if (!target.isVideo && abs(targetDuration - resolvedDurationSec) > MAX_DURATION_DELTA_SEC) {
                return ValidationResult.Rejected(
                    "Stream duration delta ${abs(targetDuration - resolvedDurationSec)}s exceeds 3s",
                    RejectionCode.DURATION_MISMATCH,
                )
            }
        }

        val quality = StreamQualityTier.fromFormat(stream.format)
        val delta = if (targetDuration != null && resolvedDurationSec != null) abs(targetDuration - resolvedDurationSec) else 0

        return ValidationResult.Passed(
            qualityTier = quality,
            similarityScore = 1.0,
            durationDeltaSec = delta,
        )
    }

    /**
     * Computes similarity between target and candidate using Levenshtein distance and token Jaccard overlap.
     */
    fun computeMetadataSimilarity(
        targetTitle: String,
        candidateTitle: String,
        targetArtist: String,
        candidateArtist: String,
    ): Double {
        val normTargetTitle = normalizeString(targetTitle)
        val normCandTitle = normalizeString(candidateTitle)

        if (normTargetTitle.isEmpty() || normCandTitle.isEmpty()) return 0.0
        if (normTargetTitle == normCandTitle) return 1.0

        val titleLev = levenshteinSimilarity(normTargetTitle, normCandTitle)
        val titleToken = tokenOverlapSimilarity(normTargetTitle, normCandTitle)
        val titleScore = max(titleLev, titleToken)

        val normTargetArtist = normalizeString(targetArtist)
        val normCandArtist = normalizeString(candidateArtist)

        if (normTargetArtist.isNotEmpty() && normCandArtist.isNotEmpty()) {
            if (normTargetArtist == normCandArtist) {
                return 0.6 * titleScore + 0.4 * 1.0
            }
            val artistLev = levenshteinSimilarity(normTargetArtist, normCandArtist)
            val artistToken = tokenOverlapSimilarity(normTargetArtist, normCandArtist)
            val artistScore = max(artistLev, artistToken)
            return 0.6 * titleScore + 0.4 * artistScore
        }

        return titleScore
    }

    fun normalizeString(input: String): String {
        val decomposed = Normalizer.normalize(input, Normalizer.Form.NFD)
        val clean = decomposed.replace(Regex("\\p{M}"), "").lowercase(Locale.ROOT)
        val tokens = clean.split(Regex("[^a-zA-Z0-9]+"))
            .map { it.trim() }
            .filter { it.isNotBlank() && it !in NOISE_TOKENS }
        return tokens.joinToString(" ")
    }

    fun levenshteinSimilarity(s1: String, s2: String): Double {
        val maxLen = max(s1.length, s2.length)
        if (maxLen == 0) return 1.0
        val dist = levenshteinDistance(s1, s2)
        return (1.0 - (dist.toDouble() / maxLen.toDouble())).coerceIn(0.0, 1.0)
    }

    fun levenshteinDistance(s1: String, s2: String): Int {
        val dp = Array(s1.length + 1) { IntArray(s2.length + 1) }
        for (i in 0..s1.length) dp[i][0] = i
        for (j in 0..s2.length) dp[0][j] = j

        for (i in 1..s1.length) {
            for (j in 1..s2.length) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                dp[i][j] = minOf(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost,
                )
            }
        }
        return dp[s1.length][s2.length]
    }

    fun tokenOverlapSimilarity(s1: String, s2: String): Double {
        val tokens1 = s1.split(" ").filter { it.isNotBlank() }.toSet()
        val tokens2 = s2.split(" ").filter { it.isNotBlank() }.toSet()
        if (tokens1.isEmpty() || tokens2.isEmpty()) return 0.0

        val intersection = tokens1.intersect(tokens2).size
        val union = tokens1.union(tokens2).size
        if (union == 0) return 0.0
        return intersection.toDouble() / union.toDouble()
    }
}

