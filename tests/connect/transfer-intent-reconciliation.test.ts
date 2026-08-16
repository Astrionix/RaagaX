import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransferManager } from '@/lib/connect/TransferManager';
import { usePlayerStore } from '@/context/usePlayerStore';

describe('Transfer Intent Reconciliation & Transfer-Time Control Tests', () => {
  let manager: TransferManager;

  beforeEach(() => {
    manager = TransferManager.getInstance();
    usePlayerStore.setState({
      deviceId: 'device_sender_1',
      isActiveDevice: true,
      isTransferring: false,
      isPlaying: true,
      currentTime: 30,
      duration: 200,
      queue: [
        { id: 'song_1', title: 'Song 1', artist: 'Artist 1', album: 'Album 1', duration: 200 } as any,
        { id: 'song_2', title: 'Song 2', artist: 'Artist 2', album: 'Album 2', duration: 180 } as any,
        { id: 'song_3', title: 'Song 3', artist: 'Artist 3', album: 'Album 3', duration: 210 } as any
      ],
      queueIndex: 0
    });
  });

  it('correctly aggregates multiple play/pause commands into final desired playback state', () => {
    manager.recordPendingIntent({ action: 'PAUSE', timestamp: 100 });
    manager.recordPendingIntent({ action: 'PLAY', timestamp: 200 });
    manager.recordPendingIntent({ action: 'PAUSE', timestamp: 300 });

    const buffer = manager.getAndClearIntentBuffer();
    expect(buffer).toBeDefined();
    expect(buffer?.desiredPlayingState).toBe(false);
  });

  it('correctly collapses multiple NEXT and PREV commands into an arithmetic queueDelta', () => {
    // NEXT (+1) -> NEXT (+1) -> PREV (-1) -> NEXT (+1) = +2
    manager.recordPendingIntent({ action: 'NEXT', timestamp: 100 });
    manager.recordPendingIntent({ action: 'NEXT', timestamp: 200 });
    manager.recordPendingIntent({ action: 'PREV', timestamp: 300 });
    manager.recordPendingIntent({ action: 'NEXT', timestamp: 400 });

    const buffer = manager.getAndClearIntentBuffer();
    expect(buffer).toBeDefined();
    expect(buffer?.queueDelta).toBe(2);
    expect(buffer?.desiredPlayingState).toBe(true);
  });

  it('correctly adopts the latest seek position during transfer', () => {
    manager.recordPendingIntent({ action: 'SEEK', positionMs: 45000, timestamp: 100 });
    manager.recordPendingIntent({ action: 'SEEK', positionMs: 90000, timestamp: 200 });

    const buffer = manager.getAndClearIntentBuffer();
    expect(buffer).toBeDefined();
    expect(buffer?.desiredPositionMs).toBe(90000);
  });

  it('retains local active renderer ownership upon rollback', () => {
    manager.handleTransferRollback('tr_test_1', 'REQUEST_ACK_TIMEOUT');
    
    expect(manager.getTransferState()).toBe('ROLLED_BACK');
    expect(manager.isTransferInProgress()).toBe(false);
    expect(usePlayerStore.getState().isActiveDevice).toBe(true);
    expect(usePlayerStore.getState().isTransferring).toBe(false);
  });
});
