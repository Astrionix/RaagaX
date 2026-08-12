import { PlayerCommand, PlayerCommandType, AdvanceReason } from './types';
import { QueueManager } from '../queue/QueueManager';
import { PlaybackService } from './PlaybackService';
import { RestrictionsEngine } from './RestrictionsEngine';
import { Song } from '@/types/music';

export class PlayerCommandBus {
  private static instance: PlayerCommandBus;
  private commandHistory: PlayerCommand[] = [];

  private constructor() {}

  public static getInstance(): PlayerCommandBus {
    if (!PlayerCommandBus.instance) {
      PlayerCommandBus.instance = new PlayerCommandBus();
    }
    return PlayerCommandBus.instance;
  }

  public createCommand<T = unknown>(
    type: PlayerCommandType,
    payload: T,
    origin?: 'HOME' | 'SEARCH' | 'ALBUM' | 'PLAYLIST' | 'RECOMMENDATION' | 'AUTOPLAY'
  ): PlayerCommand<T> {
    const manager = QueueManager.getInstance();
    const snapshot = manager.getSnapshot();

    return {
      commandId: crypto.randomUUID(),
      sessionId: snapshot.queueId || 'global-session',
      sessionCommandId: 'cmd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      sourceDeviceId: typeof window !== 'undefined' ? (localStorage.getItem('raagax_device_id') || 'local') : 'server',
      expectedQueueRevision: snapshot.revision,
      type,
      sentAt: Date.now(),
      playOrigin: origin || 'HOME',
      payload,
    };
  }

  public async executeCommand(command: PlayerCommand): Promise<{ success: boolean; reason?: string }> {
    const manager = QueueManager.getInstance();
    const snapshot = manager.getSnapshot();

    // 1. Validate Queue Revision if command specified expectedQueueRevision
    if (typeof command.expectedQueueRevision === 'number' && command.expectedQueueRevision < snapshot.revision) {
      console.warn(`[PlayerCommandBus] Rejected stale command ${command.type} (expected rev ${command.expectedQueueRevision} vs current rev ${snapshot.revision})`);
      return { success: false, reason: 'STALE_QUEUE_REVISION' };
    }

    // 2. Validate Restrictions
    const songs = snapshot.items.map(i => i.song);
    const restrictions = RestrictionsEngine.getInstance().evaluate({
      queueItems: songs,
      currentIndex: snapshot.currentIndex,
      isPlaying: true,
      isOffline: false,
    });

    if (command.type === 'SKIP_TO_NEXT' && restrictions.disallowSkipNext.length > 0) {
      console.warn('[PlayerCommandBus] Disallowed SKIP_TO_NEXT:', restrictions.disallowSkipNext);
      return { success: false, reason: restrictions.disallowSkipNext[0] };
    }

    if (command.type === 'SKIP_TO_PREV' && restrictions.disallowSkipPrev.length > 0) {
      console.warn('[PlayerCommandBus] Disallowed SKIP_TO_PREV:', restrictions.disallowSkipPrev);
      return { success: false, reason: restrictions.disallowSkipPrev[0] };
    }

    // 3. Dispatch Command
    this.commandHistory.push(command);
    if (this.commandHistory.length > 50) this.commandHistory.shift();

    switch (command.type) {
      case 'SKIP_TO_NEXT': {
        const advanceReason: AdvanceReason = (command.payload as any)?.reason || 'USER_NEXT';
        const nextItem = manager.getNext();
        if (nextItem?.song) {
          const newSnapshot = manager.getSnapshot();
          const newSongs = newSnapshot.items.map(i => i.song);
          const newIndex = newSnapshot.currentIndex >= 0 ? newSnapshot.currentIndex : 0;
          await PlaybackService.getInstance().loadQueueContext(newSongs, newIndex);
          await PlaybackService.getInstance().playTrack(nextItem.song, true);
          console.log(`[PlayerCommandBus] Executed SKIP_TO_NEXT (advanceReason=${advanceReason}):`, nextItem.song.title);
          return { success: true };
        }
        return { success: false, reason: 'NO_NEXT_TRACK' };
      }

      case 'SKIP_TO_PREV': {
        const prevItem = manager.getPrevious();
        if (prevItem?.song) {
          const newSnapshot = manager.getSnapshot();
          const newSongs = newSnapshot.items.map(i => i.song);
          const newIndex = newSnapshot.currentIndex >= 0 ? newSnapshot.currentIndex : 0;
          await PlaybackService.getInstance().loadQueueContext(newSongs, newIndex);
          await PlaybackService.getInstance().playTrack(prevItem.song, true);
          return { success: true };
        }
        return { success: false, reason: 'NO_PREV_TRACK' };
      }

      case 'SET_QUEUE': {
        const payload = command.payload as { songs: Song[]; startIndex?: number };
        if (payload?.songs) {
          manager.replaceQueue(payload.songs, payload.startIndex || 0);
          await PlaybackService.getInstance().loadQueueContext(payload.songs, payload.startIndex || 0);
          const firstSong = payload.songs[payload.startIndex || 0];
          if (firstSong) {
            await PlaybackService.getInstance().playTrack(firstSong, true);
          }
          return { success: true };
        }
        return { success: false, reason: 'INVALID_PAYLOAD' };
      }

      case 'ADD_TO_QUEUE': {
        const song = command.payload as Song;
        if (song) {
          manager.addToQueue(song);
          const newSnapshot = manager.getSnapshot();
          await PlaybackService.getInstance().loadQueueContext(newSnapshot.items.map(i => i.song), newSnapshot.currentIndex);
          return { success: true };
        }
        return { success: false, reason: 'INVALID_PAYLOAD' };
      }

      case 'PLAY_AS_NEXT': {
        const song = command.payload as Song;
        if (song) {
          manager.playNext(song);
          const newSnapshot = manager.getSnapshot();
          await PlaybackService.getInstance().loadQueueContext(newSnapshot.items.map(i => i.song), newSnapshot.currentIndex);
          return { success: true };
        }
        return { success: false, reason: 'INVALID_PAYLOAD' };
      }

      default:
        return { success: true };
    }
  }

  public getCommandHistory(): PlayerCommand[] {
    return [...this.commandHistory];
  }
}
