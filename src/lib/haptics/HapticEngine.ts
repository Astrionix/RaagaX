/**
 * RaagaX Haptic Engine — 2026 Micro-Tactility System
 * Provides precise physical vibration feedback for Android/Mobile devices.
 */
export class HapticEngine {
  private static instance: HapticEngine;

  private constructor() {}

  public static getInstance(): HapticEngine {
    if (!HapticEngine.instance) {
      HapticEngine.instance = new HapticEngine();
    }
    return HapticEngine.instance;
  }

  private vibrate(pattern: number | number[]) {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  }

  /**
   * Light 10ms click for button taps, tab switches, and toggles
   */
  public lightImpact() {
    this.vibrate(10);
  }

  /**
   * Medium 18ms pulse for play/pause, like/favorite, and shuffle
   */
  public mediumImpact() {
    this.vibrate(18);
  }

  /**
   * Micro 5ms tick for slider scrubbing and volume adjustment
   */
  public selectionTick() {
    this.vibrate(5);
  }

  /**
   * Dual pulse for download success and milestone completion
   */
  public successNotification() {
    this.vibrate([12, 40, 18]);
  }

  /**
   * Heavy 30ms pulse for destructive actions or connection drops
   */
  public warningNotification() {
    this.vibrate([25, 50, 25]);
  }
}

export const haptics = HapticEngine.getInstance();
