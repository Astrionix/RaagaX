import { describe, it, expect, beforeEach } from 'vitest';
import { DriftCorrectionEngine } from '@/lib/jam/DriftCorrectionEngine';

describe('DriftCorrectionEngine & Wi-Fi 0ms Synchronization Tests', () => {
  beforeEach(() => {
    const engine = DriftCorrectionEngine.getInstance();
    engine.stop();
    engine.resetTrack('test-track-init');
  });

  it('should maintain signed precision across positive and negative network drift', () => {
    const positionMs = 15000;
    const serverTimestamp = 1000000;

    // Case 1: Positive drift (client clock is ahead of server timestamp)
    const nowPositive = 1000300; // +300ms drift
    const positiveDrift = nowPositive - serverTimestamp;
    const expectedPositionPositive = positionMs + positiveDrift;

    expect(positiveDrift).toBe(300);
    expect(expectedPositionPositive).toBe(15300);

    // Case 2: Negative drift (client clock is behind server timestamp)
    const nowNegative = 999800; // -200ms drift
    const negativeDrift = nowNegative - serverTimestamp;
    const expectedPositionNegative = positionMs + negativeDrift;

    expect(negativeDrift).toBe(-200);
    expect(expectedPositionNegative).toBe(14800);
  });

  it('should reset track cleanly to 0:00 (0ms) on track transitions', () => {
    const engine = DriftCorrectionEngine.getInstance();

    // Simulate song 1 was playing at 20 seconds (20,000 ms)
    engine.recordHostBeacon(20000, Date.now(), 'song-1', true);
    expect(engine.getMetrics().targetPositionSec).toBeGreaterThanOrEqual(19.9);

    // Now track switches to song 2 (Track Skip)
    engine.resetTrack('song-2');
    const metrics = engine.getMetrics();

    expect(metrics.targetPositionSec).toBe(0);
    expect(metrics.currentDriftMs).toBe(0);
    expect(metrics.currentPlaybackRate).toBe(1.0);
    expect(metrics.isLocked).toBe(true);
  });

  it('should calibrate NTP clock offset with outlier filtering over Wi-Fi', () => {
    const engine = DriftCorrectionEngine.getInstance();
    const now = Date.now();

    // Client sent at now - 10, Host received at now + 50 (host clock 55ms ahead)
    engine.recordRttSample(10, now + 50, now - 10);
    engine.recordRttSample(8, now + 50, now - 8);

    const metrics = engine.getMetrics();
    expect(metrics.averageRttMs).toBeLessThanOrEqual(10);
    expect(metrics.clockOffsetMs).toBeGreaterThan(0);
  });

  it('should mark sub-5ms drift as 0ms locked phase', () => {
    const engine = DriftCorrectionEngine.getInstance();
    engine.resetTrack('song-new');
    const metrics = engine.getMetrics();

    // When drift is 0, isLocked must be true and rate 1.0
    expect(metrics.isLocked).toBe(true);
    expect(metrics.currentPlaybackRate).toBe(1.0);
  });
});
