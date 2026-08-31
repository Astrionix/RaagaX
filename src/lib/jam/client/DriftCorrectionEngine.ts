import { JamSession } from '@/types/jam';
import { ClockSyncEngine } from './ClockSyncEngine';
import { NetworkQualityEngine } from './NetworkQualityEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RaagaXNativePlayer } from '@/lib/playback/native/RaagaXNativePlayer';

export interface DriftStatus {
  expectedPositionMs: number;
  actualLocalMs: number;
  driftMs: number;
  playbackRate: number;
  isWaitingForStart: boolean;
  leadTimeRemainingMs: number;
  correctionAction: 'NONE' | 'MODULATE_RATE' | 'HARD_SEEK' | 'WAITING_FOR_SCHEDULED_START';
  timelineId?: string;
  generation?: number;
}

export type DriftListener = (status: DriftStatus) => void;

export class DriftCorrectionEngine {
  private static instance: DriftCorrectionEngine;

  private clockSync: ClockSyncEngine;
  private networkEngine: NetworkQualityEngine;
  private currentSession: JamSession | null = null;
  private isCorrectionRunning = false;
  private loopInterval: any = null;
  private lastDriftMs = 0;
  private currentRate = 1.0;
  private listeners: Set<DriftListener> = new Set();
  private scheduledStartTimer: any = null;
  private scheduledGeneration: number = 0;
  private scheduledTimelineId: string = '';

  private consecutiveLargeDriftCount = 0;
  private lastHardSeekTimeMs = 0;
  private lastRateChangeTimeMs = 0;
  private hardSeekCount = 0;
  private static readonly HARD_SEEK_COOLDOWN_MS = 3500;
  private static readonly RATE_CHANGE_HOLD_MS = 800;

  private readinessState: 'IDLE' | 'LOADING' | 'PREPARING' | 'SCHEDULED' | 'STARTING' | 'SEEKING' | 'STABILIZING' | 'STEADY_PLAYING' | 'PAUSED' = 'IDLE';

  // STARTUP DRIFT GRACE (Phase 3 + Section 4):
  // After a session loads, resumes, or changes state, suppress drift evaluation
  // for a 3s window so the audio element has time to seek and start playing smoothly
  // before we start computing micro-drift. This prevents the audio element reporting
  // currentTime=0 from ever triggering false 270s+ hard seeks.
  private lastSessionLoadTimeMs = 0;
  private static readonly STARTUP_GRACE_MS = 3000;

  private constructor() {
    this.clockSync = ClockSyncEngine.getInstance();
    this.networkEngine = NetworkQualityEngine.getInstance();
  }

  public static getInstance(): DriftCorrectionEngine {
    if (!DriftCorrectionEngine.instance) {
      DriftCorrectionEngine.instance = new DriftCorrectionEngine();
    }
    return DriftCorrectionEngine.instance;
  }

  public getHardSeekCount(): number {
    return this.hardSeekCount;
  }

  public setSession(session: JamSession | null) {
    const prevSession = this.currentSession;
    this.currentSession = session;
    if (session) {
      // Re-trigger grace window on:
      // 1. New session or track change
      // 2. Generation change
      // 3. State transition (PAUSED -> PLAYING / Resume)
      // 4. Anchor / Seek position update
      const isNewPlaybackIdentity =
        prevSession === null ||
        prevSession.trackId !== session.trackId ||
        prevSession.generation !== session.generation ||
        (prevSession.state !== 'PLAYING' && session.state === 'PLAYING') ||
        Math.abs((prevSession.positionMs || 0) - (session.positionMs || 0)) > 500;

      if (isNewPlaybackIdentity) {
        this.lastSessionLoadTimeMs = Date.now();
        this.readinessState = session.state === 'PLAYING' ? 'PREPARING' : 'PAUSED';
      }

      this.evaluateScheduledStart(session);
    } else {
      this.lastSessionLoadTimeMs = 0;
      this.readinessState = 'IDLE';
      this.cancelScheduledStart();
    }
  }

