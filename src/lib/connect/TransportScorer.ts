/**
 * TransportScorer — measures live RTT and packet loss per transport and produces
 * a numeric score used by ConnectivityRouter to select the best-performing path.
 *
 * Score formula:
 *   score = 1000 / (rtt_ms * (1 + loss_rate * 10))
 *
 * Examples:
 *   LAN  7ms,   0% loss  → 142   (strongly preferred)
 *   LAN  800ms, 15% loss → 0.8   (worse than Cloud)
 *   Cloud 75ms, 0% loss  → 13
 *
 * Measurement mechanism:
 *   - RTT: sampled on each HEARTBEAT → HEARTBEAT_ACK round-trip (LocalPeerConnection),
 *     or via latency probe headers for Cloud.
 *   - Packet loss: ratio of HEARTBEAT frames sent vs ACKs received in a rolling
 *     window of last MAX_SAMPLES heartbeat cycles.
 *   - Values are smoothed with an exponential moving average (alpha = 0.3).
 */

import { TransportMode } from './types';

export interface TransportScore {
  mode: TransportMode;
  rttMs: number;
  lossRate: number;      // 0.0 – 1.0
  score: number;
  sampleCount: number;
  lastUpdatedAt: number;
  isAvailable: boolean;
}

const ALPHA = 0.3;         // EMA smoothing factor
const MAX_SAMPLES = 10;    // Rolling window for loss calculation
const STALE_MS = 15_000;   // Score is stale if not updated within this window

export class TransportScorer {
  private static instance: TransportScorer;

  private scores: Map<TransportMode, TransportScore> = new Map();
  private heartbeatHistory: Map<TransportMode, Array<'ACK' | 'MISS'>> = new Map();

  private constructor() {
    this.reset();
  }

  public static getInstance(): TransportScorer {
    if (!TransportScorer.instance) {
      TransportScorer.instance = new TransportScorer();
    }
    return TransportScorer.instance;
  }

  private defaultScore(
    mode: TransportMode,
    isAvailable: boolean,
    rttMs: number = 8,
    lossRate: number = 0
  ): TransportScore {
    return {
      mode,
      rttMs,
      lossRate,
      score: isAvailable ? this.compute(rttMs, lossRate) : 0,
      sampleCount: 0,
      lastUpdatedAt: 0,
      isAvailable,
    };
  }

  private compute(rttMs: number, lossRate: number): number {
    if (rttMs <= 0) return 0;
    return 1000 / (rttMs * (1 + lossRate * 10));
  }

  /** Record a completed heartbeat round-trip. */
  public recordRtt(mode: TransportMode, rttMs: number) {
    const entry = this.scores.get(mode);
    if (!entry) return;
    entry.rttMs = entry.sampleCount === 0
      ? rttMs
      : ALPHA * rttMs + (1 - ALPHA) * entry.rttMs;
    entry.sampleCount++;
    entry.lastUpdatedAt = Date.now();
    entry.isAvailable = true;
    const history = this.heartbeatHistory.get(mode) || [];
    history.push('ACK');
    if (history.length > MAX_SAMPLES) history.shift();
    this.heartbeatHistory.set(mode, history);
    this.refreshLossRate(mode, entry);
    entry.score = this.compute(entry.rttMs, entry.lossRate);
  }

  /** Record a missed heartbeat (no ACK within timeout). */
  public recordMiss(mode: TransportMode) {
    const entry = this.scores.get(mode);
    if (!entry) return;
    entry.rttMs = ALPHA * 500 + (1 - ALPHA) * entry.rttMs;
    const history = this.heartbeatHistory.get(mode) || [];
    history.push('MISS');
    if (history.length > MAX_SAMPLES) history.shift();
    this.heartbeatHistory.set(mode, history);
    this.refreshLossRate(mode, entry);
    entry.score = this.compute(entry.rttMs, entry.lossRate);
    entry.lastUpdatedAt = Date.now();
  }

  /** Mark a transport as unavailable — score drops to 0 immediately. */
  public markUnavailable(mode: TransportMode) {
    const entry = this.scores.get(mode);
    if (!entry) return;
    entry.isAvailable = false;
    entry.score = 0;
    entry.lastUpdatedAt = Date.now();
    this.heartbeatHistory.set(mode, []);
  }

  /** Mark a transport available again with a conservative initial estimate. */
  public markAvailable(mode: TransportMode) {
    const entry = this.scores.get(mode);
    if (!entry) return;
    entry.isAvailable = true;
    entry.sampleCount = 0;
    entry.rttMs = mode === 'CLOUD_RELAY' ? 75 : 20;
    entry.lossRate = 0;
    entry.score = this.compute(entry.rttMs, entry.lossRate);
    entry.lastUpdatedAt = Date.now();
  }

  private refreshLossRate(mode: TransportMode, entry: TransportScore) {
    const history = this.heartbeatHistory.get(mode) || [];
    if (history.length === 0) { entry.lossRate = 0; return; }
    entry.lossRate = history.filter(h => h === 'MISS').length / history.length;
  }

  /** Returns score for a transport. Returns score=0 if stale (LAN only). */
  public getScore(mode: TransportMode): TransportScore {
    const entry = this.scores.get(mode) || this.defaultScore(mode, false);
    const isStale = entry.lastUpdatedAt > 0 && Date.now() - entry.lastUpdatedAt > STALE_MS;
    if (isStale && mode !== 'CLOUD_RELAY') {
      return { ...entry, score: 0, isAvailable: false };
    }
    return { ...entry };
  }

  /** All scores sorted by score descending. */
  public getAllScores(): TransportScore[] {
    return (['LOCAL_DIRECT', 'HOTSPOT_DIRECT', 'CLOUD_RELAY'] as TransportMode[])
      .map(m => this.getScore(m))
      .sort((a, b) => b.score - a.score);
  }

  /** Best transport by score. Falls back to CLOUD_RELAY. */
  public getBestTransport(): TransportMode {
    const best = this.getAllScores().find(s => s.isAvailable && s.score > 0);
    return best?.mode ?? 'CLOUD_RELAY';
  }

  /**
   * LAN is "degrading" if Cloud has caught up to within 20% of LAN score.
   * Used by TransportHealthMonitor for predictive switching decisions.
   */
  public isLanDegrading(): boolean {
    const lan = this.getScore('LOCAL_DIRECT');
    const hotspot = this.getScore('HOTSPOT_DIRECT');
    const cloud = this.getScore('CLOUD_RELAY');
    const bestLan = Math.max(lan.score, hotspot.score);
    if (bestLan === 0) return false;
    return cloud.score > 0 && bestLan < cloud.score * 1.2;
  }

  public reset() {
    this.scores = new Map([
      ['LOCAL_DIRECT',   this.defaultScore('LOCAL_DIRECT',   false)],
      ['HOTSPOT_DIRECT', this.defaultScore('HOTSPOT_DIRECT', false)],
      ['CLOUD_RELAY',    this.defaultScore('CLOUD_RELAY',    true,  75, 0)],
    ]);
    this.heartbeatHistory = new Map([
      ['LOCAL_DIRECT',   []],
      ['HOTSPOT_DIRECT', []],
      ['CLOUD_RELAY',    []],
    ]);
  }
}
