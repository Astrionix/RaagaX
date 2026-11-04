package com.music.raaga.playback.smart

import com.music.raaga.data.settings.AppSettings
import com.music.raaga.data.settings.CrossfadeMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

class AdaptiveCrossfadeEngineTest {

    @Test
    fun trackAnalyzer_detectsLiveAndSpeechRecordings() {
        assertTrue(AdaptiveCrossfadeEngine.TrackAnalyzer.isLiveRecording("Hotel California - Live at the Forum", "Eagles"))
        assertTrue(AdaptiveCrossfadeEngine.TrackAnalyzer.isLiveRecording("Concert Tour 2024", "Taylor Swift"))
        assertTrue(AdaptiveCrossfadeEngine.TrackAnalyzer.isLiveRecording("Track 01 (Acoustic Live)", "Coldplay"))
        assertTrue(AdaptiveCrossfadeEngine.TrackAnalyzer.isLiveRecording("Intro Interview", "Artist"))

        assertFalse(AdaptiveCrossfadeEngine.TrackAnalyzer.isLiveRecording("Blinding Lights", "The Weeknd"))
        assertFalse(AdaptiveCrossfadeEngine.TrackAnalyzer.isLiveRecording("Starboy", "The Weeknd"))
    }

    @Test
    fun trackAnalyzer_identifiesOutroCharacteristics() {
        // 1. Long instrumental outro
        val longOutroAnalysis = TrackAnalysis(
            duration = 200.0,
            contentEndTime = 198.0,
            outroStartTime = 186.0,
            energyCurve = listOf(
                EnergySample(186.0, 0.35),
                EnergySample(192.0, 0.28),
                EnergySample(198.0, 0.20),
            ),
        )
        val longProfile = AdaptiveCrossfadeEngine.TrackAnalyzer.analyzeOutro(longOutroAnalysis, 200.0)
        assertEquals(AdaptiveCrossfadeEngine.OutroType.LONG_INSTRUMENTAL, longProfile.outroType)
        assertEquals(2.0, longProfile.trailingSilence, 0.01)

        // 2. Abrupt ending (energy stays high till end)
        val abruptAnalysis = TrackAnalysis(
            duration = 180.0,
            contentEndTime = 180.0,
            outroStartTime = 175.0,
            energyCurve = listOf(
                EnergySample(175.0, 0.85),
                EnergySample(178.0, 0.82),
                EnergySample(180.0, 0.80),
            ),
        )
        val abruptProfile = AdaptiveCrossfadeEngine.TrackAnalyzer.analyzeOutro(abruptAnalysis, 180.0)
        assertEquals(AdaptiveCrossfadeEngine.OutroType.ABRUPT, abruptProfile.outroType)

        // 3. Natural fade (energy decays from high to very low)
        val fadeAnalysis = TrackAnalysis(
            duration = 210.0,
            contentEndTime = 208.0,
            outroStartTime = 198.0,
            energyCurve = listOf(
                EnergySample(198.0, 0.70),
                EnergySample(203.0, 0.40),
                EnergySample(208.0, 0.10),
            ),
        )
        val fadeProfile = AdaptiveCrossfadeEngine.TrackAnalyzer.analyzeOutro(fadeAnalysis, 210.0)
        assertEquals(AdaptiveCrossfadeEngine.OutroType.NATURAL_FADE, fadeProfile.outroType)
    }

    @Test
    fun trackAnalyzer_identifiesIntroCharacteristicsAndVocals() {
        // Track with lead-in silence and immediate vocals at 1.5s
        val vocalIntroAnalysis = TrackAnalysis(
            duration = 180.0,
            audibleStartTime = 0.8,
            introEndTime = 1.5,
            vocalProbability = 0.9,
            energyCurve = listOf(
                EnergySample(0.8, 0.4),
                EnergySample(1.5, 0.7),
            ),
            vocalActivityMask = listOf(0.0, 0.85),
        )
        val introProfile = AdaptiveCrossfadeEngine.TrackAnalyzer.analyzeIntro(vocalIntroAnalysis, 180.0)
        assertEquals(0.8, introProfile.leadInSilence, 0.01)
        assertTrue(introProfile.hasImmediateVocals)
        assertEquals(1.5, introProfile.firstVocalTime ?: 0.0, 0.01)

        // Track with long instrumental intro
        val instrumentalIntroAnalysis = TrackAnalysis(
            duration = 240.0,
            audibleStartTime = 0.2,
            introEndTime = 18.0,
            vocalProbability = 0.1,
            energyCurve = listOf(
                EnergySample(0.2, 0.3),
                EnergySample(5.0, 0.4),
                EnergySample(10.0, 0.5),
            ),
            vocalActivityMask = listOf(0.0, 0.0, 0.0),
        )
        val instProfile = AdaptiveCrossfadeEngine.TrackAnalyzer.analyzeIntro(instrumentalIntroAnalysis, 240.0)
        assertFalse(instProfile.hasImmediateVocals)
    }

