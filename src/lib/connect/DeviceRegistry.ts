import { DeviceInfo } from './types';

export class DeviceRegistry {
  private static instance: DeviceRegistry;
  private devices: Map<string, DeviceInfo> = new Map();
  private subscribers: Set<(devices: DeviceInfo[]) => void> = new Set();

  private constructor() {}

  public static getInstance(): DeviceRegistry {
    if (!DeviceRegistry.instance) {
      DeviceRegistry.instance = new DeviceRegistry();
    }
    return DeviceRegistry.instance;
  }

  public upsertDevice(device: DeviceInfo, source: 'LAN' | 'CLOUD'): void {
    const existing = this.devices.get(device.deviceId);
    let mergedSource: 'LAN' | 'CLOUD' | 'BOTH' = source;
    let isSameWifi = source === 'LAN';

    if (existing) {
      if (existing.source && existing.source !== source) {
        mergedSource = 'BOTH';
      }
      isSameWifi = isSameWifi || Boolean(existing.isSameWifi);
    }

    const updated: DeviceInfo = {
      ...existing,
      ...device,
      source: mergedSource,
      isSameWifi,
      isOnline: true,
      lastSeen: Date.now(),
    };

    this.devices.set(device.deviceId, updated);
    this.notify();
  }

  public markOffline(deviceId: string): void {
    const existing = this.devices.get(deviceId);
    if (existing) {
      existing.isOnline = false;
      this.notify();
    }
  }

  public removeDevice(deviceId: string): void {
    if (this.devices.delete(deviceId)) {
      this.notify();
    }
  }

  public getDevice(deviceId: string): DeviceInfo | undefined {
    return this.devices.get(deviceId);
  }

  public getAllDevices(excludeSelfId?: string): DeviceInfo[] {
    const all = Array.from(this.devices.values()).filter((d) => d.isOnline !== false);
    if (excludeSelfId) {
      return all.filter((d) => d.deviceId !== excludeSelfId);
    }
    return all;
  }

  public clear(): void {
    this.devices.clear();
    this.notify();
  }

  public subscribe(callback: (devices: DeviceInfo[]) => void): () => void {
    this.subscribers.add(callback);
    callback(this.getAllDevices());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    const list = this.getAllDevices();
    this.subscribers.forEach((cb) => cb(list));
  }
}
