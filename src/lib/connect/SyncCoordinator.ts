import { ClockSynchronizer } from './ClockSynchronizer';
import { PlaybackEngine } from '../playback/PlaybackEngine';
import { usePlayerStore } from '@/context/usePlayerStore';

export interface PlaybackClock {
  anchorPositionMs: number;
  anchorServerTimeMs: number;
  playbackRate: number;
  status: 'PLAYING' | 'PAUSED' | 'BUFFERING';
}

export type SyncQualityLevel = 'EXCELLENT' | 'GOOD' | 'DEGRADED' | 'POOR';

export interface SyncQuality {
  rttMs: number;
  jitterMs: number;
  clockOffsetMs: number;
  driftMs: number;
  confidence: number;
  lastSyncAt: number;
  quality: SyncQualityLevel;
}

export class SyncCoordinator {
  private static instance: SyncCoordinator;
  private syncTimer: NodeJS.Timeout | null = null;
  private driftHistory: number[] = [];

  private clock: PlaybackClock = {
    anchorPositionMs: 0,
    anchorServerTimeMs: Date.now(),
    playbackRate: 1.0,
    status: 'PAUSED',
  };

  private qualityStats: SyncQuality = {
    rttMs: 18,
    jitterMs: 3,
    clockOffsetMs: 0,
    driftMs: 0,
    confidence: 0.98,
    lastSyncAt: Date.now(),
    quality: 'EXCELLENT',
  };

  private constructor() {}

  public static getInstance(): SyncCoordinator {
    if (!SyncCoordinator.instance) {
      SyncCoordinator.instance = new SyncCoordinator();
    }
    return SyncCoordinator.instance;
  }

  public getQuality(): SyncQuality {
    return { ...this.qualityStats };
  }

  public setPlaybackClockAnchor(anchorPositionMs: number, anchorServerTimeMs: number, playbackRate: number = 1.0, status: PlaybackClock['status'] = 'PLAYING'): void {
    this.clock = {
      anchorPositionMs,
      anchorServerTimeMs,
      playbackRate,
      status,
    };
  }

  /**
   * Calculates expected position driven by PlaybackClock anchor:
   * expected = anchorPositionMs + (serverNow - anchorServerTimeMs) * rate
   */
  public getExpectedPositionMs(): number {
    if (this.clock.status !== 'PLAYING') {
      return this.clock.anchorPositionMs;
    }
    const clockSync = ClockSynchronizer.getInstance();
    const serverNow = clockSync.getEstimatedServerNow();
    const elapsed = serverNow - this.clock.anchorServerTimeMs;
    return Math.max(0, this.clock.anchorPositionMs + elapsed * this.clock.playbackRate);
  }

  public startContinuousSync(intervalMs: number = 5000): void {
    if (this.syncTimer) clearInterval(this.syncTimer);

    this.syncTimer = setInterval(() => {
      this.evaluateClockAndDrift();
    }, intervalMs);
  }

  public stopContinuousSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Evaluates drift against PlaybackClock anchor and applies multi-sample hysteresis correction (requiring 3 consecutive samples beyond 150ms).
   */
  public evaluateClockAndDrift(): number {
    const clockSync = ClockSynchronizer.getInstance();
    const serverNow = clockSync.getEstimatedServerNow();
    const localNow = Date.now();

    this.qualityStats.clockOffsetMs = serverNow - localNow;
    this.qualityStats.lastSyncAt = localNow;

    const store = usePlayerStore.getState();
    if (!store.isPlaying) {
      this.driftHistory = [];
      return 0;
    }

    const localPosMs = PlaybackEngine.getInstance().getCanonicalPositionMs();
    const expectedPosMs = this.getExpectedPositionMs() || (store.currentTime * 1000);

    const driftMs = localPosMs - expectedPosMs;
    this.qualityStats.driftMs = driftMs;

    // Track drift history for multi-sample hysteresis
    this.driftHistory.push(Math.abs(driftMs));
    if (this.driftHistory.length > 5) {
      this.driftHistory.shift();
    }

    // Determine quality level
    const absDrift = Math.abs(driftMs);
    if (absDrift < 50) {
      this.qualityStats.quality = 'EXCELLENT';
    } else if (absDrift < 120) {
      this.qualityStats.quality = 'GOOD';
    } else if (absDrift < 250) {
      this.qualityStats.quality = 'DEGRADED';
    } else {
      this.qualityStats.quality = 'POOR';
    }

    // Multi-sample Hysteresis Check: Require at least 3 consecutive samples exceeding 150ms before correcting
    const recentSamples = this.driftHistory.slice(-3);
    const sustainedDrift = recentSamples.length >= 3 && recentSamples.every(sample => sample > 150);

    if (sustainedDrift && store.isActiveDevice) {
      console.log(`[SyncCoordinator] Sustained drift detected across ${recentSamples.length} samples (${driftMs}ms). Re-anchoring...`);
      PlaybackEngine.getInstance().seekCanonical(expectedPosMs);
      this.setPlaybackClockAnchor(expectedPosMs, serverNow, 1.0, 'PLAYING');
      this.driftHistory = [];
    }

    return driftMs;
  }
}
