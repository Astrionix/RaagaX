import { JamSession } from '@/types/jam';
import { ClockSyncEngine } from './ClockSyncEngine';
import { NetworkQualityEngine } from './NetworkQualityEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RaagaXNativePlayer } from '@/lib/playback/native/RaagaXNativePlayer';

export type DriftQualityState = 'SYNCED' | 'CORRECTING' | 'HIGH_DRIFT' | 'CRITICAL' | 'INVESTIGATION';
export type DriftReadinessState = 'IDLE' | 'LOADING' | 'PREPARING' | 'BUFFERING' | 'SEEKING' | 'SCHEDULED' | 'STARTING' | 'PLAYING_CONFIRMED' | 'PAUSED';

export interface CorrectionRecord {
  correctionId: string;
  timelineId: string;
  generation: number;
  targetPositionMs: number;
  driftMs: number;
  startTime: number;
  action: 'RATE_MODULATION' | 'HARD_SEEK';
  completionState: 'PENDING' | 'COMPLETED' | 'SUPERSEDED';
}

export interface DriftStatus {
  expectedPositionMs: number;
  actualLocalMs: number;
  driftMs: number;
  playbackRate: number;
  isWaitingForStart: boolean;
  leadTimeRemainingMs: number;
  correctionAction: 'NONE' | 'MODULATE_RATE' | 'HARD_SEEK' | 'WAITING_FOR_SCHEDULED_START';
  qualityState: DriftQualityState;
  readinessState: DriftReadinessState;
  correctionId?: string;
  timelineId?: string;
  generation?: number;
  revision?: number;
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

  private readinessState: DriftReadinessState = 'IDLE';
  private activeCorrection: CorrectionRecord | null = null;

  // STARTUP DRIFT GRACE (Phase 3 + Section 4):
  // After a session loads, resumes, or changes state, suppress drift evaluation
  // for a 3s window so the audio element has time to seek and start playing smoothly
  // before we start computing micro-drift. This prevents the audio element reporting
  // currentTime=0 from ever triggering false hard seeks.
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

  public getReadinessState(): DriftReadinessState {
    return this.readinessState;
  }

  public setReadinessState(state: DriftReadinessState) {
    this.readinessState = state;
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
      const startPlaybackAtExpectedPosition = () => {
        const liveSession = this.currentSession;
        if (!liveSession || liveSession.state !== 'PLAYING') return;
        const nowServer = this.clockSync.estimatedServerNow();
        const liveExpectedPosMs = this.calculateExpectedPositionMs(liveSession, nowServer);
        const liveExpectedPosSec = liveExpectedPosMs / 1000;
        const liveAudio = PlaybackService.getInstance().getActiveAudio();

        if (liveAudio && typeof liveAudio.currentTime === 'number' && Math.abs(liveAudio.currentTime - liveExpectedPosSec) > 0.05) {
          try {
            liveAudio.currentTime = liveExpectedPosSec;
          } catch {}
        }
        if (isNative) {
          RaagaXNativePlayer.seekTo(liveExpectedPosMs);
        }

        try {
          usePlayerStore.getState().setCurrentTime(liveExpectedPosSec, true);
          console.log(`[PLAYBACK_EFFECT] action=PLAY reason=IMMEDIATE_START timelineId=${currentTL} generation=${currentGen}`);
          pb.play();
        } catch {}
      };

      if (activeAudio && typeof activeAudio.readyState === 'number' && activeAudio.readyState < 1) {
        // Audio metadata not loaded yet: wait for loadedmetadata before seeking and starting
        if (typeof activeAudio.addEventListener === 'function') {
          activeAudio.addEventListener('loadedmetadata', () => {
            startPlaybackAtExpectedPosition();
          }, { once: true });
        } else {
          startPlaybackAtExpectedPosition();
        }
      } else {
        startPlaybackAtExpectedPosition();
      }
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
        qualityState: 'SYNCED',
        readinessState: 'IDLE',
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

    // Section 2: Required States Guarding
    // During LOADING, PREPARING, BUFFERING, SEEKING, SCHEDULED, STARTING, drift engine must not fight playback
    const storeState = usePlayerStore.getState();
    const isAudioBufferingOrSyncing = isNative
      ? (storeState.playbackIntent === 'PLAYING' && !storeState.isPlaying) || this.readinessState === 'SEEKING'
      : (activeAudio
        ? activeAudio.paused || activeAudio.seeking || (typeof activeAudio.readyState === 'number' && activeAudio.readyState < 2)
        : true);

    const timeSinceLoadMs = this.lastSessionLoadTimeMs > 0 ? Date.now() - this.lastSessionLoadTimeMs : Infinity;
    const isAudioNearStart = actualLocalMs < 1000;
    const isAudioNotYetPositioned = expectedPositionMs > 3000 && actualLocalMs < 1000 && timeSinceLoadMs < 3000;
    const isInStartupGrace = timeSinceLoadMs < DriftCorrectionEngine.STARTUP_GRACE_MS && isAudioNearStart;

    let currentReadiness: DriftReadinessState = 'PLAYING_CONFIRMED';
    if (session.state === 'PAUSED') {
      currentReadiness = 'PAUSED';
    } else if (isWaitingForStart) {
      currentReadiness = 'SCHEDULED';
    } else if (isAudioBufferingOrSyncing) {
      currentReadiness = (activeAudio?.seeking || this.readinessState === 'SEEKING') ? 'SEEKING' : 'BUFFERING';
    } else if (isInStartupGrace || isAudioNotYetPositioned) {
      currentReadiness = isAudioNotYetPositioned ? 'STARTING' : 'PREPARING';
    } else {
      currentReadiness = 'PLAYING_CONFIRMED';
    }
    this.readinessState = currentReadiness;

    // If not in PLAYING_CONFIRMED state, do NOT run active correction
    if (currentReadiness !== 'PLAYING_CONFIRMED' || (!activeAudio && !isNative)) {
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
        qualityState: 'SYNCED',
        readinessState: currentReadiness,
        timelineId: session.timelineId,
        generation: session.generation,
        revision: session.revision,
      };
      this.notify(status);
      return status;
    }

