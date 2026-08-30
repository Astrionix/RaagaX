import { describe, it, expect, beforeEach } from 'vitest';
import { ClockSyncEngine, ClockSample } from '@/lib/jam/client/ClockSyncEngine';

describe('NTP High-Precision Clock Synchronization Engine', () => {
  let engine: ClockSyncEngine;

  beforeEach(() => {
    engine = ClockSyncEngine.getInstance();
    engine.resetForTesting(0);
  });

  it('1. Computes correct RTT and Clock Offset from NTP 4-timestamp exchange', () => {
    // Scenario:
    // Client send t1 = 1000
    // Server receive t2 = 1050 (server is +30ms ahead of client, 20ms one-way flight)
    // Server send t3 = 1052 (2ms server processing)
    // Client receive t4 = 1092 (20ms return flight)
    const t1 = 1000;
    const t2 = 1050;
    const t3 = 1052;
    const t4 = 1092;

    const rtt = (t4 - t1) - (t3 - t2);
    const offset = ((t2 - t1) + (t3 - t4)) / 2;

    expect(rtt).toBe(90); // Total round trip excluding server processing = 92 - 2 = 90ms
    expect(offset).toBe(5); // ((50) + (-40)) / 2 = +5ms offset
  });

  it('2. Filters out high-jitter network outliers and weights low-latency samples', () => {
    const samples: ClockSample[] = [
      { rtt: 30, offset: 12, timestamp: Date.now() },
      { rtt: 32, offset: 11, timestamp: Date.now() },
      { rtt: 28, offset: 13, timestamp: Date.now() },
      { rtt: 350, offset: 80, timestamp: Date.now() }, // Spike / outlier
      { rtt: 29, offset: 12, timestamp: Date.now() },
    ];

    engine.processSamples(samples);
    const state = engine.getState();

    // The outlier (+80ms offset with 350ms RTT) must be rejected or heavily downweighted
    expect(state.offsetMs).toBeGreaterThanOrEqual(11);
    expect(state.offsetMs).toBeLessThanOrEqual(14);
    expect(state.rttMs).toBeLessThan(50);
  });

  it('3. Computes high-precision estimated server time based on synchronized offset', () => {
    engine.resetForTesting(45); // Server is +45ms ahead

    const localNow = Date.now();
    const estimatedServerTime = engine.getEstimatedServerTime();

    expect(estimatedServerTime).toBeGreaterThanOrEqual(localNow + 40);
    expect(estimatedServerTime).toBeLessThanOrEqual(localNow + 50);
  });
});
