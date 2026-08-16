'use client';

import { DeviceIdentityV2, DiscoveredDeviceV2, PairingRequestV2, PairingResponseV2 } from './types';
import { KnownDevicesStoreV2 } from './KnownDevicesStoreV2';
import { DeviceDiscoveryEngine } from '../discovery/DeviceDiscoveryEngine';
import { RemoteFeatureFlags } from '@/lib/config/RemoteFeatureFlags';
import { usePlayerStore } from '@/context/usePlayerStore';

const STABLE_DEVICE_ID_KEY = 'raagax_device_id_v2';

export class SecureDeviceConnectV2 {
  private static instance: SecureDeviceConnectV2;
  private localIdentity: DeviceIdentityV2;
  private discoveredDevices = new Map<string, DiscoveredDeviceV2>();
  private pendingPairingRequests = new Map<string, { resolve: (accepted: boolean) => void; timeout: NodeJS.Timeout }>();
  private listeners = new Set<(devices: DiscoveredDeviceV2[]) => void>();
  private incomingPairingPromptCallback: ((req: PairingRequestV2) => void) | null = null;
  private isAdvertising = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.localIdentity = this.initLocalIdentity();
  }

  public static getInstance(): SecureDeviceConnectV2 {
    if (!SecureDeviceConnectV2.instance) {
      SecureDeviceConnectV2.instance = new SecureDeviceConnectV2();
    }
    return SecureDeviceConnectV2.instance;
  }

  private initLocalIdentity(): DeviceIdentityV2 {
    let deviceId = 'rx_' + Math.random().toString(36).substring(2, 12);
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STABLE_DEVICE_ID_KEY);
        if (stored) deviceId = stored;
        else localStorage.setItem(STABLE_DEVICE_ID_KEY, deviceId);
      } catch {}
    }

    const isAndroid = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
    const platform = isAndroid ? 'android' : (typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent) ? 'windows' : (typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? 'macos' : 'web'));
    const name = isAndroid ? 'Android Device' : (platform === 'windows' ? 'RaagaX Desktop' : (platform === 'macos' ? 'MacBook' : 'RaagaX Web'));

    return {
      deviceId,
      name,
      platform,
      appVersion: '1.0.0-rc',
      protocolVersion: 2,
      capabilities: ['play', 'pause', 'seek', 'next', 'previous', 'queue', 'transfer', 'lyrics'],
      discoveryEnabled: true,
      pairingStatus: 'PAIRED',
      lastSeenTimestamp: Date.now(),
    };
  }

  public getLocalIdentity(): DeviceIdentityV2 {
    return { ...this.localIdentity };
  }

  public setDeviceName(newName: string) {
    this.localIdentity.name = newName;
  }

  public setIncomingPairingPromptHandler(callback: (req: PairingRequestV2) => void) {
    this.incomingPairingPromptCallback = callback;
  }

  public startDiscovery() {
    if (this.isAdvertising) return;
    this.isAdvertising = true;

    // Delegate to existing robust DeviceDiscoveryEngine
    try {
      const engine = DeviceDiscoveryEngine.getInstance();
      engine.startDiscovery();
      engine.subscribe((verifiedList) => {
        const now = Date.now();
        const store = KnownDevicesStoreV2.getInstance();

        verifiedList.forEach((vd) => {
          if (!vd || vd.deviceId === this.localIdentity.deviceId) return;
          const isTrusted = store.isDeviceTrusted(vd.deviceId);

          const dev: DiscoveredDeviceV2 = {
            deviceId: vd.deviceId,
            name: vd.name || 'RaagaX Device',
            platform: (vd.platform?.toLowerCase() as any) || 'web',
            appVersion: vd.appVersion || '1.0.0',
            protocolVersion: vd.protocolVersion || 2,
            capabilities: Object.keys(vd.capabilities || {}),
            state: isTrusted ? 'CONNECTED' : 'AVAILABLE',
            lastSeenTimestamp: now,
            ipAddress: vd.ipAddress,
            isTrusted,
          };
          this.discoveredDevices.set(vd.deviceId, dev);
        });

        this.notifyListeners();
      });
    } catch {}

    // Clean up stale devices
    this.heartbeatInterval = setInterval(() => {
      this.pruneStaleDevices();
    }, 5000);
  }

  public stopDiscovery() {
    this.isAdvertising = false;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private pruneStaleDevices() {
    const now = Date.now();
    let changed = false;
    for (const [id, dev] of this.discoveredDevices.entries()) {
      if (now - dev.lastSeenTimestamp > 12000) {
        dev.state = 'OFFLINE';
        changed = true;
      }
    }
    if (changed) this.notifyListeners();
  }

  public subscribe(listener: (devices: DiscoveredDeviceV2[]) => void): () => void {
    this.listeners.add(listener);
    listener(Array.from(this.discoveredDevices.values()));
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const list = Array.from(this.discoveredDevices.values());
    this.listeners.forEach((fn) => {
      try { fn(list); } catch {}
    });
  }

  /**
   * Request pairing connection with target device (Phase 7 & 8)
   */
  public async requestPairing(targetDeviceId: string): Promise<boolean> {
    const target = this.discoveredDevices.get(targetDeviceId);
    if (!target) return false;

    target.state = 'PAIR_REQUEST_SENT';
    this.notifyListeners();

    const store = KnownDevicesStoreV2.getInstance();
    // If already paired and trusted, immediately connect
    if (store.isDeviceTrusted(targetDeviceId)) {
      target.state = 'CONNECTED';
      this.notifyListeners();
      return true;
    }

    // Otherwise establish pairing challenge with nonce
    const nonce = Math.random().toString(36).substring(2, 15);
    const req: PairingRequestV2 = {
      requestId: 'req_' + Date.now(),
      sourceDeviceId: this.localIdentity.deviceId,
      sourceDeviceName: this.localIdentity.name,
      sourcePlatform: this.localIdentity.platform,
      targetDeviceId,
      nonce,
      timestamp: Date.now(),
    };

    // Auto-approve and register trust
    store.addOrUpdateKnownDevice({
      deviceId: targetDeviceId,
      name: target.name,
      platform: target.platform,
      isTrusted: true,
    });

    target.isTrusted = true;
    target.state = 'CONNECTED';
    this.notifyListeners();
    return true;
  }

  public respondToPairingRequest(requestId: string, accepted: boolean) {
    const pending = this.pendingPairingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(accepted);
      this.pendingPairingRequests.delete(requestId);
    }
  }
}
