import { JamSession } from '@/types/jam';
import { ClockSyncEngine } from './ClockSyncEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';

export interface DriftStatus {
  expectedPositionMs: number;
  actualLocalMs: number;
  driftMs: number;
  playbackRate: number;
  isWaitingForStart: boolean;
  leadTimeRemainingMs: number;
  correctionAction: 'NONE' | 'MODULATE_RATE' | 'HARD_SEEK' | 'WAITING_FOR_SCHEDULED_START';
}

export type DriftListener = (status: DriftStatus) => void;

export class DriftCorrectionEngine {
  private static instance: DriftCorrectionEngine;

  private clockSync: ClockSyncEngine;
  private currentSession: JamSession | null = null;
  private isCorrectionRunning = false;
  private loopInterval: any = null;
  private lastDriftMs = 0;
  private currentRate = 1.0;
  private listeners: Set<DriftListener> = new Set();
  private scheduledStartTimer: any = null;

  private constructor() {
    this.clockSync = ClockSyncEngine.getInstance();
  }

  public static getInstance(): DriftCorrectionEngine {
    if (!DriftCorrectionEngine.instance) {
      DriftCorrectionEngine.instance = new DriftCorrectionEngine();
    }
    return DriftCorrectionEngine.instance;
  }

  public setSession(session: JamSession | null) {
    this.currentSession = session;
    if (session) {
      this.evaluateScheduledStart(session);
    }
  }

  public subscribe(listener: DriftListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(status: DriftStatus) {
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (e) {
        console.error('[DriftCorrectionEngine] Listener error:', e);
      }
    }
  }

  private consecutiveLargeDriftCount = 0;

  /**
   * Evaluates if we need to schedule a future start trigger
   */
  public evaluateScheduledStart(session: JamSession) {
    if (this.scheduledStartTimer) {
      clearTimeout(this.scheduledStartTimer);
      this.scheduledStartTimer = null;
    }

    if (session.state !== 'PLAYING') return;

    const estimatedServerTime = this.clockSync.getEstimatedServerTime();
    const delayMs = session.startAtServerTime - estimatedServerTime;
    const pb = PlaybackService.getInstance();
    const activeAudio = pb.getActiveAudio();

    if (delayMs > 10) {
      // Schedule local play execution at exact future server timestamp
      if (activeAudio) {
        // Pre-seek to authoritative starting position in preparation
        const targetSec = session.positionMs / 1000;
        if (Math.abs(activeAudio.currentTime - targetSec) > 0.05) {
          activeAudio.currentTime = targetSec;
        }
      }

      this.scheduledStartTimer = setTimeout(() => {
        const liveSession = this.currentSession;
        if (liveSession && liveSession.state === 'PLAYING') {
          try {
            PlaybackService.getInstance().play();
          } catch {}
        }
      }, delayMs);
    } else {
      // Already past schedule time: compute exact in-flight timeline position and seek before playing
      const expectedPosMs = this.calculateExpectedPositionMs(session, estimatedServerTime);
      const expectedPosSec = expectedPosMs / 1000;

      if (activeAudio && Math.abs(activeAudio.currentTime - expectedPosSec) > 0.05) {
        activeAudio.currentTime = expectedPosSec;
      }

      try {
        usePlayerStore.getState().setCurrentTime(expectedPosSec, true);
        pb.play();
      } catch {}
    }
  }

  /**
   * Calculates the expected authoritative position at this exact millisecond
   */
  public calculateExpectedPositionMs(session: JamSession, atServerTime?: number): number {
    if (session.state !== 'PLAYING') {
      return session.positionMs;
    }

    const serverNow = atServerTime ?? this.clockSync.getEstimatedServerTime();

    // If still in the future lead-in buffer window
    if (serverNow < session.startAtServerTime) {
      return session.positionMs;
    }

    const elapsedMs = serverNow - session.startAtServerTime;
    const durationMs = session.currentSong?.duration ? session.currentSong.duration * 1000 : Infinity;
    return Math.min(durationMs, session.positionMs + elapsedMs);
  }

