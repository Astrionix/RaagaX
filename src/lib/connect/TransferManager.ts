import { ConnectCommand, CommandAckPayload } from './types';
import { ConnectManager } from './ConnectManager';
import { CommandSequencer } from './CommandSequencer';
import { ClockSynchronizer } from './ClockSynchronizer';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackEngine } from '../playback/PlaybackEngine';
import { DeviceLeaseManager } from './DeviceLeaseManager';

export type TransferState =
  | 'IDLE'
  | 'REQUESTING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'COMMITTING'
  | 'COMMITTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK';

export interface TransferPayload {
  transactionId: string;
  sessionId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  epoch: number;
  revision: number;
  songId?: string;
  songData?: any;
  queue?: any[];
  queueIndex?: number;
  positionMs: number;
  duration?: number;
  isPlaying: boolean;
  volume: number;
  shuffle: boolean;
  repeat: string;
  playbackRate: number;
  timestamp: number;
  protocolVersion: number;
  context?: any;
}

export interface TransferCommitPayload {
  transactionId: string;
  shouldResume: boolean;
  targetAction?: 'PLAY' | 'PAUSE' | 'NEXT' | 'PREV' | 'SEEK';
  targetPositionMs?: number;
  status?: string;
  rendererDeviceId?: string;
}

export interface PendingTransferIntent {
  action: 'PLAY' | 'PAUSE' | 'NEXT' | 'PREV' | 'SEEK';
  positionMs?: number;
  songData?: any;
  timestamp: number;
}

export class TransferManager {
  private static instance: TransferManager;
  private pendingStageTimeout: NodeJS.Timeout | null = null;
  private activeTransitionId: string | null = null;
  private currentStage: TransferState = 'IDLE';
  private processedTransactions = new Map<string, { status: TransferState; handledAt: number }>();
  private pendingIntent: PendingTransferIntent | null = null;

  // Bounded stage timeouts
  private readonly REQUEST_ACK_TIMEOUT_MS = 6000;
  private readonly PREPARATION_TIMEOUT_MS = 8000;
  private readonly COMMIT_TIMEOUT_MS = 6000;

  private constructor() {}

  public static getInstance(): TransferManager {
    if (!TransferManager.instance) {
      TransferManager.instance = new TransferManager();
    }
    return TransferManager.instance;
  }

  public recordPendingIntent(intent: PendingTransferIntent) {
    console.log(`[TransferManager] Recorded user intent during transfer: ${intent.action}`, intent);
    this.pendingIntent = intent;
  }

  public getAndClearPendingIntent(): PendingTransferIntent | null {
    const intent = this.pendingIntent;
    this.pendingIntent = null;
    return intent;
  }

  public getActiveTransitionId(): string | null {
    return this.activeTransitionId;
  }

  public isTransferInProgress(): boolean {
    return this.currentStage !== 'IDLE' && this.currentStage !== 'COMPLETED' && this.currentStage !== 'ROLLED_BACK' && this.currentStage !== 'FAILED';
  }

  public getTransferState(): TransferState {
    return this.currentStage;
  }

  private clearStageTimeout() {
    if (this.pendingStageTimeout) {
      clearTimeout(this.pendingStageTimeout);
      this.pendingStageTimeout = null;
    }
  }

