/**
 * RaagaX Connect — NTP Clock Drift Correction Engine
 * Implements a high-precision NTP-lite synchronization algorithm
 * with RTT outlier rejection and Exponential Moving Average (EMA) smoothing.
 */

export interface NtpSample {
  readonly tClientSend: number;
  readonly tServer: number;
  readonly tClientReceive: number;
  readonly rtt: number;
  readonly offset: number;
}

export interface NtpSyncStats {
  readonly clockOffsetMs: number; // LocalTime + Offset = ServerAlignedTime
  readonly rttMs: number;
  readonly sampleCount: number;
  readonly isSynchronized: boolean;
}

export class NtpClockEngine {
  private static instance: NtpClockEngine;

  private samples: NtpSample[] = [];
  private readonly maxSamples: number = 8;
  private clockOffsetMs: number = 0;
  private smoothedRttMs: number = 20;
  private isSynchronized: boolean = false;
  private readonly emaAlpha: number = 0.25; // Smoothing weight for EMA

  private constructor() {}

  public static getInstance(): NtpClockEngine {
    if (!NtpClockEngine.instance) {
      NtpClockEngine.instance = new NtpClockEngine();
    }
    return NtpClockEngine.instance;
  }

  /**
   * Process a 3-timestamp NTP packet exchange
   * Formula:
   *   RTT = tClientReceive - tClientSend
   *   Offset (theta) = tServer - (tClientSend + RTT / 2)
   */
  public recordSample(tClientSend: number, tServer: number, tClientReceive: number): NtpSample {
    const rtt = Math.max(1, tClientReceive - tClientSend);
    const offset = tServer - (tClientSend + rtt / 2);

    const sample: NtpSample = {
      tClientSend,
      tServer,
      tClientReceive,
      rtt,
      offset,
    };

    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    this.recomputeOffset();
    return sample;
  }

  /**
   * Recompute offset by discarding high-RTT outliers and applying EMA
   */
  private recomputeOffset(): void {
    if (this.samples.length === 0) return;

    // Sort by RTT ascending to find lowest latency samples (least jitter)
    const sorted = [...this.samples].sort((a, b) => a.rtt - b.rtt);

    // Keep top 50% lowest RTT samples (filter out network spikes)
    const validCount = Math.max(1, Math.floor(sorted.length * 0.6));
    const bestSamples = sorted.slice(0, validCount);

    const avgOffset = bestSamples.reduce((sum, s) => sum + s.offset, 0) / bestSamples.length;
    const avgRtt = bestSamples.reduce((sum, s) => sum + s.rtt, 0) / bestSamples.length;

    if (!this.isSynchronized) {
      this.clockOffsetMs = avgOffset;
      this.smoothedRttMs = avgRtt;
      this.isSynchronized = true;
    } else {
      // Exponential Moving Average filter
      this.clockOffsetMs = this.emaAlpha * avgOffset + (1 - this.emaAlpha) * this.clockOffsetMs;
      this.smoothedRttMs = this.emaAlpha * avgRtt + (1 - this.emaAlpha) * this.smoothedRttMs;
    }
  }

  /**
   * Returns current wall clock time aligned precisely with the server's timeline
   */
  public getServerAlignedTime(localTimeMs: number = Date.now()): number {
    return Math.round(localTimeMs + this.clockOffsetMs);
  }

  /**
   * Translates a server timestamp to the local client clock domain
   */
  public serverToLocalTime(serverTimestampMs: number): number {
    return Math.round(serverTimestampMs - this.clockOffsetMs);
  }

  public getStats(): NtpSyncStats {
    return {
      clockOffsetMs: Math.round(this.clockOffsetMs),
      rttMs: Math.round(this.smoothedRttMs),
      sampleCount: this.samples.length,
      isSynchronized: this.isSynchronized,
    };
  }

  public reset(): void {
    this.samples = [];
    this.clockOffsetMs = 0;
    this.smoothedRttMs = 20;
    this.isSynchronized = false;
  }
}
