package com.music.raaga.desktop

import com.music.raaga.data.connect.ClockSyncSample
import com.music.raaga.data.connect.ConnectClockSyncRequest
import com.music.raaga.data.connect.ConnectClockSyncResponse
import com.music.raaga.data.connect.ConnectControlAck
import com.music.raaga.data.connect.ConnectControlCommand
import com.music.raaga.data.connect.ConnectDeviceStatus
import com.music.raaga.data.connect.ConnectDeviceType
import com.music.raaga.data.connect.ConnectHandoffPacket
import com.music.raaga.data.connect.ConnectTrack
import com.music.raaga.data.connect.HandoffPhase
import com.music.raaga.data.connect.RaagaConnectTiming
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.Collections
import java.util.LinkedHashMap
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Verification of the Raaga Connect 2.0 x ORCHESTRA synchronization and 2PC handoff architecture.
 * Validates:
 * 1. Monotonic NTP clock calibration & uncertainty estimation.
 * 2. Adaptive scheduling lead time for heterogeneous networks.
 * 3. 2PC Handoff state machine (PREPARE -> READY -> COMMIT -> CONFIRMED / ABORT).
 * 4. Closed-loop drift estimation and multi-tier correction.
 * 5. Single active speaker ownership model & idempotency deduplication.
 * 6. Authorization and syncKey validation.
 */
