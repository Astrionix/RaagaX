/**
 * RaagaXPermissions — TypeScript adapter for the native Android permission bridge.
 *
 * Philosophy (matches professional music apps like Spotify / YouTube Music):
 *   ✅ Notifications → requested ONLY when user first plays a song
 *   ✅ Bluetooth     → requested ONLY when user opens Connect Device
 *   ❌ No prompts on launch
 *   ❌ No location, microphone, contacts, camera
 *
 * Usage:
 *   import { RaagaXPermissions } from '@/lib/playback/native/RaagaXPermissions';
 *
 *   // When user presses Play for the first time:
 *   await RaagaXPermissions.requestNotificationsOnFirstPlay();
 *
 *   // When user opens Connect Device screen:
 *   await RaagaXPermissions.requestBluetoothForConnect();
 *
 *   // Check status:
 *   const status = await RaagaXPermissions.getStatus();
 */

const IS_CAPACITOR_NATIVE =
  typeof window !== 'undefined' &&
  (window as any).Capacitor &&
  typeof (window as any).Capacitor.isNativePlatform === 'function' &&
  (window as any).Capacitor.isNativePlatform();

function getPermPlugin() {
  if (!IS_CAPACITOR_NATIVE) return null;
  return (window as any).Capacitor?.Plugins?.RaagaXPermissions ?? null;
}

export interface PermissionStatus {
  notifications: boolean;
  bluetoothConnect: boolean;
  bluetoothScan: boolean;
}

let notificationRequestedOnce = false;

export const RaagaXPermissions = {
  isNative(): boolean {
    return IS_CAPACITOR_NATIVE;
  },

  /**
   * Get current permission status from native.
   * Returns sensible defaults on web (non-native).
   */
  async getStatus(): Promise<PermissionStatus> {
    const plugin = getPermPlugin();
    if (!plugin) {
      // On web: notifications are handled by the browser natively
      return {
        notifications: typeof Notification !== 'undefined' && Notification.permission === 'granted',
        bluetoothConnect: false,
        bluetoothScan: false,
      };
    }
    return plugin.getStatus();
  },

  /**
   * Request notification permission — call this when the user plays their FIRST song.
   * On Android < 13 or if already granted, resolves immediately without any dialog.
   * On web, uses the browser Notification API.
   */
  async requestNotificationsOnFirstPlay(): Promise<boolean> {
    if (notificationRequestedOnce) return true;
    notificationRequestedOnce = true;

    const plugin = getPermPlugin();

    if (!plugin) {
      // Web fallback: use browser Notification API
      if (typeof Notification === 'undefined') return false;
      if (Notification.permission === 'granted') return true;
      const result = await Notification.requestPermission();
      return result === 'granted';
    }

    try {
      const result = await plugin.requestNotifications();
      return result?.granted === true;
    } catch {
      return false;
    }
  },

  /**
   * Request Bluetooth permissions — call this ONLY from the Connect Device screen.
   * Never call on app launch.
   */
  async requestBluetoothForConnect(): Promise<boolean> {
    const plugin = getPermPlugin();
    if (!plugin) return false; // Bluetooth connect is native-only

    try {
      const result = await plugin.requestBluetooth();
      return result?.granted === true;
    } catch {
      return false;
    }
  },
};
