import { ConnectCommand } from './types';
import { CommandValidator } from './CommandValidator';
import { CommandSequencer } from './CommandSequencer';
import { PlaybackEngine } from '../playback/PlaybackEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { QueueManager } from '@/lib/queue/QueueManager';
import { ClockSynchronizer } from './ClockSynchronizer';
import { usePlayerStore } from '@/context/usePlayerStore';
import { TransferManager } from './TransferManager';
import { CommandObservabilityStore } from './CommandObservabilityStore';

export class CommandBus {
  private static instance: CommandBus;
  private validator = CommandValidator.getInstance();
  private localDeviceId: string | null = null;
  private sessionId: string | null = null;
  private signalListeners: Set<(command: ConnectCommand) => void> = new Set();
  private processedCommandIds: Map<string, number> = new Map();

  public subscribeToSignals(listener: (command: ConnectCommand) => void): () => void {
    this.signalListeners.add(listener);
    return () => this.signalListeners.delete(listener);
  }

  private constructor() {}

  public static getInstance(): CommandBus {
    if (!CommandBus.instance) {
      CommandBus.instance = new CommandBus();
    }
    return CommandBus.instance;
  }

  public init(localDeviceId: string, sessionId: string) {
    this.localDeviceId = localDeviceId;
    this.sessionId = sessionId;
  }

  public reset() {
    this.localDeviceId = null;
    this.sessionId = null;
    this.processedCommandIds.clear();
  }

  public async dispatch(command: ConnectCommand) {
    const { ConnectManager } = await import('./ConnectManager');
    const connectManager = ConnectManager.getInstance();

    // Record command entry for observability before dispatch
    const { ConnectivityRouter } = await import('./ConnectivityRouter');
    CommandObservabilityStore.getInstance().record({
      commandId: command.commandId,
      type: command.type,
      sourceDeviceId: command.sourceDeviceId,
      targetDeviceId: command.targetDeviceId,
      transport: ConnectivityRouter.getInstance().getActiveTransport(),
      sentAt: command.sentAt || Date.now(),
    });
    
    if (command.targetDeviceId) {
      await connectManager.sendTargetedCommand(command.targetDeviceId, command);
    } else {
      await connectManager.sendSessionCommand(command);
    }
  }

  public handleIncomingCommand(command: ConnectCommand) {
    const store = usePlayerStore.getState();
    const localId = this.localDeviceId || store.deviceId;
    const sequencer = CommandSequencer.getInstance();
    
    // Ignore loopback broadcasts sent by this device itself
    if (command.sourceDeviceId && command.sourceDeviceId === localId) {
      return;
    }

    if (command.type === 'WEBRTC_SIGNAL') {
      this.signalListeners.forEach((listener) => {
        try {
          listener(command);
        } catch (e) {
          console.error('[CommandBus] Signal listener error:', e);
        }
      });
      return;
    }

    if (!this.validator.validate(command)) return;

    // Idempotency: Ignore already processed commands
    if (command.commandId) {
      const now = Date.now();
      if (this.processedCommandIds.has(command.commandId)) {
        console.log(`[CommandBus] Duplicate command suppressed: ${command.type} (${command.commandId})`);
        if (store.isActiveDevice && command.type !== 'COMMAND_ACK' && command.sourceDeviceId) {
          const ackPayload = {
            commandId: command.commandId,
            status: 'APPLIED',
            epoch: sequencer.getEpoch()
          };
          const ackCommand: ConnectCommand = {
            commandId: crypto.randomUUID(),
            sessionId: command.sessionId,
            epoch: sequencer.getEpoch(),
            sequence: sequencer.nextSequence(),
            sourceDeviceId: store.deviceId,
            targetDeviceId: command.sourceDeviceId,
            type: 'COMMAND_ACK',
            sentAt: Date.now(),
            payload: ackPayload
          };
          import('./ConnectManager').then(({ ConnectManager }) => {
            ConnectManager.getInstance().sendTargetedCommand(command.sourceDeviceId!, ackCommand);
          });
        }
        return;
      }
      this.processedCommandIds.set(command.commandId, now);
      if (this.processedCommandIds.size > 200) {
        const cutoff = now - 30000;
        for (const [id, time] of this.processedCommandIds.entries()) {
          if (time < cutoff) this.processedCommandIds.delete(id);
        }
      }
    }

    this.applyCommand(command);

    // Automatically send COMMAND_ACK back to the sender if we are the active renderer device (exclude transfer protocol control commands)
    if (store.isActiveDevice && command.type !== 'COMMAND_ACK' && !command.type.startsWith('TRANSFER_')) {
      const ackPayload = {
        commandId: command.commandId,
        status: 'APPLIED',
        epoch: sequencer.getEpoch()
      };
      const ackCommand: ConnectCommand = {
        commandId: crypto.randomUUID(),
        sessionId: command.sessionId,
        epoch: sequencer.getEpoch(),
        sequence: sequencer.nextSequence(),
        sourceDeviceId: store.deviceId,
        targetDeviceId: command.sourceDeviceId,
        type: 'COMMAND_ACK',
        sentAt: Date.now(),
        payload: ackPayload
      };
      import('./ConnectManager').then(({ ConnectManager }) => {
        ConnectManager.getInstance().sendTargetedCommand(command.sourceDeviceId, ackCommand);
      });
    }
  }

