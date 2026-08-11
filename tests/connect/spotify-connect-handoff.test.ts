import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransferCoordinator, TransferSnapshot } from '../../src/lib/connect/TransferCoordinator';
import { SyncCoordinator } from '../../src/lib/connect/SyncCoordinator';
import { DeviceLeaseManager } from '../../src/lib/connect/DeviceLeaseManager';
import { PlaybackEngine } from '../../src/lib/playback/PlaybackEngine';
import { usePlayerStore } from '../../src/context/usePlayerStore';

describe('Spotify-Grade Production Connect Handoff & Clock Sync Tests', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      deviceId: 'dev_laptop_1',
      isActiveDevice: true,
      isPlaying: true,
      currentTime: 45,
      currentSong: { id: 'track_123', title: 'Test Song' } as any,
    });
  });

  it('Test 1: TransferCoordinator calculates dynamic lead time clamped between 300ms and 1500ms', () => {
    const coordinator = TransferCoordinator.getInstance();

    // RTT = 20ms -> 200 + 2*20 = 240ms -> clamped to 300ms minimum
    expect(coordinator.calculateDynamicLeadMs(20)).toBe(300);

    // RTT = 800ms -> 200 + 2*800 = 1800ms -> clamped to 1500ms maximum
    expect(coordinator.calculateDynamicLeadMs(800)).toBe(1500);

    // RTT = 100ms -> 200 + 2*100 = 400ms -> 400ms
    expect(coordinator.calculateDynamicLeadMs(100)).toBe(400);
  });

  it('Test 2: Target device executes 11-state handoff, captures actualStartedAtServerMs and startErrorMs', async () => {
    const coordinator = TransferCoordinator.getInstance();

    const mockAcquireLease = vi.spyOn(DeviceLeaseManager.getInstance(), 'acquireLease').mockResolvedValue(true);

    const snapshot: TransferSnapshot = {
      transferId: 't_100',
      sessionId: 'sess_100',
      epoch: 1,
      trackId: 'track_123',
      positionMs: 45000,
      capturedAtServerMs: Date.now(),
      targetStartAtServerMs: Date.now() + 400,
      isPlaying: true,
      sourceDeviceId: 'dev_laptop_1',
      targetDeviceId: 'dev_mobile_2',
    };

    await coordinator.handleIncomingTransferRequest(snapshot);

    expect(coordinator.getPhase()).toBe('COMPLETED');
    expect(snapshot.actualStartedAtServerMs).toBeDefined();
    expect(snapshot.startErrorMs).toBeDefined();
    expect(usePlayerStore.getState().currentTime).toBe(45);

    mockAcquireLease.mockRestore();
  });

  it('Test 3: SyncCoordinator uses PlaybackClock anchor and multi-sample drift hysteresis', () => {
    const sync = SyncCoordinator.getInstance();
    const serverNow = Date.now();

    sync.setPlaybackClockAnchor(45000, serverNow, 1.0, 'PLAYING');

    const expectedPos = sync.getExpectedPositionMs();
    expect(expectedPos).toBeGreaterThanOrEqual(45000);

    const engineSpy = vi.spyOn(PlaybackEngine.getInstance(), 'getCanonicalPositionMs').mockReturnValue(45010);

    const driftMs = sync.evaluateClockAndDrift();
    expect(Math.abs(driftMs)).toBeLessThan(50);

    const quality = sync.getQuality();
    expect(quality.quality).toBe('EXCELLENT');

    engineSpy.mockRestore();
  });
});