  /**
   * Core drift evaluation and automatic multi-tier correction step
   */
  public evaluateAndCorrect(): DriftStatus {
    const session = this.currentSession;
    if (!session) {
      return {
        expectedPositionMs: 0,
        actualLocalMs: 0,
        driftMs: 0,
        playbackRate: 1.0,
        isWaitingForStart: false,
        leadTimeRemainingMs: 0,
        correctionAction: 'NONE',
      };
    }

    const estimatedServerTime = this.clockSync.getEstimatedServerTime();
    const isWaitingForStart = session.state === 'PLAYING' && estimatedServerTime < session.startAtServerTime;
    const leadTimeRemainingMs = Math.max(0, session.startAtServerTime - estimatedServerTime);

    const expectedPositionMs = this.calculateExpectedPositionMs(session, estimatedServerTime);

    // Get actual local playback position from audio element
    const activeAudio = PlaybackService.getInstance().getActiveAudio();
    const actualLocalMs = activeAudio ? activeAudio.currentTime * 1000 : 0;

    if (!activeAudio || session.state === 'PAUSED' || isWaitingForStart) {
      if (activeAudio && activeAudio.playbackRate !== 1.0) {
        activeAudio.playbackRate = 1.0;
        this.currentRate = 1.0;
      }
      this.consecutiveLargeDriftCount = 0;

      const status: DriftStatus = {
        expectedPositionMs,
        actualLocalMs,
        driftMs: 0,
        playbackRate: 1.0,
        isWaitingForStart,
        leadTimeRemainingMs,
        correctionAction: isWaitingForStart ? 'WAITING_FOR_SCHEDULED_START' : 'NONE',
      };
      this.notify(status);
      return status;
    }

    // Drift = actualLocal - expected (positive = local device is ahead, negative = behind)
    const driftMs = Math.round(actualLocalMs - expectedPositionMs);
    this.lastDriftMs = driftMs;

    let targetRate = 1.0;
    let action: DriftStatus['correctionAction'] = 'NONE';

    const absDrift = Math.abs(driftMs);

    if (absDrift <= 30) {
      // Zone 1: Perfectly synchronized (within 30ms) -> Normal 1.0x
      targetRate = 1.0;
      action = 'NONE';
      this.consecutiveLargeDriftCount = 0;
    } else if (absDrift <= 120) {
      // Zone 2: Micro Drift (30ms - 120ms) -> Imperceptible smooth rate nudge (0.982x - 1.018x)
      action = 'MODULATE_RATE';
      targetRate = driftMs < 0 ? 1.018 : 0.982;
      this.consecutiveLargeDriftCount = 0;
    } else if (absDrift <= 350) {
      // Zone 3: Moderate Drift (120ms - 350ms) -> Slightly firmer rate nudge (0.955x - 1.045x)
      action = 'MODULATE_RATE';
      targetRate = driftMs < 0 ? 1.045 : 0.955;
      this.consecutiveLargeDriftCount = 0;
    } else if (absDrift > 2000) {
      // Massive gap (e.g. tab wakeup or seek) -> immediate controlled seek
      action = 'HARD_SEEK';
      targetRate = 1.0;
      activeAudio.currentTime = Math.max(0, expectedPositionMs / 1000);
      this.consecutiveLargeDriftCount = 0;
      console.log(`[DriftCorrectionEngine] Immediate seek due to large drift (${driftMs}ms) to ${(expectedPositionMs / 1000).toFixed(2)}s`);
    } else {
      // Zone 4: Persistent moderate-to-large drift (350ms - 2000ms)
      this.consecutiveLargeDriftCount++;
      if (this.consecutiveLargeDriftCount >= 2) {
        action = 'HARD_SEEK';
        targetRate = 1.0;
        activeAudio.currentTime = Math.max(0, expectedPositionMs / 1000);
        this.consecutiveLargeDriftCount = 0;
        console.log(`[DriftCorrectionEngine] Persistent drift (${driftMs}ms across 2 cycles). Performed controlled seek to ${(expectedPositionMs / 1000).toFixed(2)}s`);
      } else {
        // First cycle: apply firm rate modulation (1.05x / 0.95x) to check if transient
        action = 'MODULATE_RATE';
        targetRate = driftMs < 0 ? 1.05 : 0.95;
      }
    }

    // Apply playback rate smoothly
    if (Math.abs(activeAudio.playbackRate - targetRate) > 0.005) {
      activeAudio.playbackRate = targetRate;
      this.currentRate = targetRate;
    }

    const status: DriftStatus = {
      expectedPositionMs,
      actualLocalMs,
      driftMs,
      playbackRate: targetRate,
      isWaitingForStart: false,
      leadTimeRemainingMs: 0,
      correctionAction: action,
    };

    this.notify(status);
    return status;
  }

  /**
   * Starts the continuous drift monitoring loop (every 250ms)
   */
  public start() {
    if (this.isCorrectionRunning) return;
    this.isCorrectionRunning = true;

    this.loopInterval = setInterval(() => {
      this.evaluateAndCorrect();
    }, 250);
  }

  /**
   * Stops the drift monitoring loop
   */
  public stop() {
    this.isCorrectionRunning = false;
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    if (this.scheduledStartTimer) {
      clearTimeout(this.scheduledStartTimer);
      this.scheduledStartTimer = null;
    }

    const activeAudio = PlaybackService.getInstance().getActiveAudio();
    if (activeAudio) {
      activeAudio.playbackRate = 1.0;
    }
  }

  public getPlaybackDriftMs(): number {
    return this.lastDriftMs;
  }
}
