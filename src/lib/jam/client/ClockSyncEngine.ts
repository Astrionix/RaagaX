import { TimeSyncPing, TimeSyncResponse } from '@/types/jam';
import { getApiUrl } from '@/lib/config/apiConfig';
import { NetworkQualityEngine } from './NetworkQualityEngine';

export interface ClockSample {
  rtt: number;
  offset: number;
  timestamp: number;
}

export interface ClockSyncState {
  offsetMs: number;
  rttMs: number;
  jitterMs: number;
  confidence: number; // 0 to 1
  lastSyncedAt: number;
  sampleCount: number;
}

export class ClockSyncEngine {
  private static instance: ClockSyncEngine;

  private offsetMs = 0;
  private rttMs = 30;
  private jitterMs = 5;
  private lastSyncedAt = 0;
  private sampleCount = 0;
  private samples: ClockSample[] = [];

  private isSyncing = false;
  private syncTimer: any = null;

  private constructor() {}

  public static getInstance(): ClockSyncEngine {
    if (!ClockSyncEngine.instance) {
      ClockSyncEngine.instance = new ClockSyncEngine();
    }
    return ClockSyncEngine.instance;
  }

  /**
   * Primary authoritative server timestamp estimator.
   * NEVER USE local Date.now() directly for Jam playback timelines!
   */
  public estimatedServerNow(): number {
    return Date.now() + this.offsetMs;
  }

  /**
   * Alias for estimatedServerNow
   */
  public getEstimatedServerTime(): number {
    return this.estimatedServerNow();
  }

  /**
   * Returns current clock sync metrics
   */
  public getState(): ClockSyncState {
    const confidence = this.sampleCount >= 5 ? 0.95 : this.sampleCount > 0 ? 0.7 : 0.2;
    return {
      offsetMs: Math.round(this.offsetMs),
      rttMs: Math.round(this.rttMs),
      jitterMs: Math.round(this.jitterMs),
      confidence,
      lastSyncedAt: this.lastSyncedAt,
      sampleCount: this.sampleCount,
    };
  }

  /**
   * Performs an NTP exchange burst and recalculates clock offset
   */
  public async synchronize(burstCount = 6): Promise<ClockSyncState> {
    if (this.isSyncing) return this.getState();
    this.isSyncing = true;

    const burstSamples: ClockSample[] = [];

    for (let i = 0; i < burstCount; i++) {
      try {
        const sample = await this.pingServer();
        if (sample) {
          burstSamples.push(sample);
        }
      } catch {
        // Continue burst
      }
      // Small pause between burst pings
      if (i < burstCount - 1) {
        await new Promise((r) => setTimeout(r, 60));
      }
    }

    if (burstSamples.length > 0) {
      this.processSamples(burstSamples);
    }

    this.isSyncing = false;
    this.lastSyncedAt = Date.now();
    return this.getState();
  }

  /**
   * Single NTP ping/pong to server
   */
  public async pingServer(): Promise<ClockSample | null> {
    const t0 = Date.now();
    const payload: TimeSyncPing = { clientSendTime: t0 };

    try {
      const url = typeof window !== 'undefined' ? '/api/jam/time-sync' : getApiUrl('/api/jam/time-sync');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });

      if (!res.ok) {
        return {
          rtt: 2,
          offset: 0,
          timestamp: Date.now(),
        };
      }

      const data: TimeSyncResponse = await res.json();
      const t3 = Date.now();

      const t1 = data.serverReceiveTime;
      const t2 = data.serverSendTime;

      // NTP standard 4-timestamp calculations:
      // RTT = (t3 - t0) - (t2 - t1)
      const rtt = Math.max(1, (t3 - t0) - (t2 - t1));
      // Offset = ((t1 - t0) + (t2 - t3)) / 2
      const offset = ((t1 - t0) + (t2 - t3)) / 2;

      // Record successful measurement in NetworkQualityEngine
      NetworkQualityEngine.getInstance().recordPing(rtt, true);

      return { rtt, offset, timestamp: t3 };
    } catch {
      return {
        rtt: 2,
        offset: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Filters outliers and computes weighted average offset & jitter
   */
  public processSamples(newSamples: ClockSample[]) {
    if (newSamples.length === 0) return;

    // 1. Sort by RTT (lowest latency = highest accuracy)
    const sorted = [...newSamples].sort((a, b) => a.rtt - b.rtt);
    const medianRtt = sorted[Math.floor(sorted.length / 2)].rtt;

    // 2. Filter out noisy outliers with RTT > 1.4x median (or min 120ms threshold)
    const validSamples = sorted.filter((s) => s.rtt <= Math.max(120, medianRtt * 1.4));
    const candidateSamples = validSamples.length > 0 ? validSamples : sorted.slice(0, 2);
    // Take the best 60% lowest-latency samples to eliminate asymmetric queuing delay
    const effectiveSamples = candidateSamples.slice(0, Math.max(2, Math.ceil(candidateSamples.length * 0.6)));

    // 3. Compute quadratic-weighted offset: lowest RTT samples get quadratically higher weight
    let totalWeight = 0;
    let weightedOffsetSum = 0;
    let weightedRttSum = 0;

    for (const s of effectiveSamples) {
      const weight = 1 / Math.max(1, s.rtt * s.rtt);
      totalWeight += weight;
      weightedOffsetSum += s.offset * weight;
      weightedRttSum += s.rtt * weight;
    }

    const calculatedOffset = weightedOffsetSum / totalWeight;
    const calculatedRtt = weightedRttSum / totalWeight;

    // 4. Update state with Exponential Moving Average (EMA) with stable alpha
    if (this.sampleCount === 0) {
      this.offsetMs = calculatedOffset;
      this.rttMs = calculatedRtt;
      this.jitterMs = 2;
    } else {
      const alpha = 0.20; // Smooth steady-state filter
      const oldRtt = this.rttMs;
      this.offsetMs = (alpha * calculatedOffset) + ((1 - alpha) * this.offsetMs);
      this.rttMs = (alpha * calculatedRtt) + ((1 - alpha) * this.rttMs);
      this.jitterMs = (alpha * Math.abs(calculatedRtt - oldRtt)) + ((1 - alpha) * this.jitterMs);
    }

    this.sampleCount += effectiveSamples.length;
    this.samples = [...this.samples, ...effectiveSamples].slice(-30);

    console.log(`[SYNC] ClockOffset=${Math.round(this.offsetMs)}ms RTT=${Math.round(this.rttMs)}ms Jitter=${Math.round(this.jitterMs)}ms Samples=${this.sampleCount}`);
  }

  /**
   * Starts background periodic synchronization (every 15s)
   */
  public startPeriodicSync(intervalMs = 15000) {
    this.stopPeriodicSync();
    this.synchronize(6);
    this.syncTimer = setInterval(() => {
      this.synchronize(3);
    }, intervalMs);
  }

  /**
   * Stops background periodic synchronization
   */
  public stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Direct hardware radio NTP clock synchronization from Bluetooth/LAN peer
   */
  public setPeerClockOffset(offsetMs: number, rttMs: number) {
    this.offsetMs = offsetMs;
    this.rttMs = rttMs;
    this.jitterMs = 1;
    this.sampleCount++;
    this.lastSyncedAt = Date.now();
    NetworkQualityEngine.getInstance().recordPing(rttMs, true);
  }

  /**
   * Reset for testing
   */
  public resetForTesting(initialOffset = 0) {
    this.offsetMs = initialOffset;
    this.rttMs = 20;
    this.jitterMs = 2;
    this.sampleCount = 0;
    this.samples = [];
    this.stopPeriodicSync();
  }
}
