/**
 * PreciseWorkerTimer — Background-Proof Web Worker Timer
 *
 * Browsers aggressively throttle setTimeout / setInterval in background tabs (up to 1000ms delay).
 * Web Workers run on a separate OS thread and are immune to background tab throttling,
 * guaranteeing 1ms scheduling precision even when the tab is minimized or inactive.
 */
export class PreciseWorkerTimer {
  private static worker: Worker | null = null;
  private static callbacks: Map<number, () => void> = new Map();
  private static timerIdCounter = 0;

  private static getWorker(): Worker | null {
    if (typeof window === 'undefined') return null;
    if (this.worker) return this.worker;

    try {
      const code = `
        self.onmessage = function(e) {
          if (e.data.action === 'SCHEDULE') {
            setTimeout(function() {
              self.postMessage({ action: 'TRIGGER', timerId: e.data.timerId });
            }, Math.max(0, e.data.delayMs));
          }
        };
      `;
      const blob = new Blob([code], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e) => {
        if (e.data?.action === 'TRIGGER') {
          const cb = this.callbacks.get(e.data.timerId);
          if (cb) {
            this.callbacks.delete(e.data.timerId);
            cb();
          }
        }
      };
    } catch {
      this.worker = null;
    }

    return this.worker;
  }

  /**
   * Schedules a high-precision callback that will not be throttled in background tabs
   */
  public static setTimeout(callback: () => void, delayMs: number): number {
    const timerId = ++this.timerIdCounter;
    this.callbacks.set(timerId, callback);

    const worker = this.getWorker();
    if (worker) {
      worker.postMessage({ action: 'SCHEDULE', timerId, delayMs });
    } else {
      // Fallback to window.setTimeout if Worker is not available
      setTimeout(() => {
        const cb = this.callbacks.get(timerId);
        if (cb) {
          this.callbacks.delete(timerId);
          cb();
        }
      }, delayMs);
    }

    return timerId;
  }

  public static clearTimeout(timerId: number): void {
    this.callbacks.delete(timerId);
  }
}
