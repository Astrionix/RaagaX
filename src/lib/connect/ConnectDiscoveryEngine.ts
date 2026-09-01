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

type DeviceListListener = (devices: ConnectDevice[]) => void;

const CONNECT_STORAGE_PREFIX = 'raagax_connect_dev_';
const HEARTBEAT_INTERVAL_MS = 3000;
const DEVICE_EXPIRY_MS = 15000;

export class ConnectDiscoveryEngine {
  private static instance: ConnectDiscoveryEngine;
  private localDevice: ConnectDevice;
  private discoveredDevices: Map<string, ConnectDevice> = new Map();
  private listeners: Set<DeviceListListener> = new Set();
  private heartbeatTimer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;

  private constructor() {
    this.localDevice = this.initializeLocalDevice();
    if (typeof window !== 'undefined') {
      this.setupBroadcastChannel();
      this.setupLifecycleListeners();
      this.startAdvertising();
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
        ConnectClientManager.getInstance().requestCurrentPlaybackState();
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

    // 3. HTTP Server Beacon (cross-browser, cross-device, LAN and cloud synchronization)
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      fetch('/api/connect/beacon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: this.localDevice,
          accountId: this.localDevice.accountId,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.pendingCommands) && data.pendingCommands.length > 0) {
            const server = ConnectServerEngine.getInstance();
            for (const cmd of data.pendingCommands) {
              server.handleIncomingCommand(cmd).catch(() => {});
            }
          }
        })
        .catch(() => {});
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

  public scanNow(): ConnectDevice[] {
    // 1. Scan LocalStorage for active local beacons
    if (typeof window !== 'undefined') {
      try {
        const now = Date.now();
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

    // 2. Fetch from HTTP API for cross-browser / cross-device network peers
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      fetch(`/api/connect/devices?excludeId=${encodeURIComponent(this.localDevice.deviceId)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.devices)) {
            let changed = false;
            for (const dev of data.devices) {
              if (dev.deviceId !== this.localDevice.deviceId) {
                this.discoveredDevices.set(dev.deviceId, { ...dev, isCurrentDevice: false });
                changed = true;
              }
            }
            if (changed) {
              this.notifyListeners();
            }
          }
        })
        .catch(() => {});
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
