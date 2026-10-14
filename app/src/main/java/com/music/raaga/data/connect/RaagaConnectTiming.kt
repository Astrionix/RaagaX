package com.music.raaga.data.connect

import kotlin.math.abs

/**
 * High-precision clock synchronization, adaptive scheduling, and drift correction
 * algorithms inspired by heterogeneous-device synchronization research (e.g. ORCHESTRA).
 */
data class ClockSyncSample(
    val t1ClientSendMs: Long,
    val t2ServerRecvMs: Long,
    val t3ServerTransmitMs: Long,
    val t4ClientRecvMs: Long,
) {
    /**
     * True network round trip time excluding server turnaround delay:
     * RTT = (t4 - t1) - (t3 - t2)
     */
    val rttMs: Long get() = (t4ClientRecvMs - t1ClientSendMs) - (t3ServerTransmitMs - t2ServerRecvMs)

    /**
     * Estimated clock offset of remote clock relative to local clock:
     * θ = ((t2 - t1) + (t3 - t4)) / 2
     */
    val clockOffsetMs: Long get() = ((t2ServerRecvMs - t1ClientSendMs) + (t3ServerTransmitMs - t4ClientRecvMs)) / 2

    /**
     * Theoretical timing uncertainty bounded by half the round-trip time:
     * Uncertainty = RTT / 2
     */
    val uncertaintyMs: Long get() = (rttMs.coerceAtLeast(0L)) / 2
}

data class ClockCalibrationResult(
    val offsetMs: Long,
    val rttMs: Long,
    val uncertaintyMs: Long,
    val sampleCount: Int,
)

object RaagaConnectTiming {

    /**
     * Filters a collection of NTP ping-pong samples using a minimum-filter,
     * which rejects samples affected by operating system scheduling delay,
     * Wi-Fi channel contention, or bufferbloat.
     */
    fun filterBestSample(samples: List<ClockSyncSample>): ClockCalibrationResult? {
        if (samples.isEmpty()) return null
        val best = samples.minByOrNull { it.rttMs } ?: return null
        return ClockCalibrationResult(
            offsetMs = best.clockOffsetMs,
            rttMs = best.rttMs,
            uncertaintyMs = best.uncertaintyMs,
            sampleCount = samples.size,
        )
    }

    /**
     * Computes an adaptive scheduling lead time based on measured RTT,
     * network jitter, and target device buffer preparation time.
     */
    fun computeAdaptiveLeadTime(
        rttMs: Long,
        isCloud: Boolean,
        bufferReadyDurationMs: Long = 0L,
    ): Long {
        return if (isCloud) {
            (rttMs * 2L + 250L).coerceIn(500L, 2500L)
        } else {
            (rttMs * 2L + 120L).coerceIn(250L, 1200L)
        }
    }

    /**
     * Computes the target device's monotonic playout anchor timestamp
     * corresponding to the local scheduled start time.
     */
    fun computeTargetAnchorMs(
        localScheduleMs: Long,
        clockOffsetMs: Long,
    ): Long {
        return localScheduleMs + clockOffsetMs
    }

    /**
     * Computes the expected playhead position of the target device
     * at current local monotonic time [currentMonotonicMs], based on the initial playback anchor.
     */
    fun computeExpectedPositionMs(
        anchorPositionMs: Long,
        anchorMonotonicMs: Long,
        currentMonotonicMs: Long,
        playbackSpeed: Float = 1.0f,
        durationMs: Long = Long.MAX_VALUE,
    ): Long {
        if (playbackSpeed <= 0f) return anchorPositionMs
        val elapsedMs = (currentMonotonicMs - anchorMonotonicMs).coerceAtLeast(0L)
        val advancedMs = (elapsedMs * playbackSpeed).toLong()
        val calculated = anchorPositionMs + advancedMs
        return if (durationMs > 0L) calculated.coerceAtMost(durationMs) else calculated
    }

    /**
     * Evaluates clock and playhead drift between two consecutive or reference reports.
     * @return Drift in milliseconds (positive means actual position is ahead of expected, negative means behind).
     */
    fun calculateDriftMs(
        actualPositionMs: Long,
        expectedPositionMs: Long,
    ): Long {
        return actualPositionMs - expectedPositionMs
    }

    /**
     * Drift correction action recommended for the given drift magnitude.
     */
    sealed class DriftAction {
        object InSync : DriftAction()
        data class RateAdjust(val newSpeed: Float) : DriftAction()
        data class HardSeek(val targetPositionMs: Long) : DriftAction()
    }

    fun evaluateDriftAction(
        driftMs: Long,
        expectedPositionMs: Long,
        currentSpeed: Float = 1.0f,
    ): DriftAction {
        val absDrift = abs(driftMs)
        return when {
            absDrift < 40L -> DriftAction.InSync
            absDrift in 40L..250L -> {
                // Micro-rate adjustment (0.98x - 1.02x) for inaudible phase-locking
                val adjustedSpeed = if (driftMs > 0) 0.98f else 1.02f
                DriftAction.RateAdjust(adjustedSpeed)
            }
            else -> {
                // Hard seek when drift exceeds 250ms
                DriftAction.HardSeek(expectedPositionMs)
            }
        }
    }
}
