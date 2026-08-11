import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceLeaseManager } from '../../src/lib/connect/DeviceLeaseManager';
import { usePlayerStore } from '../../src/context/usePlayerStore';

describe('DeviceLeaseManager Chaos & Invariant Tests', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      deviceId: 'test_device_1',
      deviceInstanceId: 'inst_1',
      isActiveDevice: false,
    });
  });

  it('should enforce single active renderer lease check rules', async () => {
    const leaseManager = DeviceLeaseManager.getInstance();
    
    // Initially without lease token, checkLeaseValid returns false
    const isValidBefore = await leaseManager.checkLeaseValid('sess_123');
    expect(isValidBefore).toBe(false);
  });

  it('should invalidate lease if lease token expired', async () => {
    const leaseManager = DeviceLeaseManager.getInstance();
    usePlayerStore.setState({ isActiveDevice: true });
    
    // Force expired lease state internally
    (leaseManager as any).currentLeaseToken = 'token_abc';
    (leaseManager as any).leaseExpiresAt = Date.now() - 5000; // 5s in the past

    const isValid = await leaseManager.checkLeaseValid('sess_123');
    expect(isValid).toBe(false);
  });
});
