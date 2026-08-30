import { ConnectionQuality, NetworkMetrics } from '@/types/jam';

export type NetworkQualityListener = (metrics: NetworkMetrics) => void;
export type NetworkChangeListener = (changeType: 'ONLINE' | 'OFFLINE' | 'WIFI' | 'CELLULAR') => void;

export interface PingRecord {
  rtt: number;
  timestamp: number;
  success: boolean;
}

/**
 * RaagaX Network Quality Engine
 * Measures and classifies client-side network conditions independently from playback synchronization.
 * Responsibilities:
 * - Real-time RTT measurement & rolling median filtering
 * - Jitter calculation (variation between RTT samples)
 * - Packet loss detection over a rolling window
 * - Connection quality classification (EXCELLENT | GOOD | FAIR | POOR | OFFLINE)
 * - Network change detection (Wi-Fi <-> Cellular, Online <-> Offline)
 */
export class NetworkQualityEngine {
  private static instance: NetworkQualityEngine;

  private pingHistory: PingRecord[] = [];
  private maxHistoryLength = 30;

  private currentRTT = 30;
  private currentMedianRTT = 30;
  private currentAverageRTT = 30;
  private currentJitter = 4;
  private currentPacketLoss = 0;
  private quality: ConnectionQuality = 'EXCELLENT';
  private transport: 'CLOUD' | 'LAN' | 'PEER' = 'CLOUD';
  private lastCheckedAt = Date.now();

  private isOnline = true;
  private listeners: Set<NetworkQualityListener> = new Set();
  private networkChangeListeners: Set<NetworkChangeListener> = new Set();

  private constructor() {
    this.setupNetworkListeners();
  }

  public static getInstance(): NetworkQualityEngine {
    if (!NetworkQualityEngine.instance) {
      NetworkQualityEngine.instance = new NetworkQualityEngine();
    }
    return NetworkQualityEngine.instance;
  }

  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;

    this.isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;

    window.addEventListener('online', () => {
      console.log('[NETWORK] Connection changed to ONLINE');
      this.isOnline = true;
      this.recalculateMetrics();
      this.notifyNetworkChange('ONLINE');
    });

    window.addEventListener('offline', () => {
      console.log('[NETWORK] Connection changed to OFFLINE');
      this.isOnline = false;
      this.quality = 'OFFLINE';
      this.currentPacketLoss = 100;
      this.notifyMetrics();
      this.notifyNetworkChange('OFFLINE');
    });

