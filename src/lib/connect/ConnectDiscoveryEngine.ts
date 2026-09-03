/**
 * RaagaX Connect — Device Discovery & Presence Engine
 *
 * Implements mDNS/DNS-SD style local network discovery (_raaga-connect._tcp),
 * Local HTTP Device Registry, and Cloud Account Presence synchronization.
 */

import { ConnectDevice, ConnectDeviceType, ConnectTransportType } from '@/types/connect';
import { ConnectServerEngine } from './ConnectServerEngine';
import { DeviceIdentity } from './identity/DeviceIdentity';
import { LocalLanDiscovery } from './discovery/LocalLanDiscovery';
import { getApiUrl } from '@/lib/config/apiConfig';

type DeviceListListener = (devices: ConnectDevice[]) => void;

const CONNECT_STORAGE_PREFIX = 'raagax_connect_dev_';
const HEARTBEAT_INTERVAL_MS = 3000;
const DEVICE_EXPIRY_MS = 30000;

export class ConnectDiscoveryEngine {
  private static instance: ConnectDiscoveryEngine;
  private localDevice: ConnectDevice;
  private discoveredDevices: Map<string, ConnectDevice> = new Map();
  private listeners: Set<DeviceListListener> = new Set();
  private heartbeatTimer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private presenceChannel: any = null;
  private subscribedUserId: string | null = null;
  private localSubnet: string = '127.0.0';
  private lastHttpBeaconTime: number = 0;
  private lastHttpScanTime: number = 0;

  private constructor() {
    this.localDevice = this.initializeLocalDevice();
    if (typeof window !== 'undefined') {
      this.setupBroadcastChannel();
      this.setupLifecycleListeners();
      this.startAdvertising();
      this.setupPresenceFromCurrentAuth();
      try {
        LocalLanDiscovery.getInstance().connectStream();
      } catch {}
    }
  }

  public static getInstance(): ConnectDiscoveryEngine {
    if (!ConnectDiscoveryEngine.instance) {
      ConnectDiscoveryEngine.instance = new ConnectDiscoveryEngine();
    }
    return ConnectDiscoveryEngine.instance;
  }

  private initializeLocalDevice(): ConnectDevice {
    try {
      return DeviceIdentity.getInstance().toConnectDevice();
    } catch {
      return {
        deviceId: 'dev_local',
        deviceName: 'RaagaX Device',
        deviceType: 'desktop',
        platform: 'Web',
        isCurrentDevice: true,
        isOnline: true,
        state: 'IDLE',
        lastSeenAt: Date.now(),
        transport: 'LOCAL_LAN',
        capabilities: {
          canPlayAudio: true,
          supportsVolume: true,
          supportsLossless: true,
        },
      };
    }
  }

