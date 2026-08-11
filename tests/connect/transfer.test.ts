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
    expect(store.isPlaying).toBe(false);
  });
});
