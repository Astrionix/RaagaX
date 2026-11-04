package com.music.raaga.playback.smart

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Intelligent transition engine for Raaga.
 *
 * Implements the 3-pillar architecture:
 * 1. TrackAnalyzer: Analyzes song endings, beginnings, silence, and musical energy.
 * 2. TransitionPlanner: Calculates dynamic overlap, protects vocal sections, and determines transition timing.
 * 3. AudioMixer: Computes equal-power crossfade curves (sin/cos) and headroom scaling to avoid volume dips.
 */
object AdaptiveCrossfadeEngine {

    enum class OutroType {
        LONG_INSTRUMENTAL,
        NATURAL_FADE,
        ABRUPT,
        STANDARD,
    }

    enum class TransitionCategory {
        LONG_INSTRUMENTAL_BLEND,
        NATURAL_FADE_FOLLOW,
        ABRUPT_CLEAN_TRANSITION,
        VOCAL_PROTECTED_TRANSITION,
        GAPLESS_SEQUENTIAL,
        STANDARD_ADAPTIVE,
    }

    data class OutroProfile(
        val outroDuration: Double,
        val trailingSilence: Double,
        val outroType: OutroType,
        val effectiveEnd: Double,
    )

    data class IntroProfile(
        val leadInSilence: Double,
        val firstVocalTime: Double?,
        val hasImmediateVocals: Boolean,
        val introEnergy: Double,
    )

    data class SmartTransitionResult(
        val transitionStart: Double,
        val transitionEnd: Double,
        val durationSeconds: Double,
        val incomingCueTime: Double,
        val category: TransitionCategory,
        val reason: String,
    )

    data class CrossfadeGains(
        val outgoingGain: Float,
        val incomingGain: Float,
        val headroomScale: Float,
    )

    /**
     * Subsystem 1: TrackAnalyzer
     * Inspects intro, outro, silence boundaries, and vocal activity.
     */
    object TrackAnalyzer {
        private val LIVE_OR_SPEECH_REGEX = Regex(
            """\b(live|concert|tour|recorded live|acoustic live|speech|interview|monologue|applause)\b""",
            RegexOption.IGNORE_CASE,
        )

        fun isLiveRecording(title: String, artist: String): Boolean {
            return LIVE_OR_SPEECH_REGEX.containsMatchIn(title) || LIVE_OR_SPEECH_REGEX.containsMatchIn(artist)
        }

        fun analyzeOutro(analysis: TrackAnalysis, trackDuration: Double): OutroProfile {
            val length = if (trackDuration > 0) trackDuration else analysis.duration
            val contentEnd = if (analysis.contentEndTime in 1.0..length) analysis.contentEndTime else length
            val trailingSilence = (length - contentEnd).coerceAtLeast(0.0)

            val outroStart = if (analysis.outroStartTime in 1.0..contentEnd) {
                analysis.outroStartTime
            } else {
                max(0.0, contentEnd - 10.0)
            }
            val outroDuration = (contentEnd - outroStart).coerceAtLeast(0.0)

            // Inspect energy in the last section
            val outroSamples = analysis.energyCurve.filter { it.time >= outroStart && it.time <= contentEnd }
            val avgOutroEnergy = if (outroSamples.isNotEmpty()) outroSamples.map { it.energy }.average() else 0.5
            val lastSampleEnergy = outroSamples.lastOrNull()?.energy ?: 0.5
            val firstSampleEnergy = outroSamples.firstOrNull()?.energy ?: 0.5

            val outroType = when {
                // Outro has a natural fade: energy declines steadily
                firstSampleEnergy > 0.4 && lastSampleEnergy < 0.2 -> OutroType.NATURAL_FADE
                // Energy remains high right up to the end without decay: abrupt ending
                lastSampleEnergy > 0.5 && (firstSampleEnergy - lastSampleEnergy) < 0.15 -> OutroType.ABRUPT
                // Long outro with low energy and at least 8 seconds
                outroDuration >= 8.0 && avgOutroEnergy < 0.4 -> OutroType.LONG_INSTRUMENTAL
                else -> OutroType.STANDARD
            }

            return OutroProfile(
                outroDuration = outroDuration,
                trailingSilence = trailingSilence,
                outroType = outroType,
                effectiveEnd = contentEnd,
            )
        }

        fun analyzeIntro(analysis: TrackAnalysis, trackDuration: Double): IntroProfile {
            val leadIn = (analysis.audibleStartTime ?: analysis.firstBeat.takeIf { it > 0 } ?: 0.0).coerceAtLeast(0.0)

            // Look for first vocal activity from mask or introEndTime
            var firstVocal: Double? = null
            if (analysis.vocalActivityMask.isNotEmpty() && analysis.energyCurve.size == analysis.vocalActivityMask.size) {
                for (i in analysis.vocalActivityMask.indices) {
                    if (analysis.vocalActivityMask[i] > 0.35) {
                        firstVocal = analysis.energyCurve[i].time
                        break
                    }
                }
            }
            if (firstVocal == null && analysis.introEndTime > 0.5 && analysis.vocalProbability > 0.5) {
                firstVocal = analysis.introEndTime
            }

            val hasImmediateVocals = firstVocal != null && firstVocal < 3.5

            val introSamples = analysis.energyCurve.filter { it.time in leadIn..(leadIn + 10.0) }
            val introEnergy = if (introSamples.isNotEmpty()) introSamples.map { it.energy }.average() else 0.5

            return IntroProfile(
                leadInSilence = leadIn,
                firstVocalTime = firstVocal,
                hasImmediateVocals = hasImmediateVocals,
                introEnergy = introEnergy,
            )
        }
    }

