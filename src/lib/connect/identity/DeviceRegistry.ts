/**
 * RaagaX Connect — Device Registry
 *
 * Tracks all known devices discovered over Local LAN (mDNS / BroadcastChannel / HTTP)
 * and Cloud presence. Maintains online/offline state with hysteresis.
 */

import { ConnectDevice } from '@/types/connect';
import { CapabilityRegistry } from './CapabilityRegistry';

export class DeviceRegistry {
  private static instance: DeviceRegistry;
  private devices: Map<string, ConnectDevice> = new Map();
  private listeners: Set<(devices: ConnectDevice[]) => void> = new Set();
  private readonly DEVICE_TTL_MS = 10000;

  private constructor() {}

  public static getInstance(): DeviceRegistry {
    if (!DeviceRegistry.instance) {
      DeviceRegistry.instance = new DeviceRegistry();
    }
    return DeviceRegistry.instance;
  }

  public registerOrUpdateDevice(device: ConnectDevice): void {
    const existing = this.devices.get(device.deviceId);
    const updated: ConnectDevice = {
      ...(existing || {}),
      ...device,
      lastSeenAt: Date.now(),
      isOnline: true,
    };

    if (device.capabilities) {
      CapabilityRegistry.getInstance().register(device.deviceId, device.capabilities);
    }

    this.devices.set(device.deviceId, updated);
    this.notifyListeners();
  }

  public markOffline(deviceId: string): void {
    const dev = this.devices.get(deviceId);
    if (dev) {
      dev.isOnline = false;
      dev.state = 'OFFLINE';
      this.notifyListeners();
    }
  }

  public removeDevice(deviceId: string): void {
    if (this.devices.delete(deviceId)) {
      this.notifyListeners();
    }
  }

  public getDevice(deviceId: string): ConnectDevice | undefined {
    return this.devices.get(deviceId);
  }

  public getAllActiveDevices(): ConnectDevice[] {
    const now = Date.now();
    const active: ConnectDevice[] = [];

    this.devices.forEach((dev) => {
      if (dev.isCurrentDevice || (now - dev.lastSeenAt <= this.DEVICE_TTL_MS && dev.isOnline)) {
        active.push({ ...dev });
      }
    });

    return active;
  }

  public subscribe(listener: (devices: ConnectDevice[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getAllActiveDevices());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const list = this.getAllActiveDevices();
    this.listeners.forEach((listener) => {
      try {
        listener(list);
      } catch {}
    });
  }
}
