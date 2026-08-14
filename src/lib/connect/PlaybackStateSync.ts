import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { CommandSequencer } from './CommandSequencer';
import { DeviceRegistry } from './DeviceRegistry';
import { RaagaXNativePlayer } from '../playback/native/RaagaXNativePlayer';
import { PlaybackService } from '../playback/PlaybackService';
import { SeekLock } from '../playback/SeekLock';

export interface RemotePlaybackState {
  activeDeviceId: string;
  activeDeviceName: string;
  songId: string | null;
  songData: Song | null;
  isPlaying: boolean;
  isBuffering?: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  isMuted: boolean;
  queue: Song[];
  queueIndex: number;
  shuffleMode?: string;
  repeatMode?: string;
  serverTimestamp: number;
  epoch: number;
  revision?: number;
}

export class PlaybackStateSync {
  private static instance: PlaybackStateSync;
  private lastPublishTime: number = 0;
  private publishTimer: NodeJS.Timeout | null = null;

  // Optimistic command shielding to eliminate remote state feedback loops
  private lastSentCommand: string | null = null;
  private lastSentCommandTime: number = 0;
  private lastSentSongId: string | null = null;
  private lastSentQueueIndex: number | null = null;

  private constructor() {}

  public static getInstance(): PlaybackStateSync {
    if (!PlaybackStateSync.instance) {
      PlaybackStateSync.instance = new PlaybackStateSync();
    }
    return PlaybackStateSync.instance;
  }

  /**
   * Tracks a sent command to shield optimistic UI state from conflicting incoming updates.
   */
  public recordSentCommand(type: string, songId: string | null = null, queueIndex: number | null = null) {
    this.lastSentCommand = type;
    this.lastSentCommandTime = Date.now();
    this.lastSentSongId = songId;
    this.lastSentQueueIndex = queueIndex;
    console.log(`[PlaybackStateSync] Shielding enabled for command ${type} (songId=${songId}, queueIndex=${queueIndex})`);
  }

  /**
   * Broadcasts the authoritative playback state to all connected devices in the session.
   * Called only by the active renderer device.
   */
  public broadcastState(immediate: boolean = false) {
    const store = usePlayerStore.getState();
    if (!store.isActiveDevice) return; // Only active renderer broadcasts state

    const now = Date.now();
    if (!immediate && now - this.lastPublishTime < 1500) {
      // Throttle rapid time updates
      if (!this.publishTimer) {
        this.publishTimer = setTimeout(() => {
          this.publishTimer = null;
          this.broadcastState(true);
        }, 1500);
      }
      return;
    }

    if (this.publishTimer) {
      clearTimeout(this.publishTimer);
      this.publishTimer = null;
    }

    this.lastPublishTime = now;
    const sequencer = CommandSequencer.getInstance();
    const deviceName = typeof window !== 'undefined' ? (localStorage.getItem('raagax_device_name') || 'RaagaX Player') : 'RaagaX Player';

    const nextRevision = (store.localPlaybackRevision || 0) + 1;
    usePlayerStore.setState({ localPlaybackRevision: nextRevision });

    const payload: RemotePlaybackState = {
      activeDeviceId: store.deviceId,
      activeDeviceName: deviceName,
      songId: store.currentSong?.id || null,
      songData: store.currentSong || null,
      isPlaying: store.isPlaying,
      positionMs: Math.round(store.currentTime * 1000),
      durationMs: Math.round(store.duration * 1000),
      volume: store.volume,
      isMuted: store.isMuted,
      queue: store.queue || [],
      queueIndex: store.queueIndex || 0,
      shuffleMode: store.shuffleMode,
      repeatMode: store.repeatMode,
      serverTimestamp: now,
      epoch: sequencer.getEpoch(),
      revision: nextRevision,
    };

    import('./ConnectManager').then(({ ConnectManager }) => {
      ConnectManager.getInstance().broadcastSessionState(payload);
    });
  }

