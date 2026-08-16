'use client';

import { UnifiedDeviceV3, DeviceClassificationV3 } from './types';
import { ConnectionRouterV3 } from './ConnectionRouterV3';
import { DeviceDiscoveryEngine } from '../discovery/DeviceDiscoveryEngine';
import { KnownDevicesStoreV2 } from '../v2/KnownDevicesStoreV2';
import { useAuthStore } from '@/context/useAuthStore';

export class AccountAwareDeviceRegistryV3 {
  private static instance: AccountAwareDeviceRegistryV3;
  private unifiedDevices = new Map<string, UnifiedDeviceV3>();
  private listeners = new Set<(devices: UnifiedDeviceV3[]) => void>();
  private isRunning = false;

  private constructor() {}

  public static getInstance(): AccountAwareDeviceRegistryV3 {
    if (!AccountAwareDeviceRegistryV3.instance) {
      AccountAwareDeviceRegistryV3.instance = new AccountAwareDeviceRegistryV3();
    }
    return AccountAwareDeviceRegistryV3.instance;
  }

  public startRegistry() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const discovery = DeviceDiscoveryEngine.getInstance();
      discovery.startDiscovery();
      discovery.subscribe((verifiedList) => {
        const currentUserId = useAuthStore.getState().user?.id;
        const knownStore = KnownDevicesStoreV2.getInstance();
        const router = ConnectionRouterV3.getInstance();
        const now = Date.now();

        verifiedList.forEach((vd) => {
          if (!vd) return;
          const isSameAccount = !!currentUserId && !!vd.userId && currentUserId === vd.userId;
          const isPaired = isSameAccount || knownStore.isDeviceTrusted(vd.deviceId);

          let relationship: DeviceClassificationV3 = 'NEARBY_UNPAIRED_DEVICE';
          if (isSameAccount) {
            relationship = 'OWN_DEVICE';
          } else if (isPaired) {
            relationship = 'KNOWN_PAIRED_DEVICE';
          }

          const sameLocalNetwork = vd.discoverySources.has('LAN') || vd.isNearby;
          const lanAvailable = sameLocalNetwork && vd.reachabilityState !== 'OFFLINE';
          const cloudAvailable = vd.discoverySources.has('CLOUD') || vd.reachabilityState === 'ONLINE';

          const selectedTransport = router.evaluateRoute({
            sourceAccountId: currentUserId,
            targetAccountId: vd.userId,
            sameLocalNetwork,
            lanAvailable,
            cloudAvailable,
            isPaired,
            isAuthorized: isPaired,
          });

          const unified: UnifiedDeviceV3 = {
            deviceId: vd.deviceId,
            accountId: vd.userId,
            name: vd.name || 'RaagaX Device',
            platform: (vd.platform?.toLowerCase() as any) || 'web',
            appVersion: vd.appVersion || '1.0.0',
            protocolVersion: vd.protocolVersion || 2,
            capabilities: Object.keys(vd.capabilities || {}),
            discoverySources: Array.from(vd.discoverySources).map(s => s.toLowerCase() as 'lan' | 'cloud'),
            sameLocalNetwork,
            relationship,
            selectedTransport,
            ipAddress: vd.ipAddress,
            lastSeenTimestamp: now,
            isTrusted: isPaired,
          };

          this.unifiedDevices.set(vd.deviceId, unified);
        });

        this.notifyListeners();
      });
    } catch {}
  }

  public getDevices(): UnifiedDeviceV3[] {
    return Array.from(this.unifiedDevices.values());
  }

  public subscribe(listener: (devices: UnifiedDeviceV3[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getDevices());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const list = this.getDevices();
    this.listeners.forEach(fn => {
      try { fn(list); } catch {}
    });
  }
}