    /**
     * Subsystem 2: TransitionPlanner
     * Calculates overlap, avoids cutting vocals, and synchronizes transition timing.
     */
    object TransitionPlanner {
        fun plan(
            currentAnalysis: TrackAnalysis,
            nextAnalysis: TrackAnalysis,
            currentTrack: TransitionTrackInfo?,
            nextTrack: TransitionTrackInfo?,
            currentDuration: Double,
            nextDuration: Double,
            albumSequential: Boolean = false,
        ): SmartTransitionResult {
            val titleCurrent = currentTrack?.title.orEmpty()
            val artistCurrent = currentTrack?.artist.orEmpty()
            val titleNext = nextTrack?.title.orEmpty()
            val artistNext = nextTrack?.artist.orEmpty()

            // 1. Live recording or speech: prefer no overlap / gapless
            if (TrackAnalyzer.isLiveRecording(titleCurrent, artistCurrent) ||
                TrackAnalyzer.isLiveRecording(titleNext, artistNext)
            ) {
                return SmartTransitionResult(
                    transitionStart = currentDuration - 0.2,
                    transitionEnd = currentDuration,
                    durationSeconds = 0.2,
                    incomingCueTime = 0.0,
                    category = TransitionCategory.GAPLESS_SEQUENTIAL,
                    reason = "live-or-speech-gapless",
                )
            }

            // 2. Same album consecutive tracks: gapless
            if (albumSequential && currentTrack != null && nextTrack != null &&
                currentTrack.album.isNotBlank() && currentTrack.album == nextTrack.album
            ) {
                return SmartTransitionResult(
                    transitionStart = currentDuration - 0.2,
                    transitionEnd = currentDuration,
                    durationSeconds = 0.2,
                    incomingCueTime = 0.0,
                    category = TransitionCategory.GAPLESS_SEQUENTIAL,
                    reason = "same-album-gapless",
                )
            }

            val outro = TrackAnalyzer.analyzeOutro(currentAnalysis, currentDuration)
            val intro = TrackAnalyzer.analyzeIntro(nextAnalysis, nextDuration)

            // Determine appropriate transition duration and category
            val (category, rawDuration) = when {
                // Next song starts with vocals: avoid cutting intro vocals!
                intro.hasImmediateVocals -> {
                    val vocalLimit = (intro.firstVocalTime ?: 3.0).coerceAtLeast(1.5)
                    TransitionCategory.VOCAL_PROTECTED_TRANSITION to min(vocalLimit, 3.5)
                }
                // Outro ends abruptly: shorter transition to avoid dragging out an abrupt stop
                outro.outroType == OutroType.ABRUPT -> {
                    TransitionCategory.ABRUPT_CLEAN_TRANSITION to 2.5
                }
                // Outro has a long instrumental section: longer crossfade
                outro.outroType == OutroType.LONG_INSTRUMENTAL -> {
                    val candidateDuration = min(outro.outroDuration * 0.75, 10.0)
                    TransitionCategory.LONG_INSTRUMENTAL_BLEND to max(6.0, candidateDuration)
                }
                // Outro fades naturally: respect natural ending
                outro.outroType == OutroType.NATURAL_FADE -> {
                    TransitionCategory.NATURAL_FADE_FOLLOW to max(4.0, min(outro.outroDuration, 8.0))
                }
                else -> {
                    TransitionCategory.STANDARD_ADAPTIVE to 5.0
                }
            }

            val finalDuration = rawDuration.coerceIn(1.5, 12.0)
            val transitionEnd = outro.effectiveEnd
            val transitionStart = max(0.0, transitionEnd - finalDuration)
            val incomingCue = intro.leadInSilence // Skip silent intro gap!

            return SmartTransitionResult(
                transitionStart = transitionStart,
                transitionEnd = transitionEnd,
                durationSeconds = transitionEnd - transitionStart,
                incomingCueTime = incomingCue,
                category = category,
                reason = "smart-crossfade-${category.name.lowercase()}",
            )
        }
    }

    /**
     * Subsystem 3: AudioMixer
     * Equal-power crossfade gain law and dynamic headroom scaling.
     */
    object AudioMixer {
        /**
         * Calculates equal-power crossfade gains for normalized progress [0.0f..1.0f].
         *
         * Equal-power law:
         * outgoingGain = cos(progress * π / 2)
         * incomingGain = sin(progress * π / 2)
         *
         * This guarantees:
         * outgoingGain² + incomingGain² = 1.0, preserving constant sound power
         * and completely eliminating perceived volume dips during overlap.
         */
        fun calculateGains(progress: Float): CrossfadeGains {
            val clamped = progress.coerceIn(0f, 1f)
            val angle = clamped * (PI / 2.0).toFloat()
            val outGain = cos(angle)
            val inGain = sin(angle)

            // Headroom scaling to prevent digital clipping when two loud tracks sum
            val sumGains = outGain + inGain
            val headroom = if (sumGains > 1.0f) 1.0f / sqrt(sumGains) else 1.0f

            return CrossfadeGains(
                outgoingGain = outGain,
                incomingGain = inGain,
                headroomScale = headroom,
            )
        }
    }
}