  /**
   * Handles incoming live playback state from the active renderer device.
   * Updates remote controller UI without starting local audio playback.
   */
  public handleRemoteStateUpdate(remoteState: RemotePlaybackState) {
    if (!remoteState || !remoteState.activeDeviceId) return;

    const store = usePlayerStore.getState();
    const localDeviceId = store.deviceId;

    // Ignore if sent by our own device
    if (remoteState.activeDeviceId === localDeviceId) return;

    // Epoch & Revision validation to filter out stale/out-of-order state snapshots
    const currentEpoch = CommandSequencer.getInstance().getEpoch();
    if (remoteState.epoch < currentEpoch) {
      console.log(`[PlaybackStateSync] Ignoring remote state with stale epoch ${remoteState.epoch} < current ${currentEpoch}`);
      return;
    }

    const lastRemoteRevision = store.lastReceivedPlaybackRevision || 0;
    const incomingRevision = remoteState.revision || 0;
    if (incomingRevision <= lastRemoteRevision && remoteState.epoch === currentEpoch && lastRemoteRevision > 0) {
      console.log(`[PlaybackStateSync] Ignoring stale remote state revision ${incomingRevision} <= last ${lastRemoteRevision}`);
      return;
    }

    // While the user is dragging the seekbar or seek is settling, suppress
    // incoming remote position updates so the thumb doesn't snap back mid-drag.
    if (SeekLock.shouldBlockRemoteUpdate) {
      console.log('[PlaybackStateSync] Suppressing remote position update — SeekLock active (user is seeking)');
      return;
    }

    // Apply command shielding to filter out delayed contradicting updates before target device updates
    const now = Date.now();
    if (this.lastSentCommand && now - this.lastSentCommandTime < 2500) {
      if (this.lastSentCommand === 'PLAY' || this.lastSentCommand === 'NEXT' || this.lastSentCommand === 'PREV') {
        const isSongMatched = !this.lastSentSongId || remoteState.songId === this.lastSentSongId;
        const isPlayingMatched = remoteState.isPlaying === true;
        if (isSongMatched && isPlayingMatched) {
          // Renderer has caught up to our optimistic state, clear shielding
          this.lastSentCommand = null;
          this.lastSentSongId = null;
          this.lastSentQueueIndex = null;
        } else {
          console.log(`[PlaybackStateSync] Shielding optimistic play/song state. Incoming: isPlaying=${remoteState.isPlaying}, songId=${remoteState.songId}. Kept local isPlaying=true, songId=${this.lastSentSongId}`);
          remoteState.isPlaying = true;
          if (this.lastSentSongId && store.currentSong && store.currentSong.id === this.lastSentSongId) {
            remoteState.songId = this.lastSentSongId;
            remoteState.songData = store.currentSong;
            if (this.lastSentQueueIndex !== null) {
              remoteState.queueIndex = this.lastSentQueueIndex;
            }
          }
        }
      } else if (this.lastSentCommand === 'PAUSE') {
        if (remoteState.isPlaying === false) {
          // Renderer has caught up to our optimistic state, clear shielding
          this.lastSentCommand = null;
        } else {
          console.log(`[PlaybackStateSync] Shielding optimistic pause state. Incoming: isPlaying=true. Kept local isPlaying=false`);
          remoteState.isPlaying = false;
        }
      } else if (this.lastSentCommand === 'SEEK') {
        const localTime = store.currentTime;
        const remoteTime = remoteState.positionMs / 1000;
        if (Math.abs(remoteTime - localTime) < 2) {
          // Renderer has caught up to our optimistic state, clear shielding
          this.lastSentCommand = null;
        } else {
          console.log(`[PlaybackStateSync] Shielding optimistic seek position. Incoming: pos=${remoteTime}s. Kept local pos=${localTime}s`);
          remoteState.positionMs = Math.round(localTime * 1000);
        }
      }
    }

    console.log(`[PlaybackStateSync] Received remote state from ${remoteState.activeDeviceName} (${remoteState.activeDeviceId}):`, {
      song: remoteState.songData?.title,
      isPlaying: remoteState.isPlaying,
      pos: (remoteState.positionMs / 1000).toFixed(1) + 's',
      revision: incomingRevision
    });

    // 1. HARD RULE: Controller MUST NOT output audio locally (silence local media elements without mutating store.isPlaying)
    if (RaagaXNativePlayer.isNative()) {
      RaagaXNativePlayer.pause().catch(() => {});
    } else {
      const active = PlaybackService.getInstance().getActiveAudio();
      if (active && !active.paused) {
        active.pause();
      }
    }

    // 2. Adopt remote state into local store for display in MiniPlayer / PlayerBar / SeekBar
    usePlayerStore.setState({
      isActiveDevice: false,
      activeDeviceId: remoteState.activeDeviceId,
      remoteDeviceName: remoteState.activeDeviceName,
      currentSong: remoteState.songData,
      currentTime: remoteState.positionMs / 1000,
      duration: remoteState.durationMs / 1000,
      isPlaying: remoteState.isPlaying,
      queue: remoteState.queue || [],
      queueIndex: remoteState.queueIndex || 0,
      shuffleMode: (remoteState.shuffleMode || 'OFF') as any,
      repeatMode: (remoteState.repeatMode || 'OFF') as any,
      volume: remoteState.volume ?? 0.8,
      isMuted: remoteState.isMuted ?? false,
      lastReceivedPlaybackRevision: incomingRevision,
    });

    // 3. Keep local QueueManager aligned with remote repeat and shuffle modes
    import('@/lib/queue/QueueManager').then(({ QueueManager }) => {
      const manager = QueueManager.getInstance();
      if (remoteState.repeatMode && manager.getRepeatMode() !== remoteState.repeatMode) {
        manager.setRepeatMode(remoteState.repeatMode as any);
      }
      if (remoteState.shuffleMode && manager.getShuffleMode() !== remoteState.shuffleMode) {
        manager.setShuffleMode(remoteState.shuffleMode as any);
      }
    }).catch(() => {});
  }
}
