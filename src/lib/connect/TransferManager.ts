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
  queueDelta?: number;
  status?: string;
  rendererDeviceId?: string;
  songId?: string;
  epoch?: number;
}

export interface PendingTransferIntent {
  action: 'PLAY' | 'PAUSE' | 'NEXT' | 'PREV' | 'SEEK';
  positionMs?: number;
  songData?: any;
  timestamp: number;
}

export interface SemanticIntentBuffer {
  desiredPlayingState?: boolean;
  queueDelta: number;
  desiredPositionMs?: number;
  lastIntentTimestamp: number;
}

export interface TransferTimelineEntry {
  stage: string;
  timestamp: number;
  details?: any;
}

export interface TransferContext {
  transactionId: string;
  sessionId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  songId?: string;
  songData?: any;
  queue?: any[];
  queueIndex?: number;
  positionMs: number;
  initialPlaybackState: boolean;
  desiredPlayingState?: boolean;
  queueDelta: number;
  desiredPositionMs?: number;
  targetAction?: 'PLAY' | 'PAUSE' | 'NEXT' | 'PREV' | 'SEEK';
  commandSequence: number;
  queueVersion: number;
  epoch: number;
  stage: TransferState;
  createdAt: number;
  timeline: TransferTimelineEntry[];
}

export class TransferManager {
  private static instance: TransferManager;
  private pendingStageTimeout: NodeJS.Timeout | null = null;
  private activeTransitionId: string | null = null;
  private activeTransferContext: TransferContext | null = null;
  private currentStage: TransferState = 'IDLE';
  private processedTransactions = new Map<string, { status: TransferState; handledAt: number }>();
  private intentBuffer: SemanticIntentBuffer = { queueDelta: 0, lastIntentTimestamp: 0 };
  private postCommitCommands: PendingTransferIntent[] = [];

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

  private recordTimeline(stage: string, details?: any) {
    const entry: TransferTimelineEntry = {
      stage,
      timestamp: Date.now(),
      details
    };
    if (this.activeTransferContext) {
      this.activeTransferContext.timeline.push(entry);
    }
    console.log(`[TransferManager] [TIMELINE: ${stage}] (Tx: ${this.activeTransitionId || 'N/A'})`, details || '');
  }

  /**
   * Captures and semantically reconciles playback user controls during active transfer.
   */
  public recordPendingIntent(intent: PendingTransferIntent) {
    this.recordTimeline('USER_COMMAND_DURING_TRANSFER', intent);
    this.intentBuffer.lastIntentTimestamp = intent.timestamp;

    if (intent.action === 'PLAY') {
      this.intentBuffer.desiredPlayingState = true;
    } else if (intent.action === 'PAUSE') {
      this.intentBuffer.desiredPlayingState = false;
    } else if (intent.action === 'NEXT') {
      this.intentBuffer.queueDelta += 1;
      this.intentBuffer.desiredPlayingState = true;
    } else if (intent.action === 'PREV') {
      this.intentBuffer.queueDelta -= 1;
      this.intentBuffer.desiredPlayingState = true;
    } else if (intent.action === 'SEEK' && typeof intent.positionMs === 'number') {
      this.intentBuffer.desiredPositionMs = intent.positionMs;
    }

    if (this.activeTransferContext) {
      this.activeTransferContext.queueDelta = this.intentBuffer.queueDelta;
      this.activeTransferContext.desiredPlayingState = this.intentBuffer.desiredPlayingState;
      this.activeTransferContext.desiredPositionMs = this.intentBuffer.desiredPositionMs;
    }

    // If transfer is already in COMMITTING or COMMITTED stage (after initial buffer snapshot was dispatched),
    // buffer this intent into postCommitCommands to be executed on target once committed.
    if (this.currentStage === 'COMMITTING' || this.currentStage === 'COMMITTED') {
      console.log(`[TransferManager] Intent ${intent.action} received during ${this.currentStage} stage; buffering for post-commit execution.`);
      this.postCommitCommands.push(intent);
    }

    this.recordTimeline('COMMAND_QUEUED', {
      currentQueueDelta: this.intentBuffer.queueDelta,
      desiredPlayingState: this.intentBuffer.desiredPlayingState,
      desiredPositionMs: this.intentBuffer.desiredPositionMs
    });
  }