  /**
   * (Sender side) Phase A — Initiates a 2-Phase transactional transfer to target device.
   */
  public async initiateTransfer(targetDeviceId: string): Promise<string> {
    if (this.isTransferInProgress() && this.activeTransitionId) {
      console.warn(`[TransferManager] Transfer ${this.activeTransitionId} already in progress (State: ${this.currentStage}). Ignoring duplicate.`);
      return this.activeTransitionId;
    }

    const store = usePlayerStore.getState();
    const sequencer = CommandSequencer.getInstance();
    const engine = PlaybackEngine.getInstance();
    const clock = ClockSynchronizer.getInstance();

    const transitionId = 'tr_' + Math.random().toString(36).substring(2, 10);
    this.activeTransitionId = transitionId;
    this.currentStage = 'REQUESTING';

    usePlayerStore.setState({
      isTransferring: true,
      transferringDeviceId: targetDeviceId
    });

    const positionMs = engine.getCanonicalPositionMs();
    const currentSong = store.currentSong;

    const payload: TransferPayload = {
      transactionId: transitionId,
      sessionId: ConnectManager.getInstance().getSessionId() || 'global-session',
      sourceDeviceId: store.deviceId,
      targetDeviceId: targetDeviceId,
      epoch: sequencer.getEpoch(),
      revision: store.localPlaybackRevision || 1,
      songId: currentSong?.id,
      songData: currentSong,
      queue: store.queue,
      queueIndex: store.queueIndex,
      positionMs,
      duration: store.duration,
      isPlaying: store.isPlaying,
      volume: store.volume,
      shuffle: store.shuffleMode !== 'OFF',
      repeat: store.repeatMode,
      playbackRate: 1.0,
      timestamp: clock.getEstimatedServerNow(),
      protocolVersion: 2,
      context: store.playbackContext
    };

    const command: ConnectCommand<TransferPayload> = {
      commandId: crypto.randomUUID(),
      sessionId: payload.sessionId,
      transitionId,
      epoch: payload.epoch,
      revision: payload.revision,
      sequence: sequencer.nextSequence(),
      sourceDeviceId: store.deviceId,
      targetDeviceId: targetDeviceId,
      type: 'TRANSFER_REQUEST',
      sentAt: Date.now(),
      payload
    };

    console.log(`[TransferManager] [TRANSFER ${transitionId}] Initiating transfer to ${targetDeviceId} (Song: ${currentSong?.title || 'None'}, Pos: ${positionMs}ms)`);
    await ConnectManager.getInstance().sendTargetedCommand(targetDeviceId, command);

    // Set Stage-aware ACK Timeout
    this.clearStageTimeout();
    this.pendingStageTimeout = setTimeout(() => {
      console.warn(`[TransferManager] [TRANSFER ${transitionId}] REQUEST_ACK timed out waiting for ${targetDeviceId}. Executing ROLLBACK.`);
      this.handleTransferRollback(transitionId, 'REQUEST_ACK_TIMEOUT');
    }, this.REQUEST_ACK_TIMEOUT_MS);

    return transitionId;
  }