    @Test
    fun transitionPlanner_adaptsToAudioCharacteristics() {
        val currentTrack = TransitionTrackInfo("track_1", 200_000L, "Outro Song", "Artist")
        val nextTrack = TransitionTrackInfo("track_2", 180_000L, "Intro Song", "Artist")

        // Case A: Long instrumental outro -> produces longer crossfade (6s to 10s)
        val longOutro = TrackAnalysis(
            duration = 200.0,
            contentEndTime = 200.0,
            outroStartTime = 188.0,
            energyCurve = listOf(
                EnergySample(188.0, 0.3),
                EnergySample(194.0, 0.25),
                EnergySample(200.0, 0.15),
            ),
        )
        val normalIntro = TrackAnalysis(duration = 180.0, audibleStartTime = 0.1, introEndTime = 15.0)
        val planA = AdaptiveCrossfadeEngine.TransitionPlanner.plan(
            currentAnalysis = longOutro,
            nextAnalysis = normalIntro,
            currentTrack = currentTrack,
            nextTrack = nextTrack,
            currentDuration = 200.0,
            nextDuration = 180.0,
        )
        assertEquals(AdaptiveCrossfadeEngine.TransitionCategory.LONG_INSTRUMENTAL_BLEND, planA.category)
        assertTrue("Fade duration should be >= 6.0s for long instrumental outro", planA.durationSeconds >= 6.0)

        // Case B: Abrupt ending -> produces tight short transition
        val abruptOutro = TrackAnalysis(
            duration = 180.0,
            contentEndTime = 180.0,
            outroStartTime = 175.0,
            energyCurve = listOf(
                EnergySample(175.0, 0.8),
                EnergySample(180.0, 0.78),
            ),
        )
        val planB = AdaptiveCrossfadeEngine.TransitionPlanner.plan(
            currentAnalysis = abruptOutro,
            nextAnalysis = normalIntro,
            currentTrack = currentTrack,
            nextTrack = nextTrack,
            currentDuration = 180.0,
            nextDuration = 180.0,
        )
        assertEquals(AdaptiveCrossfadeEngine.TransitionCategory.ABRUPT_CLEAN_TRANSITION, planB.category)
        assertTrue("Fade duration should be <= 3.5s for abrupt ending", planB.durationSeconds <= 3.5)

        // Case C: Next track starts immediately with vocals -> protects vocal intro
        val immediateVocalIntro = TrackAnalysis(
            duration = 180.0,
            audibleStartTime = 0.0,
            introEndTime = 2.0,
            vocalProbability = 0.95,
            energyCurve = listOf(EnergySample(0.0, 0.4), EnergySample(2.0, 0.8)),
            vocalActivityMask = listOf(0.0, 0.9),
        )
        val planC = AdaptiveCrossfadeEngine.TransitionPlanner.plan(
            currentAnalysis = longOutro,
            nextAnalysis = immediateVocalIntro,
            currentTrack = currentTrack,
            nextTrack = nextTrack,
            currentDuration = 200.0,
            nextDuration = 180.0,
        )
        assertEquals(AdaptiveCrossfadeEngine.TransitionCategory.VOCAL_PROTECTED_TRANSITION, planC.category)
        assertTrue("Fade duration should be capped to protect early vocals", planC.durationSeconds <= 3.5)

        // Case D: Live recording -> gapless transition (no overlap)
        val liveTrack = TransitionTrackInfo("track_live", 200_000L, "Song (Live from Wembley)", "Artist")
        val planD = AdaptiveCrossfadeEngine.TransitionPlanner.plan(
            currentAnalysis = longOutro,
            nextAnalysis = normalIntro,
            currentTrack = liveTrack,
            nextTrack = nextTrack,
            currentDuration = 200.0,
            nextDuration = 180.0,
        )
        assertEquals(AdaptiveCrossfadeEngine.TransitionCategory.GAPLESS_SEQUENTIAL, planD.category)
        assertEquals(0.2, planD.durationSeconds, 0.01)
    }

    @Test
    fun audioMixer_enforcesEqualPowerLawWithoutLoudnessDip() {
        val testPoints = floatArrayOf(0.0f, 0.15f, 0.35f, 0.5f, 0.7f, 0.85f, 1.0f)

        for (t in testPoints) {
            val gains = AdaptiveCrossfadeEngine.AudioMixer.calculateGains(t)
            val powerSum = (gains.outgoingGain * gains.outgoingGain) + (gains.incomingGain * gains.incomingGain)

            // Equal power law: outgoing² + incoming² must equal 1.0 within floating point margin
            assertTrue(
                "Power sum at progress $t should be 1.0, was $powerSum",
                abs(powerSum - 1.0f) < 0.001f,
            )

            // Start condition: full outgoing, zero incoming
            if (t == 0.0f) {
                assertEquals(1.0f, gains.outgoingGain, 0.001f)
                assertEquals(0.0f, gains.incomingGain, 0.001f)
            }
            // End condition: zero outgoing, full incoming
            if (t == 1.0f) {
                assertEquals(0.0f, gains.outgoingGain, 0.001f)
                assertEquals(1.0f, gains.incomingGain, 0.001f)
            }
            // Midpoint: both equal to 1/sqrt(2) ≈ 0.7071
            if (t == 0.5f) {
                assertEquals(gains.outgoingGain, gains.incomingGain, 0.001f)
                assertEquals(0.7071f, gains.outgoingGain, 0.001f)
            }

            // Headroom scaling prevents clipping when sum exceeds 1.0
            assertTrue(gains.headroomScale in 0.7f..1.0f)
        }
    }

    @Test
    fun crossfadeMode_defaultIsAutomaticAndSwitchesCorrectly() {
        assertEquals(CrossfadeMode.AUTOMATIC, CrossfadeMode.fromString("AUTOMATIC"))
        assertEquals(CrossfadeMode.MANUAL, CrossfadeMode.fromString("MANUAL"))
        assertEquals(CrossfadeMode.OFF, CrossfadeMode.fromString("OFF"))
        assertEquals(CrossfadeMode.AUTOMATIC, CrossfadeMode.fromString(null))
        assertEquals(CrossfadeMode.AUTOMATIC, CrossfadeMode.fromString("UNKNOWN"))
    }
}

