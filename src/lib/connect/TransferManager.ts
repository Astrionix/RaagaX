import { ConnectCommand } from './types';
import { ConnectManager } from './ConnectManager';
import { CommandSequencer } from './CommandSequencer';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackEngine } from '../playback/PlaybackEngine';

export class TransferManager {
  private static instance: TransferManager;
  private pendingTransferTimeout: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): TransferManager {
    if (!TransferManager.instance) {
      TransferManager.instance = new TransferManager();
    }
    return TransferManager.instance;
  }

  /**
   * (Sender side) Initiates a transfer to another device.
   */
  public async initiateTransfer(targetDeviceId: string) {
    const store = usePlayerStore.getState();
    const sequencer = CommandSequencer.getInstance();
    const engine = PlaybackEngine.getInstance();
    
    // 1. Capture current state
    const state = engine.getPlaybackState();
    
    const command: ConnectCommand = {
      commandId: crypto.randomUUID(),
      sessionId: 'global-session-1', // Simplified for now
      epoch: sequencer.getEpoch(),
      sequence: sequencer.nextSequence(),
      sourceDeviceId: store.deviceId,
      targetDeviceId: targetDeviceId,
      type: 'TRANSFER_REQUEST',
      sentAt: Date.now(),
      payload: {
        trackId: state.trackId,
        positionMs: state.positionMs,
        isPlaying: state.isPlaying
      }
    };

    // 2. Send via Inbox
    await ConnectManager.getInstance().sendTargetedCommand(targetDeviceId, command);
    
    // 3. Set timeout for rollback
    this.pendingTransferTimeout = setTimeout(() => {
      console.warn('[TransferManager] Transfer to', targetDeviceId, 'timed out. Rolling back.');
      // Rollback logic...
    }, 10000); // 10s timeout
  }

  /**
   * (Receiver side) Handles incoming TRANSFER_REQUEST
   */
  public async handleIncomingTransferRequest(command: ConnectCommand) {
    console.log('[TransferManager] Handling TRANSFER_REQUEST', command);
    
    const store = usePlayerStore.getState();
    const engine = PlaybackEngine.getInstance();
    const payload = command.payload as any;

    try {
      // 1. Attempt to claim lease
      // (Skipped DB call for brevity, assuming success in this mock flow)
      usePlayerStore.setState({ isActiveDevice: true });
      
      // 2. Prepare playback
      if (payload.positionMs !== undefined) {
         engine.seekCanonical(payload.positionMs);
      }
      if (payload.isPlaying) {
         engine.play();
      }
      
      // 3. Send TRANSFER_READY ACK back
      const sequencer = CommandSequencer.getInstance();
      const ackCommand: ConnectCommand = {
        commandId: crypto.randomUUID(),
        sessionId: command.sessionId,
        epoch: sequencer.getEpoch(),
        sequence: sequencer.nextSequence(),
        sourceDeviceId: store.deviceId,
        targetDeviceId: command.sourceDeviceId,
        type: 'COMMAND_ACK',
        sentAt: Date.now(),
        payload: {
          status: 'APPLIED',
          originalCommandId: command.commandId
        }
      };
      
      await ConnectManager.getInstance().sendTargetedCommand(command.sourceDeviceId, ackCommand);
      
    } catch (e) {
       console.error('[TransferManager] Failed to apply transfer request', e);
    }
  }
}