    // Section 1: Strict Drift Definition (driftMs = actualPlayerPositionMs - expectedTimelinePositionMs)
    // NEVER fake, clamp, or hide measured drift
    const driftMs = Math.round(actualLocalMs - expectedPositionMs);
    this.lastDriftMs = driftMs;

    let targetRate = 1.0;
    let action: DriftStatus['correctionAction'] = 'NONE';
    let qualityState: DriftQualityState = 'SYNCED';
    let correctionId: string | undefined = undefined;

    const absDrift = Math.abs(driftMs);

    // Diagnostic logging when drift exceeds 300ms
    if (absDrift > 300) {
      this.logLargeDriftDiagnostic(session, expectedPositionMs, actualLocalMs, driftMs, activeAudio);
    }

    // Section 4 & 18: Progressive Correction Strategy & Quality States
    if (absDrift < 30) {
      // 0–30ms: SYNCED -> Target achieved, no correction
      qualityState = 'SYNCED';
      targetRate = 1.0;
      action = 'NONE';
      this.consecutiveLargeDriftCount = 0;
    } else if (absDrift < 100) {
      // 30–100ms: CORRECTING -> Gentle playback-rate correction (0.982x / 1.018x)
      qualityState = 'CORRECTING';
      action = 'MODULATE_RATE';
      targetRate = driftMs < 0 ? 1.018 : 0.982;
      this.consecutiveLargeDriftCount = 0;
    } else if (absDrift < 300) {
      // 100–300ms: HIGH DRIFT -> Stronger controlled rate correction (0.948x / 1.052x)
      qualityState = 'HIGH_DRIFT';
      action = 'MODULATE_RATE';
      targetRate = driftMs < 0 ? 1.052 : 0.948;
      this.consecutiveLargeDriftCount = 0;
    } else if (absDrift <= 500) {
      // 300–500ms: CRITICAL -> Controlled convergence (0.925x / 1.075x)
      qualityState = 'CRITICAL';
      action = 'MODULATE_RATE';
      targetRate = driftMs < 0 ? 1.075 : 0.925;
      this.consecutiveLargeDriftCount = 0;
    } else if (absDrift > 5000) {
      // >5000ms: Timeline Anomaly Guard (suppress blind seek, investigate state)
      qualityState = 'INVESTIGATION';
      console.warn(`[TIMELINE_ANOMALY_SUPPRESSED] drift=${driftMs}ms timelineId=${session.timelineId} gen=${session.generation} — suppressing blind seek`);
      action = 'NONE';
      targetRate = 1.0;
      this.consecutiveLargeDriftCount = 0;
    } else {
      // 500ms - 5000ms: INVESTIGATION -> Confirmed persistent drift triggers ONE controlled seek
      qualityState = 'INVESTIGATION';
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

        correctionId = `corr_${now}_${Math.random().toString(36).slice(2, 7)}`;
        this.activeCorrection = {
          correctionId,
          timelineId: session.timelineId || 'TL_1',
          generation: session.generation ?? 1,
          targetPositionMs: expectedPositionMs,
          driftMs,
          startTime: now,
          action: 'HARD_SEEK',
          completionState: 'PENDING',
        };

        if (activeAudio) {
          activeAudio.currentTime = Math.max(0, expectedPositionMs / 1000);
        }
        if (isNative) {
          RaagaXNativePlayer.seekTo(Math.max(0, expectedPositionMs));
        }
        console.log(`[PLAYBACK_EFFECT] action=SEEK reason=DRIFT_CORRECTION timelineId=${session.timelineId || 'TL_1'} driftMs=${driftMs} hardSeekCount=${this.hardSeekCount} correctionId=${correctionId}`);
      } else {
        // While waiting for cooldown/stability, apply firm rate nudge rather than rapid-seeking
        action = 'MODULATE_RATE';
        targetRate = driftMs < 0 ? 1.075 : 0.925;
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
      qualityState,
      readinessState: this.readinessState,
      correctionId,
      timelineId: session.timelineId,
      generation: session.generation,
      revision: session.revision,
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