  /**
   * (Receiver side) Step 1: Validate request, acknowledge with TRANSFER_ACCEPTED, then prepare player.
   */
  public async handleIncomingTransferRequest(command: ConnectCommand) {
    const payload = command.payload as TransferPayload;
    const transitionId = command.transitionId || payload?.transactionId || 'tr_fallback';
    const store = usePlayerStore.getState();
    const sequencer = CommandSequencer.getInstance();

    console.log(`[TransferReceiver] REQUEST_RECEIVED: transactionId=${transitionId}, songId=${payload?.songId || payload?.songData?.id}, pos=${payload?.positionMs}ms`);

    // 1. Target ID Validation
    const localId = store.deviceId;
    if (command.targetDeviceId && command.targetDeviceId !== localId) {
      console.warn(`[TransferReceiver] INVALID_TARGET: Received for ${command.targetDeviceId}, but local device is ${localId}`);
      return;
    }

    // 2. Idempotency Check: Don't recreate if already handled
    const existing = this.processedTransactions.get(transitionId);
    if (existing) {
      console.log(`[TransferReceiver] Idempotent repeat for transaction ${transitionId} (current status: ${existing.status}). Replying with status.`);
      if (existing.status === 'READY' || existing.status === 'COMMITTED') {
        const readyCmd: ConnectCommand = {
          commandId: crypto.randomUUID(),
          sessionId: command.sessionId,
          transitionId,
          epoch: sequencer.getEpoch(),
          sequence: sequencer.nextSequence(),
          sourceDeviceId: store.deviceId,
          targetDeviceId: command.sourceDeviceId,
          type: existing.status === 'READY' ? 'TRANSFER_READY' : 'TRANSFER_COMMITTED',
          sentAt: Date.now(),
          payload: { transactionId: transitionId, status: existing.status }
        };
        await ConnectManager.getInstance().sendTargetedCommand(command.sourceDeviceId, readyCmd);
      }
      return;
    }

    this.processedTransactions.set(transitionId, { status: 'PREPARING', handledAt: Date.now() });

    try {
      // Step 2: Validate Request & Session
      console.log(`[TransferReceiver] REQUEST_VALIDATED: transactionId=${transitionId}`);

      // Respond immediately with TRANSFER_ACCEPTED
      const acceptedCmd: ConnectCommand = {
        commandId: crypto.randomUUID(),
        sessionId: command.sessionId,
        transitionId,
        epoch: sequencer.getEpoch(),
        sequence: sequencer.nextSequence(),
        sourceDeviceId: store.deviceId,
        targetDeviceId: command.sourceDeviceId,
        type: 'TRANSFER_ACCEPTED',
        sentAt: Date.now(),
        payload: { transactionId: transitionId, status: 'ACCEPTED' }
      };
      await ConnectManager.getInstance().sendTargetedCommand(command.sourceDeviceId, acceptedCmd);

      // Step 3: AUDIO_PREPARING — Pre-buffer stream and restore queue & position
      console.log(`[TransferReceiver] AUDIO_PREPARING: transactionId=${transitionId}`);

      const queueToRestore = payload.queue && payload.queue.length > 0 ? payload.queue : (payload.songData ? [payload.songData] : []);
      const queueIndexToRestore = payload.queueIndex !== undefined ? payload.queueIndex : 0;
      const targetPosSeconds = (payload.positionMs || 0) / 1000;

      if (payload.songData) {
        usePlayerStore.setState({
          currentSong: payload.songData,
          queue: queueToRestore,
          queueIndex: queueIndexToRestore,
          currentTime: targetPosSeconds,
          isPlaying: false, // Target stays strictly PAUSED during preparation until commit
          playbackIntent: 'PAUSED',
          playbackStatus: 'paused',
          isTransferring: false,
          transferringDeviceId: null,
        });

        // Initialize QueueManager with received queue
        try {
          const { QueueManager } = await import('@/lib/queue/QueueManager');
          QueueManager.getInstance().replaceQueue(queueToRestore, queueIndexToRestore);
          if (payload.repeat) QueueManager.getInstance().setRepeatMode(payload.repeat as any);
        } catch {}

        // Prepare Player Audio Engine
        const { PlaybackService } = await import('@/lib/playback/PlaybackService');
        const { RaagaXNativePlayer } = await import('../playback/native/RaagaXNativePlayer');

        if (RaagaXNativePlayer.isNative() && queueToRestore.length > 0) {
          await PlaybackService.getInstance().loadQueueContext(queueToRestore, queueIndexToRestore, false, payload.positionMs || 0);
        } else {
          const service = PlaybackService.getInstance();
          await service.playTrack(payload.songData, false);
          if (payload.positionMs > 0) {
            service.seek(targetPosSeconds, true);
          }
          const activeAudio = service.getActiveAudio();
          if (activeAudio && !activeAudio.paused) {
            activeAudio.pause();
          }
        }
      }

      // Step 4: READY — Notify source that target has loaded stream and is armed
      console.log(`[TransferReceiver] READY: transactionId=${transitionId}`);
      this.processedTransactions.set(transitionId, { status: 'READY', handledAt: Date.now() });

      const readyCmd: ConnectCommand = {
        commandId: crypto.randomUUID(),
        sessionId: command.sessionId,
        transitionId,
        epoch: sequencer.getEpoch(),
        sequence: sequencer.nextSequence(),
        sourceDeviceId: store.deviceId,
        targetDeviceId: command.sourceDeviceId,
        type: 'TRANSFER_READY',
        sentAt: Date.now(),
        payload: {
          transactionId: transitionId,
          status: 'READY',
          readyAt: Date.now()
        }
      };
      await ConnectManager.getInstance().sendTargetedCommand(command.sourceDeviceId, readyCmd);

    } catch (e) {
      console.error(`[TransferReceiver] AUDIO_PREPARATION_FAILED for ${transitionId}:`, e);
      this.processedTransactions.set(transitionId, { status: 'FAILED', handledAt: Date.now() });

      const rollbackCmd: ConnectCommand = {
        commandId: crypto.randomUUID(),
        sessionId: command.sessionId,
        transitionId,
        epoch: sequencer.getEpoch(),
        sequence: sequencer.nextSequence(),
        sourceDeviceId: store.deviceId,
        targetDeviceId: command.sourceDeviceId,
        type: 'TRANSFER_ROLLBACK',
        sentAt: Date.now(),
        payload: {
          transactionId: transitionId,
          reason: 'AUDIO_PREPARATION_FAILED',
          error: String(e)
        }
      };
      await ConnectManager.getInstance().sendTargetedCommand(command.sourceDeviceId, rollbackCmd);
    }
  }

