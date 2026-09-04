import { DeviceInfo, DeviceType, Platform, DeviceCapabilities } from './types';

export class DeviceIdentityManager {
  private static instance: DeviceIdentityManager;
  private currentDevice: DeviceInfo;

  private constructor() {
    this.currentDevice = this.loadOrCreateIdentity();
  }

  public static getInstance(): DeviceIdentityManager {
    if (!DeviceIdentityManager.instance) {
      DeviceIdentityManager.instance = new DeviceIdentityManager();
    }
    return DeviceIdentityManager.instance;
  }

  private loadOrCreateIdentity(): DeviceInfo {
    if (typeof window === 'undefined') {
      return {
        deviceId: 'server-node',
        deviceName: 'Server',
        deviceType: 'desktop',
        platform: 'web',
        capabilities: this.getDefaultCapabilities(),
        isOnline: true,
        lastSeen: Date.now(),
        appVersion: '1.0.0',
        protocolVersion: 2,
      };
    }

    // 1. Persistent Unique Device ID
    let deviceId = localStorage.getItem('raaga_device_id');
    if (!deviceId) {
      deviceId = 'dev_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));
      try { localStorage.setItem('raaga_device_id', deviceId); } catch {}
    }

    // 2. Device Type & Platform Detection
    const ua = navigator.userAgent;
    const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/i.test(ua);
    const isPhone = !isTablet && /Android|iPhone|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const deviceType: DeviceType = isTablet ? 'tablet' : isPhone ? 'phone' : 'desktop';

    let platform: Platform = 'web';
    if ((window as any).Capacitor?.isNativePlatform?.() || /Capacitor/i.test(ua)) {
      platform = 'android';
    } else if (/Electron/i.test(ua)) {
      platform = 'electron';
    }

    // 3. User-friendly Device Name with Browser & OS Intelligence
    let deviceName = localStorage.getItem('raaga_device_name');
    if (!deviceName || deviceName === 'Windows PC' || deviceName === 'MacBook Pro') {
      let browserName = "Web Player";
      // Detect browser
      if ((navigator as any).brave && typeof (navigator as any).brave.isBrave === 'function') {
        browserName = "Brave Browser";
      } else if (/Edg\//i.test(ua)) {
        browserName = "Microsoft Edge";
      } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
        browserName = "Opera";
      } else if (/Chrome\//i.test(ua)) {
        browserName = "Google Chrome";
      } else if (/Firefox\//i.test(ua)) {
        browserName = "Firefox";
      } else if (/Safari\//i.test(ua)) {
        browserName = "Safari";
      }

      if (isTablet) {
        deviceName = /iPad/i.test(ua) ? 'Apple iPad' : 'Android Tablet';
      } else if (isPhone) {
        deviceName = /iPhone/i.test(ua) ? 'Apple iPhone' : 'Android Device';
      } else {
        const osName = /Windows/i.test(ua) ? 'PC' : /Macintosh|Mac OS/i.test(ua) ? 'Mac' : 'Linux';
        deviceName = `${browserName} (${osName})`;
      }
      try { localStorage.setItem('raaga_device_name', deviceName); } catch {}
    }

    let savedUserId: string | null = null;
    if (typeof window !== 'undefined') {
      try {
        savedUserId = localStorage.getItem('raaga_user_id') || null;
      } catch {}
    }

    return {
      deviceId,
      userId: savedUserId,
      deviceName,
      deviceType,
      platform,
      capabilities: this.getDefaultCapabilities(),
      isOnline: true,
      lastSeen: Date.now(),
      appVersion: '1.0.0',
      protocolVersion: 2,
    };
  }

  public getDevice(): DeviceInfo {
    return { ...this.currentDevice, lastSeen: Date.now() };
  }

  public setDeviceName(newName: string): void {
    if (!newName.trim()) return;
    this.currentDevice.deviceName = newName.trim();
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('raaga_device_name', this.currentDevice.deviceName); } catch {}
    }
  }

  public setUserId(userId?: string | null): void {
    this.currentDevice.userId = userId || null;
    if (typeof window !== 'undefined') {
      try {
        if (userId) {
          localStorage.setItem('raaga_user_id', userId);
        } else {
          localStorage.removeItem('raaga_user_id');
        }
      } catch {}
    }
  }

  public getDefaultCapabilities(): DeviceCapabilities {
    return {
      play: true,
      pause: true,
      seek: true,
      volume: true,
      shuffle: true,
      repeat: true,
      queue_control: true,
      handoff: true,
    };
  }
}
