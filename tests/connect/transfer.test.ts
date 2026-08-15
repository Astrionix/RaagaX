import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransferManager } from '../../src/lib/connect/TransferManager';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { CommandSequencer } from '../../src/lib/connect/CommandSequencer';
import { ConnectCommand } from '../../src/lib/connect/types';

describe('TransferManager Multi-Phase Handoff Tests', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      deviceId: 'dev_sender',
      deviceInstanceId: 'inst_sender',
      isActiveDevice: true,
      isPlaying: true,
      currentSong: { id: 'song_1', title: 'Test Song', artist: 'Test Artist', coverUrl: '', audioUrl: '' } as any,
    });
    CommandSequencer.getInstance().setEpoch(1);
  });

  it('should clear transfer timeout and stop local audio when transfer ACK is received', () => {
    const manager = TransferManager.getInstance();
    
    const ackCommand: ConnectCommand = {
      commandId: 'cmd_ack_1',
      sessionId: 'sess_1',
      epoch: 2, // Target acquired lease at epoch 2
      revision: 5,
      sequence: 1,
      sourceDeviceId: 'dev_target',
      targetDeviceId: 'dev_sender',
      type: 'COMMAND_ACK',
      sentAt: Date.now(),
      payload: {
        status: 'APPLIED',
        originalCommandId: 'cmd_req_1'
      }
    };

    manager.handleTransferAck(ackCommand);

    const store = usePlayerStore.getState();
    expect(store.isActiveDevice).toBe(false);
  });

  it('should transition through Phase A (ACCEPTED -> READY) and Phase B (COMMITTED) correctly', async () => {
    const manager = TransferManager.getInstance();
    
    // Simulate initiated transfer
    const txId = await manager.initiateTransfer('dev_target');
    expect(manager.getTransferState()).toBe('REQUESTING');

    // Simulate target responding with TRANSFER_ACCEPTED
    manager.handleTransferAccepted({
      commandId: 'cmd_acc',
      sessionId: 'sess_1',
      transitionId: txId,
      epoch: 1,
      sequence: 1,
      sourceDeviceId: 'dev_target',
      targetDeviceId: 'dev_sender',
      type: 'TRANSFER_ACCEPTED',
      sentAt: Date.now(),
      payload: { transactionId: txId, status: 'ACCEPTED' }
    });
    expect(manager.getTransferState()).toBe('PREPARING');

    // Simulate target responding with TRANSFER_READY
    await manager.handleTransferReady({
      commandId: 'cmd_rdy',
      sessionId: 'sess_1',
      transitionId: txId,
      epoch: 1,
      sequence: 2,
      sourceDeviceId: 'dev_target',
      targetDeviceId: 'dev_sender',
      type: 'TRANSFER_READY',
      sentAt: Date.now(),
      payload: { transactionId: txId, status: 'READY' }
    });
    expect(manager.getTransferState()).toBe('COMMITTING');

    // Simulate target confirming TRANSFER_COMMITTED
    manager.handleTransferCommitted({
      commandId: 'cmd_cmt',
      sessionId: 'sess_1',
      transitionId: txId,
      epoch: 2,
      sequence: 3,
      sourceDeviceId: 'dev_target',
      targetDeviceId: 'dev_sender',
      type: 'TRANSFER_COMMITTED',
      sentAt: Date.now(),
      payload: { transactionId: txId, status: 'COMMITTED', rendererDeviceId: 'dev_target' }
    });
    expect(manager.getTransferState()).toBe('COMPLETED');
    expect(usePlayerStore.getState().isActiveDevice).toBe(false);
  });

  it('should safely rollback without interrupting playback if target rejects or fails', async () => {
    const manager = TransferManager.getInstance();
    
    const txId = await manager.initiateTransfer('dev_target');
    expect(usePlayerStore.getState().isTransferring).toBe(true);

    manager.handleTransferRollback(txId, 'TARGET_TIMEOUT');
    
    const store = usePlayerStore.getState();
    expect(manager.getTransferState()).toBe('ROLLED_BACK');
    expect(store.isActiveDevice).toBe(true);
    expect(store.isTransferring).toBe(false);
  });
});
