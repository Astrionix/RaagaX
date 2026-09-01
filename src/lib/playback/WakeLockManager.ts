/**
 * WakeLockManager — Screen Wake Lock & Background Playback Resiliency
 *
 * Prevents mobile OS background suspension and CPU throttling during active playback
 * by maintaining an active Screen Wake Lock and automatically re-acquiring upon visibility changes.
 */

export class WakeLockManager {
  private static instance: WakeLockManager;
  private wakeLockSentinel: any = null;
  private isRequested = false;

  private constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isRequested) {
          this.acquireWakeLock();
        }
      });
    }
  }

  public static getInstance(): WakeLockManager {
    if (!WakeLockManager.instance) {
      WakeLockManager.instance = new WakeLockManager();
    }
    return WakeLockManager.instance;
  }

  public async acquireWakeLock(): Promise<boolean> {
    this.isRequested = true;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return false;
    }

    try {
      if (this.wakeLockSentinel && !this.wakeLockSentinel.released) {
        return true;
      }

      this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
      });
      return true;
    } catch {
      return false;
    }
  }

  public async releaseWakeLock(): Promise<void> {
    this.isRequested = false;
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch {}
      this.wakeLockSentinel = null;
    }
  }
}
