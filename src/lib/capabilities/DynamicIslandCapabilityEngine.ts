/**
 * RaagaX Live Player — Universal System Surface Capability Detection Engine
 * 
 * Accurately detects whether the current Android/OEM/OS platform actually supports
 * a system-level live media playback surface (e.g. Android 13+ Rich MediaStyle,
 * ColorOS/OxygenOS Live Alerts, HyperOS Live Island, iOS Live Activity).
 * 
 * Principles:
 * 1. Never determine support using only manufacturer name.
 * 2. Consider Android SDK level, OEM capabilities, safe-area cutout, and permission state.
 * 3. If supported: exposes Settings -> Playback -> Live Player.
 * 4. If unsupported: completely hides the setting.
 * 5. Never creates a fake in-app overlay or draws over the status bar.
 */

export interface DynamicIslandCapability {
  isMobilePlatform: boolean;
  hasCutoutSupport: boolean;
  hasMediaSession: boolean;
  hasNotificationSupport: boolean;
  permissionState: 'granted' | 'denied' | 'prompt' | 'unsupported';
  isHardwareSupported: boolean;
  isAvailable: boolean;
  needsSystemSettings: boolean;
  statusMessage: string;
}

export class DynamicIslandCapabilityEngine {
  private static instance: DynamicIslandCapabilityEngine;
  private permissionStatusObj: PermissionStatus | null = null;
  private listeners = new Set<(cap: DynamicIslandCapability) => void>();

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initPermissionWatcher();
      window.addEventListener('resize', () => this.notifyListeners());
      window.addEventListener('orientationchange', () => this.notifyListeners());
    }
  }

  public static getInstance(): DynamicIslandCapabilityEngine {
    if (!DynamicIslandCapabilityEngine.instance) {
      DynamicIslandCapabilityEngine.instance = new DynamicIslandCapabilityEngine();
    }
    return DynamicIslandCapabilityEngine.instance;
  }

  private async initPermissionWatcher() {
    if (typeof navigator === 'undefined' || !navigator.permissions) return;
    try {
      this.permissionStatusObj = await navigator.permissions.query({ name: 'notifications' as any });
      if (this.permissionStatusObj) {
        this.permissionStatusObj.onchange = () => {
          this.notifyListeners();
        };
      }
    } catch {}
  }

  public subscribe(callback: (cap: DynamicIslandCapability) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    const cap = this.getCapability();
    this.listeners.forEach((cb) => cb(cap));
  }

  /**
   * Evaluates device capabilities using OS API levels, OEM capability interfaces, and permissions.
   */
  public getCapability(): DynamicIslandCapability {
    if (typeof window === 'undefined') {
      return {
        isMobilePlatform: false,
        hasCutoutSupport: false,
        hasMediaSession: false,
        hasNotificationSupport: false,
        permissionState: 'unsupported',
        isHardwareSupported: false,
        isAvailable: false,
        needsSystemSettings: false,
        statusMessage: 'Server-side environment',
      };
    }

    // 1. Mobile Platform Detection (Capability, touch & screen-based)
    const hasTouch = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || ('ontouchstart' in window);
    const isMobileUA = typeof navigator !== 'undefined' && (
      /(iPhone|iPad|iPod|Android|Mobile)/i.test(navigator.userAgent) || Boolean((navigator as any).userAgentData?.mobile)
    );
    const isDesktopPointer = window.matchMedia?.('(pointer: fine)').matches && !window.matchMedia?.('(pointer: coarse)').matches && !hasTouch;
    const isMobilePlatform = (hasTouch || isMobileUA) && !isDesktopPointer;

    // 2. Native Bridge or System Media Surface Capability Detection
    const isNativeBridgeAvailable = Boolean(
      (window as any).webkit?.messageHandlers?.liveActivity ||
      (window as any).AndroidLiveActivity ||
      (window as any).AndroidLivePlayerCapability ||
      (window as any).Capacitor?.isNativePlatform?.()
    );

    // Check Android version heuristics (Android 13+ API 33+ introduces enhanced live media surface)
    let isModernAndroid = false;
    if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
      const match = navigator.userAgent.match(/Android\s([0-9\.]+)/i);
      if (match && parseFloat(match[1]) >= 13) {
        isModernAndroid = true;
      }
    }

    const hasCutoutSupport = isMobilePlatform && (
      isNativeBridgeAvailable || 
      isModernAndroid ||
      (isMobileUA && typeof window.screen !== 'undefined' && (window.screen.height / window.screen.width > 2.0))
    );

    // 3. MediaSession & Notification Capability
    const hasMediaSession = typeof navigator !== 'undefined' && 'mediaSession' in navigator;
    const hasNotificationSupport = typeof window !== 'undefined' && 'Notification' in window;

    // 4. Permission State
    let permissionState: 'granted' | 'denied' | 'prompt' | 'unsupported' = 'unsupported';
    if (hasNotificationSupport) {
      const perm = Notification.permission;
      if (perm === 'granted') permissionState = 'granted';
      else if (perm === 'denied') permissionState = 'denied';
      else permissionState = 'prompt';
    } else if (isNativeBridgeAvailable) {
      permissionState = 'granted';
    }

    // 5. Hardware Supported Flag:
    // Supported only when device is mobile with verified native bridge, modern Android media surface, or display cutout
    const isHardwareSupported = isMobilePlatform && (hasCutoutSupport || isNativeBridgeAvailable || isModernAndroid);

    // 6. Availability:
    const isAvailable = isHardwareSupported && permissionState === 'granted';
    const needsSystemSettings = isHardwareSupported && permissionState !== 'granted';

    let statusMessage = 'Device supports this feature';
    if (!isHardwareSupported) {
      statusMessage = 'Not supported on this device/platform';
    } else if (needsSystemSettings) {
      statusMessage = 'Your device supports this feature. Enable in System Settings.';
    }

    return {
      isMobilePlatform,
      hasCutoutSupport,
      hasMediaSession,
      hasNotificationSupport,
      permissionState,
      isHardwareSupported,
      isAvailable,
      needsSystemSettings,
      statusMessage,
    };
  }

  /**
   * Opens the appropriate system settings or requests permissions.
   */
  public async openSystemSettings(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // 1. If native bridge exposes settings intent, trigger it
    if ((window as any).AndroidSettings?.openLiveMediaSettings) {
      try {
        (window as any).AndroidSettings.openLiveMediaSettings();
        return true;
      } catch {}
    }

    if ((window as any).Capacitor?.isNativePlatform?.() && (window as any).AndroidBridge?.openNotificationSettings) {
      try {
        (window as any).AndroidBridge.openNotificationSettings();
        return true;
      } catch {}
    }

    // 2. Standard Web/PWA Notification Permission Request
    return this.requestPermission();
  }

  /**
   * Requests permission to activate live surface.
   */
  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      this.notifyListeners();
      return result === 'granted';
    } catch (e) {
      console.warn('[DynamicIslandCapabilityEngine] Permission request error:', e);
      return false;
    }
  }
}

export const dynamicIslandCapability = DynamicIslandCapabilityEngine.getInstance();
