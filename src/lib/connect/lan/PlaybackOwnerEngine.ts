'use client';

import { 
  LANPlaybackStatePayload, 
  LANPlaybackStateMessage, 
  LANRemoteCommandMessage 
} from './types';
import { usePlayerStore } from '@/context/usePlayerStore';
import { DirectLANTransport } from './DirectLANTransport';
import { ConnectAuthManager } from './ConnectAuthManager';
import { LocalDiscoveryService } from './LocalDiscoveryService';

export class PlaybackOwnerEngine {
  private static instance: PlaybackOwnerEngine;
  private stateVersion: number = 1;
  private activeOwnerDeviceId: string;
  private isLocalOwner: boolean = true;
  private broadcastThrottleTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.activeOwnerDeviceId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;

    // Listen for incoming commands from controllers
    DirectLANTransport.getInstance().onMessage((msg) => {
      if (msg.type.startsWith('CMD_')) {
        this.handleRemoteCommand(msg as LANRemoteCommandMessage);
      }
    });

    // Subscribe to store state changes to broadcast when this device is owner
    usePlayerStore.subscribe((state, prevState) => {
      // Synchronize ownership state dynamically
      if (state.isActiveDevice !== this.isLocalOwner) {
        this.isLocalOwner = Boolean(state.isActiveDevice);
      }
      if (state.activeDeviceId && state.activeDeviceId !== this.activeOwnerDeviceId) {
        this.activeOwnerDeviceId = state.activeDeviceId;
      }

      if (!this.isLocalOwner) return;

      const songChanged = state.currentSong?.id !== prevState.currentSong?.id;
      const playingChanged = state.isPlaying !== prevState.isPlaying;
      const queueChanged = state.queue.length !== prevState.queue.length || state.queueIndex !== prevState.queueIndex;
      const volumeChanged = state.volume !== prevState.volume || state.isMuted !== prevState.isMuted;
      const modesChanged = state.shuffleMode !== prevState.shuffleMode || state.repeatMode !== prevState.repeatMode;

      if (songChanged || playingChanged || queueChanged || volumeChanged || modesChanged) {
        this.stateVersion++;
        if (songChanged || queueChanged || playingChanged) {
          // Track, queue, and play/pause transitions must broadcast immediately without throttling
          this.broadcastStateImmediately();
        } else {
          this.scheduleStateBroadcast();
        }
      }
    });
  }

  public static getInstance(): PlaybackOwnerEngine {
    if (!PlaybackOwnerEngine.instance) {
      PlaybackOwnerEngine.instance = new PlaybackOwnerEngine();
    }
    return PlaybackOwnerEngine.instance;
  }

  public isOwner(): boolean {
    const s = usePlayerStore.getState();
    return Boolean(s.isActiveDevice && !s.connectedDeviceId);
  }

  public getActiveOwnerId(): string {
    const s = usePlayerStore.getState();
    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;
    return s.connectedDeviceId || s.activeDeviceId || this.activeOwnerDeviceId || localId;
  }

  public setOwner(deviceId: string, isLocal: boolean) {
    this.activeOwnerDeviceId = deviceId;
    this.isLocalOwner = isLocal;
    usePlayerStore.setState({
      isActiveDevice: isLocal,
      activeDeviceId: deviceId,
    });
  }

  public getStateSnapshot(): LANPlaybackStatePayload {
    const s = usePlayerStore.getState();
    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;

    return {
      ownerDeviceId: this.isLocalOwner ? localId : this.activeOwnerDeviceId,
      songId: s.currentSong?.id || null,
      song: s.currentSong ? { ...s.currentSong } : null,
      queue: s.queue ? [...s.queue] : [],
      queueIndex: s.queueIndex || 0,
      positionMs: Math.round((s.currentTime || 0) * 1000),
      durationMs: Math.round((s.duration || s.currentSong?.duration || 0) * 1000),
      isPlaying: Boolean(s.isPlaying),
      playbackRate: 1.0,
      volume: s.volume,
      isMuted: s.isMuted,
      shuffleMode: (s.shuffleMode as any) || 'OFF',
      repeatMode: (s.repeatMode as any) || 'OFF',
      stateVersion: this.stateVersion,
      timestamp: Date.now(),
    };
  }

  public broadcastStateImmediately() {
    if (this.broadcastThrottleTimer) {
      clearTimeout(this.broadcastThrottleTimer);
      this.broadcastThrottleTimer = null;
    }
    this.broadcastState();
  }

  public broadcastState() {
    if (!this.isLocalOwner) return;

    const payload = this.getStateSnapshot();
    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;

    const stateMsg: LANPlaybackStateMessage = {
      id: 'st_' + Math.random().toString(36).substring(2, 10),
      type: 'PLAYBACK_STATE',
      sourceDeviceId: localId,
      targetDeviceId: 'broadcast',
      payload,
      timestamp: Date.now(),
    };

    DirectLANTransport.getInstance().sendMessage('broadcast', stateMsg);
  }

  private scheduleStateBroadcast() {
    if (this.broadcastThrottleTimer) return;
    this.broadcastThrottleTimer = setTimeout(() => {
      this.broadcastThrottleTimer = null;
      this.broadcastState();
    }, 100);
  }

  public async handleRemoteCommand(cmd: LANRemoteCommandMessage) {
    // Only the authoritative owner executes player commands
    if (!this.isLocalOwner) {
      console.warn('[PlaybackOwnerEngine] Ignored command: this device is not the active playback owner');
      return;
    }

    // Verify sender authorization
    if (!ConnectAuthManager.getInstance().canControl(cmd.sourceDeviceId)) {
      console.warn(`[PlaybackOwnerEngine] Command ${cmd.type} rejected: sender ${cmd.sourceDeviceId} is not authorized for control`);
      return;
    }

    // Replay attack and timestamp check
    if (!ConnectAuthManager.getInstance().validateCommandSecurity(cmd)) {
      console.warn(`[PlaybackOwnerEngine] Command ${cmd.type} failed security replay validation`);
      return;
    }

    const receiveTimestamp = Date.now();
    console.log(`[PlaybackOwnerEngine] Executing authoritative command ${cmd.type} from ${cmd.sourceDeviceId}`);
    const store = usePlayerStore.getState();

    switch (cmd.type) {
      case 'CMD_PLAY':
        await store.setIsPlaying(true);
        break;

      case 'CMD_PAUSE':
        await store.setIsPlaying(false);
        break;

      case 'CMD_NEXT':
        await store.playNext();
        break;

      case 'CMD_PREV':
        await store.playPrev();
        break;

      case 'CMD_SEEK':
        if (cmd.payload?.positionMs !== undefined) {
          const seekSec = cmd.payload.positionMs / 1000;
          usePlayerStore.setState({ currentTime: seekSec });
          try {
            const { PlaybackService } = await import('@/lib/playback/PlaybackService');
            PlaybackService.getInstance().seek(seekSec);
          } catch {}
        }
        break;

      case 'CMD_VOLUME':
        if (cmd.payload?.volume !== undefined) {
          store.setVolume(cmd.payload.volume);
        }
        if (cmd.payload?.isMuted !== undefined && store.isMuted !== cmd.payload.isMuted) {
          store.toggleMute();
        }
        break;

      case 'CMD_SHUFFLE':
        store.toggleShuffle();
        break;

      case 'CMD_REPEAT':
        store.cycleRepeatMode();
        break;

      case 'CMD_LOAD_TRACK':
        if (cmd.payload?.song) {
          await store.playSong(cmd.payload.song, cmd.payload.queue || [cmd.payload.song]);
        }
        break;

      case 'CMD_QUEUE_CHANGE':
        if (cmd.payload?.queue) {
          usePlayerStore.setState({
            queue: cmd.payload.queue,
            queueIndex: cmd.payload.queueIndex ?? store.queueIndex,
          });
        }
        break;
    }

    const executeTimestamp = Date.now();
    this.stateVersion++;
    this.broadcastStateImmediately();

    // Send Authoritative Command ACK with round-trip telemetry
    try {
      DirectLANTransport.getInstance().sendMessage(cmd.sourceDeviceId, {
        id: 'ack_' + cmd.commandId,
        type: 'CMD_ACK',
        sourceDeviceId: this.activeOwnerDeviceId,
        targetDeviceId: cmd.sourceDeviceId,
        commandId: cmd.commandId,
        success: true,
        stateVersion: this.stateVersion,
        timing: {
          tapTimestamp: cmd.timing?.tapTimestamp,
          sendTimestamp: cmd.timing?.sendTimestamp || cmd.timestamp,
          receiveTimestamp,
          executeTimestamp,
          ackTimestamp: Date.now(),
        },
        timestamp: Date.now(),
      });
    } catch {}
  }
}