  private cancelScheduledStart() {
    if (this.scheduledStartTimer) {
      clearTimeout(this.scheduledStartTimer);
      this.scheduledStartTimer = null;
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

  /**
   * Evaluates if we need to schedule a future start trigger based on authoritative startAtServerTime
   */
  public evaluateScheduledStart(session: JamSession) {
    this.cancelScheduledStart();

    if (session.state !== 'PLAYING') return;

    const estimatedServerTime = this.clockSync.estimatedServerNow();
    const delayMs = session.startAtServerTime - estimatedServerTime;
    const pb = PlaybackService.getInstance();
    const activeAudio = pb.getActiveAudio();
    const isNative = RaagaXNativePlayer.isNative();

    const currentGen = session.generation ?? session.revision;
    const currentTL = session.timelineId ?? `TL_${session.revision}`;

    // If audio is ALREADY playing this running timeline smoothly, do not restart or seek
    if (!isNative && activeAudio && !activeAudio.paused) {
      const nowServer = this.clockSync.estimatedServerNow();
      const expectedPosMs = this.calculateExpectedPositionMs(session, nowServer);
      const curLocalMs = activeAudio.currentTime * 1000;
      if (Math.abs(curLocalMs - expectedPosMs) < 800) {
        console.log(`[PLAYBACK_EFFECT] action=NO_OP reason=ALREADY_PLAYING_TIMELINE timelineId=${currentTL} generation=${currentGen}`);
        this.scheduledGeneration = currentGen;
        this.scheduledTimelineId = currentTL;
        return;
      }
    }

    this.scheduledGeneration = currentGen;
    this.scheduledTimelineId = currentTL;

    const targetSec = (session.positionMs || 0) / 1000;
    const targetMs = session.positionMs || 0;

    if (delayMs > 10) {
      // Schedule local play execution at exact future server timestamp
      if (activeAudio) {
        // Pre-seek to authoritative starting position in preparation
        // Guard: only seek if the audio is NOT already at the correct position (avoid spurious seeks on reconnect)
        if (typeof activeAudio.readyState === 'number' && activeAudio.readyState >= 1) {
          if (typeof activeAudio.currentTime === 'number' && Math.abs(activeAudio.currentTime - targetSec) > 0.05) {
            activeAudio.currentTime = targetSec;
          }
        } else if (typeof activeAudio.addEventListener === 'function') {
          activeAudio.addEventListener('loadedmetadata', () => {
            try {
              // Re-check position at metadata load time; skip if already at correct spot
              if (Math.abs(activeAudio.currentTime - targetSec) > 0.05) {
                activeAudio.currentTime = targetSec;
              }
            } catch {}
          }, { once: true });
        } else if (typeof activeAudio.currentTime === 'number') {
          if (Math.abs(activeAudio.currentTime - targetSec) > 0.05) {
            activeAudio.currentTime = targetSec;
          }
        }
      }
      if (isNative) {
        RaagaXNativePlayer.seekTo(targetMs);
      }
      usePlayerStore.getState().setCurrentTime(targetSec, true);

      this.scheduledStartTimer = setTimeout(() => {
        // Generation guard: ignore callback if session or timeline changed while waiting
        const liveSession = this.currentSession;
        if (!liveSession || liveSession.state !== 'PLAYING') return;

        const liveGen = liveSession.generation ?? liveSession.revision;
        const liveTL = liveSession.timelineId ?? `TL_${liveSession.revision}`;
        if (liveGen !== currentGen || liveTL !== currentTL) {
          console.log(`[DriftCorrectionEngine] Ignoring stale scheduled start callback for gen ${currentGen} (current gen ${liveGen})`);
          return;
        }

        try {
          const nowServer = this.clockSync.estimatedServerNow();
          const expectedPosMs = this.calculateExpectedPositionMs(liveSession, nowServer);
          const expectedPosSec = expectedPosMs / 1000;
          const liveAudio = PlaybackService.getInstance().getActiveAudio();
          if (liveAudio && typeof liveAudio.currentTime === 'number' && Math.abs(liveAudio.currentTime - expectedPosSec) > 0.05) {
            liveAudio.currentTime = expectedPosSec;
          }
          if (isNative) {
            RaagaXNativePlayer.seekTo(expectedPosMs);
          }
          usePlayerStore.getState().setCurrentTime(expectedPosSec, true);
          console.log(`[PLAYBACK_EFFECT] action=PLAY reason=SCHEDULED_START timelineId=${liveTL} generation=${liveGen}`);
          PlaybackService.getInstance().play();
        } catch {}
      }, delayMs);
    } else {
      // Already past schedule time: compute exact in-flight timeline position and seek before playing
      const expectedPosMs = this.calculateExpectedPositionMs(session, estimatedServerTime);
      const expectedPosSec = expectedPosMs / 1000;

      if (activeAudio && typeof activeAudio.currentTime === 'number' && Math.abs(activeAudio.currentTime - expectedPosSec) > 0.05) {
        if (typeof activeAudio.readyState === 'number' && activeAudio.readyState >= 1) {
          activeAudio.currentTime = expectedPosSec;
        } else if (typeof activeAudio.addEventListener === 'function') {
          activeAudio.addEventListener('loadedmetadata', () => {
            try { activeAudio.currentTime = expectedPosSec; } catch {}
          }, { once: true });
        } else {
          activeAudio.currentTime = expectedPosSec;
        }
      }
      if (isNative) {
        RaagaXNativePlayer.seekTo(expectedPosMs);
      }

      try {
        usePlayerStore.getState().setCurrentTime(expectedPosSec, true);
        console.log(`[PLAYBACK_EFFECT] action=PLAY reason=IMMEDIATE_START timelineId=${currentTL} generation=${currentGen}`);
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

    const serverNow = atServerTime ?? this.clockSync.estimatedServerNow();

    // If still in the future lead-in buffer window
    if (serverNow < session.startAtServerTime) {
      return session.positionMs;
    }

    const elapsedMs = serverNow - session.startAtServerTime;
    const durationMs = session.currentSong?.duration ? session.currentSong.duration * 1000 : Infinity;
    return Math.min(durationMs, session.positionMs + elapsedMs);
  }

  /**
   * Logs complete diagnostic context when large playback drift is detected (Section 14).
   *
   * CLOCK DOMAIN AUDIT (Phase 7):
   * All timestamps in this engine belong to one of two domains:
   *   - SERVER_MS: UTC milliseconds from server clock (session.startAtServerTime, session.timelineStartServerMs)
   *   - CLIENT_MS: Local clock ms (Date.now())
   *   - ESTIMATED_SERVER_MS: Date.now() + clockSync.getState().offsetMs
   *     (where offsetMs = server_clock - client_clock, positive = server is ahead)
   * The drift formula:
   *   expectedPositionMs = (estimatedServerNow - session.startAtServerTime) + session.basePositionMs
   *   driftMs = actualLocalMs - expectedPositionMs  (positive = local is ahead, negative = behind)
   */
  private logLargeDriftDiagnostic(
    session: JamSession,
    expectedPosMs: number,
    actualLocalMs: number,
    driftMs: number,
    activeAudio: HTMLAudioElement | null
  ) {
    const netMetrics = this.networkEngine.getMetrics();
    const clockState = this.clockSync.getState();
    const clientNow = Date.now();
    const serverNow = clientNow + clockState.offsetMs;

    let bufferState = 'UNKNOWN';
    if (activeAudio) {
      const buffered = activeAudio.buffered;
      const curTime = activeAudio.currentTime;
      let bufferedEnd = 0;
      for (let i = 0; i < buffered.length; i++) {
        if (buffered.start(i) <= curTime && curTime <= buffered.end(i)) {
          bufferedEnd = buffered.end(i);
          break;
        }
      }
      bufferState = `ready=${activeAudio.readyState}, bufferedAhead=${Math.max(0, bufferedEnd - curTime).toFixed(1)}s, paused=${activeAudio.paused}`;
    }

    // Elapsed time in server domain since timeline anchor
    const elapsedSinceAnchorMs = serverNow - (session.startAtServerTime || serverNow);

    console.warn('[SYNC_DRIFT_DIAGNOSTIC]', {
      // ── Clock Domain Context ──────────────────────────────────
      // CLIENT_MS: raw local clock
      clientNow,
      // ESTIMATED_SERVER_MS: local clock adjusted by NTP-style offset
      serverNow,
      // NTP-style offset: server_clock - client_clock
      clockOffsetMs: clockState.offsetMs,
      clockOffsetSign: clockState.offsetMs >= 0 ? 'server_is_ahead' : 'client_is_ahead',
      // ── Timeline Anchor (SERVER_MS domain) ────────────────────
      // startAtServerTime: the server UTC ms when playback was scheduled to begin
      anchorServerTime: session.startAtServerTime,
      // basePositionMs: the track offset (ms) at which playback was anchored
      basePositionMs: session.basePositionMs ?? session.positionMs,
      // How long ago (in server clock) the timeline started
      elapsedSinceAnchorMs,
      // ── Drift Calculation ─────────────────────────────────────
      // expectedPositionMs = elapsedSinceAnchorMs + basePositionMs
      expectedPosition: `${(expectedPosMs / 1000).toFixed(3)}s (${expectedPosMs}ms)`,
      actualPosition: `${(actualLocalMs / 1000).toFixed(3)}s (${actualLocalMs}ms)`,
      drift: `${driftMs >= 0 ? `+${driftMs}` : driftMs}ms`,
      // ── Session Identity ──────────────────────────────────────
      trackId: session.trackId || session.currentSong?.id || 'unknown',
      timelineId: session.timelineId || `TL_${session.revision}`,
      transitionId: session.transitionId || 'N/A',
      generation: session.generation ?? session.revision,
      // ── Network Quality ───────────────────────────────────────
      RTT: `${netMetrics.rttMedian}ms (raw ${netMetrics.rtt}ms)`,
      jitter: `${netMetrics.jitter}ms`,
      packetLoss: `${netMetrics.packetLoss}%`,
      connectionState: netMetrics.quality,
      transport: netMetrics.transport,
      bufferState,
    });

    console.log(`\n[DRIFT]\njamId=${session.jamId}\ntimelineId=${session.timelineId || 'N/A'}\ngeneration=${session.generation || 1}\ndeviceId=LOCAL\nserverNow=${serverNow}\nclientNow=${clientNow}\nclockOffset=${clockState.offsetMs}ms\nanchorServerTime=${session.startAtServerTime}\nbasePosition=${session.basePositionMs ?? session.positionMs}ms\nexpected=${expectedPosMs}\nactual=${actualLocalMs}\ndrift=${driftMs}ms\nrtt=${netMetrics?.rtt || 0}ms\njitter=${netMetrics?.jitter || 0}ms\n`);
  }


  /**
   * Core drift evaluation and progressive multi-tier correction step
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

    const estimatedServerTime = this.clockSync.estimatedServerNow();
    const isWaitingForStart = session.state === 'PLAYING' && estimatedServerTime < session.startAtServerTime;
    const leadTimeRemainingMs = Math.max(0, session.startAtServerTime - estimatedServerTime);

    const expectedPositionMs = this.calculateExpectedPositionMs(session, estimatedServerTime);

    // Get actual local playback position from audio element or native store
    const isNative = RaagaXNativePlayer.isNative();
    const activeAudio = PlaybackService.getInstance().getActiveAudio();
    const actualLocalMs = isNative
      ? usePlayerStore.getState().currentTime * 1000
      : (activeAudio ? activeAudio.currentTime * 1000 : 0);

    // Priority 17: During loading, buffering, seeking, or transitions, drift engine must not fight playback
    const isAudioBufferingOrSyncing = isNative
      ? false
      : (activeAudio
        ? activeAudio.paused || activeAudio.seeking || (typeof activeAudio.readyState === 'number' && activeAudio.readyState < 2)
        : true);

    if ((!activeAudio && !isNative) || session.state === 'PAUSED' || isWaitingForStart || isAudioBufferingOrSyncing) {
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
        timelineId: session.timelineId,
        generation: session.generation,
      };
      this.notify(status);
      return status;
    }

    // STARTUP DRIFT GRACE & POSITION SEEK READINESS (Phase 3 + Section 4):
    // 1. Suppress drift evaluation ONLY when audio is still near 0:00 or not yet positioned at the anchor.
    // 2. If audio is already playing at the correct position (>1s), compute steady-state drift immediately.
    // 3. Filter out false 0:00 readings when audio is still preparing / seeking to a mid-song anchor.
    const timeSinceLoadMs = this.lastSessionLoadTimeMs > 0 ? Date.now() - this.lastSessionLoadTimeMs : Infinity;
    const isAudioNearStart = actualLocalMs < 1000;
    const isAudioNotYetPositioned = expectedPositionMs > 3000 && actualLocalMs < 2000;
    const isInStartupGrace = timeSinceLoadMs < DriftCorrectionEngine.STARTUP_GRACE_MS && isAudioNearStart;

    if (isInStartupGrace || isAudioNotYetPositioned) {
      if (isAudioNotYetPositioned) {
        this.readinessState = 'STARTING';
        // If audio is stalled at 0 after 600ms, nudge seek directly to expected position
        if (timeSinceLoadMs > 600 && timeSinceLoadMs < 5000 && activeAudio && (activeAudio.readyState >= 1 || !activeAudio.seeking)) {
          try {
            activeAudio.currentTime = expectedPositionMs / 1000;
            this.lastSessionLoadTimeMs = Date.now();
          } catch {}
        }
      } else {
        this.readinessState = 'STABILIZING';
      }

      if (activeAudio && activeAudio.playbackRate !== 1.0) {
        activeAudio.playbackRate = 1.0;
        this.currentRate = 1.0;
      }
      const status: DriftStatus = {
        expectedPositionMs,
        actualLocalMs,
        driftMs: 0,
        playbackRate: 1.0,
        isWaitingForStart: false,
        leadTimeRemainingMs: 0,
        correctionAction: 'NONE',
        timelineId: session.timelineId,
        generation: session.generation,
      };
      this.notify(status);
      return status;
    }

    this.readinessState = 'STEADY_PLAYING';


    // Drift = actualLocal - expected (positive = local device is ahead, negative = behind)
    const driftMs = Math.round(actualLocalMs - expectedPositionMs);
    this.lastDriftMs = driftMs;

    let targetRate = 1.0;
    let action: DriftStatus['correctionAction'] = 'NONE';

    const absDrift = Math.abs(driftMs);

    // Diagnostic logging for investigation when drift exceeds 300ms
    if (absDrift > 300) {
      this.logLargeDriftDiagnostic(session, expectedPositionMs, actualLocalMs, driftMs, activeAudio);
    }

    if (absDrift <= 35) {
      // Tier 1: In Sync (|drift| <= 35ms) -> Normal 1.0x
      targetRate = 1.0;
      action = 'NONE';
      this.consecutiveLargeDriftCount = 0;
    } else if (absDrift <= 120) {
      // Tier 2: Micro Drift (35ms - 120ms) -> Imperceptible rate nudge (0.982x / 1.018x)
      action = 'MODULATE_RATE';
      targetRate = driftMs < 0 ? 1.018 : 0.982;
      this.consecutiveLargeDriftCount = 0;
    } else if (absDrift <= 500) {
      // Tier 3: Moderate Drift (120ms - 500ms) -> Firm rate nudge (0.948x / 1.052x)
      action = 'MODULATE_RATE';
      targetRate = driftMs < 0 ? 1.052 : 0.948;
      this.consecutiveLargeDriftCount = 0;
    } else {
      // Tier 4: Large Drift (> 500ms) -> Controlled seek with cooldown protection
      this.consecutiveLargeDriftCount++;
      const now = Date.now();
      const isCooldownElapsed = now - this.lastHardSeekTimeMs >= DriftCorrectionEngine.HARD_SEEK_COOLDOWN_MS;

      if (isCooldownElapsed && !isAudioBufferingOrSyncing) {
        action = 'HARD_SEEK';
        targetRate = 1.0;
        this.lastHardSeekTimeMs = now;
        this.hardSeekCount++;
        this.consecutiveLargeDriftCount = 0;
        this.readinessState = 'SEEKING';

        if (activeAudio) {
          activeAudio.currentTime = Math.max(0, expectedPositionMs / 1000);
        }
        if (isNative) {
          RaagaXNativePlayer.seekTo(Math.max(0, expectedPositionMs));
        }
        console.log(`[PLAYBACK_EFFECT] action=SEEK reason=DRIFT_CORRECTION timelineId=${session.timelineId || 'TL_1'} driftMs=${driftMs} hardSeekCount=${this.hardSeekCount}`);
      } else {
        // While waiting for cooldown (avoiding rapid seek loop), apply firm rate nudge rather than rapid-seeking
        action = 'MODULATE_RATE';
        targetRate = driftMs < 0 ? 1.052 : 0.948;
      }
    }

    // Apply playback rate smoothly with rate-hold window; ALWAYS restore 1.0x when converged
    if (activeAudio) {
      const now = Date.now();
      const rateDiff = Math.abs(activeAudio.playbackRate - targetRate);
      const isReturningToNormal = targetRate === 1.0 && rateDiff > 0.005;
      const isHoldElapsed = now - this.lastRateChangeTimeMs >= DriftCorrectionEngine.RATE_CHANGE_HOLD_MS;

      if (isReturningToNormal || (rateDiff > 0.008 && isHoldElapsed)) {
        activeAudio.playbackRate = targetRate;
        this.currentRate = targetRate;
        this.lastRateChangeTimeMs = now;
      }
    }

    const status: DriftStatus = {
      expectedPositionMs,
      actualLocalMs,
      driftMs,
      playbackRate: targetRate,
      isWaitingForStart: false,
      leadTimeRemainingMs: 0,
      correctionAction: action,
      timelineId: session.timelineId,
      generation: session.generation,
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
    this.cancelScheduledStart();

    const activeAudio = PlaybackService.getInstance().getActiveAudio();
    if (activeAudio) {
      activeAudio.playbackRate = 1.0;
    }
  }

  public getPlaybackDriftMs(): number {
    return this.lastDriftMs;
  }

  public resetForTesting() {
    this.stop();
    this.currentSession = null;
    this.lastDriftMs = 0;
    this.currentRate = 1.0;
    this.consecutiveLargeDriftCount = 0;
    this.lastHardSeekTimeMs = 0;
    this.lastRateChangeTimeMs = 0;
    this.hardSeekCount = 0;
    this.listeners.clear();
  }
}
