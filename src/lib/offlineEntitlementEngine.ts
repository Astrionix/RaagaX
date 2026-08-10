export interface OfflineEntitlement {
  deviceId: string;
  lastVerifiedAt: number; // UTC Timestamp
  expiresAt: number;      // UTC Timestamp (30 Days window)
  isAuthorized: boolean;
}

const STORAGE_KEY = 'raagax_offline_entitlement_v1';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class OfflineEntitlementEngine {
  private static instance: OfflineEntitlementEngine;

  public static getInstance(): OfflineEntitlementEngine {
    if (!OfflineEntitlementEngine.instance) {
      OfflineEntitlementEngine.instance = new OfflineEntitlementEngine();
    }
    return OfflineEntitlementEngine.instance;
  }

  /**
   * Generates or retrieves a unique persistent device ID for entitlement tracking.
   */
  public getOrCreateDeviceId(): string {
    if (typeof window === 'undefined') return 'server_device';
    let deviceId = localStorage.getItem('raagax_device_id');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('raagax_device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Retrieves current offline entitlement state.
   */
  public getEntitlement(): OfflineEntitlement {
    const defaultEntitlement: OfflineEntitlement = {
      deviceId: this.getOrCreateDeviceId(),
      lastVerifiedAt: Date.now(),
      expiresAt: Date.now() + THIRTY_DAYS_MS,
      isAuthorized: true
    };

    if (typeof window === 'undefined') return defaultEntitlement;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.saveEntitlement(defaultEntitlement);
        return defaultEntitlement;
      }
      return JSON.parse(raw) as OfflineEntitlement;
    } catch {
      return defaultEntitlement;
    }
  }

  /**
   * Saves updated entitlement state to localStorage.
   */
  public saveEntitlement(entitlement: OfflineEntitlement): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entitlement));
    } catch (err) {
      console.error('[OfflineEntitlementEngine] Failed to save entitlement:', err);
    }
  }

  /**
   * Checks if the 30-day offline entitlement is valid and authorized.
   */
  public async isEntitlementValid(): Promise<boolean> {
    const entitlement = this.getEntitlement();
    const now = Date.now();

    // If online, perform background heartbeat revalidation
    if (typeof window !== 'undefined' && window.navigator.onLine) {
      this.revalidateHeartbeat();
      return true;
    }

    // When offline, check if within the 30-day window
    return entitlement.isAuthorized && now <= entitlement.expiresAt;
  }

  /**
   * Background online revalidation: updates lastVerifiedAt and resets 30-day countdown.
   */
  public revalidateHeartbeat(): void {
    const entitlement = this.getEntitlement();
    const now = Date.now();
    entitlement.lastVerifiedAt = now;
    entitlement.expiresAt = now + THIRTY_DAYS_MS;
    entitlement.isAuthorized = true;
    this.saveEntitlement(entitlement);
  }
}
