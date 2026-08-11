/**
 * RaagaXPermissions — Persistent permission state manager
 *
 * Implements a one-time onboarding model:
 *   - On first install: runs permission onboarding flow
 *   - On every subsequent launch: reads stored state silently, no popups
 *   - If user denies: records "denied", never asks again automatically
 *   - Feature-triggered Bluetooth: only from Connect Device screen
 *   - If app data cleared / reinstalled: treated as fresh install
 *
 * State persisted in localStorage under "raagax_permission_state"
 */

const STORAGE_KEY = 'raagax_permission_state';

const IS_CAPACITOR_NATIVE =
  typeof window !== 'undefined' &&
  (window as any).Capacitor &&
  typeof (window as any).Capacitor.isNativePlatform === 'function' &&
  (window as any).Capacitor.isNativePlatform();

function getPermPlugin() {
  if (!IS_CAPACITOR_NATIVE) return null;
  return (window as any).Capacitor?.Plugins?.RaagaXPermissions ?? null;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type PermissionState = 'granted' | 'denied' | 'not_requested';

export interface PermissionStore {
  notification: PermissionState;
  bluetooth: PermissionState;
  setupCompleted: boolean;
}

const DEFAULT_STORE: PermissionStore = {
  notification: 'not_requested',
  bluetooth: 'not_requested',
  setupCompleted: false,
};

// ── Persistence ───────────────────────────────────────────────────────────────

function loadStore(): PermissionStore {
  if (typeof window === 'undefined') return { ...DEFAULT_STORE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STORE };
    return { ...DEFAULT_STORE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STORE };
  }
}

function saveStore(store: PermissionStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────

export const RaagaXPermissions = {
  isNative(): boolean {
    return IS_CAPACITOR_NATIVE;
  },

  /**
   * Read current persisted permission store.
   * Never triggers any popup.
   */
  getStoredState(): PermissionStore {
    return loadStore();
  },

  /**
   * Check if one-time onboarding has been completed.
   * Returns false on first install or after app data clear.
   */
  isSetupCompleted(): boolean {
    return loadStore().setupCompleted;
  },

  /**
   * Mark setup as completed — call at end of onboarding flow.
   * After this, no permission dialogs appear automatically.
   */
  markSetupCompleted(): void {
    const store = loadStore();
    store.setupCompleted = true;
    saveStore(store);
  },

  /**
   * Request notification permission during onboarding.
   *
   * Rules:
   *   - Only called once: if state is "not_requested"
   *   - If "granted" or "denied": returns immediately, no popup
   *   - On native Android: triggers OS dialog
   *   - On web: uses browser Notification API
   */
  async requestNotificationPermission(): Promise<PermissionState> {
    const store = loadStore();

    // Already resolved — never ask again
    if (store.notification !== 'not_requested') {
      return store.notification;
    }

    let result: PermissionState = 'denied';

    const plugin = getPermPlugin();
    if (plugin) {
      // Native Android path
      try {
        await plugin.requestNotifications();
        // Query actual granted state after dialog
        const status = await plugin.getStatus();
        result = status?.notifications ? 'granted' : 'denied';
      } catch {
        result = 'denied';
      }
    } else if (typeof Notification !== 'undefined') {
      // Web / PWA path
      if (Notification.permission === 'granted') {
        result = 'granted';
      } else if (Notification.permission === 'denied') {
        result = 'denied';
      } else {
        const perm = await Notification.requestPermission();
        result = perm === 'granted' ? 'granted' : 'denied';
      }
    }

    store.notification = result;
    saveStore(store);
    return result;
  },

  /**
   * Request Bluetooth permissions — ONLY from Connect Device screen.
   * Never called during launch or onboarding.
   *
   * Rules:
   *   - If already "granted": returns immediately
   *   - If "denied": returns "denied", no popup (user must go to Settings)
   *   - If "not_requested": shows OS dialog once
   */
  async requestBluetoothForConnect(): Promise<PermissionState> {
    const store = loadStore();

    // Already resolved
    if (store.bluetooth !== 'not_requested') {
      return store.bluetooth;
    }

    const plugin = getPermPlugin();
    if (!plugin) {
      // Bluetooth is native-only; on web return not applicable
      return 'not_requested';
    }

    let result: PermissionState = 'denied';
    try {
      await plugin.requestBluetooth();
      const status = await plugin.getStatus();
      result = (status?.bluetoothConnect && status?.bluetoothScan) ? 'granted' : 'denied';
    } catch {
      result = 'denied';
    }

    store.bluetooth = result;
    saveStore(store);
    return result;
  },

  /**
   * Sync the real OS permission state into the store.
   * Call on app resume to detect if user changed permissions in Settings.
   */
  async syncFromOs(): Promise<void> {
    const plugin = getPermPlugin();
    if (!plugin) return;

    try {
      const status = await plugin.getStatus();
      const store = loadStore();
      store.notification = status?.notifications ? 'granted' : store.notification === 'not_requested' ? 'not_requested' : 'denied';
      store.bluetooth = (status?.bluetoothConnect && status?.bluetoothScan) ? 'granted' : store.bluetooth === 'not_requested' ? 'not_requested' : 'denied';
      saveStore(store);
    } catch {}
  },
};
