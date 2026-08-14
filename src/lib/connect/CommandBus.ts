import { ConnectCommand } from './types';
import { CommandValidator } from './CommandValidator';
import { ConnectManager } from './ConnectManager';
import { PlaybackEngine } from '../playback/PlaybackEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { QueueManager } from '@/lib/queue/QueueManager';
import { ClockSynchronizer } from './ClockSynchronizer';
import { usePlayerStore } from '@/context/usePlayerStore';
import { TransferManager } from './TransferManager';

export class CommandBus {
  private static instance: CommandBus;
  private validator = CommandValidator.getInstance();
  private localDeviceId: string | null = null;
  private sessionId: string | null = null;

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

  public async dispatch(command: ConnectCommand) {
    const connectManager = ConnectManager.getInstance();
    
    if (command.targetDeviceId) {
      await connectManager.sendTargetedCommand(command.targetDeviceId, command);
    } else {
      await connectManager.sendSessionCommand(command);
    }
  }

  public handleIncomingCommand(command: ConnectCommand) {
    if (!this.validator.validate(command)) return;

    this.applyCommand(command);
  }

  private applyCommand(command: ConnectCommand) {
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
            isPlaying: true
          });

          if (store.isActiveDevice) {
            PlaybackService.getInstance().playTrack(songData, true).then(() => {
              if (targetMs > 0) {
                engine.seekCanonical(targetMs);
              }
            });
          }
        } else {
          if (store.isActiveDevice) {
            if (targetMs > 0) engine.seekCanonical(targetMs);
            engine.play();
          }
          store.setIsPlaying(true, true);
        }
        break;
      }

      case 'PAUSE':
        if (store.isActiveDevice) {
          engine.pause();
        }
        store.setIsPlaying(false, true);
        break;

      case 'NEXT': {
        const manager = QueueManager.getInstance();
        const nextItem = manager.getNext(false);
        if (nextItem && nextItem.song) {
          const snapshot = manager.getSnapshot();
          usePlayerStore.setState({
            currentSong: nextItem.song,
            queue: snapshot.items.map((i: any) => i.song),
            queueIndex: snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0,
            isPlaying: true,
            currentTime: 0
          });
          if (store.isActiveDevice) {
            PlaybackService.getInstance().playTrack(nextItem.song, true);
          }
        }
        break;
      }

      case 'PREV': {
        const manager = QueueManager.getInstance();
        const prevItem = manager.getPrevious();
        if (prevItem && prevItem.song) {
          const snapshot = manager.getSnapshot();
          usePlayerStore.setState({
            currentSong: prevItem.song,
            queue: snapshot.items.map((i: any) => i.song),
            queueIndex: snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0,
            isPlaying: true,
            currentTime: 0
          });
          if (store.isActiveDevice) {
            PlaybackService.getInstance().playTrack(prevItem.song, true);
          }
        }
        break;
      }

      case 'SEEK':
        if (command.payload && typeof command.payload === 'object' && 'positionMs' in command.payload) {
          const p = command.payload as { positionMs: number };
          store.setCurrentTime(p.positionMs / 1000, true);
          if (store.isActiveDevice) {
            engine.seekCanonical(p.positionMs);
          }
        }
        break;

      case 'SET_VOLUME':
        if (command.payload && typeof command.payload === 'object' && 'volume' in command.payload) {
          const p = command.payload as { volume: number };
          store.setVolume(p.volume);
        }
        break;
        
      case 'TRANSFER_REQUEST': {
        const storeDeviceId = usePlayerStore.getState().deviceId;
        if (!command.targetDeviceId || command.targetDeviceId === this.localDeviceId || command.targetDeviceId === storeDeviceId) {
           console.log(`[CommandBus] Received TRANSFER_REQUEST for this device (${storeDeviceId || this.localDeviceId})`);
           TransferManager.getInstance().handleIncomingTransferRequest(command);
        } else {
           console.log(`[CommandBus] Ignoring TRANSFER_REQUEST targeted to ${command.targetDeviceId} (this device: ${storeDeviceId})`);
        }
        break;
      }
        
      case 'COMMAND_ACK':
        console.log('[CommandBus] Received ACK:', command.payload);
        TransferManager.getInstance().handleTransferAck(command);
        break;

      default:
        console.warn(`[CommandBus] Unhandled command type: ${command.type}`);
    }
  }
}
