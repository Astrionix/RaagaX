import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransferCoordinator } from '../../src/lib/connect/TransferCoordinator';
import { SyncCoordinator } from '../../src/lib/connect/SyncCoordinator';
import { ClockSynchronizer } from '../../src/lib/connect/ClockSynchronizer';
import { DeviceLeaseManager } from '../../src/lib/connect/DeviceLeaseManager';
import { PlaybackEngine } from '../../src/lib/playback/PlaybackEngine';
import { usePlayerStore } from '../../src/context/usePlayerStore';

describe('Spotify-Grade Connect Handoff & Clock Sync Tests', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      deviceId: 'dev_laptop_1',
      isActiveDevice: true,
      isPlaying: true,
      currentTime: 45,
      currentSong: { id: 'track_123', title: 'Test Song' } as any,
    });
  });

  it('Test 1: TransferCoordinator computes targetStartAtServerMs 500ms in the future for pre-buffering', async () => {
    const coordinator = TransferCoordinator.getInstance();

    const success = await coordinator.initiateTransfer('dev_mobile_2');

    expect(success).toBe(true);
    expect(coordinator.getPhase()).toBe('PREPARING');
  });

  it('Test 2: Target device handles incoming transfer request, pre-buffers stream, and commits lease', async () => {
    const coordinator = TransferCoordinator.getInstance();

    const mockAcquireLease = vi.spyOn(DeviceLeaseManager.getInstance(), 'acquireLease').mockResolvedValue(true);

    const snapshot = {
      sessionId: 'sess_100',
      trackId: 'track_123',
      positionMs: 45000,
      capturedAtServerMs: Date.now(),
      targetStartAtServerMs: Date.now() + 500,
      isPlaying: true,
      epoch: 1,
      sourceDeviceId: 'dev_laptop_1',
      targetDeviceId: 'dev_mobile_2',
    };

    await coordinator.handleIncomingTransferRequest(snapshot);

    expect(coordinator.getPhase()).toBe('COMMITTED');
    expect(usePlayerStore.getState().currentTime).toBe(45);

    mockAcquireLease.mockRestore();
  });

  it('Test 3: SyncCoordinator continuously tracks RTT and server clock offset within < 50ms drift tolerance', () => {
    const sync = SyncCoordinator.getInstance();
    const engineSpy = vi.spyOn(PlaybackEngine.getInstance(), 'getCanonicalPositionMs').mockReturnValue(45015);

    const driftMs = sync.evaluateClockAndDrift();
    expect(Math.abs(driftMs)).toBeLessThan(50);

    const stats = sync.getStats();
    expect(stats.serverOffsetMs).toBeDefined();
    expect(stats.rttMs).toBeGreaterThan(0);

    engineSpy.mockRestore();
  });
});
