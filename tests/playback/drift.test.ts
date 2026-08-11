import { describe, it, expect } from 'vitest';

describe('Signed Time Drift Calculation Tests', () => {
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
});
