'use client';

import { LANCommandTiming } from './types';

export interface CommandLatencyMetric {
  commandId: string;
  commandType: string;
  tapToSendMs: number;
  transitMs: number;
  execMs: number;
  rttMs: number;
  totalPerceivedMs: number;
  timestamp: number;
}

export interface LatencyPercentiles {
  count: number;
  min: number;
  p50: number;
  p75: number;
  p95: number;
  max: number;
  averageRtt: number;
}

export class ConnectTelemetry {
  private static instance: ConnectTelemetry;
  private metrics: CommandLatencyMetric[] = [];
  private maxHistorySize: number = 200;

  private constructor() {}

  public static getInstance(): ConnectTelemetry {
    if (!ConnectTelemetry.instance) {
      ConnectTelemetry.instance = new ConnectTelemetry();
    }
    return ConnectTelemetry.instance;
  }

  public recordCommandLifecycle(
    commandId: string,
    commandType: string,
    timing: LANCommandTiming
  ) {
    const tap = timing.tapTimestamp || timing.sendTimestamp;
    const send = timing.sendTimestamp;
    const recv = timing.receiveTimestamp || send;
    const exec = timing.executeTimestamp || recv;
    const ack = timing.ackTimestamp || Date.now();

    const metric: CommandLatencyMetric = {
      commandId,
      commandType,
      tapToSendMs: Math.max(0, send - tap),
      transitMs: Math.max(0, recv - send),
      execMs: Math.max(0, exec - recv),
      rttMs: Math.max(0, ack - send),
      totalPerceivedMs: Math.max(0, ack - tap),
      timestamp: Date.now(),
    };

    this.metrics.push(metric);
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics.shift();
    }

    console.log(
      `[ConnectTelemetry] ${commandType} (${commandId}) -> RTT: ${metric.rttMs}ms | Exec: ${metric.execMs}ms | Perceived: ${metric.totalPerceivedMs}ms`
    );
  }

  public getPercentiles(): LatencyPercentiles {
    if (this.metrics.length === 0) {
      return { count: 0, min: 0, p50: 0, p75: 0, p95: 0, max: 0, averageRtt: 0 };
    }

    const rtts = this.metrics.map((m) => m.rttMs).sort((a, b) => a - b);
    const count = rtts.length;
    const sum = rtts.reduce((acc, val) => acc + val, 0);

    const getP = (p: number) => {
      const idx = Math.min(count - 1, Math.floor((p / 100) * count));
      return rtts[idx];
    };

    return {
      count,
      min: rtts[0],
      p50: getP(50),
      p75: getP(75),
      p95: getP(95),
      max: rtts[count - 1],
      averageRtt: Math.round(sum / count),
    };
  }

  public getRecentMetrics(limit: number = 20): CommandLatencyMetric[] {
    return this.metrics.slice(-limit);
  }

  public clear() {
    this.metrics = [];
  }
}
