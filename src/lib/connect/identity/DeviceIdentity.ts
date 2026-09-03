/**
 * RaagaX Connect — Device Identity Module
 *
 * Provides a stable device identifier (persisted in localStorage / cookie / app storage)
 * along with hardware metadata, platform detection, and installation profile.
 */

import { ConnectDevice, ConnectDeviceType } from '@/types/connect';

export interface DeviceIdentityProfile {
  deviceId: string;
  installationId: string;
  deviceName: string;
  deviceType: ConnectDeviceType;
  platform: string;
  appVersion: string;
}

export class DeviceIdentity {
  private static instance: DeviceIdentity;
  private profile: DeviceIdentityProfile;

  private constructor() {
    this.profile = this.initializeProfile();
  }

  public static getInstance(): DeviceIdentity {
    if (!DeviceIdentity.instance) {
      DeviceIdentity.instance = new DeviceIdentity();
    }
    return DeviceIdentity.instance;
  }

  private initializeProfile(): DeviceIdentityProfile {
    let deviceId = '';
    let installationId = '';
    const platform = this.detectPlatform();
    const deviceType = this.detectDeviceType(platform);
    const deviceName = this.detectDeviceName(platform);
    const appVersion = '2.4.0';

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        let baseId = localStorage.getItem('rx_connect_device_id') || '';
        installationId = localStorage.getItem('rx_connect_install_id') || '';
        if (!baseId) {
          const prefix = deviceType === 'mobile' || deviceType === 'tablet' ? 'mob' : 'desk';
          baseId = `rx_dev_${prefix}_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
          localStorage.setItem('rx_connect_device_id', baseId);
        }
        if (!installationId) {
          installationId = `inst_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
          localStorage.setItem('rx_connect_install_id', installationId);
        }

        // Tab-isolated suffix so multiple browser tabs on the same machine discover each other cleanly
        let tabSuffix = '';
        if (typeof sessionStorage !== 'undefined') {
          tabSuffix = sessionStorage.getItem('rx_connect_tab_id') || '';
          if (!tabSuffix) {
            tabSuffix = Math.random().toString(36).substring(2, 6);
            try { sessionStorage.setItem('rx_connect_tab_id', tabSuffix); } catch {}
          }
        }
        deviceId = tabSuffix ? `${baseId}_${tabSuffix}` : baseId;
      } catch {
        deviceId = `rx_dev_fallback_${Date.now().toString(36)}`;
        installationId = `inst_fallback_${Date.now().toString(36)}`;
      }
    } else {
      deviceId = `rx_dev_node_${Date.now().toString(36)}`;
      installationId = `inst_node_${Date.now().toString(36)}`;
    }

    return {
      deviceId,
      installationId,
      deviceName,
      deviceType,
      platform,
      appVersion,
    };
  }

  private detectPlatform(): string {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'Node/Server';
    const ua = navigator.userAgent || '';
    if (/iPad|Macintosh/i.test(ua) && 'ontouchend' in document) return 'iPad';
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/Android/i.test(ua)) return 'Android';
    if (/Windows/i.test(ua)) {
      if (/Edg\//i.test(ua)) return 'Windows (Edge)';
      if (/Chrome/i.test(ua)) {
        if ((navigator as any).brave || (window as any).chrome) return 'Windows (Brave/Chrome)';
        return 'Windows (Chrome)';
      }
      if (/Firefox/i.test(ua)) return 'Windows (Firefox)';
      return 'Windows';
    }
    if (/Macintosh/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Web';
  }

  private detectDeviceType(platform: string): ConnectDeviceType {
    if (platform === 'iPad') return 'tablet';
    if (platform === 'iPhone' || platform === 'Android') return 'mobile';
    return 'desktop';
  }

  private detectDeviceName(platform: string): string {
    if (platform === 'iPad') return 'RaagaX iPad';
    if (platform === 'iPhone') return 'RaagaX iPhone';
    if (platform === 'Android') return 'RaagaX Mobile';
    if (platform.includes('Edge')) return 'RaagaX Desktop (Edge)';
    if (platform.includes('Brave')) return 'RaagaX Desktop (Brave)';
    if (platform.includes('Chrome')) return 'RaagaX Desktop (Chrome)';
    if (platform.includes('Firefox')) return 'RaagaX Desktop (Firefox)';
    return `RaagaX ${platform}`;
  }

  public getProfile(): DeviceIdentityProfile {
    return { ...this.profile };
  }

  public getDeviceId(): string {
    return this.profile.deviceId;
  }

  public getDeviceName(): string {
    return this.profile.deviceName;
  }

  public setDeviceName(customName: string): void {
    if (!customName) return;
    this.profile.deviceName = customName;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('rx_connect_device_name', customName);
      } catch {}
    }
  }

  public toConnectDevice(state: ConnectDevice['state'] = 'IDLE'): ConnectDevice {
    let accountId: string | undefined;
    let email: string | undefined;
    if (typeof window !== 'undefined') {
      try {
        const { useAuthStore } = require('@/context/useAuthStore');
        const user = useAuthStore.getState().user;
        if (user?.id) accountId = user.id;
        if (user?.email) email = user.email;
      } catch {}
    }

    return {
      deviceId: this.profile.deviceId,
      deviceName: this.profile.deviceName,
      deviceType: this.profile.deviceType,
      platform: this.profile.platform,
      isCurrentDevice: true,
      isOnline: true,
      state,
      lastSeenAt: Date.now(),
      transport: 'LOCAL_LAN',
      accountId,
      capabilities: {
        canPlayAudio: true,
        supportsVolume: true,
        supportsLossless: true,
      },
    };
  }
}
