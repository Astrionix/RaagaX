import { getApiUrl } from '@/lib/config/apiConfig';

interface ClockSample {
  rtt: number;
  oneWayLatency: number;
  offset: number;
  serverTimeMs: number;
}

export class ClockSynchronizer {
  private static instance: ClockSynchronizer;
  private serverTimeOffsetMs: number = 0;
  private isSynchronized: boolean = false;
  /** One-way latency of the best sample — represents our clock uncertainty bound */
  private clockUncertaintyMs: number = 30;
  private lastSyncAt: number = 0;
  private syncCount: number = 0;
  private isSyncing: boolean = false;

  private constructor() {}

  public static getInstance(): ClockSynchronizer {
    if (!ClockSynchronizer.instance) {
      ClockSynchronizer.instance = new ClockSynchronizer();
    }
    return ClockSynchronizer.instance;
  }

  /**
   * Multi-Sample Statistical Clock Synchronization (SNTP-inspired filter)
   *
   * Fires 3-5 burst samples against /api/time, rejects jitter outliers,
   * selects the lowest RTT measurement, and clamps offset jumps to prevent playback skips.
   */
  public async synchronize(endpoint: string = '/api/time', burstCount: number = 4): Promise<void> {
    if (this.isSyncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }
    this.isSyncing = true;

    try {
      const url = getApiUrl(endpoint);
      const samples: ClockSample[] = [];

      for (let i = 0; i < burstCount; i++) {
        try {
          const t0 = performance.now();
          const localWallBefore = Date.now();
          const response = await fetch(url, { method: 'GET', cache: 'no-store' });

          if (response.ok) {
            const data = await response.json();
            const t1 = performance.now();
            const serverTimeMs = Number(data?.serverTimeMs || data?.serverTime);

            if (!isNaN(serverTimeMs) && serverTimeMs > 0) {
              const rtt = Math.max(1, t1 - t0);
              const oneWayLatency = rtt / 2;
              const estimatedLocalAtServer = localWallBefore + oneWayLatency;
              const offset = serverTimeMs - estimatedLocalAtServer;

              samples.push({
                rtt,
                oneWayLatency,
                offset,
                serverTimeMs,
              });
            }
          }
        } catch {}

        // Small spacing between burst samples
        if (i < burstCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
      }

      if (samples.length === 0) {
        throw new Error('All burst samples failed');
      }

      // Filter out high latency spikes (> 1000ms)
      const validSamples = samples.filter((s) => s.rtt < 1000);
      const candidates = validSamples.length > 0 ? validSamples : samples;

      // Sort by lowest RTT (lowest network jitter)
      candidates.sort((a, b) => a.rtt - b.rtt);

      // Best sample is lowest RTT
      const bestSample = candidates[0];

      // Smooth offset updates: If already synchronized, damp large jumps
      if (this.isSynchronized && Math.abs(bestSample.offset - this.serverTimeOffsetMs) > 1500) {
        // Clamp maximum jump to 300ms delta per sync
        const maxDelta = 300;
        const delta = bestSample.offset - this.serverTimeOffsetMs;
        this.serverTimeOffsetMs += Math.sign(delta) * Math.min(Math.abs(delta), maxDelta);
      } else {
        this.serverTimeOffsetMs = bestSample.offset;
      }

      this.clockUncertaintyMs = Math.max(10, Math.round(bestSample.oneWayLatency));
      this.isSynchronized = true;
      this.lastSyncAt = Date.now();
      this.syncCount++;

      console.log(
        `[ClockSynchronizer] Synced! Best RTT: ${bestSample.rtt.toFixed(1)}ms, Offset: ${this.serverTimeOffsetMs.toFixed(0)}ms, Uncertainty: ±${this.clockUncertaintyMs}ms (from ${samples.length} samples)`
      );
    } catch (e) {
      console.warn('[ClockSynchronizer] Failed to synchronize clock:', e);
      if (!this.isSynchronized) {
        this.serverTimeOffsetMs = 0;
        this.isSynchronized = false;
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Returns the estimated server timestamp corresponding to the current local instant.
   */
  public getEstimatedServerNow(): number {
    return Date.now() + this.serverTimeOffsetMs;
  }

  public getOffsetMs(): number {
    return this.serverTimeOffsetMs;
  }

  /**
   * Returns the one-way clock uncertainty bound in milliseconds.
   */
  public getUncertaintyMs(): number {
    return this.clockUncertaintyMs;
  }

  public getLastSyncAt(): number {
    return this.lastSyncAt;
  }

  public isSyncFresh(maxAgeMs: number = 60_000): boolean {
    return this.isSynchronized && Date.now() - this.lastSyncAt < maxAgeMs;
  }
}
