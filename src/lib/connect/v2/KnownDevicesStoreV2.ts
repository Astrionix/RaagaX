'use client';

import { KnownDeviceV2 } from './types';

const KNOWN_DEVICES_STORAGE_KEY = 'raagax_known_devices_v2';
const DISCOVERY_PRIVACY_KEY = 'raagax_discovery_privacy_mode_v2';

export class KnownDevicesStoreV2 {
  private static instance: KnownDevicesStoreV2;
  private knownDevices = new Map<string, KnownDeviceV2>();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): KnownDevicesStoreV2 {
    if (!KnownDevicesStoreV2.instance) {
      KnownDevicesStoreV2.instance = new KnownDevicesStoreV2();
    }
    return KnownDevicesStoreV2.instance;
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(KNOWN_DEVICES_STORAGE_KEY);
      if (raw) {
        const list: KnownDeviceV2[] = JSON.parse(raw);
        list.forEach(d => this.knownDevices.set(d.deviceId, d));
      }
    } catch {}
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        KNOWN_DEVICES_STORAGE_KEY,
        JSON.stringify(Array.from(this.knownDevices.values()))
      );
    } catch {}
  }

  public getKnownDevices(): KnownDeviceV2[] {
    return Array.from(this.knownDevices.values()).sort((a, b) => b.lastConnectedAt - a.lastConnectedAt);
  }

  public isDeviceTrusted(deviceId: string): boolean {
    const dev = this.knownDevices.get(deviceId);
    return !!dev && dev.isTrusted;
  }

  public addOrUpdateKnownDevice(device: Partial<KnownDeviceV2> & { deviceId: string; name: string }) {
    const existing = this.knownDevices.get(device.deviceId);
    const updated: KnownDeviceV2 = {
      deviceId: device.deviceId,
      name: device.name || existing?.name || 'RaagaX Device',
      platform: device.platform || existing?.platform || 'web',
      pairedAt: existing?.pairedAt || Date.now(),
      lastConnectedAt: Date.now(),
      isTrusted: device.isTrusted !== undefined ? device.isTrusted : true,
    };
    this.knownDevices.set(device.deviceId, updated);
    this.saveToStorage();
  }

  public renameDevice(deviceId: string, newName: string) {
    const dev = this.knownDevices.get(deviceId);
    if (dev) {
      dev.name = newName;
      this.saveToStorage();
    }
  }

  public forgetDevice(deviceId: string) {
    this.knownDevices.delete(deviceId);
    this.saveToStorage();
  }

  public getPrivacyMode(): 'VISIBLE' | 'VISIBLE_WHEN_APP_OPEN' | 'INVISIBLE' {
    if (typeof window === 'undefined') return 'VISIBLE_WHEN_APP_OPEN';
    return (localStorage.getItem(DISCOVERY_PRIVACY_KEY) as any) || 'VISIBLE_WHEN_APP_OPEN';
  }

  public setPrivacyMode(mode: 'VISIBLE' | 'VISIBLE_WHEN_APP_OPEN' | 'INVISIBLE') {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DISCOVERY_PRIVACY_KEY, mode);
  }
}