  public getAndClearIntentBuffer(): SemanticIntentBuffer | null {
    if (this.intentBuffer.lastIntentTimestamp === 0 && this.intentBuffer.queueDelta === 0 && this.intentBuffer.desiredPlayingState === undefined && this.intentBuffer.desiredPositionMs === undefined) {
      return null;
    }
    const snapshot = { ...this.intentBuffer };
    this.intentBuffer = { queueDelta: 0, lastIntentTimestamp: 0 };
    return snapshot;
  }

  public getActiveTransitionId(): string | null {
    return this.activeTransitionId;
  }

  public getActiveContext(): TransferContext | null {
    return this.activeTransferContext;
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
   * (Sender side) Phase A — Initiates a transactional playback transfer to target device.
   */
  public async initiateTransfer(targetDeviceId: string): Promise<string> {
    const store = usePlayerStore.getState();
    if (targetDeviceId === store.deviceId) {
      console.warn(`[TransferManager] Cannot transfer playback to the current device (${targetDeviceId})`);
      throw new Error('Cannot transfer playback to the current device');
    }

    if (this.isTransferInProgress() && this.activeTransitionId) {
      if (this.activeTransferContext?.targetDeviceId === targetDeviceId) {
        console.warn(`[TransferManager] Transfer ${this.activeTransitionId} to ${targetDeviceId} already in progress (Stage: ${this.currentStage}). Ignoring duplicate.`);
        return this.activeTransitionId;
      }
      console.warn(`[TransferManager] Switching target device from ${this.activeTransferContext?.targetDeviceId} to ${targetDeviceId}. Aborting prior transfer.`);
      this.handleTransferRollback(this.activeTransitionId, 'SUPERSEDED_BY_NEW_TARGET');
    }

    const sequencer = CommandSequencer.getInstance();
    const engine = PlaybackEngine.getInstance();
    const clock = ClockSynchronizer.getInstance();

    const transitionId = 'tr_' + Math.random().toString(36).substring(2, 10);
    this.activeTransitionId = transitionId;
    this.currentStage = 'REQUESTING';
    this.postCommitCommands = [];
    this.intentBuffer = { queueDelta: 0, lastIntentTimestamp: 0 };

    const positionMs = engine.getCanonicalPositionMs();
    const currentSong = store.currentSong;

    this.activeTransferContext = {
      transactionId: transitionId,
      sessionId: ConnectManager.getInstance().getSessionId() || 'global-session',
      sourceDeviceId: store.deviceId,
      targetDeviceId,
      songId: currentSong?.id,
      songData: currentSong,
      queue: store.queue,
      queueIndex: store.queueIndex,
      positionMs,
      initialPlaybackState: store.isPlaying,
      queueDelta: 0,
      commandSequence: sequencer.nextSequence(),
      queueVersion: store.localPlaybackRevision || 1,
      epoch: sequencer.getEpoch(),
      stage: 'REQUESTING',
      createdAt: Date.now(),
      timeline: []
    };

    usePlayerStore.setState({
      isTransferring: true,
      transferringDeviceId: targetDeviceId
    });

    this.recordTimeline('TRANSFER_REQUEST', { targetDeviceId, positionMs, isPlaying: store.isPlaying });

    const payload: TransferPayload = {
      transactionId: transitionId,
      sessionId: this.activeTransferContext.sessionId,
      sourceDeviceId: store.deviceId,
      targetDeviceId: targetDeviceId,
      epoch: this.activeTransferContext.epoch,
      revision: this.activeTransferContext.queueVersion,
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
      sequence: this.activeTransferContext.commandSequence,
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

      // Step 3: DESTINATION_PREPARING — Pre-buffer stream and restore queue & position
      console.log(`[TransferReceiver] DESTINATION_PREPARING: transactionId=${transitionId}`);

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

      // Step 4: DESTINATION_READY — Notify source that target has loaded stream and is armed
      console.log(`[TransferReceiver] DESTINATION_READY: transactionId=${transitionId}`);
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
    this.recordTimeline('TRANSFER_ACCEPTED', { fromDeviceId: command.sourceDeviceId });
    this.currentStage = 'PREPARING';
    if (this.activeTransferContext) this.activeTransferContext.stage = 'PREPARING';

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
    this.recordTimeline('DESTINATION_READY', { fromDeviceId: command.sourceDeviceId });
    this.currentStage = 'COMMITTING';
    if (this.activeTransferContext) this.activeTransferContext.stage = 'COMMITTING';

    const store = usePlayerStore.getState();
    const sequencer = CommandSequencer.getInstance();
    const intentBuffer = this.getAndClearIntentBuffer();

    let shouldResume = store.isPlaying;
    let targetAction: 'PLAY' | 'PAUSE' | 'NEXT' | 'PREV' | 'SEEK' | undefined = undefined;
    let targetPositionMs: number | undefined = undefined;
    let queueDelta = 0;

    if (intentBuffer) {
      console.log(`[TransferManager] [TRANSFER ${command.transitionId}] Reconciling semantic intent buffer on commit:`, intentBuffer);
      if (typeof intentBuffer.desiredPlayingState === 'boolean') {
        shouldResume = intentBuffer.desiredPlayingState;
      }
      if (intentBuffer.queueDelta > 0) {
        targetAction = 'NEXT';
        queueDelta = intentBuffer.queueDelta;
      } else if (intentBuffer.queueDelta < 0) {
        targetAction = 'PREV';
        queueDelta = intentBuffer.queueDelta;
      }
      if (typeof intentBuffer.desiredPositionMs === 'number') {
        targetPositionMs = intentBuffer.desiredPositionMs;
        if (!targetAction) targetAction = 'SEEK';
      }
    }

    const commitPayload: TransferCommitPayload = {
      transactionId: command.transitionId || this.activeTransitionId,
      shouldResume,
      targetAction,
      targetPositionMs,
      queueDelta,
      epoch: sequencer.getEpoch(),
      rendererDeviceId: command.sourceDeviceId
    };

    this.recordTimeline('DESTINATION_COMMAND_SENT', commitPayload);

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
      payload: commitPayload
    };

    console.log(`[TransferManager] [TRANSFER ${command.transitionId}] Dispatching TRANSFER_COMMIT to ${command.sourceDeviceId}`, commitPayload);
    await ConnectManager.getInstance().sendTargetedCommand(command.sourceDeviceId, commitCommand);

    this.clearStageTimeout();
    this.pendingStageTimeout = setTimeout(() => {
      console.warn(`[TransferManager] [TRANSFER ${command.transitionId}] COMMIT_ACK timed out. Executing ROLLBACK.`);
      this.handleTransferRollback(command.transitionId, 'COMMIT_TIMEOUT');
    }, this.COMMIT_TIMEOUT_MS);
  }

  /**
   * (Receiver side) Handles incoming TRANSFER_COMMIT.
   * Activates renderer ownership, claims lease, executes reconciled intent, and confirms TRANSFER_COMMITTED.
   */
  public async handleIncomingTransferCommit(command: ConnectCommand) {
    const payload = command.payload as TransferCommitPayload;
    const transitionId = command.transitionId || payload?.transactionId || 'tr_fallback';
    const store = usePlayerStore.getState();
    const sequencer = CommandSequencer.getInstance();

    console.log(`[TransferReceiver] COMMIT_RECEIVED: transactionId=${transitionId}`, payload);

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
      const queueDelta = typeof payload?.queueDelta === 'number' ? payload.queueDelta : (payload?.targetAction === 'NEXT' ? 1 : (payload?.targetAction === 'PREV' ? -1 : 0));
      
      if (queueDelta !== 0) {
        const { QueueManager } = await import('@/lib/queue/QueueManager');
        const qManager = QueueManager.getInstance();
        let targetItem: any = null;
        
        if (queueDelta > 0) {
          for (let i = 0; i < queueDelta; i++) {
            targetItem = qManager.getNext(false);
          }
        } else if (queueDelta < 0) {
          for (let i = 0; i < Math.abs(queueDelta); i++) {
            targetItem = qManager.getPrevious();
          }
        }

        if (targetItem && targetItem.song) {
          const snapshot = qManager.getSnapshot();
          usePlayerStore.setState({
            currentSong: targetItem.song,
            queue: snapshot.items.map((i: any) => i.song),
            queueIndex: snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0,
            currentTime: 0,
            isPlaying: true,
            playbackIntent: 'PLAYING'
          });
          const { RaagaXNativePlayer } = await import('../playback/native/RaagaXNativePlayer');
          if (RaagaXNativePlayer.isNative()) {
            if (queueDelta > 0) await RaagaXNativePlayer.next();
            else await RaagaXNativePlayer.previous();
          } else {
            const { PlaybackService } = await import('@/lib/playback/PlaybackService');
            await PlaybackService.getInstance().playTrack(targetItem.song, true);
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
          rendererDeviceId: store.deviceId,
          songId: usePlayerStore.getState().currentSong?.id
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
   * Releases local renderer ownership, transitions source into controller mode, and flushes any post-commit intents.
   * NEVER calls disconnectFromDevice() — control connection stays alive!
   */
  public handleTransferCommitted(command: ConnectCommand) {
    if (this.activeTransitionId && command.transitionId && command.transitionId !== this.activeTransitionId) {
      console.warn(`[TransferManager] Mismatched transitionId in TRANSFER_COMMITTED: expected ${this.activeTransitionId}, got ${command.transitionId}`);
    }

    this.clearStageTimeout();
    this.recordTimeline('TRANSFER_COMPLETED', { targetDeviceId: command.sourceDeviceId });
    console.log(`[TransferManager] [TRANSFER ${command.transitionId || 'unknown'}] COMMITTED by target ${command.sourceDeviceId}. Relinquishing local renderer.`);

    // 1. Pause and release local audio engine
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

    this.recordTimeline('SOURCE_RELEASED');

    // 2. Source transitions to controller (keeping active connection alive)
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

    this.recordTimeline('ACTIVE_OWNER_CHANGED', { newOwnerId: command.sourceDeviceId });

    this.currentStage = 'COMPLETED';
    const targetDeviceId = command.sourceDeviceId;
    this.activeTransitionId = null;
    this.activeTransferContext = null;

    // 3. Flush any pending commands that arrived while commit was in-flight
    if (this.postCommitCommands.length > 0) {
      const commandsToFlush = [...this.postCommitCommands];
      this.postCommitCommands = [];
      console.log(`[TransferManager] Flushing ${commandsToFlush.length} post-commit user commands to target ${targetDeviceId}:`, commandsToFlush);
      
      // Dispatch commands sequentially to newly confirmed active renderer
      commandsToFlush.forEach((cmd) => {
        ConnectManager.getInstance().dispatchPlaybackCommand(cmd.action, {
          positionMs: cmd.positionMs,
          songData: cmd.songData
        }).catch((err) => {
          console.warn(`[TransferManager] Failed to dispatch post-commit ${cmd.action}:`, err);
        });
      });
    }
  }

  /**
   * Handles incoming ACK or legacy COMMAND_ACK messages.
   */
  public handleTransferAck(command: ConnectCommand) {
    const payload = command.payload as CommandAckPayload;
    this.recordTimeline('COMMAND_ACK', payload);
    if (payload?.status === 'APPLIED' || payload?.status === 'EXECUTED' || payload?.status === 'READY') {
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
    this.recordTimeline('TRANSFER_ROLLBACK', { reason: reason || 'Unknown' });
    console.warn(`[TransferManager] [TRANSFER ${transitionId || 'unknown'}] ROLLBACK (Reason: ${reason || 'Unknown'}): Source device retains active renderer.`);

    this.currentStage = 'ROLLED_BACK';
    this.activeTransitionId = null;
    this.activeTransferContext = null;
    this.postCommitCommands = [];

    usePlayerStore.setState({
      isActiveDevice: true,
      isTransferring: false,
      transferringDeviceId: null
    });
  }
}
