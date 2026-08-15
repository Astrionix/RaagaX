import { TransportMode, ConnectCommand } from './types';
import { NetworkManager } from '../offline/NetworkManager';
import { TransportScorer, TransportScore } from './TransportScorer';

export interface TransportMetrics {
  mode: TransportMode;
  latencyMs: number;
  isAvailable: boolean;
  lastChecked: number;
}

export class ConnectivityRouter {
  private static instance: ConnectivityRouter;

  private activeTransport: TransportMode = 'CLOUD_RELAY';
  private localPeerAvailable: boolean = false;

  private listeners: Set<(mode: TransportMode) => void> = new Set();

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkShift('online'));
      window.addEventListener('offline', () => this.handleNetworkShift('offline'));
    }
    // Cloud is always baseline-available
    TransportScorer.getInstance().markAvailable('CLOUD_RELAY');
  }

  public static getInstance(): ConnectivityRouter {
    if (!ConnectivityRouter.instance) {
      ConnectivityRouter.instance = new ConnectivityRouter();
    }
    return ConnectivityRouter.instance;
  }

  /** Returns current active transport mode. */
  public getActiveTransport(): TransportMode {
    return this.activeTransport;
  }

  /**
   * Returns current transport health status based on scorer state.
   */
  public getTransportHealth(): 'LAN_CONNECTED' | 'LAN_DEGRADED' | 'LAN_LOST' | 'CLOUD_CONNECTED' | 'OFFLINE' {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      return 'OFFLINE';
    }
    if (this.activeTransport === 'LOCAL_DIRECT' || this.activeTransport === 'HOTSPOT_DIRECT') {
      const lanScore = TransportScorer.getInstance().getScore(this.activeTransport);
      if (TransportScorer.getInstance().isLanDegrading()) return 'LAN_DEGRADED';
      return lanScore.isAvailable ? 'LAN_CONNECTED' : 'LAN_LOST';
    }
    if (this.localPeerAvailable) {
      return 'LAN_DEGRADED';
    }
    const local = TransportScorer.getInstance().getScore('LOCAL_DIRECT');
    const hotspot = TransportScorer.getInstance().getScore('HOTSPOT_DIRECT');
    // LAN_LOST only when we actually measured live samples (sampleCount > 0) and recently lost them
    const recentlyHadLan = (local.sampleCount > 0 || hotspot.sampleCount > 0)
      && !local.isAvailable && !hotspot.isAvailable
      && Date.now() - Math.max(local.lastUpdatedAt, hotspot.lastUpdatedAt) < 10_000;
    if (recentlyHadLan) return 'LAN_LOST';
    return 'CLOUD_CONNECTED';
  }

  /**
   * Registers a direct local peer connection becoming available/unavailable.
   * Feeds availability into TransportScorer which then drives route recalculation.
   */
  public setLocalPeerAvailable(available: boolean, isHotspot: boolean = false) {
    this.localPeerAvailable = available;
    const mode: TransportMode = isHotspot ? 'HOTSPOT_DIRECT' : 'LOCAL_DIRECT';
    const scorer = TransportScorer.getInstance();
    if (available) {
      scorer.markAvailable(mode);
    } else {
      scorer.markUnavailable(mode);
    }
    this.recalculateBestRoute();
  }

  /**
   * Recalculates and applies the best route according to live TransportScorer data.
   * This replaces the old fixed-priority (LOCAL > HOTSPOT > CLOUD) logic with
   * score-based selection so degraded LAN can lose to healthy Cloud.
   */
  public recalculateBestRoute(): TransportMode {
    const nextMode = TransportScorer.getInstance().getBestTransport();

    if (nextMode !== this.activeTransport) {
      console.log(`[ConnectivityRouter] Transport shifted: ${this.activeTransport} → ${nextMode} (Session preserved)`);
      this.activeTransport = nextMode;
      this.notifyListeners(nextMode);
    }

    return this.activeTransport;
  }

  /** Handles network changes without terminating active session. */
  private handleNetworkShift(status: 'online' | 'offline') {
    const scorer = TransportScorer.getInstance();
    if (status === 'offline') {
      console.warn('[ConnectivityRouter] Network lost. Checking for direct LAN/Hotspot peer...');
      scorer.markUnavailable('CLOUD_RELAY');
      this.recalculateBestRoute();
    } else {
      console.log('[ConnectivityRouter] Network restored. Re-enabling cloud relay...');
      scorer.markAvailable('CLOUD_RELAY');
      this.recalculateBestRoute();
    }
  }

  public subscribe(callback: (mode: TransportMode) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(mode: TransportMode) {
    for (const listener of this.listeners) {
      try { listener(mode); } catch (e) {
        console.error('[ConnectivityRouter] Listener error:', e);
      }
    }
  }

  /** Returns live scored metrics for all transports — used by DiagnosticsPanel. */
  public getScores(): TransportScore[] {
    return TransportScorer.getInstance().getAllScores();
  }

  /** Legacy compat: returns TransportMetrics shape for existing callers. */
  public getMetrics(): TransportMetrics[] {
    return this.getScores().map(s => ({
      mode: s.mode,
      latencyMs: s.rttMs,
      isAvailable: s.isAvailable,
      lastChecked: s.lastUpdatedAt,
    }));
  }

  public reset() {
    this.activeTransport = 'CLOUD_RELAY';
    this.localPeerAvailable = false;
    TransportScorer.getInstance().reset();
    TransportScorer.getInstance().markAvailable('CLOUD_RELAY');
  }
}