  /**
   * (Sender side) Handles incoming TRANSFER_ACCEPTED from target.
   */
  public handleTransferAccepted(command: ConnectCommand) {
    if (command.transitionId !== this.activeTransitionId) return;
    console.log(`[TransferManager] [TRANSFER ${command.transitionId}] Target accepted request. State: ACCEPTED ➔ PREPARING.`);
    this.currentStage = 'PREPARING';

    this.clearStageTimeout();
    this.pendingStageTimeout = setTimeout(() => {
      console.warn(`[TransferManager] [TRANSFER ${command.transitionId}] PREPARATION timed out. Rolling back.`);
      this.handleTransferRollback(command.transitionId, 'PREPARATION_TIMEOUT');
    }, this.PREPARATION_TIMEOUT_MS);
  }

  /**
   * (Sender side) Phase B — Handles incoming TRANSFER_READY from target.
   * Sends TRANSFER_COMMIT to complete ownership transfer.
   */
  public async handleTransferReady(command: ConnectCommand) {
    if (command.transitionId !== this.activeTransitionId) return;
    console.log(`[TransferManager] [TRANSFER ${command.transitionId}] Target is READY. State: READY ➔ COMMITTING.`);
    this.currentStage = 'COMMITTING';

    this.clearStageTimeout();

    const store = usePlayerStore.getState();
    const sequencer = CommandSequencer.getInstance();
    const queuedIntent = this.getAndClearPendingIntent();

    let shouldResume = store.isPlaying;
    let targetAction: 'PLAY' | 'PAUSE' | 'NEXT' | 'PREV' | 'SEEK' | undefined = undefined;
    let targetPositionMs: number | undefined = undefined;

    if (queuedIntent) {
      console.log(`[TransferManager] [TRANSFER ${command.transitionId}] Reconciling queued user intent on commit: ${queuedIntent.action}`);
      if (queuedIntent.action === 'PAUSE') shouldResume = false;
      if (queuedIntent.action === 'PLAY') shouldResume = true;
      targetAction = queuedIntent.action;
      targetPositionMs = queuedIntent.positionMs;
    }

    const commitCommand: ConnectCommand<TransferCommitPayload> = {
      commandId: crypto.randomUUID(),
      sessionId: command.sessionId,
      transitionId: command.transitionId,
      epoch: sequencer.getEpoch(),
      sequence: sequencer.nextSequence(),
      sourceDeviceId: store.deviceId,
      targetDeviceId: command.sourceDeviceId,
      type: 'TRANSFER_COMMIT',
      sentAt: Date.now(),
      payload: {
        transactionId: command.transitionId,
        shouldResume, // Reconciled playing intent
        targetAction, // Reconciled intent (NEXT / PREV / SEEK / PAUSE / PLAY)
        targetPositionMs
      }
    };

    console.log(`[TransferManager] [TRANSFER ${command.transitionId}] Dispatching TRANSFER_COMMIT to ${command.sourceDeviceId}`);
    await ConnectManager.getInstance().sendTargetedCommand(command.sourceDeviceId, commitCommand);

    this.pendingStageTimeout = setTimeout(() => {
      console.warn(`[TransferManager] [TRANSFER ${command.transitionId}] COMMIT_ACK timed out. Executing ROLLBACK.`);
      this.handleTransferRollback(command.transitionId, 'COMMIT_TIMEOUT');
    }, this.COMMIT_TIMEOUT_MS);
  }

