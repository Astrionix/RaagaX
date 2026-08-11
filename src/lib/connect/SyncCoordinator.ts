import { ClockSynchronizer } from './ClockSynchronizer';
import { PlaybackEngine } from '../playback/PlaybackEngine';
import { usePlayerStore } from '@/context/usePlayerStore';

export interface ClockStats {
  serverOffsetMs: number;
  rttMs: number;
  jitterMs: number;
  lastSyncAt: number;
}

export class SyncCoordinator {
  private static instance: SyncCoordinator;
  private syncTimer: NodeJS.Timeout | null = null;

  private stats: ClockStats = {
    serverOffsetMs: 0,
    rttMs: 15,
    jitterMs: 2,
    lastSyncAt: Date.now(),
  };

  private constructor() {}

  public static getInstance(): SyncCoordinator {
    if (!SyncCoordinator.instance) {
      SyncCoordinator.instance = new SyncCoordinator();
    }
    return SyncCoordinator.instance;
  }

  public getStats(): ClockStats {
    return { ...this.stats };
  }

  public startContinuousSync(intervalMs: number = 10000): void {
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

  public evaluateClockAndDrift(): number {
    const clock = ClockSynchronizer.getInstance();
    const serverNow = clock.getEstimatedServerNow();
    const localNow = Date.now();

    this.stats.serverOffsetMs = serverNow - localNow;
    this.stats.lastSyncAt = localNow;

    const store = usePlayerStore.getState();
    if (!store.isPlaying) return 0;

    const localPosMs = PlaybackEngine.getInstance().getCanonicalPositionMs();
    const expectedPosMs = store.currentTime * 1000;

    const driftMs = localPosMs - expectedPosMs;

    // Gentle correction policy
    if (Math.abs(driftMs) < 50) {
      // Ignore drift under 50ms
    } else if (Math.abs(driftMs) > 150 && store.isActiveDevice) {
      // Controlled seek for large drift
      console.log(`[SyncCoordinator] Correcting large drift: ${driftMs}ms`);
      PlaybackEngine.getInstance().seekCanonical(expectedPosMs);
    }

    return driftMs;
  }
}
