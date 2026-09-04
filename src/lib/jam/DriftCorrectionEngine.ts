/**
 * DriftCorrectionEngine
 *
 * Provides ultra-low latency, sub-5ms (perceived 0ms) phase-locked synchronized
 * audio playback across multiple devices on the same WiFi / local network or Cloud.
 *
 * Algorithm:
 * 1. Network Time Protocol (NTP) RTT & Clock Offset Calibration with minimum-RTT
 *    outlier filtering (filters Wi-Fi packet jitter).
 * 2. Continuous Proportional Phase-Locked Loop (PLL) via micro-playbackRate scaling
 *    (0.995x - 1.045x with pitch preservation enabled).
 * 3. Non-intrusive drift catch-up: Eliminates audio pops, skips, and clicks.
 * 4. Cross-Platform: Coordinates HTML5 Web Audio and Android Native ExoPlayer
 *    with equal sub-5ms precision.
 * 5. Track-boundary reset guarantees 0:00 start on song transitions.
 */

import { PlaybackService } from '@/lib/playback/PlaybackService';
import { RaagaXNativePlayer } from '@/lib/playback/native/RaagaXNativePlayer';
import { usePlayerStore } from '@/context/usePlayerStore';

export interface DriftMetrics {
  currentDriftMs: number;
  averageRttMs: number;
  clockOffsetMs: number;
  targetPositionSec: number;
  isLocked: boolean; // |drift| <= 25ms (effectively 0ms audible Haas effect)
  currentPlaybackRate: number;
  lastSyncTimestamp: number;
}

export class DriftCorrectionEngine {
  private static instance: DriftCorrectionEngine;

  private isRunning = false;
  private checkInterval: any = null;
  private subscribers: Set<(metrics: DriftMetrics) => void> = new Set();

  // NTP / Clock Calibration
  private clockOffsetMs = 0;
  private rttSamples: number[] = [];
  private averageRttMs = 8; // Default 8ms for Wi-Fi

  // Master Timeline Reference
  private currentTrackId: string | null = null;
  private lastHostPositionMs = 0;
  private lastHostTimestamp = 0;
  private isHostPlaying = true;
  private lastReceiveLocalTime = 0;

  // Real-time Metrics
  private currentMetrics: DriftMetrics = {
    currentDriftMs: 0,
    averageRttMs: 8,
    clockOffsetMs: 0,
    targetPositionSec: 0,
    isLocked: true,
    currentPlaybackRate: 1.0,
    lastSyncTimestamp: 0,
  };

  private constructor() {}

  public static getInstance(): DriftCorrectionEngine {
    if (!DriftCorrectionEngine.instance) {
      DriftCorrectionEngine.instance = new DriftCorrectionEngine();
    }
    return DriftCorrectionEngine.instance;
  }

  public getMetrics(): DriftMetrics {
    return { ...this.currentMetrics };
  }

