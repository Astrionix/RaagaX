import { usePlayerStore } from '@/context/usePlayerStore';
import { DeviceSyncManager } from '@/lib/sync/DeviceSyncManager';
import { Song, RepeatMode, Device } from '@/types/music';

/**
 * PlaybackController is the unified facade for all RaagaX Connect APIs.
 * It abstracts the logic of whether the current instance is the Active Device
 * (executing locally) or a Remote Controller (dispatching via Supabase Realtime).
 */
export class PlaybackController {
  private static instance: PlaybackController;
  private syncManager = DeviceSyncManager.getInstance();

  private constructor() {}

  public static getInstance(): PlaybackController {
    if (!PlaybackController.instance) {
      PlaybackController.instance = new PlaybackController();
    }
    return PlaybackController.instance;
  }

  // ==========================================
  // Playback Functions
  // ==========================================

  public play() {
    const store = usePlayerStore.getState();
    if (store.isActiveDevice) {
      store.setIsPlaying(true);
    } else {
      this.syncManager.dispatchCommand({ type: 'PLAY' });
    }
  }

  public pause() {
    const store = usePlayerStore.getState();
    if (store.isActiveDevice) {
      store.setIsPlaying(false);
    } else {
      this.syncManager.dispatchCommand({ type: 'PAUSE' });
    }
  }

  public togglePlayPause() {
    const store = usePlayerStore.getState();
    if (store.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public next() {
    const store = usePlayerStore.getState();
    if (store.isActiveDevice) {
      store.playNext();
    } else {
      this.syncManager.dispatchCommand({ type: 'NEXT' });
    }
  }

  public previous() {
    const store = usePlayerStore.getState();
    if (store.isActiveDevice) {
      store.playPrev();
    } else {
      this.syncManager.dispatchCommand({ type: 'PREV' });
    }
  }

  public seek(positionMs: number) {
    const store = usePlayerStore.getState();
    const positionSec = positionMs / 1000;
    if (store.isActiveDevice) {
      store.setCurrentTime(positionSec, true);
    } else {
      // Optimistic UI
      store.setRemoteState({ currentTime: positionSec });
      this.syncManager.dispatchCommand({ type: 'SEEK', position: positionSec });
    }
  }

  public setVolume(percent: number) {
    const store = usePlayerStore.getState();
    if (store.isActiveDevice) {
      store.setVolume(percent);
    } else {
      this.syncManager.dispatchCommand({ type: 'SET_VOLUME', percent });
    }
  }

  public setShuffle(enabled: boolean) {
    const store = usePlayerStore.getState();
    if (store.isActiveDevice) {
      store.setRemoteState({ isShuffle: enabled });
    } else {
      store.setRemoteState({ isShuffle: enabled }); // Optimistic UI
      this.syncManager.dispatchCommand({ type: 'SET_SHUFFLE', enabled });
    }
  }

  public setRepeat(mode: RepeatMode) {
    const store = usePlayerStore.getState();
    if (store.isActiveDevice) {
      store.setRemoteState({ repeatMode: mode });
    } else {
      store.setRemoteState({ repeatMode: mode }); // Optimistic UI
      this.syncManager.dispatchCommand({ type: 'SET_REPEAT', mode });
    }
  }

  // ==========================================
  // Queue Functions
  // ==========================================

  public addToQueue(song: Song) {
    const store = usePlayerStore.getState();
    if (store.isActiveDevice) {
      store.addToQueue(song);
    } else {
      store.setRemoteState({ queue: [...store.queue, song] }); // Optimistic UI
      this.syncManager.dispatchCommand({ type: 'ADD_TO_QUEUE', song });
    }
  }

  public removeFromQueue(songId: string) {
    const store = usePlayerStore.getState();
    if (store.isActiveDevice) {
      store.removeFromQueue(songId);
    } else {
      store.setRemoteState({ queue: store.queue.filter(s => s.id !== songId) }); // Optimistic UI
      this.syncManager.dispatchCommand({ type: 'REMOVE_FROM_QUEUE', songId });
    }
  }

  public getQueue(): Song[] {
    return usePlayerStore.getState().queue;
  }

  // ==========================================
  // Transfer & Device Management
  // ==========================================

  public transferPlayback(targetDeviceId: string) {
    const store = usePlayerStore.getState();
    const currentDeviceId = this.syncManager.getDeviceId();
    const positionMs = store.currentTime * 1000;

    store.setRemoteState({ activeDeviceId: targetDeviceId, isActiveDevice: targetDeviceId === currentDeviceId });
    if (targetDeviceId !== currentDeviceId) {
      store.setIsPlaying(false, true); // Prevent local playback immediately
    }

    this.syncManager.dispatchCommand({ 
      type: 'TRANSFER', 
      fromDeviceId: currentDeviceId,
      toDeviceId: targetDeviceId, 
      positionMs 
    });
  }

  public getDevices(): { id: string; name: string }[] {
    return usePlayerStore.getState().onlineDevices;
  }

  public getPlaybackState() {
    const store = usePlayerStore.getState();
    return {
      currentSong: store.currentSong,
      currentTime: store.currentTime,
      isPlaying: store.isPlaying,
      queue: store.queue,
      queueIndex: store.queueIndex,
      isShuffle: store.isShuffle,
      repeatMode: store.repeatMode,
      activeDeviceId: store.activeDeviceId,
    };
  }
}

export const connectAPI = PlaybackController.getInstance();
