/**
 * RaagaX Dynamic Island — Smart Device Capability Engine
 * 
 * Accurately detects mobile platform capability, Live Activity / Dynamic Island
 * hardware support, safe-area cutout, and notification permissions.
 * Never renders a fake or broken Dynamic Island on unsupported devices.
 */

export interface DynamicIslandCapability {
  isMobilePlatform: boolean;
  hasCutoutSupport: boolean;
  hasMediaSession: boolean;
  hasNotificationSupport: boolean;
  permissionState: 'granted' | 'denied' | 'prompt' | 'unsupported';
  isHardwareSupported: boolean;
  isAvailable: boolean;
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
   * Evaluates device capabilities using hardware, OS, and permission heuristics.
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
        statusMessage: 'Server-side environment',
      };
    }

    // 1. Desktop vs Mobile Detection (Capability & touch based)
    const hasTouch = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || ('ontouchstart' in window);
    const isMobileUA = typeof navigator !== 'undefined' && (
      /(iPhone|iPad|iPod|Android|Mobile)/i.test(navigator.userAgent) || Boolean((navigator as any).userAgentData?.mobile)
    );
    const isDesktopPointer = window.matchMedia?.('(pointer: fine)').matches && !window.matchMedia?.('(pointer: coarse)').matches && !hasTouch;
    const isMobilePlatform = (hasTouch || isMobileUA) && !isDesktopPointer;

    // 2. Native Bridge or Hardware Cutout
    const isNativeBridgeAvailable = Boolean(
      (window as any).webkit?.messageHandlers?.liveActivity ||
      (window as any).AndroidLiveActivity ||
      (window as any).Capacitor?.isNativePlatform?.()
    );

    const hasCutoutSupport = isMobilePlatform && (
      isNativeBridgeAvailable || 
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
    const isHardwareSupported = isMobilePlatform && (hasCutoutSupport || isNativeBridgeAvailable);

    // 6. Availability:
    const isAvailable = isHardwareSupported && permissionState === 'granted';

    let statusMessage = 'Dynamic Island is active and synchronized';
    if (!isHardwareSupported) {
      statusMessage = 'Dynamic Island isn\'t available on desktop/unsupported hardware';
    } else if (permissionState === 'denied' || permissionState === 'prompt') {
      statusMessage = 'Dynamic Island isn\'t available. Enable the required notification/live activity permission';
    }

    return {
      isMobilePlatform,
      hasCutoutSupport,
      hasMediaSession,
      hasNotificationSupport,
      permissionState,
      isHardwareSupported,
      isAvailable,
      statusMessage,
    };
  }

  /**
   * Prompts user for notification permission.
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

/**
 * Public capability decision function.
 * Evaluates whether current platform supports live/floating playback mechanisms
 * AND has the required notification/live permissions granted.
 */
export function isLivePlaybackSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return dynamicIslandCapability.getCapability().isAvailable;
}
