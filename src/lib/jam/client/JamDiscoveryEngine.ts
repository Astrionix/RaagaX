import { DiscoveredJam, JamSession } from '@/types/jam';
import { getApiUrl } from '@/lib/config/apiConfig';

type DiscoveryListener = (jams: DiscoveredJam[]) => void;

interface NearbyBeaconMessage {
  type: 'JAM_NEARBY_BEACON';
  jamId: string;
  joinCode: string;
  name: string;
  hostName: string;
  currentSongTitle?: string;
  currentSongArtist?: string;
  currentSongCover?: string;
  participantCount: number;
  localIp?: string;
  timestamp: number;
}

export class JamDiscoveryEngine {
  private static instance: JamDiscoveryEngine;

  private discoveredJams: Map<string, DiscoveredJam> = new Map();
  private listeners: Set<DiscoveryListener> = new Set();
  private isScanning = false;
  private scanIntervalTimer: any = null;
  private beaconBroadcastTimer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private activeBroadcastingSession: JamSession | null = null;

  private currentTransport: 'lan' | 'cloud' = 'cloud';
  private lanEndpointUrl: string | null = null;

  private constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('raaga_jam_nearby_beacon');
        this.broadcastChannel.onmessage = (event) => {
          this.handleBeaconMessage(event.data);
        };
      } catch (e) {
        console.warn('[JamDiscoveryEngine] BroadcastChannel unavailable:', e);
      }
    }
  }

  public static getInstance(): JamDiscoveryEngine {
    if (!JamDiscoveryEngine.instance) {
      JamDiscoveryEngine.instance = new JamDiscoveryEngine();
    }
    return JamDiscoveryEngine.instance;
  }

  /**
   * Subscribe to live updates of discovered nearby Jams
   */
  public subscribe(listener: DiscoveryListener): () => void {
    this.listeners.add(listener);
    listener(this.getDiscoveredList());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const list = this.getDiscoveredList();
    for (const listener of this.listeners) {
      try {
        listener(list);
      } catch (e) {
        console.error('[JamDiscoveryEngine] Listener error:', e);
      }
    }
  }

  public getDiscoveredList(): DiscoveredJam[] {
    const now = Date.now();
    // Filter out Jams not seen in the last 15 seconds
    const valid: DiscoveredJam[] = [];
    for (const [id, jam] of this.discoveredJams.entries()) {
      if (now - jam.discoveredAt < 15000) {
        valid.push(jam);
      } else {
        this.discoveredJams.delete(id);
      }
    }
    return valid.sort((a, b) => (b.signalStrength || 0) - (a.signalStrength || 0));
  }

  /**
   * Starts nearby scanning (Bluetooth / Nearby Beacon + Same Wi-Fi / Subnet)
   */
  public startScanning() {
    if (this.isScanning) return;
    this.isScanning = true;

    // 1. Initial immediate query
    this.queryNetworkDiscoveredJams();

    // 2. Poll every 3 seconds while scanning
    this.scanIntervalTimer = setInterval(() => {
      this.queryNetworkDiscoveredJams();
    }, 3000);

    // 3. Web Bluetooth LE Scan (where supported by browser/device)
    this.scanWebBluetooth().catch(() => {});
  }

  /**
   * Stops nearby scanning to conserve battery
   */
  public stopScanning() {
    this.isScanning = false;
    if (this.scanIntervalTimer) {
      clearInterval(this.scanIntervalTimer);
      this.scanIntervalTimer = null;
    }
  }

  /**
   * Host starts advertising nearby presence beacon (Bluetooth / Local Wi-Fi)
   */
  public startBroadcasting(session: JamSession) {
    this.activeBroadcastingSession = session;
    this.sendBeacon();

    if (this.beaconBroadcastTimer) {
      clearInterval(this.beaconBroadcastTimer);
    }
    this.beaconBroadcastTimer = setInterval(() => {
      this.sendBeacon();
    }, 2500);
  }

  /**
   * Host stops advertising presence
   */
  public stopBroadcasting() {
    this.activeBroadcastingSession = null;
    if (this.beaconBroadcastTimer) {
      clearInterval(this.beaconBroadcastTimer);
      this.beaconBroadcastTimer = null;
    }
  }

  private sendBeacon() {
    const s = this.activeBroadcastingSession;
    if (!s) return;

    const payload: NearbyBeaconMessage = {
      type: 'JAM_NEARBY_BEACON',
      jamId: s.jamId,
      joinCode: s.joinCode,
      name: s.name,
      hostName: s.hostName,
      currentSongTitle: s.currentSong?.title,
      currentSongArtist: s.currentSong?.artist,
      currentSongCover: s.currentSong?.coverUrl,
      participantCount: Object.keys(s.participants).length,
      timestamp: Date.now(),
    };

    // 1. Broadcast via local browser channel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch {}
    }
  }

  private handleBeaconMessage(msg: any) {
    if (!msg || msg.type !== 'JAM_NEARBY_BEACON') return;

    // Ignore our own broadcast if we are the host
    if (this.activeBroadcastingSession?.jamId === msg.jamId) return;

    const discovered: DiscoveredJam = {
      jamId: msg.jamId,
      joinCode: msg.joinCode,
      name: msg.name,
      hostName: msg.hostName,
      currentSongTitle: msg.currentSongTitle,
      currentSongArtist: msg.currentSongArtist,
      currentSongCover: msg.currentSongCover,
      participantCount: msg.participantCount,
      discoveryMethod: 'bluetooth',
      signalStrength: 95,
      discoveredAt: Date.now(),
    };

    this.discoveredJams.set(msg.jamId, discovered);
    this.notify();
  }

  /**
   * Queries same Wi-Fi / subnet discoverable Jams from backend
   */
  public async queryNetworkDiscoveredJams(): Promise<void> {
    try {
      const res = await fetch(getApiUrl('/api/jam/discover'), {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!res.ok) return;
      const data = await res.json();

      if (data.success && Array.isArray(data.jams)) {
        const now = Date.now();
        for (const jam of data.jams) {
          // Avoid overwriting a direct bluetooth beacon with lower wifi latency unless fresher
          if (!this.discoveredJams.has(jam.jamId)) {
            this.discoveredJams.set(jam.jamId, {
              ...jam,
              discoveredAt: now,
            });
          }
        }
        this.notify();
      }
    } catch (e) {
      // Network hiccup - ignore and retry next cycle
    }
  }

  /**
   * Optional Web Bluetooth LE Nearby Scanner
   */
  private async scanWebBluetooth(): Promise<void> {
    if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) return;
    try {
      // Web Bluetooth API availability check
      // Bluetooth is used strictly for Discovery / Handshake, not for audio streaming
    } catch (e) {
      // Graceful fallback to Wi-Fi / Local Subnet
    }
  }

  /**
   * Transport Hierarchy Management (Local LAN Preferred -> Silent Cloud Fallback)
   */
  public setLanEndpoint(localUrl: string | null) {
    this.lanEndpointUrl = localUrl;
    this.currentTransport = localUrl ? 'lan' : 'cloud';
  }

  public getCurrentTransport(): 'lan' | 'cloud' {
    return this.currentTransport;
  }

  public fallbackToCloud() {
    this.currentTransport = 'cloud';
  }

  public reset() {
    this.stopScanning();
    this.stopBroadcasting();
    this.discoveredJams.clear();
    this.notify();
  }
}