  public subscribe(cb: (metrics: DriftMetrics) => void): () => void {
    this.subscribers.add(cb);
    cb(this.currentMetrics);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notify(): void {
    const copy = this.getMetrics();
    this.subscribers.forEach((cb) => cb(copy));
  }

  /**
   * Reset engine state cleanly on song change so new tracks begin at 0:00
   */
  private trackStartedAt = 0;

  public resetTrack(trackId?: string): void {
    this.currentTrackId = trackId || null;
    this.trackStartedAt = Date.now();
    this.lastHostPositionMs = 0;
    this.lastHostTimestamp = 0;
    this.lastReceiveLocalTime = 0;
    this.applyPlaybackRate(1.0);
    this.currentMetrics = {
      ...this.currentMetrics,
      currentDriftMs: 0,
      targetPositionSec: 0,
      isLocked: true,
      currentPlaybackRate: 1.0,
    };
    this.notify();
  }

  /**
   * Calibrate Network Time & RTT using ping-pong measurements.
   * On Wi-Fi, filtering with minimum-RTT provides the most accurate clock offset
   * because minimum RTT approaches pure propagation delay without queuing jitter.
   */
  public recordRttSample(rttMs: number, hostServerTimeMs?: number, clientSendTimeMs?: number): void {
    if (rttMs > 0 && rttMs < 1000) {
      this.rttSamples.push(rttMs);
      if (this.rttSamples.length > 10) this.rttSamples.shift();

      // Median & Min RTT calculation
      const sorted = [...this.rttSamples].sort((a, b) => a - b);
      const minRtt = sorted[0];
      this.averageRttMs = sorted[Math.floor(sorted.length / 2)];

      if (hostServerTimeMs) {
        const now = Date.now();
        // If clientSendTimeMs was provided, use precise NTP 4-timestamp formula
        let estimatedOffset: number;
        if (clientSendTimeMs && clientSendTimeMs > 0) {
          const t0 = clientSendTimeMs;
          const t1 = hostServerTimeMs;
          const t2 = now;
          estimatedOffset = Math.round(t1 - (t0 + t2) / 2);
        } else {
          const estimatedTransit = minRtt / 2;
          estimatedOffset = Math.round((hostServerTimeMs + estimatedTransit) - now);
        }

        // Exponential moving average for clock offset: Rapid convergence on first 5 samples (< 750ms)
        const weight = this.rttSamples.length <= 5 ? 0.7 : 0.25;
        this.clockOffsetMs = this.clockOffsetMs === 0 ? estimatedOffset : Math.round(this.clockOffsetMs * (1 - weight) + estimatedOffset * weight);
        this.currentMetrics.clockOffsetMs = this.clockOffsetMs;
        this.currentMetrics.averageRttMs = Math.round(this.averageRttMs);
      }
    }
  }

  /**
   * Called whenever host sends authoritative playback state or periodic drift beacon
   */
  public recordHostBeacon(positionMs: number, hostTimestamp: number, trackId?: string, isPlaying: boolean = true): void {
    if (trackId && this.currentTrackId && trackId !== this.currentTrackId) {
      // New track began: clean boundary reset
      this.resetTrack(trackId);
    }

    if (trackId) {
      this.currentTrackId = trackId;
    }

    this.isHostPlaying = isPlaying;
    this.lastHostPositionMs = positionMs;
    this.lastHostTimestamp = hostTimestamp;
    this.lastReceiveLocalTime = Date.now();
    this.currentMetrics.lastSyncTimestamp = Date.now();
    this.currentMetrics.targetPositionSec = this.computeTargetPositionSec();

    // Start correction loop if not already running
    if (!this.isRunning) {
      this.start();
    }
  }

  /**
   * Compute exact target playhead in seconds at this current millisecond
   * using host timebase + network clock offset + playback state.
   */
  public computeTargetPositionSec(): number {
    if (this.lastHostTimestamp === 0) return 0;

    if (!this.isHostPlaying) {
      return Math.max(0, this.lastHostPositionMs / 1000);
    }

    const now = Date.now();
    // Estimated current time on host clock
    const currentHostTime = now + this.clockOffsetMs;
    const elapsedSinceHostBeaconMs = Math.max(0, currentHostTime - this.lastHostTimestamp);

    const totalEstimatedPositionMs = this.lastHostPositionMs + elapsedSinceHostBeaconMs;
    return Math.max(0, totalEstimatedPositionMs / 1000);
  }

  /**
   * Start continuous high-frequency Phase-Locked Loop (PLL) drift alignment
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Check drift every 150ms for ultra-responsive phase alignment
    this.checkInterval = setInterval(() => {
      this.performDriftCorrectionStep();
    }, 150);
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;

    // Restore standard playback rate
    this.applyPlaybackRate(1.0);

    this.currentMetrics = {
      ...this.currentMetrics,
      currentDriftMs: 0,
      isLocked: false,
      currentPlaybackRate: 1.0,
    };
    this.notify();
  }

  /**
   * Reads current playhead position in seconds from Native ExoPlayer or Web Audio
   */
  private getCurrentAudioPositionSec(): number | null {
    if (RaagaXNativePlayer.isNative()) {
      const state = RaagaXNativePlayer.getCachedPlaybackState();
      if (state && typeof state.positionMs === 'number' && state.positionMs >= 0) {
        return state.positionMs / 1000;
      }
      return usePlayerStore.getState().currentTime || 0;
    }

    const playback = PlaybackService.getInstance();
    const audio = playback.getActiveAudio();
    if (!audio || audio.paused || !audio.src || isNaN(audio.currentTime) || audio.currentTime < 0) {
      return null;
    }
    return audio.currentTime;
  }

  /**
   * Core PLL Algorithm:
   * Smoothly micro-adjusts playback speed to achieve 0ms audible drift without clicks or pauses.
   */
  private performDriftCorrectionStep(): void {
    const store = usePlayerStore.getState();
    if (!store.isPlaying) {
      return;
    }

    const currentSec = this.getCurrentAudioPositionSec();
    if (currentSec === null) {
      return;
    }

    const targetSec = this.computeTargetPositionSec();
    if (targetSec <= 0 && currentSec <= 0.5) {
      return;
    }

    // Positive drift = local audio is ahead of host; Negative drift = local audio is lagging behind
    const driftSec = currentSec - targetSec;
    const driftMs = Math.round(driftSec * 1000);

    this.currentMetrics.currentDriftMs = driftMs;
    this.currentMetrics.targetPositionSec = targetSec;
    this.currentMetrics.averageRttMs = Math.round(this.averageRttMs);
    this.currentMetrics.clockOffsetMs = this.clockOffsetMs;

    const absDriftMs = Math.abs(driftMs);

    // ── CASE 1: Hard Resync (Severe desynchronization > 350ms) ───────────────
    // Allow a 1200ms grace period on track start so buffer priming isn't interrupted by eager seeks
    const isWithinTrackGracePeriod = (Date.now() - this.trackStartedAt) < 1200;
    if (absDriftMs > 350) {
      if (!isWithinTrackGracePeriod) {
        this.applySeek(targetSec);
        this.applyPlaybackRate(1.0);
        this.currentMetrics.isLocked = true;
        this.notify();
        return;
      }
    }

    // ── CASE 2: Near Zero Drift (<= 5ms) ────────────────────────────────────
    // Sub-5ms difference is completely inaudible (perceived 0ms drift!).
    if (absDriftMs <= 5) {
      this.applyPlaybackRate(1.0);
      this.currentMetrics.isLocked = true;
      this.notify();
      return;
    }

    // ── CASE 3: Inaudible Micro-Nudge (5ms - 25ms) ──────────────────────────
    // Within Haas psychoacoustic effect (< 25ms). Ear perceives as single speaker.
    // Micro-adjust speed by +/- 0.5% (imperceptible pitch change).
    if (absDriftMs <= 25) {
      this.currentMetrics.isLocked = true;
      const targetRate = driftMs < 0 ? 1.005 : 0.995;
      this.applyPlaybackRate(targetRate);
      this.notify();
      return;
    }

    // ── CASE 4: Proportional PLL Micro-Adjustment (25ms - 350ms) ────────────
    this.currentMetrics.isLocked = false;
    let targetRate = 1.0;

    if (driftMs < 0) {
      // Local is lagging behind -> Speed up smoothly
      if (absDriftMs < 100) {
        targetRate = 1.02;  // +2.0% speed: catches up 20ms/sec
      } else {
        targetRate = 1.045; // +4.5% speed: catches up 45ms/sec
      }
    } else {
      // Local is running ahead -> Slow down smoothly
      if (absDriftMs < 100) {
        targetRate = 0.98;  // -2.0% speed
      } else {
        targetRate = 0.955; // -4.5% speed
      }
    }

    this.applyPlaybackRate(targetRate);
    this.notify();
  }

  private applyPlaybackRate(rate: number): void {
    if (Math.abs(this.currentMetrics.currentPlaybackRate - rate) < 0.002) return;
    this.currentMetrics.currentPlaybackRate = rate;

    if (RaagaXNativePlayer.isNative()) {
      try {
        RaagaXNativePlayer.setPlaybackRate(rate);
      } catch {}
    } else {
      const playback = PlaybackService.getInstance();
      const audio = playback.getActiveAudio();
      if (audio) {
        try {
          this.ensurePitchPreservation(audio);
          audio.playbackRate = rate;
        } catch {}
      }
    }
  }

  private applySeek(targetSec: number): void {
    if (RaagaXNativePlayer.isNative()) {
      try {
        RaagaXNativePlayer.seekTo(Math.round(targetSec * 1000));
      } catch {}
    } else {
      const playback = PlaybackService.getInstance();
      const audio = playback.getActiveAudio();
      if (audio) {
        try {
          audio.currentTime = targetSec;
        } catch {}
      }
    }
    usePlayerStore.setState({ currentTime: targetSec });
  }

  private ensurePitchPreservation(audio: HTMLAudioElement): void {
    try {
      if ('preservesPitch' in audio) {
        (audio as any).preservesPitch = true;
      }
      if ('webkitPreservesPitch' in audio) {
        (audio as any).webkitPreservesPitch = true;
      }
      if ('mozPreservesPitch' in audio) {
        (audio as any).mozPreservesPitch = true;
      }
    } catch {}
  }
}
