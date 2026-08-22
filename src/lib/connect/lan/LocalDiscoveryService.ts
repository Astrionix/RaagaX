'use client';

import { LANDeviceAdvertisement, DiscoveredLANDevice, LANDeviceType, LANPlatform } from './types';
import { LocalServerBridge } from './LocalServerBridge';
import { RaagaXNativeConnect } from './RaagaXNativeConnect';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlayerStore } from '@/context/usePlayerStore';

const STABLE_DEVICE_ID_KEY = 'raagax_device_id_v2';
const DISCOVERY_BEACON_CHANNEL = 'raagax_lan_beacon_v2';
const DEVICE_TTL_MS = 10000; // 10s expiration if no heartbeat received

export class LocalDiscoveryService {
  private static instance: LocalDiscoveryService;
  private localIdentity: LANDeviceAdvertisement;
  private discoveredDevices = new Map<string, DiscoveredLANDevice>();
  private listeners = new Set<(devices: DiscoveredLANDevice[]) => void>();
  private beaconChannel: BroadcastChannel | null = null;
  private discoveryTimer: NodeJS.Timeout | null = null;
  private pruneTimer: NodeJS.Timeout | null = null;
  private isDiscovering: boolean = false;

  private constructor() {
    this.localIdentity = this.initLocalIdentity();
    this.initBeaconChannel();
  }

  public static getInstance(): LocalDiscoveryService {
    if (!LocalDiscoveryService.instance) {
      LocalDiscoveryService.instance = new LocalDiscoveryService();
    }
    return LocalDiscoveryService.instance;
  }

