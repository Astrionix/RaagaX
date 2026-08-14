import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { CommandSequencer } from './CommandSequencer';
import { DeviceRegistry } from './DeviceRegistry';
import { RaagaXNativePlayer } from '../playback/native/RaagaXNativePlayer';
import { PlaybackService } from '../playback/PlaybackService';

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
  serverTimestamp: number;
  epoch: number;
}

export class PlaybackStateSync {
  private static instance: PlaybackStateSync;
  private lastPublishTime: number = 0;
  private publishTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): PlaybackStateSync {
    if (!PlaybackStateSync.instance) {
      PlaybackStateSync.instance = new PlaybackStateSync();
    }
    return PlaybackStateSync.instance;
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
      serverTimestamp: now,
      epoch: sequencer.getEpoch(),
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

    console.log(`[PlaybackStateSync] Received remote state from ${remoteState.activeDeviceName} (${remoteState.activeDeviceId}):`, {
      song: remoteState.songData?.title,
      isPlaying: remoteState.isPlaying,
      pos: (remoteState.positionMs / 1000).toFixed(1) + 's',
    });

    // 1. HARD RULE: Controller MUST NOT output audio locally
    if (RaagaXNativePlayer.isNative()) {
      RaagaXNativePlayer.pause().catch(() => {});
    } else {
      PlaybackService.getInstance().pause();
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
      volume: remoteState.volume ?? 0.8,
      isMuted: remoteState.isMuted ?? false,
    });
  }
}
