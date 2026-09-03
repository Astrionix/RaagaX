import { DeviceCapabilities, DiscoveredJam, JamSession } from '@/types/jam';
import { getApiUrl } from '@/lib/config/apiConfig';
import { supabase } from '@/lib/supabase';

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
  lanEndpoint?: string;
  deviceId: string;
  deviceName: string;
  platform: 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'web';
  protocolVersion: string;
  capabilities?: DeviceCapabilities;
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
  private presenceChannel: any = null;
  private activeBroadcastingSession: JamSession | null = null;

  private currentTransport: 'lan' | 'cloud' = 'cloud';
  private lanEndpointUrl: string | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      if ('BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel('raaga_jam_nearby_beacon');
          this.broadcastChannel.onmessage = (event) => {
            this.handleBeaconMessage(event.data);
          };
        } catch (e) {
          console.warn('[JamDiscoveryEngine] BroadcastChannel unavailable:', e);
        }
      }
      this.setupPresenceChannel();
    }
  }

  private setupPresenceChannel() {
    try {
      this.presenceChannel = supabase.channel('raaga_jam_mesh', {
        config: { presence: { key: `peer_${Date.now().toString(36)}` } },
      });

      this.presenceChannel
        .on('presence', { event: 'sync' }, () => {
          this.handlePresenceSync();
        })
        .subscribe();
    } catch {}
  }

  private handlePresenceSync() {
    if (!this.presenceChannel) return;
    try {
      const state = this.presenceChannel.presenceState();
      const now = Date.now();
      for (const key of Object.keys(state)) {
        const presences = state[key];
        if (Array.isArray(presences)) {
          for (const p of presences) {
            if (p.jamId && p.joinCode) {
              if (this.activeBroadcastingSession?.jamId === p.jamId) continue;
              this.discoveredJams.set(p.jamId, {
                jamId: p.jamId,
                joinCode: p.joinCode,
                name: p.name || `${p.hostName}'s Jam`,
                hostName: p.hostName || 'Host',
                currentSongTitle: p.currentSongTitle,
                currentSongArtist: p.currentSongArtist,
                currentSongCover: p.currentSongCover,
                participantCount: p.participantCount || 1,
                discoveryMethod: 'wifi',
                signalStrength: 95,
                deviceId: p.deviceId || 'host',
                deviceName: p.deviceName || 'RaagaX Host',
                platform: p.platform || 'web',
                protocolVersion: '2.0.0',
                discoveredAt: now,
              });
            }
          }
        }
      }
      this.notify();
    } catch {}
  }

  public findByJoinCode(code: string): DiscoveredJam | null {
    if (!code) return null;
    const clean = code.trim().toUpperCase();
    for (const jam of this.discoveredJams.values()) {
      if (jam.joinCode && jam.joinCode.toUpperCase() === clean) {
        return jam;
      }
    }
    return null;
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
   * Starts nearby scanning (Same Wi-Fi / Local LAN / Subnet Beacon)
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
   * Host starts advertising nearby presence beacon (Local Wi-Fi / LAN)
   */
  public startBroadcasting(session: JamSession) {
    this.activeBroadcastingSession = session;
    this.sendBeacon();

    if (this.presenceChannel && (this.presenceChannel as any).state === 'joined') {
      try {
        this.presenceChannel.track({
          jamId: session.jamId,
          joinCode: session.joinCode,
          name: session.name,
          hostName: session.hostName,
          currentSongTitle: session.currentSong?.title,
          currentSongArtist: session.currentSong?.artist,
          currentSongCover: session.currentSong?.coverUrl,
          participantCount: Object.keys(session.participants || {}).length,
          deviceId: session.hostId,
        });
      } catch {}
    }

    if (this.beaconBroadcastTimer) {
      clearInterval(this.beaconBroadcastTimer);
    }
    this.beaconBroadcastTimer = setInterval(() => {
      this.sendBeacon();
    }, 2500);
  }

  public stopBroadcasting() {
    this.activeBroadcastingSession = null;
    if (this.presenceChannel) {
      try { this.presenceChannel.untrack(); } catch {}
    }
    if (this.beaconBroadcastTimer) {
      clearInterval(this.beaconBroadcastTimer);
      this.beaconBroadcastTimer = null;
    }
  }

  private sendBeacon() {
    const s = this.activeBroadcastingSession;
    if (!s) return;

    let platform: DeviceCapabilities['platform'] = 'web';
    let deviceName = 'RaagaX Host';
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (/android/i.test(ua)) { platform = 'android'; deviceName = 'Android Device'; }
      else if (/iphone|ipad|ipod/i.test(ua)) { platform = 'ios'; deviceName = 'iOS Device'; }
      else if (/windows/i.test(ua)) { platform = 'windows'; deviceName = 'Windows PC'; }
      else if (/macintosh|mac os x/i.test(ua)) { platform = 'macos'; deviceName = 'Mac'; }
      else if (/linux/i.test(ua)) { platform = 'linux'; deviceName = 'Linux Device'; }
    }

    const lanEndpoint = typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : undefined;

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
      lanEndpoint,
      deviceId: s.hostId || `host_${s.jamId}`,
      deviceName,
      platform,
      protocolVersion: '2.0.0',
      capabilities: {
        deviceId: s.hostId,
        deviceName,
        platform,
        supportedCodecs: ['mp3', 'aac', 'opus', 'flac'],
        backgroundPlayback: true,
        lanSupported: true,
        cloudSupported: true,
        protocolVersion: '2.0.0',
      },
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
      discoveryMethod: 'wifi',
      signalStrength: 95,
      lanEndpoint: msg.lanEndpoint,
      deviceId: msg.deviceId,
      deviceName: msg.deviceName,
      platform: msg.platform,
      protocolVersion: msg.protocolVersion || '2.0.0',
      capabilities: msg.capabilities,
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
          const existing = this.discoveredJams.get(jam.jamId);
          this.discoveredJams.set(jam.jamId, {
            ...jam,
            lanEndpoint: jam.lanEndpoint || existing?.lanEndpoint,
            deviceId: jam.deviceId || existing?.deviceId,
            deviceName: jam.deviceName || existing?.deviceName,
            platform: jam.platform || existing?.platform,
            protocolVersion: jam.protocolVersion || existing?.protocolVersion || '2.0.0',
            capabilities: jam.capabilities || existing?.capabilities,
            discoveredAt: now,
          });
        }
        this.notify();
      }
    } catch (e) {
      // Network hiccup - ignore and retry next cycle
    }
  }

  /**
   * Retrieves the discovered LAN endpoint for a specific Jam ID if available
   */
  public getLanEndpointForJam(jamId: string): string | null {
    const jam = this.discoveredJams.get(jamId);
    return jam?.lanEndpoint || this.lanEndpointUrl || null;
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