    const conn = (navigator as any)?.connection;
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', () => {
        const type = conn.type || conn.effectiveType || 'unknown';
        console.log(`[NETWORK] Connection interface changed: ${type}`);
        const isCellular = type.includes('cellular') || ['2g', '3g', '4g', '5g'].includes(conn.effectiveType);
        this.notifyNetworkChange(isCellular ? 'CELLULAR' : 'WIFI');
      });
    }
  }

  public subscribe(listener: NetworkQualityListener): () => void {
    this.listeners.add(listener);
    listener(this.getMetrics());
    return () => this.listeners.delete(listener);
  }

  public onNetworkChange(listener: NetworkChangeListener): () => void {
    this.networkChangeListeners.add(listener);
    return () => this.networkChangeListeners.delete(listener);
  }

  private notifyMetrics() {
    const metrics = this.getMetrics();
    for (const listener of this.listeners) {
      try {
        listener(metrics);
      } catch (e) {
        console.error('[NetworkQualityEngine] Listener error:', e);
      }
    }
  }

  private notifyNetworkChange(type: 'ONLINE' | 'OFFLINE' | 'WIFI' | 'CELLULAR') {
    for (const listener of this.networkChangeListeners) {
      try {
        listener(type);
      } catch (e) {
        console.error('[NetworkQualityEngine] Network change listener error:', e);
      }
    }
  }

  /**
   * Records a successful or failed ping measurement
   */
  public recordPing(rttMs: number, success: boolean = true) {
    const now = Date.now();
    this.pingHistory.push({
      rtt: Math.max(1, rttMs),
      timestamp: now,
      success,
    });

    if (this.pingHistory.length > this.maxHistoryLength) {
      this.pingHistory.shift();
    }

    this.recalculateMetrics();
  }

  /**
   * Records a packet loss event (e.g. heartbeat timeout)
   */
  public recordLoss() {
    this.recordPing(this.currentRTT * 2, false);
  }

  /**
   * Recalculates RTT, Median RTT, Jitter, Packet Loss, and Connection Quality
   */
  private recalculateMetrics() {
    if (!this.isOnline) {
      this.quality = 'OFFLINE';
      this.currentPacketLoss = 100;
      this.lastCheckedAt = Date.now();
      this.notifyMetrics();
      return;
    }

    if (this.pingHistory.length === 0) {
      return;
    }

    const totalSamples = this.pingHistory.length;
    const successfulSamples = this.pingHistory.filter((p) => p.success);
    const failedSamplesCount = totalSamples - successfulSamples.length;

    // 1. Calculate Packet Loss %
    this.currentPacketLoss = Math.round((failedSamplesCount / totalSamples) * 100);

    if (successfulSamples.length === 0) {
      this.quality = 'OFFLINE';
      this.notifyMetrics();
      return;
    }

    // 2. Compute Latest RTT & Average RTT
    const lastSuccess = successfulSamples[successfulSamples.length - 1];
    this.currentRTT = Math.round(lastSuccess.rtt);

    const sumRtt = successfulSamples.reduce((acc, p) => acc + p.rtt, 0);
    this.currentAverageRTT = Math.round(sumRtt / successfulSamples.length);

    // 3. Compute Robust Rolling Median RTT (outlier immune)
    const sortedRtts = successfulSamples.map((p) => p.rtt).sort((a, b) => a - b);
    const midIndex = Math.floor(sortedRtts.length / 2);
    this.currentMedianRTT =
      sortedRtts.length % 2 !== 0
        ? Math.round(sortedRtts[midIndex])
        : Math.round((sortedRtts[midIndex - 1] + sortedRtts[midIndex]) / 2);

    // 4. Compute Jitter (mean absolute difference between consecutive samples)
    if (successfulSamples.length >= 2) {
      let jitterSum = 0;
      for (let i = 1; i < successfulSamples.length; i++) {
        jitterSum += Math.abs(successfulSamples[i].rtt - successfulSamples[i - 1].rtt);
      }
      this.currentJitter = Math.round(jitterSum / (successfulSamples.length - 1));
    } else {
      this.currentJitter = 2;
    }

    // 5. Connection Quality Classification
    // Note: Connection quality does NOT determine playback position; it informs adaptive buffer sizing.
    if (this.currentPacketLoss >= 15 || this.currentMedianRTT >= 450) {
      this.quality = 'POOR';
    } else if (this.currentPacketLoss >= 5 || this.currentMedianRTT >= 200 || this.currentJitter >= 60) {
      this.quality = 'FAIR';
    } else if (this.currentMedianRTT <= 80 && this.currentJitter <= 18 && this.currentPacketLoss < 2) {
      this.quality = 'EXCELLENT';
    } else {
      this.quality = 'GOOD';
    }

    this.lastCheckedAt = Date.now();
    this.notifyMetrics();
  }

  // --- Public Metric Getters ---

  public getRTT(): number {
    return this.currentRTT;
  }

  public getMedianRTT(): number {
    return this.currentMedianRTT;
  }

  public getAverageRTT(): number {
    return this.currentAverageRTT;
  }

  public getJitter(): number {
    return this.currentJitter;
  }

  public getPacketLoss(): number {
    return this.currentPacketLoss;
  }

  public getConnectionQuality(): ConnectionQuality {
    return this.quality;
  }

  public setTransport(transport: 'CLOUD' | 'LAN' | 'PEER') {
    this.transport = transport;
    this.notifyMetrics();
  }

  public getTransport(): 'CLOUD' | 'LAN' | 'PEER' {
    return this.transport;
  }

  public getMetrics(): NetworkMetrics {
    return {
      rtt: this.currentRTT,
      rttMedian: this.currentMedianRTT,
      rttAverage: this.currentAverageRTT,
      jitter: this.currentJitter,
      packetLoss: this.currentPacketLoss,
      quality: this.quality,
      transport: this.transport,
      lastCheckedAt: this.lastCheckedAt,
    };
  }

  /**
   * Reset state for testing
   */
  public resetForTesting(initialRtt = 30) {
    this.pingHistory = [];
    this.isOnline = true;
    this.currentRTT = initialRtt;
    this.currentMedianRTT = initialRtt;
    this.currentAverageRTT = initialRtt;
    this.currentJitter = 4;
    this.currentPacketLoss = 0;
    this.quality = 'EXCELLENT';
    this.transport = 'CLOUD';
    this.lastCheckedAt = Date.now();
  }
}