  private initLocalIdentity(): LANDeviceAdvertisement {
    let deviceId = 'rx_' + Math.random().toString(36).substring(2, 10);
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STABLE_DEVICE_ID_KEY);
        if (stored) deviceId = stored;
        else localStorage.setItem(STABLE_DEVICE_ID_KEY, deviceId);
      } catch {}
    }

    const isAndroid = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
    const isMobileUA = typeof navigator !== 'undefined' && /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    let platform: LANPlatform = 'web';
    let deviceType: LANDeviceType = 'desktop';

    if (isAndroid) {
      platform = 'android';
      deviceType = 'mobile';
    } else if (typeof navigator !== 'undefined') {
      if (/Windows/i.test(navigator.userAgent)) platform = 'windows';
      else if (/Mac/i.test(navigator.userAgent)) platform = 'macos';
      else if (/Linux/i.test(navigator.userAgent)) platform = 'linux';
      else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        platform = 'ios';
        deviceType = /iPad/i.test(navigator.userAgent) ? 'tablet' : 'mobile';
      }
      if (isMobileUA && deviceType !== 'tablet') deviceType = 'mobile';
    }

    let defaultName = 'RaagaX Player';
    if (platform === 'windows') defaultName = 'Windows Desktop';
    else if (platform === 'macos') defaultName = 'MacBook Pro';
    else if (platform === 'android') defaultName = 'Android Phone';
    else if (platform === 'ios') defaultName = 'iPhone';

    return {
      deviceId,
      deviceName: defaultName,
      deviceType,
      platform,
      protocolVersion: '2.0.0',
      host: '127.0.0.1',
      port: 47104,
      capabilities: ['playback', 'remote_control', 'lossless_stream', 'switch_owner'],
      currentActivity: 'idle',
      timestamp: Date.now(),
    };
  }

  private initBeaconChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.beaconChannel = new BroadcastChannel(DISCOVERY_BEACON_CHANNEL);
        this.beaconChannel.onmessage = (event) => {
          if (event.data && event.data.deviceId) {
            this.handleAdvertisement(event.data);
          }
        };
      } catch (e) {
        console.warn('[LocalDiscoveryService] BroadcastChannel init error:', e);
      }
    }
  }

  public async startDiscovery() {
    if (this.isDiscovering) return;
    this.isDiscovering = true;

    // Start local server to get assigned port
    const port = await LocalServerBridge.getInstance().startServer(this.localIdentity.port);
    this.localIdentity.port = port;

    // 1. Android Native NsdManager registration & discovery
    const isAndroid = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
    if (isAndroid) {
      try {
        await RaagaXNativeConnect.requestLocalNetworkPermissions();
        await RaagaXNativeConnect.registerNsdService(this.localIdentity);
        await RaagaXNativeConnect.startNsdDiscovery((dev: LANDeviceAdvertisement) => {
          this.handleAdvertisement(dev);
        });
      } catch (e) {
        console.warn('[LocalDiscoveryService] Android NsdManager init warning:', e);
      }
    }

    // 2. Broadcast local advertisement beacon immediately
    this.broadcastAdvertisement();

    // 3. Periodic broadcast beacon every 3s
    this.discoveryTimer = setInterval(() => {
      this.broadcastAdvertisement();
    }, 3000);

    // 4. Prune stale devices every 4s
    this.pruneTimer = setInterval(() => {
      this.pruneStaleDevices();
    }, 4000);
  }

  public stopDiscovery() {
    this.isDiscovering = false;
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
  }

  public getLocalIdentity(): LANDeviceAdvertisement {
    // Enrich with current user and playback state
    const currentUser = useAuthStore.getState().user;
    const playerStore = usePlayerStore.getState();

    const isPlaying = playerStore.isPlaying && playerStore.isActiveDevice;
    const currentActivity = isPlaying ? 'playing' : (playerStore.isActiveDevice && playerStore.currentSong ? 'paused' : 'idle');

    this.localIdentity.userId = currentUser?.id || undefined;
    this.localIdentity.accountName = currentUser?.user_metadata?.name || currentUser?.email?.split('@')[0] || undefined;
    this.localIdentity.currentActivity = currentActivity;
    this.localIdentity.activeSongTitle = playerStore.currentSong?.title || undefined;
    this.localIdentity.activeSongCover = playerStore.currentSong?.coverUrl || undefined;
    this.localIdentity.timestamp = Date.now();

    return { ...this.localIdentity };
  }

  public clearDiscoveredDevices() {
    this.discoveredDevices.clear();
    this.notifyListeners();
  }

  public setDeviceName(name: string) {
    this.localIdentity.deviceName = name;
    this.broadcastAdvertisement();
  }

  public broadcastAdvertisement() {
    const currentAdv = this.getLocalIdentity();

    if (this.beaconChannel) {
      try {
        this.beaconChannel.postMessage(currentAdv);
      } catch (e) {
        console.warn('[LocalDiscoveryService] Beacon broadcast failed:', e);
      }
    }
  }

  public handleAdvertisement(ad: LANDeviceAdvertisement) {
    if (!ad || !ad.deviceId || ad.deviceId === this.localIdentity.deviceId) {
      return;
    }

    const currentUserId = useAuthStore.getState().user?.id;
    const isSameAccount = Boolean(currentUserId && ad.userId && currentUserId === ad.userId);

    const now = Date.now();
    const existing = this.discoveredDevices.get(ad.deviceId);

    const device: DiscoveredLANDevice = {
      ...ad,
      isSameAccount,
      authTier: isSameAccount ? 'SAME_ACCOUNT' : (ad.userId ? 'OTHER_ACCOUNT' : 'UNVERIFIED'),
      connectionStatus: existing?.connectionStatus || 'DISCONNECTED',
      lastSeen: now,
      rttMs: existing?.rttMs || 15,
      isLocalDevice: false,
    };

    this.discoveredDevices.set(ad.deviceId, device);
    this.notifyListeners();
  }

  public getDiscoveredDevices(): DiscoveredLANDevice[] {
    return Array.from(this.discoveredDevices.values()).sort((a, b) => {
      // Prioritize same account devices, then active devices
      if (a.isSameAccount && !b.isSameAccount) return -1;
      if (!a.isSameAccount && b.isSameAccount) return 1;
      if (a.currentActivity === 'playing' && b.currentActivity !== 'playing') return -1;
      if (a.currentActivity !== 'playing' && b.currentActivity === 'playing') return 1;
      return a.deviceName.localeCompare(b.deviceName);
    });
  }

  public subscribe(listener: (devices: DiscoveredLANDevice[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getDiscoveredDevices());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private pruneStaleDevices() {
    const now = Date.now();
    let hasChanges = false;

    for (const [id, dev] of this.discoveredDevices.entries()) {
      if (now - dev.lastSeen > DEVICE_TTL_MS) {
        this.discoveredDevices.delete(id);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.notifyListeners();
    }
  }

  private notifyListeners() {
    const list = this.getDiscoveredDevices();
    for (const listener of this.listeners) {
      try {
        listener(list);
      } catch (e) {
        console.error('[LocalDiscoveryService] Listener error:', e);
      }
    }
  }
}
