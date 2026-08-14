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
  private isTransferring: boolean = false;

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

  public isTransferInProgress(): boolean {
    return this.isTransferring;
  }

  /**
   * (Sender side) Initiates a transactional transfer to target device.
   */
  public async initiateTransfer(targetDeviceId: string): Promise<string> {
    if (this.isTransferring && this.activeTransitionId) {
      console.warn(`[TransferManager] Transfer ${this.activeTransitionId} already in progress. Ignoring duplicate click.`);
      return this.activeTransitionId;
    }

    this.isTransferring = true;
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
    const payload = command.payload as any;
    const transitionId = command.transitionId || 'tr_fallback';
    console.log(`[TRANSFER TARGET] Received request: transitionId=${transitionId}, songId=${payload?.trackId}, positionMs=${payload?.positionMs}`);
    
    const store = usePlayerStore.getState();
    const engine = PlaybackEngine.getInstance();

    try {
      // 1. PREPARING phase: Restore transferred queue and current song
      console.log(`[TRANSFER TARGET] PREPARING: Restoring queue (${payload?.queue?.length || 1} tracks)...`);
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
          isTransferring: false,
          transferringDeviceId: null,
        });

        console.log(`[TRANSFER TARGET] MEDIA_LOADED: Song "${payload.songData.title}" (${payload.songData.id}) loaded`);

        // Initialize QueueManager with received queue
        try {
          const { QueueManager } = await import('@/lib/queue/QueueManager');
          QueueManager.getInstance().replaceQueue(queueToRestore, queueIndexToRestore);
        } catch {}
      }

      // 2. READY / COMMIT phase: Acquire lease server-side with forceTakeover
      const leaseSuccess = await DeviceLeaseManager.getInstance().acquireLease(command.sessionId, true);
      console.log(`[TRANSFER TARGET] READY_TO_COMMIT: Lease acquired (success=${leaseSuccess})`);
      
      // 3. START phase: play audio locally if active on source
      const { PlaybackService } = await import('@/lib/playback/PlaybackService');
      const { RaagaXNativePlayer } = await import('../playback/native/RaagaXNativePlayer');

      if (payload.isPlaying && payload.songData) {
        if (RaagaXNativePlayer.isNative() && queueToRestore.length > 0) {
          await PlaybackService.getInstance().loadQueueContext(queueToRestore, queueIndexToRestore, true, payload.positionMs || 0);
        } else {
          await PlaybackService.getInstance().playTrack(payload.songData, true);
          if (payload.positionMs > 0) {
            PlaybackService.getInstance().seek(payload.positionMs / 1000, true);
          }
        }
        console.log(`[TRANSFER TARGET] PLAYING: Local playback running at ${payload.positionMs}ms`);
      } else if (payload.positionMs > 0) {
        PlaybackService.getInstance().seek(payload.positionMs / 1000, true);
      }

      // Broadcast the newly acquired authoritative state immediately
      import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
        PlaybackStateSync.getInstance().broadcastState(true);
      });
      
      // 4. Send COMMAND_ACK back to source device
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
      console.log(`[TRANSFER TARGET] COMMITTED: Dispatched COMMAND_ACK (APPLIED) to source ${command.sourceDeviceId}`);
    } catch (e) {
       console.error(`[TRANSFER TARGET] Transfer transition ${transitionId} failed:`, e);
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

    this.isTransferring = false;
    if (payload.status === 'APPLIED') {
      console.log(`[TransferManager] Transfer ${command.transitionId} committed by target. Relinquishing local control.`);
      if (typeof window !== 'undefined') {
        import('../playback/native/RaagaXNativePlayer').then(({ RaagaXNativePlayer }) => {
          if (RaagaXNativePlayer.isNative()) {
            RaagaXNativePlayer.pause().catch(() => {});
          } else {
            import('../playback/PlaybackService').then(({ PlaybackService }) => {
              const active = PlaybackService.getInstance().getActiveAudio();
              if (active && !active.paused) active.pause();
            });
          }
        });
      }
      usePlayerStore.setState({ 
        isActiveDevice: false, 
        activeDeviceId: command.sourceDeviceId,
        isTransferring: false, 
        transferringDeviceId: null 
      });
    } else {
      console.warn(`[TransferManager] Target rejected transition ${command.transitionId}. Retaining local control.`);
      this.handleTransferRollback(command.transitionId);
    }

    this.activeTransitionId = null;
  }

  private handleTransferRollback(transitionId?: string) {
    console.warn(`[TransferManager] Rollback transition ${transitionId || 'unknown'}: Source device retains active renderer ownership.`);
    usePlayerStore.setState({ 
      isActiveDevice: true, 
      isTransferring: false, 
      transferringDeviceId: null 
    });
    this.isTransferring = false;
    this.activeTransitionId = null;
  }
}
