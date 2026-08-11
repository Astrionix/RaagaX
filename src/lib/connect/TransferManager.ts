import { ConnectCommand } from './types';
import { ConnectManager } from './ConnectManager';
import { CommandSequencer } from './CommandSequencer';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackEngine } from '../playback/PlaybackEngine';
import { DeviceLeaseManager } from './DeviceLeaseManager';

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
    const positionMs = engine.getCanonicalPositionMs();
    
    const command: ConnectCommand = {
      commandId: crypto.randomUUID(),
      sessionId: ConnectManager.getInstance().getSessionId() || 'global-session',
      epoch: sequencer.getEpoch(),
      sequence: sequencer.nextSequence(),
      sourceDeviceId: store.deviceId,
      targetDeviceId: targetDeviceId,
      type: 'TRANSFER_REQUEST',
      sentAt: Date.now(),
      payload: {
        trackId: store.currentSong?.id,
        positionMs: positionMs,
        isPlaying: store.isPlaying
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
      // 1. Prepare playback locally (buffer track, etc.)
      console.log('[TransferManager] PREPARE phase...');
      
      // 2. Acquire Lease with forceTakeover to increment epoch
      console.log('[TransferManager] COMMIT phase... acquiring lease');
      const leaseSuccess = await DeviceLeaseManager.getInstance().acquireLease(command.sessionId, true);
      
      if (!leaseSuccess) {
        throw new Error('Failed to acquire lease during transfer.');
      }
      
      // 3. Setup playback state
      if (payload.positionMs !== undefined) {
         engine.seekCanonical(payload.positionMs);
      }
      if (payload.isPlaying) {
         engine.play();
      }
      
      // 4. Send TRANSFER_COMMIT (or ACK) back to source so it knows to stop
      const sequencer = CommandSequencer.getInstance();
      const ackCommand: ConnectCommand = {
        commandId: crypto.randomUUID(),
        sessionId: command.sessionId,
        epoch: sequencer.getEpoch(), // Now at new epoch!
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

  /**
   * (Sender side) Handles incoming ACK (TRANSFER_COMMIT essentially)
   */
  public handleTransferAck(command: ConnectCommand) {
     if (this.pendingTransferTimeout) {
       clearTimeout(this.pendingTransferTimeout);
       this.pendingTransferTimeout = null;
     }
     
     console.log('[TransferManager] Transfer committed by target. Relinquishing local control.');
     
     // Stop local playback, we are no longer owner
     PlaybackEngine.getInstance().pause();
     usePlayerStore.setState({ isActiveDevice: false, isPlaying: false });
  }
}