  private setupBroadcastChannel() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel('raaga_connect_mdns_beacon');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'DEVICE_BEACON' && event.data.device) {
          this.handleIncomingBeacon(event.data.device);
        } else if (event.data?.type === 'DEVICE_BYE' && event.data.deviceId) {
          this.discoveredDevices.delete(event.data.deviceId);
          this.notifyListeners();
        }
      };
    } catch {}
  }

  private lastRehydrationAt = 0;
  private isRehydrating = false;

  private setupLifecycleListeners() {
    if (typeof window === 'undefined') return;

    const onWakeOrReconnect = () => {
      const now = Date.now();
      if (this.isRehydrating || now - this.lastRehydrationAt < 1500) return;
      this.lastRehydrationAt = now;
      this.isRehydrating = true;

      console.log('[CONNECT_LIFECYCLE] App wake / focus / network online detected. Triggering instant session rehydration.');
      // 1. Broadcast beacon immediately
      this.broadcastBeacon();
      // 2. Scan available devices
      this.scanNow();
      // 3. Request latest session snapshot from active speaker
      try {
        const { ConnectClientManager } = require('./ConnectClientManager');
        ConnectClientManager.getInstance().requestCurrentPlaybackState()?.catch?.(() => {});
      } catch {}
      // 4. Reconnect SSE stream if dropped during mobile sleep
      try {
        LocalLanDiscovery.getInstance().connectStream();
      } catch {}

      setTimeout(() => {
        this.isRehydrating = false;
      }, 1000);
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          onWakeOrReconnect();
        }
      });
    }
    window.addEventListener('focus', onWakeOrReconnect);
    window.addEventListener('online', onWakeOrReconnect);

    // Automatically sync presence channel when user logs in or out
    try {
      const { useAuthStore } = require('@/context/useAuthStore');
      useAuthStore.subscribe((state: any, prevState: any) => {
        const uid = state?.user?.id;
        const prevUid = prevState?.user?.id;
        if (uid && uid !== prevUid) {
          this.localDevice.accountId = uid;
          this.setupPresenceChannel(uid);
        } else if (!uid && prevUid) {
          this.cleanupPresenceChannel();
        }
      });
    } catch {}
  }

  public setupPresenceFromCurrentAuth(): void {
    if (typeof window === 'undefined') return;
    try {
      const { useAuthStore } = require('@/context/useAuthStore');
      const user = useAuthStore.getState().user;
      if (user?.id) {
        this.localDevice.accountId = user.id;
        if (user.email) (this.localDevice as any).email = user.email;
      }
      this.setupPresenceChannel(user?.id || null);
    } catch {
      this.setupPresenceChannel(null);
    }
  }

  public setupPresenceChannel(userId?: string | null): void {
    if (typeof window === 'undefined') return;
    if (userId) {
      this.localDevice.accountId = userId;
    }

    if (this.presenceChannel) {
      // Already connected to discovery mesh; update tracked state with current identity & subnet
      try {
        this.presenceChannel.track({
          device: {
            ...this.localDevice,
            subnet: this.localSubnet || '127.0.0',
          },
          onlineAt: Date.now(),
        }).catch(() => {});
      } catch {}
      return;
    }

    try {
      const { supabase } = require('@/lib/supabase');
      const channelName = 'raaga_connect_mesh';
      this.presenceChannel = supabase.channel(channelName, {
        config: {
          presence: { key: this.localDevice.deviceId },
          broadcast: { self: false },
        },
      });

      const handlePresenceMeshUpdate = () => {
        const state = this.presenceChannel?.presenceState() || {};
        const currentDeviceId = this.localDevice.deviceId;
        const activeDeviceIds = new Set<string>();
        let changed = false;

        for (const [key, presences] of Object.entries(state)) {
          if (key === currentDeviceId) continue;
          if (Array.isArray(presences) && presences.length > 0) {
            const remote = (presences[0] as any)?.device as ConnectDevice & { subnet?: string };
            if (!remote || !remote.deviceId || remote.deviceId === currentDeviceId) continue;

            activeDeviceIds.add(remote.deviceId);

            const myAccount = this.localDevice.accountId;
            const remoteAccount = remote.accountId;
            const isSameAccount = Boolean(myAccount && remoteAccount && myAccount === remoteAccount);

            this.discoveredDevices.set(remote.deviceId, {
              ...remote,
              isCurrentDevice: false,
              lastSeenAt: Date.now(),
              transport: 'CLOUD_RELAY',
              authStatus: 'AUTO_AUTHORIZED',
              isSameAccount: Boolean(isSameAccount),
            });
            changed = true;
          }
        }

        // Instant Prune: Remove devices that have left presence mesh immediately (<50ms)
        for (const [id, dev] of this.discoveredDevices.entries()) {
          if (dev.transport === 'CLOUD_RELAY' || dev.transport === 'LOCAL_LAN') {
            if (!activeDeviceIds.has(id)) {
              this.discoveredDevices.delete(id);
              changed = true;
            }
          }
        }

        if (changed) {
          this.notifyListeners();
        }
      };

      this.presenceChannel
        .on('presence', { event: 'sync' }, handlePresenceMeshUpdate)
        .on('presence', { event: 'join' }, handlePresenceMeshUpdate)
        .on('presence', { event: 'leave' }, handlePresenceMeshUpdate)
        .on('broadcast', { event: 'CONNECT_COMMAND' }, (msg: any) => {
          const cmd = msg?.payload || msg;
          if (cmd && cmd.targetDeviceId === this.localDevice.deviceId) {
            import('./ConnectServerEngine').then(({ ConnectServerEngine }) => {
              ConnectServerEngine.getInstance().handleIncomingCommand(cmd);
            });
          }
        })
        .on('broadcast', { event: 'SESSION_UPDATE' }, (msg: any) => {
          const session = msg?.payload || msg;
          if (session) {
            import('./ConnectClientManager').then(({ ConnectClientManager }) => {
              ConnectClientManager.getInstance().handleIncomingSession(session);
            });
          }
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await this.presenceChannel?.track({
              device: {
                ...this.localDevice,
                subnet: this.localSubnet || '127.0.0',
              },
              onlineAt: Date.now(),
            }).catch(() => {});
          }
        });
    } catch (e) {
      console.warn('[ConnectDiscoveryEngine] Supabase presence channel error:', e);
    }
  }

  public cleanupPresenceChannel(): void {
    this.localDevice.accountId = undefined;
    if (this.presenceChannel) {
      try {
        this.presenceChannel.track({
          device: {
            ...this.localDevice,
            accountId: null,
            subnet: this.localSubnet || '127.0.0',
          },
          onlineAt: Date.now(),
        }).catch(() => {});
      } catch {}
    }
  }

  public sendSupabaseBroadcast(event: string, payload: any): void {
    if (this.presenceChannel && (this.presenceChannel as any).state === 'joined') {
      try {
        this.presenceChannel.send({
          type: 'broadcast',
          event,
          payload,
        }).catch(() => {});
      } catch {}
    }
  }

  public getLocalDevice(): ConnectDevice {
    return { ...this.localDevice, lastSeenAt: Date.now() };
  }

  public setLocalDeviceName(name: string): void {
    this.localDevice.deviceName = name;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('raagax_connect_device_name', name);
      } catch {}
    }
    this.broadcastBeacon();
  }

  public setLocalPlaybackState(state: ConnectDevice['state'], currentSong?: any, positionMs?: number, volume?: number) {
    this.localDevice.state = state;
    if (currentSong !== undefined) this.localDevice.currentSong = currentSong;
    if (positionMs !== undefined) this.localDevice.positionMs = positionMs;
    if (volume !== undefined) this.localDevice.volume = volume;
    this.localDevice.lastSeenAt = Date.now();
    this.broadcastBeacon();
  }

  public startAdvertising(): void {
    if (this.heartbeatTimer) return;

    this.broadcastBeacon();
    this.scanNow();

    this.heartbeatTimer = setInterval(() => {
      this.broadcastBeacon();
      this.scanNow();
      this.pruneStaleDevices();
    }, HEARTBEAT_INTERVAL_MS);
  }

  public stopAdvertising(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'DEVICE_BYE',
          deviceId: this.localDevice.deviceId,
        });
      } catch {}
    }
  }

  public broadcastBeacon(): void {
    this.localDevice.lastSeenAt = Date.now();

    // Track active presence on Supabase Realtime channel
    if (this.presenceChannel) {
      this.presenceChannel.track({
        device: this.localDevice,
        onlineAt: Date.now(),
      }).catch(() => {});
    }

    // 1. Broadcast via local BroadcastChannel (same browser tab fast path)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'DEVICE_BEACON',
          device: this.localDevice,
        });
      } catch {}
    }

    // 2. Broadcast via LocalStorage beacon (same browser profile sharing)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          `${CONNECT_STORAGE_PREFIX}${this.localDevice.deviceId}`,
          JSON.stringify(this.localDevice)
        );
      } catch {}
    }
  }

  private handleIncomingBeacon(device: ConnectDevice): void {
    if (device.deviceId === this.localDevice.deviceId) return;

    const updated: ConnectDevice = {
      ...device,
      isCurrentDevice: false,
      lastSeenAt: Date.now(),
    };

    this.discoveredDevices.set(device.deviceId, updated);
    this.notifyListeners();
  }

  public handleIncomingDeviceList(devices: ConnectDevice[]): void {
    let changed = false;
    for (const dev of devices) {
      if (dev.deviceId !== this.localDevice.deviceId) {
        this.discoveredDevices.set(dev.deviceId, { ...dev, isCurrentDevice: false });
        changed = true;
      }
    }
    if (changed) {
      this.notifyListeners();
    }
  }

  public scanNow(): ConnectDevice[] {
    const now = Date.now();
    // 1. Scan LocalStorage for active local beacons
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(CONNECT_STORAGE_PREFIX)) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const dev: ConnectDevice = JSON.parse(raw);
              if (dev.deviceId !== this.localDevice.deviceId && now - dev.lastSeenAt < DEVICE_EXPIRY_MS) {
                this.discoveredDevices.set(dev.deviceId, { ...dev, isCurrentDevice: false });
              }
            }
          }
        }
      } catch {}
    }

    // 2. Scan Supabase Realtime presence mesh for instant zero-latency discovery
    if (this.presenceChannel) {
      try {
        const state = this.presenceChannel.presenceState() || {};
        const currentDeviceId = this.localDevice.deviceId;
        for (const [key, presences] of Object.entries(state)) {
          if (key === currentDeviceId) continue;
          if (Array.isArray(presences) && presences.length > 0) {
            const remote = (presences[0] as any)?.device as ConnectDevice;
            if (remote && remote.deviceId && remote.deviceId !== currentDeviceId) {
              const myAccount = this.localDevice.accountId;
              const remoteAccount = remote.accountId;
              const isSameAccount = Boolean(myAccount && remoteAccount && myAccount === remoteAccount);
              this.discoveredDevices.set(remote.deviceId, {
                ...remote,
                isCurrentDevice: false,
                lastSeenAt: now,
                transport: 'CLOUD_RELAY',
                authStatus: 'AUTO_AUTHORIZED',
                isSameAccount: Boolean(isSameAccount),
              });
            }
          }
        }
      } catch {}
    }

    this.pruneStaleDevices();
    return this.getAvailableDevices();
  }

  private pruneStaleDevices(): void {
    const now = Date.now();
    let changed = false;

    for (const [id, dev] of this.discoveredDevices.entries()) {
      if (now - dev.lastSeenAt > DEVICE_EXPIRY_MS) {
        this.discoveredDevices.delete(id);
        changed = true;
      }
    }

    if (changed) {
      this.notifyListeners();
    }
  }

  public getAvailableDevices(): ConnectDevice[] {
    const list: ConnectDevice[] = [this.getLocalDevice()];
    for (const dev of this.discoveredDevices.values()) {
      list.push(dev);
    }
    return list;
  }

  public getDiscoveredDevices(): ConnectDevice[] {
    return this.getAvailableDevices();
  }

  public subscribe(listener: DeviceListListener): () => void {
    this.listeners.add(listener);
    listener(this.getAvailableDevices());

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const devices = this.getAvailableDevices();
    this.listeners.forEach((listener) => {
      try {
        listener(devices);
      } catch {}
    });
  }
}