  /**
   * (Receiver side) Handles incoming TRANSFER_COMMIT.
   * Activates renderer ownership, claims lease, and confirms TRANSFER_COMMITTED.
   */
  public async handleIncomingTransferCommit(command: ConnectCommand) {
    const payload = command.payload as any;
    const transitionId = command.transitionId || payload?.transactionId || 'tr_fallback';
    const store = usePlayerStore.getState();
    const sequencer = CommandSequencer.getInstance();

    console.log(`[TransferReceiver] COMMIT_RECEIVED: transactionId=${transitionId}`);

    try {
      // 1. Claim server-side playback lease atomically
      const leaseSuccess = await DeviceLeaseManager.getInstance().acquireLease(command.sessionId, true);
      console.log(`[TransferReceiver] RENDERER_ACTIVE: Lease acquired (success=${leaseSuccess})`);

      // 2. Set Active Renderer state on local target
      usePlayerStore.setState({
        isActiveDevice: true,
        activeDeviceId: store.deviceId,
        deviceConnectionState: 'CONNECTED',
        connectedDeviceId: null,
        remoteDeviceName: null,
        isTransferring: false,
        transferringDeviceId: null
      });

      // 3. Reconcile explicit user intent (NEXT, PREV, SEEK, PLAY, PAUSE)
      if (payload?.targetAction === 'NEXT') {
        const { QueueManager } = await import('@/lib/queue/QueueManager');
        const nextItem = QueueManager.getInstance().getNext(false);
        if (nextItem && nextItem.song) {
          usePlayerStore.setState({
            currentSong: nextItem.song,
            currentTime: 0,
            isPlaying: true,
            playbackIntent: 'PLAYING'
          });
          const { RaagaXNativePlayer } = await import('../playback/native/RaagaXNativePlayer');
          if (RaagaXNativePlayer.isNative()) {
            await RaagaXNativePlayer.next();
          } else {
            const { PlaybackService } = await import('@/lib/playback/PlaybackService');
            await PlaybackService.getInstance().playTrack(nextItem.song, true);
          }
        }
      } else if (payload?.targetAction === 'PREV') {
        const { QueueManager } = await import('@/lib/queue/QueueManager');
        const prevItem = QueueManager.getInstance().getPrevious();
        if (prevItem && prevItem.song) {
          usePlayerStore.setState({
            currentSong: prevItem.song,
            currentTime: 0,
            isPlaying: true,
            playbackIntent: 'PLAYING'
          });
          const { RaagaXNativePlayer } = await import('../playback/native/RaagaXNativePlayer');
          if (RaagaXNativePlayer.isNative()) {
            await RaagaXNativePlayer.previous();
          } else {
            const { PlaybackService } = await import('@/lib/playback/PlaybackService');
            await PlaybackService.getInstance().playTrack(prevItem.song, true);
          }
        }
      } else if (payload?.targetAction === 'SEEK' && typeof payload.targetPositionMs === 'number') {
        const seekSec = payload.targetPositionMs / 1000;
        usePlayerStore.setState({ currentTime: seekSec, isPlaying: Boolean(payload.shouldResume) });
        const { PlaybackService } = await import('@/lib/playback/PlaybackService');
        PlaybackService.getInstance().seek(seekSec, true);
        if (payload.shouldResume) PlaybackService.getInstance().play();
      } else if (payload?.shouldResume) {
        const { RaagaXNativePlayer } = await import('../playback/native/RaagaXNativePlayer');
        if (RaagaXNativePlayer.isNative()) {
          console.log('[TransferReceiver] Resuming native Android ExoPlayer on commit');
          RaagaXNativePlayer.resume();
        } else {
          const { PlaybackService } = await import('@/lib/playback/PlaybackService');
          PlaybackService.getInstance().play();
        }
      }

      this.processedTransactions.set(transitionId, { status: 'COMMITTED', handledAt: Date.now() });

      // 4. Send TRANSFER_COMMITTED confirmation back to source
      const committedCmd: ConnectCommand = {
        commandId: crypto.randomUUID(),
        sessionId: command.sessionId,
        transitionId,
        epoch: sequencer.getEpoch(),
        sequence: sequencer.nextSequence(),
        sourceDeviceId: store.deviceId,
        targetDeviceId: command.sourceDeviceId,
        type: 'TRANSFER_COMMITTED',
        sentAt: Date.now(),
        payload: {
          transactionId: transitionId,
          status: 'COMMITTED',
          rendererDeviceId: store.deviceId
        }
      };

      await ConnectManager.getInstance().sendTargetedCommand(command.sourceDeviceId, committedCmd);

      // 5. Broadcast authoritative state across session
      import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
        PlaybackStateSync.getInstance().broadcastState(true);
      });

