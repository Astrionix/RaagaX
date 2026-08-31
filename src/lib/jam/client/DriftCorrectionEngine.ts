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
  private static readonly HARD_SEEK_COOLDOWN_MS = 2000;
  private static readonly RATE_CHANGE_HOLD_MS = 400;

  private readinessState: DriftReadinessState = 'IDLE';
  private activeCorrection: CorrectionRecord | null = null;

  // STARTUP DRIFT GRACE (Phase 3 + Section 4):
  // After a session loads, resumes, or changes state, suppress drift evaluation
  // for a 3s window so the audio element has time to seek and start playing smoothly
  // before we start computing micro-drift. This prevents the audio element reporting
  // currentTime=0 from ever triggering false hard seeks.
  private lastSessionLoadTimeMs = 0;
  private static readonly STARTUP_GRACE_MS = 3000;

  // ─── PID Controller & EMA Filter (Broadcast-grade Drift Engine) ───────────────
  // Proportional gain: base rate change per ms of smoothed drift
  private static readonly Kp = 0.0018;
  // Integral gain: corrects steady-state bias (e.g. clock running 0.02% fast)
  private static readonly Ki = 0.000015;
  // Derivative gain: rate change per ms/s of drift velocity (anti-overshoot)
  private static readonly Kd = 0.0009;
  // Anti-windup: clamp accumulated integral to prevent runaway on large transients
  private static readonly INTEGRAL_CLAMP_MS_S = 40;
  // EMA alpha: higher = more responsive, lower = smoother (noise rejection)
  private static readonly EMA_ALPHA = 0.35;
  // rAF throttle: run PID at most every 50ms even on 60fps rAF (avoids stale-currentTime noise)
  private static readonly RAF_MIN_INTERVAL_MS = 50;
  // Foreground grace: suppress hard seeks for this many ms after app/tab returns to foreground
  private static readonly FOREGROUND_GRACE_MS = 3000;

  // Smoothed drift (EMA output fed into the PID controller)
  private smoothedDriftMs = 0;
  // Previous EMA value used to compute velocity
  private prevSmoothedDriftMs = 0;
  // Drift velocity in ms/s (derivative term)
  private driftVelocityMsPerSec = 0;
  // Accumulated integral error for bias elimination (ms·s)
  private integralMs = 0;
  // Timestamp of last evaluateAndCorrect() call, for Δt computation
  private lastEvalTimeMs = 0;

  // requestAnimationFrame handle (web only; null on native)
  private rafHandle: number | null = null;
  // Last timestamp that rAF actually ran a PID evaluation (throttle guard)
  private lastRafEvalMs = 0;
  // setInterval handle used when page/app is hidden (rAF stops in background)
  private visibilityFallbackInterval: any = null;
  // performance.now() timestamp when the page/app returned to foreground
  // Used to suppress hard seeks during the initial resync window
  private foregroundRestoreTimeMs = 0;
  // visibilitychange listener ref for cleanup
  private visibilityListener: (() => void) | null = null;

  // ── Gap 2: Native position interpolation ─────────────────────────────────
  // ExoPlayer reports position at ~1Hz via usePlayerStore.currentTime.
  // We anchor the last known position + a performance.now() timestamp so we can
  // interpolate sub-second positions between updates, giving the PID accurate
  // velocity readings on native (instead of seeing Δdrift=0 then a 1000ms jump).
  private lastNativePositionMs = 0;
  private lastNativeAnchorMs   = 0;  // performance.now() at last ExoPlayer update

  // ── Gap 6: Network transport change detection ─────────────────────────────
  // When the link changes (Wi-Fi→cellular), reset EMA/integral immediately so the
  // adaptive gains re-tune to the new RTT/jitter without a 10s EMA settling delay.
  private lastKnownTransport = '';

  // Hysteresis flag: prevents rate flapping at the SYNCED boundary
  // Enter SYNCED when |smoothed| < deadBand; exit only when |smoothed| > deadBand + 10ms
  private isInSyncedZone = true;

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
        prevSession.jamId !== session.jamId ||
        prevSession.timelineId !== session.timelineId ||
        prevSession.trackId !== session.trackId ||
        prevSession.generation !== session.generation ||
        (prevSession.state !== 'PLAYING' && session.state === 'PLAYING') ||
        Math.abs((prevSession.positionMs || 0) - (session.positionMs || 0)) > 500;

      if (isNewPlaybackIdentity) {
        this.lastSessionLoadTimeMs = Date.now();
        this.readinessState = session.state === 'PLAYING' ? 'PREPARING' : 'PAUSED';
        // Seed EMA to zero so stale drift from previous track/seek cannot
        // bleed into the first correction cycle of the new playback identity.
        this.smoothedDriftMs = 0;
        this.prevSmoothedDriftMs = 0;
        this.driftVelocityMsPerSec = 0;
        this.integralMs = 0;       // reset integral so no previous bias bleeds into new track
        this.lastEvalTimeMs = 0;
        this.isInSyncedZone = true;
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
          console.log(`\n[JAM_PLAYING_CONFIRMED]\ntrackId=${this.currentSession?.trackId || 'NONE'}\ntimelineId=${liveTL}\ngeneration=${liveGen}\n`);
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
          console.log(`\n[JAM_PLAYING_CONFIRMED]\ntrackId=${liveSession.trackId || 'NONE'}\ntimelineId=${currentTL}\ngeneration=${currentGen}\n`);
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

    // ── Gap 2: Native position interpolation ─────────────────────────────
    // ExoPlayer pushes positionMs at ~1Hz. Between updates, interpolate using
    // performance.now() so the PID gets accurate sub-second positions and
    // the derivative term doesn't see phantom Δdrift=0 → 1000ms jumps.
    let actualLocalMs: number;
    if (isNative) {
      const storePositionMs = usePlayerStore.getState().currentTime * 1000;
      const perfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
      // If ExoPlayer updated more recently than our anchor, re-anchor
      if (storePositionMs !== this.lastNativePositionMs) {
        this.lastNativePositionMs = storePositionMs;
        this.lastNativeAnchorMs   = perfNow;
      }
      // Interpolate: add elapsed time since last ExoPlayer report (capped at 1.5s)
      const msSinceUpdate = Math.min(1500, perfNow - this.lastNativeAnchorMs);
      actualLocalMs = this.lastNativePositionMs + (usePlayerStore.getState().isPlaying ? msSinceUpdate : 0);
    } else {
      actualLocalMs = activeAudio ? activeAudio.currentTime * 1000 : 0;
    }

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

    // ── Step 1: Raw drift (authoritative, never hidden) ──────────────────────
    const rawDriftMs = actualLocalMs - expectedPositionMs;
    const evalNow = Date.now();

    // ── Step 2: EMA smoother — reject single-frame currentTime noise ─────────
    // First sample after a new playback identity: seed EMA directly from rawDrift
    // so tests and real sessions see the true drift immediately on the first tick.
    // Subsequent calls blend via EMA to filter jitter/noise.
    const isFirstSample = this.lastEvalTimeMs === 0;
    const deltaT = isFirstSample
      ? 0.1
      : Math.min((evalNow - this.lastEvalTimeMs) / 1000, 1.0);  // cap at 1s (tab focus protection)
    this.lastEvalTimeMs = evalNow;

    this.prevSmoothedDriftMs = this.smoothedDriftMs;
    this.smoothedDriftMs = isFirstSample
      ? rawDriftMs   // hard-seed: no blending on first tick of a new identity
      : DriftCorrectionEngine.EMA_ALPHA * rawDriftMs +
        (1 - DriftCorrectionEngine.EMA_ALPHA) * this.smoothedDriftMs;

    // ── Step 3: Derivative — drift velocity (ms/s) ───────────────────────────
    // Positive velocity = drift is growing; negative = drift is shrinking (converging).
    this.driftVelocityMsPerSec = deltaT > 0.01
      ? (this.smoothedDriftMs - this.prevSmoothedDriftMs) / deltaT
      : 0;

    // Expose smoothed drift to callers (badge, store, test suite)
    this.lastDriftMs = Math.round(this.smoothedDriftMs);

    const absDrift    = Math.abs(this.smoothedDriftMs);
    const absRawDrift = Math.abs(rawDriftMs);

    if (absRawDrift > 0 || Math.abs(this.smoothedDriftMs) > 0) {
      console.log(`\n[JAM_DRIFT]\nexpectedMs=${Math.round(expectedPositionMs)}\nactualMs=${Math.round(actualLocalMs)}\ndriftMs=${Math.round(rawDriftMs)}\n`);
    }

    // Diagnostic logging when raw drift exceeds 300ms
    if (absRawDrift > 300) {
      this.logLargeDriftDiagnostic(session, expectedPositionMs, actualLocalMs, Math.round(rawDriftMs), activeAudio);
    }

    // ── Step 4: Network-adaptive dead-band & Same-Wi-Fi Zero-Drift Mode ───────
    // LAN/Bluetooth peers have very low RTT (< 15ms) → activate Zero-Drift Micro-Sync.
    // In this mode, instead of ignoring drift under 15ms, the engine applies continuous
    // pitch-neutral micro-nudges (±0.15% max speed) that smoothly eliminate steady-state
    // drift down to 0.0ms across all devices on the same Wi-Fi without pitch artifacts.
    const netMetrics       = this.networkEngine.getMetrics();
    const isLanOrPeer      = netMetrics.transport === 'LAN' || netMetrics.transport === 'PEER';
    const isLowLatencyWifi = isLanOrPeer || (netMetrics.rttMedian <= 20 && netMetrics.jitter <= 4);
    const baseDead         = isLanOrPeer ? 15 : 30;
    const deadBandMs       = Math.max(baseDead, netMetrics.rttMedian * 0.15);
    // Hysteresis guard: once SYNCED, require drift to exceed deadBand+10ms before re-engaging macro PID
    const exitThresholdMs  = deadBandMs + 10;

    // ── Gap 6: Network transport change — flush EMA + integral immediately ─
    // When the link changes (Wi-Fi→cellular or LAN→CLOUD), the old EMA history
    // is invalid for the new RTT/jitter regime. Reset so PID re-tunes now.
    const currentTransport = netMetrics.transport ?? '';
    if (this.lastKnownTransport && this.lastKnownTransport !== currentTransport) {
      this.smoothedDriftMs       = rawDriftMs;  // hard-seed to current raw reading
      this.prevSmoothedDriftMs   = rawDriftMs;
      this.driftVelocityMsPerSec = 0;
      this.integralMs            = 0;
      this.lastEvalTimeMs        = 0;  // force isFirstSample on next tick
      console.log(`[DRIFT_ENGINE] Network transport changed: ${this.lastKnownTransport} → ${currentTransport}. EMA + integral reset.`);
    }
    this.lastKnownTransport = currentTransport;

    let targetRate   = 1.0;
    let action: DriftStatus['correctionAction'] = 'NONE';
    let qualityState: DriftQualityState = 'SYNCED';
    let correctionId: string | undefined;

    // ── Step 5: Correction decision ──────────────────────────────────────────
    if (absDrift > 5000) {
      // Timeline Anomaly Guard: >5s anomaly is almost always a clock domain bug,
      // not a real drift. Suppress to avoid catastrophic blind seeks.
      qualityState = 'INVESTIGATION';
      console.warn(
        `[TIMELINE_ANOMALY_SUPPRESSED] smoothedDrift=${Math.round(this.smoothedDriftMs)}ms ` +
        `rawDrift=${Math.round(rawDriftMs)}ms timelineId=${session.timelineId} gen=${session.generation} — suppressing blind seek`
      );
      action    = 'NONE';
      targetRate = 1.0;
      this.consecutiveLargeDriftCount = 0;
      // Reset EMA so we re-seed cleanly once the anomaly clears
      this.smoothedDriftMs     = 0;
      this.prevSmoothedDriftMs = 0;

    } else if (absDrift > (isNative ? 300 : 500)) {
      // ── Hard seek threshold: 300ms (native) / 500ms (web) ─────────────────
      qualityState = 'INVESTIGATION';
      this.consecutiveLargeDriftCount++;
      const isCooldownElapsed = evalNow - this.lastHardSeekTimeMs >= DriftCorrectionEngine.HARD_SEEK_COOLDOWN_MS;

      // ── Foreground grace window: suppress hard seeks after background restore
      const msSinceForeground = this.foregroundRestoreTimeMs > 0
        ? Date.now() - this.foregroundRestoreTimeMs
        : Infinity;
      const isInForegroundGrace = msSinceForeground < DriftCorrectionEngine.FOREGROUND_GRACE_MS;

      if (isCooldownElapsed && !isAudioBufferingOrSyncing && !isInForegroundGrace) {
        action     = 'HARD_SEEK';
        targetRate = 1.0;
        this.lastHardSeekTimeMs     = evalNow;
        this.hardSeekCount++;
        this.consecutiveLargeDriftCount = 0;
        this.readinessState = 'SEEKING';
        // Reset EMA + integral after seek so we start fresh from the new position
        this.smoothedDriftMs     = 0;
        this.prevSmoothedDriftMs = 0;
        this.integralMs          = 0;
        this.isInSyncedZone      = true;

        correctionId = `corr_${evalNow}_${Math.random().toString(36).slice(2, 7)}`;

        // ── Predictive seek compensation ─────────────────────────────────
        const estimatedSeekLatencyMs = isNative
          ? Math.min(1200, Math.max(300, netMetrics.rttMedian * 2 + 100))
          : Math.min(400,  Math.max(80,  netMetrics.rttMedian * 1.5 + 40));
        const predictiveTargetMs = Math.max(0, expectedPositionMs + estimatedSeekLatencyMs);
        const predictiveTargetSec = predictiveTargetMs / 1000;

        this.activeCorrection = {
          correctionId,
          timelineId:       session.timelineId || 'TL_1',
          generation:       session.generation ?? 1,
          targetPositionMs: predictiveTargetMs,
          driftMs:          Math.round(rawDriftMs),
          startTime:        evalNow,
          action:           'HARD_SEEK',
          completionState:  'PENDING',
        };

        if (activeAudio) {
          activeAudio.currentTime = predictiveTargetSec;
        }
        if (isNative) {
          RaagaXNativePlayer.seekTo(predictiveTargetMs);
        }
        console.log(
          `[PLAYBACK_EFFECT] action=SEEK reason=DRIFT_CORRECTION ` +
          `timelineId=${session.timelineId || 'TL_1'} smoothedDrift=${Math.round(this.smoothedDriftMs)}ms ` +
          `rawDrift=${Math.round(rawDriftMs)}ms predictiveTarget=${Math.round(predictiveTargetMs)}ms ` +
          `seekLatencyEstimate=${Math.round(estimatedSeekLatencyMs)}ms hardSeekCount=${this.hardSeekCount} correctionId=${correctionId}`
        );
      } else {
        // While waiting for cooldown, apply strong rate nudge (10%) rather than rapid-seeking
        action     = 'MODULATE_RATE';
        targetRate = this.smoothedDriftMs < 0 ? 1.100 : 0.900;
      }

    } else {
      // ── PID Controller zone: |drift| ≤ 500ms ──────────────────────────────
      this.consecutiveLargeDriftCount = 0;

      // Hysteresis: update SYNCED zone membership
      if (this.isInSyncedZone) {
        if (absDrift > exitThresholdMs) this.isInSyncedZone = false;
      } else {
        if (absDrift < deadBandMs) this.isInSyncedZone = true;
      }

      if (this.isInSyncedZone) {
        // Inside standard dead-band zone (e.g. |drift| <= 15ms or 30ms)
        qualityState = 'SYNCED';

        if (isLowLatencyWifi && absDrift > 1.0) {
          // ── SAME WI-FI / LOCAL LAN ZERO-DRIFT MICRO-SYNC ─────────────────
          // On same Wi-Fi, actively zero out residual micro-drift (1.0ms–15ms).
          // Uses pitch-neutral micro-rate nudges (±0.15% max: 0.9985x–1.0015x)
          // to continuously pull drift to 0.0ms without audible distortion.
          action = 'MODULATE_RATE';

          // Micro-integral accumulation for sub-millisecond precision
          this.integralMs += this.smoothedDriftMs * deltaT;
          this.integralMs = Math.max(-10, Math.min(10, this.integralMs));

          const microKp = 0.00035;
          const microKi = 0.00002;
          const microKd = 0.00015;

          const isConverging = this.smoothedDriftMs * this.driftVelocityMsPerSec < 0;
          const effectiveMicroKp = isConverging ? microKp * 0.5 : microKp;

          let microAdjust =
            effectiveMicroKp * this.smoothedDriftMs +
            microKi          * this.integralMs +
            microKd          * this.driftVelocityMsPerSec;

          // Clamp to ±0.20% — 100% pitch-neutral micro-correction
          targetRate = Math.max(0.9980, Math.min(1.0020, 1.0 - microAdjust));
        } else {
          // True Phase-Lock (drift <= 1.0ms) or Cloud Mode within deadband: hold 1.0x
          this.integralMs = 0;
          action          = 'NONE';
          targetRate      = 1.0;
        }

      } else {
        // Label quality state for UI / telemetry
        if      (absDrift < 100) qualityState = 'CORRECTING';
        else if (absDrift < 300) qualityState = 'HIGH_DRIFT';
        else                     qualityState = 'CRITICAL';
        action = 'MODULATE_RATE';

        // ── Adaptive gains (jitter-scaled) ──────────────────────────────────
        const jitterMs      = netMetrics.jitter;
        const jitterScale   = Math.max(0.5, Math.min(1.0, 1.0 - (jitterMs - 5) / 120));
        const lanBoost      = isLanOrPeer ? 1.5 : 1.0;
        const adaptiveKp    = Math.min(0.004, DriftCorrectionEngine.Kp * jitterScale * lanBoost);
        const adaptiveKd    = Math.min(0.002, DriftCorrectionEngine.Kd * jitterScale * lanBoost);
        const adaptiveKi    = DriftCorrectionEngine.Ki;

        // ── Integral accumulation with anti-windup ─────────────────────────
        this.integralMs += this.smoothedDriftMs * deltaT;
        this.integralMs = Math.max(
          -DriftCorrectionEngine.INTEGRAL_CLAMP_MS_S,
          Math.min(DriftCorrectionEngine.INTEGRAL_CLAMP_MS_S, this.integralMs)
        );

        // ── PID rate formula ────────────────────────────────────────────────
        const isConverging = this.smoothedDriftMs * this.driftVelocityMsPerSec < 0;
        const effectiveKp  = isConverging ? adaptiveKp * 0.5 : adaptiveKp;

        let pidAdjust =
          effectiveKp * this.smoothedDriftMs +         // P: current error
          adaptiveKi  * this.integralMs +              // I: accumulated bias
          adaptiveKd  * this.driftVelocityMsPerSec;   // D: rate of change

        // ── Clock-confidence gating ────────────────────────────────────────
        const clockConf = this.clockSync.getState().confidence;
        if (clockConf < 0.7) {
          pidAdjust *= (clockConf / 0.7);
        }

        // Clamp to ±12% — beyond that, a hard seek is faster and cleaner
        targetRate = Math.max(0.88, Math.min(1.12, 1.0 - pidAdjust));
      }
    }

    // ── Step 6: Apply rate with hold-window & micro-sensitivity ──────────────
    const holdTime    = isLowLatencyWifi ? 120 : DriftCorrectionEngine.RATE_CHANGE_HOLD_MS;
    const minRateDiff = isLowLatencyWifi ? 0.0004 : 0.008;

    if (activeAudio) {
      const rateDiff            = Math.abs(activeAudio.playbackRate - targetRate);
      const isReturningToNormal = targetRate === 1.0 && rateDiff > 0.001;
      const isHoldElapsed       = evalNow - this.lastRateChangeTimeMs >= holdTime;

      if (isReturningToNormal || (rateDiff >= minRateDiff && isHoldElapsed)) {
        // iOS Safari playbackRate guard: only apply when playing
        const isIOS = typeof navigator !== 'undefined' &&
          /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        if (!isIOS || !activeAudio.paused) {
          activeAudio.playbackRate  = targetRate;
          this.currentRate          = targetRate;
          this.lastRateChangeTimeMs = evalNow;
        }
      }
    }

    // Native Android ExoPlayer real-time rate modulation
    if (isNative) {
      const rateDiff            = Math.abs(this.currentRate - targetRate);
      const isReturningToNormal = targetRate === 1.0 && rateDiff > 0.001;
      const isHoldElapsed       = evalNow - this.lastRateChangeTimeMs >= holdTime;

      if (isReturningToNormal || (rateDiff >= minRateDiff && isHoldElapsed)) {
        this.currentRate          = targetRate;
        this.lastRateChangeTimeMs = evalNow;
        RaagaXNativePlayer.setPlaybackRate(targetRate);
      }
    }

    const status: DriftStatus = {
      expectedPositionMs,
      actualLocalMs,
      driftMs:         this.lastDriftMs,  // smoothed value
      playbackRate:    targetRate,
      isWaitingForStart: false,
      leadTimeRemainingMs: 0,
      correctionAction: action,
      qualityState,
      readinessState: this.readinessState,
      correctionId,
      timelineId:  session.timelineId,
      generation:  session.generation,
      revision:    session.revision,
    };

    this.notify(status);
    return status;
  }

  /**
   * Starts the drift monitoring loop.
   *
   * Web: uses requestAnimationFrame (~16ms) throttled to RAF_MIN_INTERVAL_MS (50ms)
   *      for high-precision timing with low jitter vs setInterval.
   * Native: falls back to setInterval(100ms) since rAF is not available.
   *
   * The throttle ensures we don't waste CPU reading stale AudioElement.currentTime
   * on every 60fps frame — browsers update currentTime roughly every 250ms.
   */
  public start() {
    if (this.isCorrectionRunning) return;
    this.isCorrectionRunning = true;

    const isNative = RaagaXNativePlayer.isNative();
    const hasRaf   = !isNative && typeof requestAnimationFrame !== 'undefined';

    // Helpers: start/stop the rAF loop and the background setInterval fallback
    const startRaf = () => {
      if (this.rafHandle !== null) return;
      const rafLoop = () => {
        if (!this.isCorrectionRunning) return;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - this.lastRafEvalMs >= DriftCorrectionEngine.RAF_MIN_INTERVAL_MS) {
          this.lastRafEvalMs = now;
          this.evaluateAndCorrect();
        }
        this.rafHandle = requestAnimationFrame(rafLoop);
      };
      this.rafHandle = requestAnimationFrame(rafLoop);
    };

    const stopRaf = () => {
      if (this.rafHandle !== null) {
        cancelAnimationFrame(this.rafHandle);
        this.rafHandle = null;
      }
    };

    const startVisibilityFallback = () => {
      if (this.visibilityFallbackInterval) return;
      // Browsers throttle setInterval to ~1Hz when hidden — still enough to
      // keep the PID alive and not miss a complete session reset.
      this.visibilityFallbackInterval = setInterval(() => {
        if (this.isCorrectionRunning) this.evaluateAndCorrect();
      }, 500);
    };

    const stopVisibilityFallback = () => {
      if (this.visibilityFallbackInterval) {
        clearInterval(this.visibilityFallbackInterval);
        this.visibilityFallbackInterval = null;
      }
    };

    if (hasRaf) {
      // ── Gap 1: Visibility change handler ─────────────────────────────────
      // rAF stops completely when a tab is hidden or app is backgrounded.
      // Switch to a 500ms setInterval while hidden (browsers allow this at 1Hz
      // even in background — enough to not miss a full session reset).
      // On restore: flush EMA hard-seed, set foreground grace window,
      // then resume rAF for high-precision corrections.
      this.visibilityListener = () => {
        if (typeof document === 'undefined') return;
        if (document.hidden) {
          // Tab/app going to background
          stopRaf();
          startVisibilityFallback();
        } else {
          // Tab/app returning to foreground
          stopVisibilityFallback();

          // ── Gap 4: Foreground grace window ──────────────────────────────
          // Background-accumulated drift looks like real drift but audio was
          // simply paused/suspended. Reset EMA so the hard-seed on the first
          // tick reflects actual current drift, and start the grace window
          // so only rate correction (not hard seeks) fires for 3s.
          this.lastEvalTimeMs      = 0;  // triggers EMA hard-seed on next tick
          this.smoothedDriftMs     = 0;
          this.prevSmoothedDriftMs = 0;
          this.driftVelocityMsPerSec = 0;
          this.integralMs          = 0;
          this.foregroundRestoreTimeMs = Date.now();

          startRaf();
        }
      };

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', this.visibilityListener);
      }

      // Start rAF immediately (tab starts visible)
      startRaf();
    } else {
      // Native / SSR / test fallback: setInterval at 100ms
      this.loopInterval = setInterval(() => {
        this.evaluateAndCorrect();
      }, 100);
    }
  }

  /**
   * Stops the drift monitoring loop and restores 1.0x playback rate.
   */
  public stop() {
    this.isCorrectionRunning = false;

    // Cancel rAF loop (web)
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    // Cancel visibility fallback interval
    if (this.visibilityFallbackInterval) {
      clearInterval(this.visibilityFallbackInterval);
      this.visibilityFallbackInterval = null;
    }
    // Remove visibilitychange listener
    if (this.visibilityListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
    // Cancel setInterval fallback (native / test)
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

  /**
   * Called by the native ExoPlayer position listener whenever a new position
   * is reported. Anchors the interpolation base used by evaluateAndCorrect()
   * to give the PID accurate sub-1s position readings on Android.
   */
  public updateNativePosition(positionMs: number) {
    this.lastNativePositionMs = positionMs;
    this.lastNativeAnchorMs   = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  public getPlaybackDriftMs(): number {
    return this.lastDriftMs;
  }

  /**
   * Returns full PID controller diagnostics for the debug badge and test suite.
   * All values reflect the state after the most recent evaluateAndCorrect() call.
   */
  public getDriftDiagnostics(): {
    rawDriftMs:             number;
    smoothedDriftMs:        number;
    driftVelocityMsPerSec:  number;
    integralMs:             number;
    isInSyncedZone:         boolean;
    currentRate:            number;
    hardSeekCount:          number;
    clockConfidence:        number;
    loopMode:               'RAF' | 'INTERVAL';
  } {
    return {
      rawDriftMs:            this.lastDriftMs,
      smoothedDriftMs:       Math.round(this.smoothedDriftMs),
      driftVelocityMsPerSec: Math.round(this.driftVelocityMsPerSec),
      integralMs:            Math.round(this.integralMs * 100) / 100,
      isInSyncedZone:        this.isInSyncedZone,
      currentRate:           this.currentRate,
      hardSeekCount:         this.hardSeekCount,
      clockConfidence:       this.clockSync.getState().confidence,
      loopMode:              this.rafHandle !== null ? 'RAF' : 'INTERVAL',
    };
  }

  public resetForTesting() {
    this.stop();
    this.currentSession             = null;
    this.lastDriftMs                = 0;
    this.currentRate                = 1.0;
    this.consecutiveLargeDriftCount = 0;
    this.lastHardSeekTimeMs         = 0;
    this.lastRateChangeTimeMs       = 0;
    this.hardSeekCount              = 0;
    // PID controller / EMA state
    this.smoothedDriftMs            = 0;
    this.prevSmoothedDriftMs        = 0;
    this.driftVelocityMsPerSec      = 0;
    this.integralMs                 = 0;
    this.lastEvalTimeMs             = 0;
    this.isInSyncedZone             = true;
    // rAF + visibility state
    this.rafHandle                  = null;
    this.lastRafEvalMs              = 0;
    this.visibilityFallbackInterval = null;
    this.foregroundRestoreTimeMs    = 0;
    this.visibilityListener         = null;
    // Native interpolation state
    this.lastNativePositionMs       = 0;
    this.lastNativeAnchorMs         = 0;
    // Network transport state
    this.lastKnownTransport         = '';
    this.listeners.clear();
  }
}