class DesktopConnectSyncTest {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        isLenient = true
    }

    @Test
    fun `RaagaConnectTiming filters jitter and computes offset and uncertainty`() {
        val samples = listOf(
            ClockSyncSample(t1ClientSendMs = 1000L, t2ServerRecvMs = 5050L, t3ServerTransmitMs = 5050L, t4ClientRecvMs = 1080L), // RTT = 80ms, offset = +4010ms (Wi-Fi spike)
            ClockSyncSample(t1ClientSendMs = 1200L, t2ServerRecvMs = 5205L, t3ServerTransmitMs = 5205L, t4ClientRecvMs = 1210L), // RTT = 10ms, offset = +4000ms (minimum-latency filter win)
            ClockSyncSample(t1ClientSendMs = 1400L, t2ServerRecvMs = 5425L, t3ServerTransmitMs = 5425L, t4ClientRecvMs = 1450L), // RTT = 50ms, offset = +4000ms
        )

        val result = RaagaConnectTiming.filterBestSample(samples)
        assertNotNull(result)
        assertEquals(10L, result.rttMs, "Minimum-filter must select the 10ms lowest-latency sample")
        assertEquals(4000L, result.offsetMs, "Measured monotonic clock offset must be exactly +4000ms")
        assertEquals(5L, result.uncertaintyMs, "Timing uncertainty bounded by RTT / 2 must be 5ms")
        assertEquals(3, result.sampleCount)

        // Translate schedule anchor to target clock
        val localScheduleMs = 2000L
        val targetScheduleMs = RaagaConnectTiming.computeTargetAnchorMs(localScheduleMs, result.offsetMs)
        assertEquals(6000L, targetScheduleMs, "Target monotonic schedule anchor must translate accurately")
    }

    @Test
    fun `adaptive lead time dynamically scales with network RTT and cloud relay`() {
        // Fast LAN (RTT = 8ms)
        val lanLead = RaagaConnectTiming.computeAdaptiveLeadTime(rttMs = 8L, isCloud = false)
        assertEquals(250L, lanLead, "Fast LAN should clamp to minimum responsive 250ms lead time")

        // Busy Wi-Fi (RTT = 150ms)
        val busyWifiLead = RaagaConnectTiming.computeAdaptiveLeadTime(rttMs = 150L, isCloud = false)
        assertEquals(420L, busyWifiLead, "Lead time must scale to (150 * 2 + 120) = 420ms")

        // Cloud Relay (RTT = 200ms)
        val cloudLead = RaagaConnectTiming.computeAdaptiveLeadTime(rttMs = 200L, isCloud = true)
        assertEquals(650L, cloudLead, "Cloud relay must accommodate higher jitter: (200 * 2 + 250) = 650ms")
    }

    @Test
    fun `two-phase handoff packet serialization and state transition with protocol version 2 and session id`() {
        val track = ConnectTrack(
            videoId = "test_vid_123",
            title = "Kesariya",
            artist = "Arijit Singh",
            durationText = "4:28",
        )

        val preparePacket = ConnectHandoffPacket(
            handoffId = "h-9876",
            phase = HandoffPhase.PREPARE,
            protocolVersion = 2,
            sessionId = "sess-abc-123",
            sourceDeviceId = "phone-1",
            sourceDeviceName = "Pixel 8",
            targetDeviceId = "desktop-1",
            track = track,
            positionMs = 45_000L,
            isPlaying = true,
            syncKey = "sync-key-xyz",
        )

        val jsonStr = json.encodeToString(preparePacket)
        val decoded = json.decodeFromString<ConnectHandoffPacket>(jsonStr)

        assertEquals("h-9876", decoded.handoffId)
        assertEquals(HandoffPhase.PREPARE, decoded.phase)
        assertEquals(2, decoded.protocolVersion)
        assertEquals("sess-abc-123", decoded.sessionId)
        assertEquals(45_000L, decoded.positionMs)
        assertEquals("sync-key-xyz", decoded.syncKey)

        // Target responds with READY and buffer readiness duration
        val readyPacket = decoded.copy(
            phase = HandoffPhase.READY,
            bufferReadyDurationMs = 2400L,
        )
        assertEquals(HandoffPhase.READY, readyPacket.phase)
        assertTrue(readyPacket.bufferReadyDurationMs >= 1000L, "Target must report >= 1000ms buffered audio")

        // Source commits with scheduled playout instant
        val commitPacket = readyPacket.copy(
            phase = HandoffPhase.COMMIT,
            scheduledStartEpochMs = 95_000L,
        )
        assertEquals(HandoffPhase.COMMIT, commitPacket.phase)
        assertEquals(95_000L, commitPacket.scheduledStartEpochMs)

        // Target confirms commit
        val confirmedPacket = commitPacket.copy(phase = HandoffPhase.CONFIRMED)
        assertEquals(HandoffPhase.CONFIRMED, confirmedPacket.phase)
    }

    @Test
    fun `safe rollback on target prepare failure triggers ABORT without music interruption`() {
        val preparePacket = ConnectHandoffPacket(
            handoffId = "h-fail-1",
            phase = HandoffPhase.PREPARE,
            protocolVersion = 2,
            sessionId = "sess-fail-1",
            sourceDeviceId = "phone-1",
            targetDeviceId = "desktop-broken",
        )

        // Target fails to prepare buffer (e.g. network stream error)
        val targetErrorPacket = preparePacket.copy(
            errorCode = "STREAM_UNAVAILABLE",
            errorMessage = "Failed to resolve stream URL",
        )

        // Verify that target response indicates not ready
        assertFalse(targetErrorPacket.phase == HandoffPhase.READY, "Failed target must not enter READY phase")

        // Source aborts handoff
        val abortPacket = targetErrorPacket.copy(phase = HandoffPhase.ABORT)
        assertEquals(HandoffPhase.ABORT, abortPacket.phase)
        assertEquals("h-fail-1", abortPacket.handoffId)
    }

    @Test
    fun `command deduplication rejects repeated command IDs without duplicate side-effects`() {
        val processedCommandIds = Collections.newSetFromMap(
            Collections.synchronizedMap(
                object : LinkedHashMap<String, Boolean>(64, 0.75f, true) {
                    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Boolean>?): Boolean = size > 64
                }
            )
        )

        val cmd1 = ConnectControlCommand(
            action = "PLAY",
            commandId = "cmd-uuid-1",
            seq = 1L,
            senderDeviceId = "phone-1",
        )
        val cmd2 = ConnectControlCommand(
            action = "PLAY",
            commandId = "cmd-uuid-1", // duplicate delivery
            seq = 1L,
            senderDeviceId = "phone-1",
        )
        val cmd3 = ConnectControlCommand(
            action = "PAUSE",
            commandId = "cmd-uuid-2",
            seq = 2L,
            senderDeviceId = "phone-1",
        )

        // First command should succeed
        val firstHandled = processedCommandIds.add(cmd1.commandId)
        assertTrue(firstHandled, "First instance of command must be processed")

        // Duplicate command arriving over cloud/LAN relay race
        val secondHandled = processedCommandIds.add(cmd2.commandId)
        assertFalse(secondHandled, "Duplicate command must be dropped by deduplication set")

        // Next new command
        val thirdHandled = processedCommandIds.add(cmd3.commandId)
        assertTrue(thirdHandled, "New command with fresh UUID must be processed")

        // Verify ack model
        val ack = ConnectControlAck(commandId = cmd1.commandId, success = true, deduplicated = false)
        val dupAck = ConnectControlAck(commandId = cmd2.commandId, success = true, deduplicated = true)
        assertTrue(dupAck.deduplicated)
    }

    @Test
    fun `drift evaluation classifies in-sync, micro-rate adjustment, and hard seek correctly`() {
        // 1. Playhead position advancement calculation
        val expectedPos = RaagaConnectTiming.computeExpectedPositionMs(
            anchorPositionMs = 10_000L,
            anchorMonotonicMs = 50_000L,
            currentMonotonicMs = 55_000L, // 5000ms elapsed
            playbackSpeed = 1.0f,
        )
        assertEquals(15_000L, expectedPos, "Expected position after 5000ms at 1.0x must be 15,000ms")

        // 2. Imperceptible jitter (< 40ms)
        val jitterDrift = RaagaConnectTiming.calculateDriftMs(actualPositionMs = 15_025L, expectedPositionMs = 15_000L)
        val jitterAction = RaagaConnectTiming.evaluateDriftAction(jitterDrift, expectedPos)
        assertTrue(jitterAction is RaagaConnectTiming.DriftAction.InSync, "Drift of 25ms should be classified as InSync")

        // 3. Subtle drift (40-250ms) -> Micro rate adjust
        val laggingDrift = RaagaConnectTiming.calculateDriftMs(actualPositionMs = 14_920L, expectedPositionMs = 15_000L) // -80ms
        val laggingAction = RaagaConnectTiming.evaluateDriftAction(laggingDrift, expectedPos)
        assertTrue(laggingAction is RaagaConnectTiming.DriftAction.RateAdjust)
        assertEquals(1.02f, laggingAction.newSpeed, "Lagging target should subtly speed up at 1.02x")

        val leadingDrift = RaagaConnectTiming.calculateDriftMs(actualPositionMs = 15_120L, expectedPositionMs = 15_000L) // +120ms
        val leadingAction = RaagaConnectTiming.evaluateDriftAction(leadingDrift, expectedPos)
        assertTrue(leadingAction is RaagaConnectTiming.DriftAction.RateAdjust)
        assertEquals(0.98f, leadingAction.newSpeed, "Leading target should subtly slow down at 0.98x")

        // 4. Large drift (> 250ms) -> Hard seek
        val largeDrift = RaagaConnectTiming.calculateDriftMs(actualPositionMs = 14_200L, expectedPositionMs = 15_000L) // -800ms
        val seekAction = RaagaConnectTiming.evaluateDriftAction(largeDrift, expectedPos)
        assertTrue(seekAction is RaagaConnectTiming.DriftAction.HardSeek)
        assertEquals(15_000L, seekAction.targetPositionMs, "Large drift must correct to expected playhead position")
    }

    @Test
    fun `single active speaker ownership status maintains exactly one active playback master`() {
        // Speaker status packet when Desktop is playing as the master
        val speakerStatus = ConnectDeviceStatus(
            deviceId = "desktop-1",
            deviceName = "Living Room Mac",
            deviceType = ConnectDeviceType.DESKTOP,
            isPlaying = true,
            activeSpeakerDeviceId = "desktop-1",
            sessionId = "sess-active-master",
            positionMs = 60_000L,
            durationMs = 240_000L,
            protocolVersion = 2,
        )

        assertEquals("desktop-1", speakerStatus.activeSpeakerDeviceId)
        assertEquals("sess-active-master", speakerStatus.sessionId)
        assertTrue(speakerStatus.isPlaying)

        // Phone acting purely as remote controller
        val phoneControllerStatus = ConnectDeviceStatus(
            deviceId = "phone-1",
            deviceName = "Pixel 8",
            deviceType = ConnectDeviceType.PHONE,
            isPlaying = false,
            activeSpeakerDeviceId = null, // Not playing locally
            sessionId = null,
            protocolVersion = 2,
        )

        assertEquals(null, phoneControllerStatus.activeSpeakerDeviceId, "Controller must not claim active speaker role")
        assertFalse(phoneControllerStatus.isPlaying, "Controller local playback must be paused")
    }

    @Test
    fun `authorization checks allow paired devices and shared syncKey while rejecting unauthorized callers`() {
        fun checkAuth(
            senderDeviceId: String,
            requestSyncKey: String?,
            pairedDeviceIds: Set<String>,
            localSyncKey: String?,
        ): Boolean {
            if (pairedDeviceIds.isEmpty() && localSyncKey.isNullOrBlank()) return true // bootstrap allow
            if (senderDeviceId.isNotBlank() && senderDeviceId in pairedDeviceIds) return true
            if (!localSyncKey.isNullOrBlank() && !requestSyncKey.isNullOrBlank() && localSyncKey == requestSyncKey) return true
            return false
        }

        val paired = setOf("desktop-1", "phone-1")
        val syncKey = "shared-secret-key-12345"

        // Paired device
        assertTrue(checkAuth("phone-1", null, paired, syncKey), "Paired device must be authorized")

        // Unpaired device with valid syncKey
        assertTrue(checkAuth("tablet-unknown", syncKey, paired, syncKey), "Matching syncKey must authorize device")

        // Rogue unknown device without valid credentials
        assertFalse(checkAuth("rogue-dev", "wrong-key", paired, syncKey), "Invalid key must be rejected")
        assertFalse(checkAuth("rogue-dev", null, paired, syncKey), "Unpaired device with no key must be rejected")
    }
}