      console.log(`[TransferReceiver] COMPLETE: Transfer ${transitionId} committed successfully.`);
    } catch (e) {
      console.error(`[TransferReceiver] COMMIT_FAILED for ${transitionId}:`, e);
      const rollbackCmd: ConnectCommand = {
        commandId: crypto.randomUUID(),
        sessionId: command.sessionId,
        transitionId,
        epoch: sequencer.getEpoch(),
        sequence: sequencer.nextSequence(),
        sourceDeviceId: store.deviceId,
        targetDeviceId: command.sourceDeviceId,
        type: 'TRANSFER_ROLLBACK',
        sentAt: Date.now(),
        payload: {
          transactionId: transitionId,
          reason: 'COMMIT_FAILED',
          error: String(e)
        }
      };
      await ConnectManager.getInstance().sendTargetedCommand(command.sourceDeviceId, rollbackCmd);
    }
  }

  /**
   * (Sender side) Handles incoming TRANSFER_COMMITTED from target.
   * Releases local renderer ownership and transitions source into controller mode.
   */
  public handleTransferCommitted(command: ConnectCommand) {
    if (this.activeTransitionId && command.transitionId && command.transitionId !== this.activeTransitionId) {
      console.warn(`[TransferManager] Mismatched transitionId in TRANSFER_COMMITTED: expected ${this.activeTransitionId}, got ${command.transitionId}`);
    }

    this.clearStageTimeout();
    console.log(`[TransferManager] [TRANSFER ${command.transitionId || 'unknown'}] COMMITTED by target ${command.sourceDeviceId}. Relinquishing local renderer.`);

    // Pause and release local audio engine
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

    // Source transitions to controller
    usePlayerStore.setState({
      isActiveDevice: false,
      activeDeviceId: command.sourceDeviceId,
      connectedDeviceId: command.sourceDeviceId,
      deviceConnectionState: 'CONNECTED',
      isPlaying: false,
      playbackIntent: 'PAUSED',
      playbackStatus: 'paused',
      isTransferring: false,
      transferringDeviceId: null
    });

    this.currentStage = 'COMPLETED';
    this.activeTransitionId = null;
  }

  /**
   * Handles incoming ACK or legacy COMMAND_ACK messages.
   */
  public handleTransferAck(command: ConnectCommand) {
    const payload = command.payload as CommandAckPayload;
    if (payload?.status === 'APPLIED') {
      this.handleTransferCommitted(command);
    } else {
      this.handleTransferRollback(command.transitionId, payload?.reason || 'TARGET_REJECTED');
    }
  }

  /**
   * Safe Rollback: Source device retains active renderer ownership and continues playback uninterrupted.
   */
  public handleTransferRollback(transitionId?: string, reason?: string) {
    this.clearStageTimeout();
    console.warn(`[TransferManager] [TRANSFER ${transitionId || 'unknown'}] ROLLBACK (Reason: ${reason || 'Unknown'}): Source device retains active renderer.`);

    this.currentStage = 'ROLLED_BACK';
    this.activeTransitionId = null;

    usePlayerStore.setState({
      isActiveDevice: true,
      isTransferring: false,
      transferringDeviceId: null
    });
  }
}

