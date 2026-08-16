'use client';

/**
 * ProductionTelemetry — Structured, privacy-safe crash & playback observability.
 * Captures actionable diagnostic breadcrumbs without logging personal data.
 */

export interface TelemetryBreadcrumb {
  timestamp: number;
  category: 'ui' | 'playback' | 'connect' | 'network';
  message: string;
  data?: Record<string, any>;
}

export interface CrashReport {
  timestamp: number;
  version: string;
  platform: string;
  screen: string;
  playbackState: {
    trackId?: string;
    positionMs?: number;
    isPlaying: boolean;
    provider?: string;
  };
  errorMessage: string;
  stackTrace?: string;
  breadcrumbs: TelemetryBreadcrumb[];
}

export class ProductionTelemetry {
  private static instance: ProductionTelemetry;
  private breadcrumbs: TelemetryBreadcrumb[] = [];
  private readonly MAX_BREADCRUMBS = 25;

  private constructor() {
    this.initGlobalErrorHandlers();
  }

  public static getInstance(): ProductionTelemetry {
    if (!ProductionTelemetry.instance) {
      ProductionTelemetry.instance = new ProductionTelemetry();
    }
    return ProductionTelemetry.instance;
  }

  private initGlobalErrorHandlers() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.recordCrash(event.message, event.error?.stack);
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.recordCrash(String(event.reason?.message || event.reason), event.reason?.stack);
    });
  }

  /**
   * Records a lightweight operational breadcrumb
   */
  public addBreadcrumb(category: TelemetryBreadcrumb['category'], message: string, data?: Record<string, any>) {
    const crumb: TelemetryBreadcrumb = {
      timestamp: Date.now(),
      category,
      message,
      data,
    };
    this.breadcrumbs.push(crumb);
    if (this.breadcrumbs.length > this.MAX_BREADCRUMBS) {
      this.breadcrumbs.shift();
    }
  }

  /**
   * Tracks structured playback events
   */
  public trackEvent(event: string, properties?: Record<string, any>) {
    const payload = {
      event,
      timestamp: Date.now(),
      ...properties,
    };
    this.addBreadcrumb('playback', event, properties);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Telemetry] ◈ ${event}:`, payload);
    }
  }

  /**
   * Captures and persists crash diagnostics
   */
  public recordCrash(errorMessage: string, stackTrace?: string) {
    if (typeof window === 'undefined') return;

    try {
      const { usePlayerStore } = require('@/context/usePlayerStore');
      const store = usePlayerStore.getState();

      const report: CrashReport = {
        timestamp: Date.now(),
        version: '1.0.0-rc',
        platform: (window as any).Capacitor?.isNativePlatform?.() ? 'Android (Media3)' : 'Web',
        screen: store.activeTab || 'Home',
        playbackState: {
          trackId: store.currentSong?.id,
          positionMs: Math.round((store.currentTime || 0) * 1000),
          isPlaying: store.isPlaying || false,
          provider: 'JioSaavn',
        },
        errorMessage,
        stackTrace,
        breadcrumbs: [...this.breadcrumbs],
      };

      console.error('[ProductionTelemetry] 💥 Crash Report Captured:', report);
      localStorage.setItem('raagax_last_crash_report', JSON.stringify(report));
    } catch {}
  }

  public getLastCrashReport(): CrashReport | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('raagax_last_crash_report');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
