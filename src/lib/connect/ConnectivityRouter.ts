import { TransportMode, ConnectCommand } from './types';
import { NetworkManager } from '../offline/NetworkManager';

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
  private metrics: Map<TransportMode, TransportMetrics> = new Map([
    ['LOCAL_DIRECT', { mode: 'LOCAL_DIRECT', latencyMs: 8, isAvailable: false, lastChecked: 0 }],
    ['HOTSPOT_DIRECT', { mode: 'HOTSPOT_DIRECT', latencyMs: 12, isAvailable: false, lastChecked: 0 }],
    ['CLOUD_RELAY', { mode: 'CLOUD_RELAY', latencyMs: 35, isAvailable: true, lastChecked: 0 }],
  ]);

  private listeners: Set<(mode: TransportMode) => void> = new Set();

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkShift('online'));
      window.addEventListener('offline', () => this.handleNetworkShift('offline'));
    }
  }

  public static getInstance(): ConnectivityRouter {
    if (!ConnectivityRouter.instance) {
      ConnectivityRouter.instance = new ConnectivityRouter();
    }
    return ConnectivityRouter.instance;
  }

  /**
   * Returns current active transport mode.
   */
  public getActiveTransport(): TransportMode {
    return this.activeTransport;
  }

  /**
   * Registers a direct local peer connection (e.g. WebRTC DataChannel on same LAN/Hotspot).
   */
  public setLocalPeerAvailable(available: boolean, isHotspot: boolean = false) {
    this.localPeerAvailable = available;
    const targetMode: TransportMode = isHotspot ? 'HOTSPOT_DIRECT' : 'LOCAL_DIRECT';
    
    const metric = this.metrics.get(targetMode);
    if (metric) {
      metric.isAvailable = available;
      metric.lastChecked = Date.now();
    }

    this.recalculateBestRoute();
  }

  /**
   * Re-evaluates best route based on priority:
   * 1. LOCAL_DIRECT (< 10ms)
   * 2. HOTSPOT_DIRECT (< 15ms)
   * 3. CLOUD_RELAY (< 40ms)
   */
  public recalculateBestRoute(): TransportMode {
    const local = this.metrics.get('LOCAL_DIRECT');
    const hotspot = this.metrics.get('HOTSPOT_DIRECT');

    let nextMode: TransportMode = 'CLOUD_RELAY';

    if (local?.isAvailable) {
      nextMode = 'LOCAL_DIRECT';
    } else if (hotspot?.isAvailable) {
      nextMode = 'HOTSPOT_DIRECT';
    } else {
      nextMode = 'CLOUD_RELAY';
    }

    if (nextMode !== this.activeTransport) {
      console.log(`[ConnectivityRouter] Transport shifted: ${this.activeTransport} -> ${nextMode} (Session preserved)`);
      this.activeTransport = nextMode;
      this.notifyListeners(nextMode);
    }

    return this.activeTransport;
  }

  /**
   * Handles network changes (e.g. Wi-Fi <-> Hotspot <-> Mobile Data) without terminating active session.
   */
  private handleNetworkShift(status: 'online' | 'offline') {
    if (status === 'offline') {
      console.warn('[ConnectivityRouter] Network lost. Checking for direct LAN/Hotspot peer...');
      this.recalculateBestRoute();
    } else {
      console.log('[ConnectivityRouter] Network restored. Resuming cloud relay / local probe...');
      const cloudMetric = this.metrics.get('CLOUD_RELAY');
      if (cloudMetric) {
        cloudMetric.isAvailable = true;
        cloudMetric.lastChecked = Date.now();
      }
      this.recalculateBestRoute();
    }
  }

  public subscribe(callback: (mode: TransportMode) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(mode: TransportMode) {
    for (const listener of this.listeners) {
      try {
        listener(mode);
      } catch (e) {
        console.error('[ConnectivityRouter] Listener error:', e);
      }
    }
  }

  public getMetrics(): TransportMetrics[] {
    return Array.from(this.metrics.values());
  }

  public reset() {
    this.activeTransport = 'CLOUD_RELAY';
    this.localPeerAvailable = false;
    for (const m of this.metrics.values()) {
      m.isAvailable = m.mode === 'CLOUD_RELAY';
    }
  }
}