  private async applyCommand(command: ConnectCommand) {
    console.log(`[CommandBus] Applying command: ${command.type}`);
    const engine = PlaybackEngine.getInstance();
    const store = usePlayerStore.getState();
    const clock = ClockSynchronizer.getInstance();

    switch (command.type) {
      case 'PLAY': {
        const p = (command.payload || {}) as any;
        const songData = p.songData;
        const queue = p.queue;
        const queueIndex = p.queueIndex;

        let targetMs = p.positionMs || 0;
        if (p.serverTimestamp && typeof p.serverTimestamp === 'number') {
          const estimatedNow = clock.getEstimatedServerNow();
          const drift = estimatedNow - p.serverTimestamp;
          targetMs = Math.max(0, targetMs + drift);
        }

        if (songData) {
          // If already playing this exact song and no force seek requested, ignore duplicate PLAY
          if (store.isPlaying && store.currentSong?.id === songData.id && Math.abs(store.currentTime * 1000 - targetMs) < 1500) {
            console.log(`[CommandBus] Already playing song ${songData.id}, duplicate PLAY ignored`);
            break;
          }

          const manager = QueueManager.getInstance();
          if (queue && queue.length > 0) {
            const idx = typeof queueIndex === 'number' ? queueIndex : 0;
            manager.replaceQueue(queue, idx, 'PLAYLIST');
          } else {
            manager.playNow(songData);
          }
          
          const snapshot = manager.getSnapshot();
          const syncedQueue = snapshot.items.map((i: any) => i.song);
          const syncedIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0;

          usePlayerStore.setState({
            currentSong: songData,
            currentTime: targetMs / 1000,
            queue: syncedQueue.length > 0 ? syncedQueue : store.queue,
            queueIndex: syncedIndex,
            isPlaying: true,
            playbackIntent: 'PLAYING'
          });

          if (store.isActiveDevice) {
            PlaybackService.getInstance().playTrack(songData, true).then(() => {
              if (targetMs > 0) {
                PlaybackService.getInstance().seek(targetMs / 1000, true);
              }
              import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
                PlaybackStateSync.getInstance().broadcastState(true);
              });
            });
          }
        } else {
          // Resuming existing playback
          if (store.isPlaying) {
            console.log(`[CommandBus] Already playing, redundant PLAY ignored`);
            break;
          }

          if (store.isActiveDevice) {
            if (targetMs > 0) PlaybackService.getInstance().seek(targetMs / 1000, true);
            import('../playback/native/RaagaXNativePlayer').then(({ RaagaXNativePlayer }) => {
              if (RaagaXNativePlayer.isNative()) {
                RaagaXNativePlayer.resume();
              } else {
                PlaybackService.getInstance().play();
              }
            });
            import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
              PlaybackStateSync.getInstance().broadcastState(true);
            });
          }
          store.setIsPlaying(true, true);
        }
        break;
      }

      case 'PAUSE':
        if (!store.isPlaying) {
          console.log(`[CommandBus] Already paused, redundant PAUSE ignored`);
          break;
        }

        if (store.isActiveDevice) {
          import('../playback/native/RaagaXNativePlayer').then(({ RaagaXNativePlayer }) => {
            if (RaagaXNativePlayer.isNative()) {
              RaagaXNativePlayer.pause();
            } else {
              PlaybackService.getInstance().pause();
            }
          });
          import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
            PlaybackStateSync.getInstance().broadcastState(true);
          });
        }
        store.setIsPlaying(false, true);
        break;

      case 'NEXT': {
        // AUTHORITATIVE OWNER ONLY: Non-owner controllers must NOT advance local queue.
        // They will receive the authoritative track metadata via PLAYBACK_STATE broadcast from the owner.
        const isOwner = store.isActiveDevice && !store.connectedDeviceId;
        if (!isOwner) {
          console.log('[CommandBus] NEXT received on non-owner controller — skipping local queue advance, awaiting owner PLAYBACK_STATE');
          break;
        }
        const manager = QueueManager.getInstance();
        const nextItem = manager.getNext(false);
        if (nextItem && nextItem.song) {
          const snapshot = manager.getSnapshot();
          // Immediately apply the full authoritative track metadata (title, artist, cover, duration, position)
          usePlayerStore.setState({
            currentSong: { ...nextItem.song },
            queue: snapshot.items.map((i: any) => i.song),
            queueIndex: snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0,
            isPlaying: true,
            playbackIntent: 'PLAYING',
            currentTime: 0
          });
          import('../playback/native/RaagaXNativePlayer').then(async ({ RaagaXNativePlayer }) => {
            if (RaagaXNativePlayer.isNative()) {
              await RaagaXNativePlayer.next();
            } else {
              await PlaybackService.getInstance().playTrack(nextItem.song, true);
            }
            // Broadcast the complete authoritative state so all controllers atomically update
            import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
              PlaybackStateSync.getInstance().broadcastState(true);
            });
          });
        }
        break;
      }

      case 'PREV': {
        // AUTHORITATIVE OWNER ONLY: Non-owner controllers must NOT advance local queue.
        // They will receive the authoritative track metadata via PLAYBACK_STATE broadcast from the owner.
        const isOwner = store.isActiveDevice && !store.connectedDeviceId;
        if (!isOwner) {
          console.log('[CommandBus] PREV received on non-owner controller — skipping local queue advance, awaiting owner PLAYBACK_STATE');
          break;
        }
        const manager = QueueManager.getInstance();
        const prevItem = manager.getPrevious();
        if (prevItem && prevItem.song) {
          const snapshot = manager.getSnapshot();
          // Immediately apply the full authoritative track metadata (title, artist, cover, duration, position)
          usePlayerStore.setState({
            currentSong: { ...prevItem.song },
            queue: snapshot.items.map((i: any) => i.song),
            queueIndex: snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0,
            isPlaying: true,
            playbackIntent: 'PLAYING',
            currentTime: 0
          });
          import('../playback/native/RaagaXNativePlayer').then(async ({ RaagaXNativePlayer }) => {
            if (RaagaXNativePlayer.isNative()) {
              await RaagaXNativePlayer.previous();
            } else {
              await PlaybackService.getInstance().playTrack(prevItem.song, true);
            }
            // Broadcast the complete authoritative state so all controllers atomically update
            import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
              PlaybackStateSync.getInstance().broadcastState(true);
            });
          });
        }
        break;
      }

      case 'SEEK':
        if (command.payload && typeof command.payload === 'object' && 'positionMs' in command.payload) {
          const p = command.payload as { positionMs: number; songId?: string };
          
          // Cross-Song Seek Validation: if songId is specified and doesn't match current active song, reject seek
          if (p.songId && store.currentSong?.id && p.songId !== store.currentSong.id) {
            console.warn(`[CommandBus] Rejected cross-song SEEK: command songId ${p.songId} !== current songId ${store.currentSong.id}`);
            break;
          }

          // Snapshot isPlaying BEFORE seeking — paused seek stays paused, playing seek stays playing
          const wasPlayingSeek = Boolean(store.isPlaying);
          store.setCurrentTime(p.positionMs / 1000, true);
          if (store.isActiveDevice) {
            PlaybackService.getInstance().seek(p.positionMs / 1000, true);
            // If was paused, re-pause explicitly (some audio engines auto-resume on seek)
            if (!wasPlayingSeek) {
              PlaybackService.getInstance().pause();
            }
            // Immediately broadcast authoritative state so controller confirms the new position
            import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
              PlaybackStateSync.getInstance().broadcastState(true);
            });
          }
        }
        break;

      case 'SET_VOLUME':
        if (command.payload && typeof command.payload === 'object' && 'volume' in command.payload) {
          const p = command.payload as { volume: number };
          const safeVol = Math.max(0, Math.min(1, p.volume));
          store.setVolume(safeVol);
          if (store.isActiveDevice) {
            const activeAudio = PlaybackService.getInstance().getActiveAudio();
            if (activeAudio) activeAudio.volume = safeVol;
            import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
              PlaybackStateSync.getInstance().broadcastState(true);
            });
          }
        }
        break;

      case 'SET_SHUFFLE':
        if (command.payload && typeof command.payload === 'object' && 'shuffleMode' in command.payload) {
          const p = command.payload as { shuffleMode: string };
          const manager = QueueManager.getInstance();
          if (manager.getShuffleMode() !== p.shuffleMode) {
            await manager.setShuffleMode(p.shuffleMode as any);
          }
          if (store.isActiveDevice) {
            import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
              PlaybackStateSync.getInstance().broadcastState(true);
            });
          }
        }
        break;

      case 'SET_REPEAT':
        if (command.payload && typeof command.payload === 'object' && 'repeatMode' in command.payload) {
          const p = command.payload as { repeatMode: string };
          QueueManager.getInstance().setRepeatMode(p.repeatMode as any);
          if (store.isActiveDevice) {
            import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
              PlaybackStateSync.getInstance().broadcastState(true);
            });
          }
        }
        break;
        
      case 'TRANSFER_REQUEST': {
        const storeDeviceId = usePlayerStore.getState().deviceId;
        if (command.sourceDeviceId === storeDeviceId) {
          console.log(`[CommandBus] TRANSFER_SKIPPED_CURRENT_DEVICE: ignoring loopback TRANSFER_REQUEST from self (${storeDeviceId})`);
          break;
        }
        if (!command.targetDeviceId || command.targetDeviceId === this.localDeviceId || command.targetDeviceId === storeDeviceId) {
           console.log(`[CommandBus] Received TRANSFER_REQUEST for this device (${storeDeviceId || this.localDeviceId})`);
           TransferManager.getInstance().handleIncomingTransferRequest(command);
        } else {
           console.log(`[CommandBus] Ignoring TRANSFER_REQUEST targeted to ${command.targetDeviceId} (this device: ${storeDeviceId})`);
        }
        break;
      }

      case 'TRANSFER_ACCEPTED': {
        console.log(`[CommandBus] Received TRANSFER_ACCEPTED for transition: ${command.transitionId}`);
        TransferManager.getInstance().handleTransferAccepted(command);
        break;
      }

      case 'TRANSFER_READY': {
        console.log(`[CommandBus] Received TRANSFER_READY for transition: ${command.transitionId}`);
        TransferManager.getInstance().handleTransferReady(command);
        break;
      }

      case 'TRANSFER_COMMIT': {
        const storeDeviceId = usePlayerStore.getState().deviceId;
        if (command.sourceDeviceId === storeDeviceId) {
          console.log(`[CommandBus] TRANSFER_SKIPPED_CURRENT_DEVICE: ignoring loopback TRANSFER_COMMIT from self (${storeDeviceId})`);
          break;
        }
        if (!command.targetDeviceId || command.targetDeviceId === this.localDeviceId || command.targetDeviceId === storeDeviceId) {
          console.log(`[CommandBus] Received TRANSFER_COMMIT for this device (${storeDeviceId || this.localDeviceId})`);
          TransferManager.getInstance().handleIncomingTransferCommit(command);
        }
        break;
      }

      case 'TRANSFER_COMMITTED': {
        console.log(`[CommandBus] Received TRANSFER_COMMITTED for transition: ${command.transitionId}`);
        TransferManager.getInstance().handleTransferCommitted(command);
        break;
      }

      case 'TRANSFER_ROLLBACK': {
        console.log(`[CommandBus] Received TRANSFER_ROLLBACK for transition: ${command.transitionId}`);
        TransferManager.getInstance().handleTransferRollback(command.transitionId, (command.payload as any)?.reason);
        break;
      }
        
      case 'COMMAND_ACK':
        console.log('[CommandBus] Received ACK:', command.payload);
        if (command.payload && typeof command.payload === 'object' && 'transitionId' in command.payload && (command.payload as any).transitionId) {
          TransferManager.getInstance().handleTransferAck(command);
        }
        import('./ConnectManager').then(({ ConnectManager }) => {
          ConnectManager.getInstance().handleCommandAck(command.payload);
        });
        break;

      default:
        console.warn(`[CommandBus] Unhandled command type: ${command.type}`);
    }
  }
}
