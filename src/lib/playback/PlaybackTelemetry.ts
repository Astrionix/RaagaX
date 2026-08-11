export interface TelemetryMetric {
  sessionId: string;
  trackId: string;
  queueItemId?: string;
  timeToFirstAudioMs?: number;
  transitionDurationMs?: number;
  stallDurationMs?: number;
  handoffLatencyMs?: number;
  success: boolean;
  errorReason?: string;
  timestamp: number;
}

export class PlaybackTelemetry {
  private static instance: PlaybackTelemetry;
  private metrics: TelemetryMetric[] = [];
  private readonly MAX_METRICS_HISTORY = 100;

  private constructor() {}

  public static getInstance(): PlaybackTelemetry {
    if (!PlaybackTelemetry.instance) {
      PlaybackTelemetry.instance = new PlaybackTelemetry();
    }
    return PlaybackTelemetry.instance;
  }

  public recordMetric(metric: Omit<TelemetryMetric, 'timestamp'>) {
    const entry: TelemetryMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this.metrics.push(entry);
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics.shift();
    }

    if (!metric.success) {
      console.warn('[PlaybackTelemetry] Playback failure recorded:', entry);
    } else {
      console.log('[PlaybackTelemetry] Playback metric recorded:', entry);
    }
  }

  public getSummary() {
    const total = this.metrics.length;
    if (total === 0) {
      return { total: 0, successRate: 1.0, avgTTFAMs: 0 };
    }

    const successes = this.metrics.filter((m) => m.success).length;
    const ttfaList = this.metrics.map((m) => m.timeToFirstAudioMs).filter((t): t is number => typeof t === 'number');
    const avgTTFA = ttfaList.length > 0 ? ttfaList.reduce((a, b) => a + b, 0) / ttfaList.length : 0;

    return {
      total,
      successes,
      successRate: successes / total,
      avgTTFAMs: Math.round(avgTTFA),
    };
  }

  public getMetricsHistory(): TelemetryMetric[] {
    return [...this.metrics];
  }

  public clear() {
    this.metrics = [];
  }
}
