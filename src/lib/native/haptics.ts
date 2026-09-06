/**
 * RaagaX High-Performance Native Haptic Feedback Engine
 * Provides physical tactile vibration feedback for mobile controls, seeking,
 * player expansion, tabs, and volume sliders.
 */

export class HapticFeedbackEngine {
  private static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      (Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
        Boolean(navigator?.vibrate))
    );
  }

  /**
   * Light tactile tap (e.g. tab switches, subtle button taps)
   */
  static selection(): void {
    if (!this.isSupported()) return;
    try {
      const Capacitor = (window as any).Capacitor;
      if (Capacitor?.Plugins?.Haptics?.selectionStart) {
        Capacitor.Plugins.Haptics.selectionStart();
        Capacitor.Plugins.Haptics.selectionChanged();
      } else if (navigator.vibrate) {
        navigator.vibrate(8);
      }
    } catch { }
  }

  /**
   * Medium impact (e.g. Play/Pause toggle, Queue reorder)
   */
  static impact(): void {
    if (!this.isSupported()) return;
    try {
      const Capacitor = (window as any).Capacitor;
      if (Capacitor?.Plugins?.Haptics?.impact) {
        Capacitor.Plugins.Haptics.impact({ style: 'MEDIUM' });
      } else if (navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch { }
  }

  /**
   * Heavy impact (e.g. Favorite toggle, Shuffle/Repeat mode change)
   */
  static heavyImpact(): void {
    if (!this.isSupported()) return;
    try {
      const Capacitor = (window as any).Capacitor;
      if (Capacitor?.Plugins?.Haptics?.impact) {
        Capacitor.Plugins.Haptics.impact({ style: 'HEAVY' });
      } else if (navigator.vibrate) {
        navigator.vibrate([10, 30, 15]);
      }
    } catch { }
  }

  /**
   * Notification success vibration (e.g. added to playlist)
   */
  static success(): void {
    if (!this.isSupported()) return;
    try {
      const Capacitor = (window as any).Capacitor;
      if (Capacitor?.Plugins?.Haptics?.notification) {
        Capacitor.Plugins.Haptics.notification({ type: 'SUCCESS' });
      } else if (navigator.vibrate) {
        navigator.vibrate([10, 40, 20]);
      }
    } catch { }
  }
}
