export class ClockSynchronizer {
  private static instance: ClockSynchronizer;
  private serverTimeOffsetMs: number = 0;
  private isSynchronized: boolean = false;
  /** Half the measured HTTP round-trip time — represents our clock confidence bound. */
  private clockUncertaintyMs: number = 50;
  private lastSyncAt: number = 0;
  private syncCount: number = 0;

  private constructor() {}

  public static getInstance(): ClockSynchronizer {
    if (!ClockSynchronizer.instance) {
      ClockSynchronizer.instance = new ClockSynchronizer();
    }
    return ClockSynchronizer.instance;
  }

  /**
   * Synchronizes the local clock with the server using an HTTP endpoint.
   * This computes an approximate offset to align Date.now() across devices.
   */
  public async synchronize(endpoint: string = '/api/time'): Promise<void> {
    try {
      const t0 = Date.now();
      const response = await fetch(endpoint, { method: 'GET', cache: 'no-store' });
      
      if (!response.ok) throw new Error('Time sync failed');
      
      const data = await response.json();
      const serverTimeMs = Number(data?.serverTimeMs || data?.serverTime || Date.now());
      if (isNaN(serverTimeMs)) throw new Error('Invalid server time payload');
      const t1 = Date.now();
      
      // Approximate latency is (t1 - t0) / 2
      // So the time the server generated the timestamp was roughly (t0 + latency)
      const latencyMs = (t1 - t0) / 2;
      const estimatedLocalTimeAtServer = t0 + latencyMs;
      
      // Offset is the difference between true server time and our estimated local time
      this.serverTimeOffsetMs = serverTimeMs - estimatedLocalTimeAtServer;
      this.clockUncertaintyMs = latencyMs; // full RTT as uncertainty, halved is the one-way estimate
      this.isSynchronized = true;
      this.lastSyncAt = Date.now();
      this.syncCount++;
      
      console.log(`[ClockSynchronizer] Synced! Offset: ${this.serverTimeOffsetMs.toFixed(0)}ms, uncertainty: ±${latencyMs.toFixed(0)}ms (latency ~${latencyMs.toFixed(0)}ms)`);
    } catch (e) {
      console.warn('[ClockSynchronizer] Failed to synchronize clock:', e);
      // Fallback: assume 0 offset
      this.serverTimeOffsetMs = 0;
      this.isSynchronized = false;
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
   * Positions within this tolerance are considered "in sync" and
   * should not trigger visible jump corrections.
   */
  public getUncertaintyMs(): number {
    return this.clockUncertaintyMs;
  }

  public getLastSyncAt(): number {
    return this.lastSyncAt;
  }

  public isSyncFresh(maxAgeMs: number = 60_000): boolean {
    return this.isSynchronized && (Date.now() - this.lastSyncAt) < maxAgeMs;
  }
}
