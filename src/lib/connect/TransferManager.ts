import { ConnectCommand, CommandAckPayload } from './types';
import { ConnectManager } from './ConnectManager';
import { CommandSequencer } from './CommandSequencer';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackEngine } from '../playback/PlaybackEngine';
import { DeviceLeaseManager } from './DeviceLeaseManager';

export class TransferManager {
  private static instance: TransferManager;
  private pendingTransferTimeout: NodeJS.Timeout | null = null;
  private activeTransitionId: string | null = null;

  private constructor() {}

  public static getInstance(): TransferManager {
    if (!TransferManager.instance) {
      TransferManager.instance = new TransferManager();
    }
    return TransferManager.instance;
  }

  public getActiveTransitionId(): string | null {
    return this.activeTransitionId;
  }

  /**
   * (Sender side) Initiates a transactional transfer to target device.
   */
  public async initiateTransfer(targetDeviceId: string): Promise<string> {
    const store = usePlayerStore.getState();
    const sequencer = CommandSequencer.getInstance();
    const engine = PlaybackEngine.getInstance();
    
    const transitionId = 'tr_' + Math.random().toString(36).substring(2, 10);
    this.activeTransitionId = transitionId;

    const positionMs = engine.getCanonicalPositionMs();
    
    const command: ConnectCommand = {
      commandId: crypto.randomUUID(),
      sessionId: ConnectManager.getInstance().getSessionId() || 'global-session',
      transitionId,
      epoch: sequencer.getEpoch(),
      sequence: sequencer.nextSequence(),
      sourceDeviceId: store.deviceId,
      targetDeviceId: targetDeviceId,
      type: 'TRANSFER_REQUEST',
      sentAt: Date.now(),
      payload: {
        trackId: store.currentSong?.id,
        songData: store.currentSong,
        queue: store.queue,
        queueIndex: store.queueIndex,
        positionMs,
        isPlaying: store.isPlaying,
        context: store.playbackContext
      }
    };

    console.log(`[TransferManager] Initiating transfer transaction ${transitionId} to ${targetDeviceId}`);
    await ConnectManager.getInstance().sendTargetedCommand(targetDeviceId, command);
    
    // Set 8s timeout for target confirmation; rollback if target fails to ACK
    this.pendingTransferTimeout = setTimeout(() => {
      console.warn(`[TransferManager] Transfer transition ${transitionId} timed out. Executing ROLLBACK.`);
      this.handleTransferRollback(transitionId);
    }, 8000);

    return transitionId;
  }

  /**
   * (Receiver side) Handles incoming TRANSFER_REQUEST
   */
  public async handleIncomingTransferRequest(command: ConnectCommand) {
    console.log('[TransferManager] Handling TRANSFER_REQUEST', command);
    
    const store = usePlayerStore.getState();
    const engine = PlaybackEngine.getInstance();
    const payload = command.payload as any;
    const transitionId = command.transitionId || 'tr_fallback';

    try {
      // 1. Restore transferred queue and current song
      if (payload.songData) {
        const queueToRestore = payload.queue && payload.queue.length > 0 ? payload.queue : [payload.songData];
        const queueIndexToRestore = payload.queueIndex !== undefined ? payload.queueIndex : 0;
        
        usePlayerStore.setState({
          currentSong: payload.songData,
          queue: queueToRestore,
          queueIndex: queueIndexToRestore,
          currentTime: (payload.positionMs || 0) / 1000,
          isActiveDevice: true,
          activeDeviceId: store.deviceId,
        });

        // Initialize QueueManager with received queue
        try {
          const { QueueManager } = await import('@/lib/queue/QueueManager');
          QueueManager.getInstance().replaceQueue(queueToRestore, queueIndexToRestore);
        } catch {}
      }

      // 2. PREPARE phase: seek canonical position
      if (payload.positionMs !== undefined) {
         engine.seekCanonical(payload.positionMs);
      }

      // 3. COMMIT phase: Acquire lease server-side with forceTakeover
      const leaseSuccess = await DeviceLeaseManager.getInstance().acquireLease(command.sessionId, true);
      
      if (!leaseSuccess) {
        throw new Error('Failed to acquire lease during transfer.');
      }
      
      // 4. START phase: play audio locally (Offline-aware: local blob first, then stream)
      if (payload.isPlaying && payload.songData) {
        const { PlaybackService } = await import('@/lib/playback/PlaybackService');
        await PlaybackService.getInstance().playTrack(payload.songData, true);
        if (payload.positionMs > 0) {
          PlaybackService.getInstance().seek(payload.positionMs / 1000);
        }
      }
      
      // 5. Send COMMAND_ACK back to source device
      const sequencer = CommandSequencer.getInstance();
      const ackPayload: CommandAckPayload = {
        commandId: command.commandId,
        transitionId,
        status: 'APPLIED',
        epoch: sequencer.getEpoch()
      };

      const ackCommand: ConnectCommand = {
        commandId: crypto.randomUUID(),
        sessionId: command.sessionId,
        transitionId,
        epoch: sequencer.getEpoch(),
        sequence: sequencer.nextSequence(),
        sourceDeviceId: store.deviceId,
        targetDeviceId: command.sourceDeviceId,
        type: 'COMMAND_ACK',
        sentAt: Date.now(),
        payload: ackPayload
      };
      
      await ConnectManager.getInstance().sendTargetedCommand(command.sourceDeviceId, ackCommand);
      console.log(`[TransferManager] Transfer transition ${transitionId} successfully committed on target.`);
    } catch (e) {
       console.error(`[TransferManager] Transfer transition ${transitionId} failed on target:`, e);
       // Send Rollback ACK to source
       const sequencer = CommandSequencer.getInstance();
       const rollbackAck: ConnectCommand = {
         commandId: crypto.randomUUID(),
         sessionId: command.sessionId,
         transitionId,
         epoch: sequencer.getEpoch(),
         sequence: sequencer.nextSequence(),
         sourceDeviceId: store.deviceId,
         targetDeviceId: command.sourceDeviceId,
         type: 'COMMAND_ACK',
         sentAt: Date.now(),
         payload: {
           commandId: command.commandId,
           transitionId,
           status: 'TRANSITION_ROLLED_BACK',
           reason: String(e)
         } as CommandAckPayload
       };
       await ConnectManager.getInstance().sendTargetedCommand(command.sourceDeviceId, rollbackAck);
    }
  }

  /**
   * (Sender side) Handles incoming ACK (TRANSFER_COMMIT / ROLLBACK)
   */
  public handleTransferAck(command: ConnectCommand) {
    const payload = command.payload as CommandAckPayload;
    
    if (this.pendingTransferTimeout) {
      clearTimeout(this.pendingTransferTimeout);
      this.pendingTransferTimeout = null;
    }

    if (payload.status === 'APPLIED') {
      console.log(`[TransferManager] Transfer ${command.transitionId} committed by target. Relinquishing local control.`);
      PlaybackEngine.getInstance().pause();
      usePlayerStore.setState({ isActiveDevice: false, isPlaying: false });
    } else {
      console.warn(`[TransferManager] Target rejected transition ${command.transitionId}. Retaining local control.`);
      this.handleTransferRollback(command.transitionId);
    }

    this.activeTransitionId = null;
  }

  private handleTransferRollback(transitionId?: string) {
    console.warn(`[TransferManager] Rollback transition ${transitionId || 'unknown'}: Source device retains active renderer ownership.`);
    const store = usePlayerStore.getState();
    usePlayerStore.setState({ isActiveDevice: true });
    this.activeTransitionId = null;
  }
}
