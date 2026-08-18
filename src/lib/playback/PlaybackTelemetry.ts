export type PlaybackSourceType = 'LOCAL_DOWNLOAD' | 'PRELOADED_STANDBY' | 'URL_CACHE_HIT' | 'NETWORK_STREAM';

export interface TelemetryMetric {
  sessionId: string;
  trackId: string;
  queueItemId?: string;
  sourceType?: PlaybackSourceType;
  timeToFirstAudioMs?: number;
  transitionDurationMs?: number;
  stallDurationMs?: number;
  handoffLatencyMs?: number;
  success: boolean;
  errorReason?: string;
  timestamp: number;
}

export interface PlaybackLatencySummary {
  total: number;
  successes: number;
  successRate: number;
  avgTTFAMs: number;
  p50TTFAMs: number;
  p75TTFAMs: number;
  p95TTFAMs: number;
  minTTFAMs: number;
  maxTTFAMs: number;
  lastSourceType?: PlaybackSourceType;
  lastTTFAMs?: number;
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
      console.log(`[PlaybackTelemetry] TTFA=${metric.timeToFirstAudioMs}ms source=${metric.sourceType || 'UNKNOWN'} track=${metric.trackId}`);
    }
  }

  private calculatePercentile(sortedList: number[], percentile: number): number {
    if (sortedList.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedList.length) - 1;
    return sortedList[Math.max(0, Math.min(sortedList.length - 1, index))];
  }

  public getSummary(): PlaybackLatencySummary {
    const total = this.metrics.length;
    if (total === 0) {
      return {
        total: 0,
        successes: 0,
        successRate: 1.0,
        avgTTFAMs: 0,
        p50TTFAMs: 0,
        p75TTFAMs: 0,
        p95TTFAMs: 0,
        minTTFAMs: 0,
        maxTTFAMs: 0,
      };
    }

    const successes = this.metrics.filter((m) => m.success).length;
    const ttfaList = this.metrics
      .map((m) => m.timeToFirstAudioMs)
      .filter((t): t is number => typeof t === 'number' && Number.isFinite(t))
      .sort((a, b) => a - b);

    const avgTTFA = ttfaList.length > 0 ? ttfaList.reduce((a, b) => a + b, 0) / ttfaList.length : 0;
    const lastMetric = this.metrics[this.metrics.length - 1];

    return {
      total,
      successes,
      successRate: successes / total,
      avgTTFAMs: Math.round(avgTTFA),
      p50TTFAMs: this.calculatePercentile(ttfaList, 50),
      p75TTFAMs: this.calculatePercentile(ttfaList, 75),
      p95TTFAMs: this.calculatePercentile(ttfaList, 95),
      minTTFAMs: ttfaList.length > 0 ? ttfaList[0] : 0,
      maxTTFAMs: ttfaList.length > 0 ? ttfaList[ttfaList.length - 1] : 0,
      lastSourceType: lastMetric?.sourceType,
      lastTTFAMs: lastMetric?.timeToFirstAudioMs,
    };
  }

  public getMetricsHistory(): TelemetryMetric[] {
    return [...this.metrics];
  }

  public clear() {
    this.metrics = [];
  }
}
