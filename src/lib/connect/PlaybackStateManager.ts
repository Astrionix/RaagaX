import { PlaybackState } from './types';
import { TransportManager } from './TransportManager';
import { DeviceIdentityManager } from './DeviceIdentityManager';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackService } from '@/lib/playback/PlaybackService';

export class PlaybackStateManager {
  private static instance: PlaybackStateManager;
  private currentState: PlaybackState;
  private latestReceivedStateVersion: number = 0;
  private subscribers: Set<(state: PlaybackState) => void> = new Set();
  private heartbeatInterval: any = null;
  private lastGetStateCallback: (() => Partial<PlaybackState>) | null = null;

  private constructor() {
    const self = DeviceIdentityManager.getInstance().getDevice();
    this.currentState = {
      playerDeviceId: self.deviceId,
      track: null,
      positionMs: 0,
      durationMs: 0,
      isPlaying: false,
      volume: 100,
      shuffle: false,
      repeat: 'OFF',
      stateVersion: 1,
      updatedAt: Date.now(),
    };

    this.bindTransport();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          const store = usePlayerStore.getState();
          if (!store.isLocalPlayback) {
            this.requestPlaybackSync();
          }
        }
      });
    }
  }

  public static getInstance(): PlaybackStateManager {
    if (!PlaybackStateManager.instance) {
      PlaybackStateManager.instance = new PlaybackStateManager();
    }
    return PlaybackStateManager.instance;
  }

  private bindTransport(): void {
    TransportManager.getInstance().onMessage((event, payload) => {
      if (event === 'PLAYBACK_STATE_UPDATE') {
        this.handleRemoteStateUpdate(payload as PlaybackState);
      } else if (event === 'REQUEST_PLAYBACK_SYNC') {
        // If this device is the active local speaker, answer the request immediately
        const self = DeviceIdentityManager.getInstance().getDevice();
        if (this.currentState.playerDeviceId === self.deviceId && usePlayerStore.getState().isLocalPlayback) {
          this.syncNow();
        }
      }
    });
  }

  // Request latest playback state from remote player immediately upon connecting
  public requestPlaybackSync(): void {
    TransportManager.getInstance().sendMessage('REQUEST_PLAYBACK_SYNC', {
      timestamp: Date.now(),
    }, '*');
  }

  // 1. Authoritative Player emits state change
  public emitLocalPlaybackState(partial: Partial<PlaybackState>): void {
    const store = usePlayerStore.getState();
    const self = DeviceIdentityManager.getInstance().getDevice();

    // CONNECT RULE: Only the true authoritative local speaker may emit playback state.
    // Controllers or idle devices must NEVER broadcast claiming playerDeviceId.
    if (!store.isLocalPlayback) {
      return;
    }

    // Do not emit if no song has ever been loaded
    if (!store.currentSong && !partial.track && !this.currentState.track) {
      return;
    }

    this.currentState = {
      ...this.currentState,
      ...partial,
      playerDeviceId: self.deviceId,
      stateVersion: this.currentState.stateVersion + 1,
      updatedAt: Date.now(),
    };

    TransportManager.getInstance().sendMessage('PLAYBACK_STATE_UPDATE', this.currentState, '*');
    this.notify();
  }

  // Trigger instantaneous sync using the active state callback
  public syncNow(): void {
    const store = usePlayerStore.getState();
    if (!store.isLocalPlayback) {
      return;
    }
    if (this.lastGetStateCallback) {
      const live = this.lastGetStateCallback();
      this.emitLocalPlaybackState(live);
    } else {
      this.emitLocalPlaybackState({});
    }
  }

  public updateLocalSnapshot(partial: Partial<PlaybackState>): void {
    this.currentState = {
      ...this.currentState,
      ...partial,
      updatedAt: Date.now(),
    };
    this.notify();
  }

  // 2. Controller receives state from authoritative Player
  private handleRemoteStateUpdate(remoteState: PlaybackState): void {
    const self = DeviceIdentityManager.getInstance().getDevice();
    // Do not process our own broadcast
    if (remoteState.playerDeviceId === self.deviceId) {
      return;
    }

    // Monotonic stateVersion rejection: only reject if strictly older packet from the same player
    if (
      this.currentState.playerDeviceId === remoteState.playerDeviceId &&
      typeof remoteState.stateVersion === 'number' &&
      typeof this.latestReceivedStateVersion === 'number' &&
      this.latestReceivedStateVersion > 0 &&
      remoteState.stateVersion < this.latestReceivedStateVersion
    ) {
      return;
    }

    this.latestReceivedStateVersion = remoteState.stateVersion || 0;
    this.currentState = { ...remoteState };
    this.notify();
  }

  // 3. Heartbeat for authoritative player to keep scrubbers synchronized
  public startHeartbeat(getStateCallback: () => Partial<PlaybackState>): void {
    this.stopHeartbeat();
    this.lastGetStateCallback = getStateCallback;

    // Only broadcast initial state if this device is actively playing locally
    const store = usePlayerStore.getState();
    const initial = getStateCallback();
    if (store.isLocalPlayback && (initial.isPlaying || store.isPlaying)) {
      this.emitLocalPlaybackState(initial);
    }

    this.heartbeatInterval = setInterval(() => {
      const currentStore = usePlayerStore.getState();
      // CRITICAL: Only the device that is ACTUALLY the authoritative local speaker
      // can emit heartbeats! Controllers must NEVER broadcast heartbeats claiming to be the player!
      if (!currentStore.isLocalPlayback) {
        return;
      }

      if (!currentStore.currentSong) {
        return;
      }

      const live = getStateCallback();
      this.emitLocalPlaybackState(live);
    }, 3000);
  }

  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public getCurrentState(): PlaybackState {
    return { ...this.currentState };
  }

  public subscribe(callback: (state: PlaybackState) => void): () => void {
    this.subscribers.add(callback);
    callback(this.currentState);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    const s = { ...this.currentState };
    this.subscribers.forEach((cb) => cb(s));
  }
}
