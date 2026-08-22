'use client';

import { 
  LANPlaybackStatePayload, 
  LANPlaybackStateMessage, 
  LANRemoteCommandMessage 
} from './types';
import { usePlayerStore } from '@/context/usePlayerStore';
import { DirectLANTransport } from './DirectLANTransport';
import { LocalDiscoveryService } from './LocalDiscoveryService';
import { PlaybackOwnerEngine } from './PlaybackOwnerEngine';

export class RemoteControlClient {
  private static instance: RemoteControlClient;
  private currentOwnerState: LANPlaybackStatePayload | null = null;
  private positionTicker: NodeJS.Timeout | null = null;

  private constructor() {
    DirectLANTransport.getInstance().onMessage((msg) => {
      if (msg.type === 'PLAYBACK_STATE') {
        this.handlePlaybackStateUpdate(msg as LANPlaybackStateMessage);
      }
    });

    this.startPositionTicker();
  }

  public static getInstance(): RemoteControlClient {
    if (!RemoteControlClient.instance) {
      RemoteControlClient.instance = new RemoteControlClient();
    }
    return RemoteControlClient.instance;
  }

  public sendCommand(
    type: LANRemoteCommandMessage['type'],
    payload?: LANRemoteCommandMessage['payload']
  ) {
    const ownerId = PlaybackOwnerEngine.getInstance().getActiveOwnerId();
    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;

    const cmdMsg: LANRemoteCommandMessage = {
      id: 'cmd_' + Math.random().toString(36).substring(2, 10),
      type,
      sourceDeviceId: localId,
      targetDeviceId: ownerId,
      commandId: 'c_' + Date.now(),
      expectedStateVersion: this.currentOwnerState?.stateVersion,
      payload,
      timestamp: Date.now(),
    };

    DirectLANTransport.getInstance().sendMessage(ownerId, cmdMsg);
  }

  public handlePlaybackStateUpdate(msg: LANPlaybackStateMessage) {
    const payload = msg.payload;
    if (!payload) return;

    // Ignore if this device is the local owner (owner is authoritative)
    if (PlaybackOwnerEngine.getInstance().isOwner()) return;

    // Ignore older or out-of-order state versions
    if (this.currentOwnerState && payload.stateVersion < this.currentOwnerState.stateVersion) {
      return;
    }

    this.currentOwnerState = payload;

    // Extrapolate position accurately
    const now = Date.now();
    const elapsedSec = payload.isPlaying ? (now - payload.timestamp) / 1000 * payload.playbackRate : 0;
    const currentSec = Math.min((payload.durationMs / 1000) || 0, (payload.positionMs / 1000) + elapsedSec);

    // Sync into player store as remote controller
    usePlayerStore.setState({
      activeDeviceId: payload.ownerDeviceId,
      connectedDeviceId: payload.ownerDeviceId,
      isActiveDevice: false,
      currentSong: payload.song,
      isPlaying: payload.isPlaying,
      currentTime: currentSec,
      duration: payload.durationMs ? payload.durationMs / 1000 : 0,
      queue: payload.queue || [],
      queueIndex: payload.queueIndex || 0,
      volume: payload.volume,
      isMuted: payload.isMuted,
      shuffleMode: (payload.shuffleMode as any) || 'OFF',
      repeatMode: (payload.repeatMode as any) || 'OFF',
    });
  }

  public getEstimatedPositionMs(): number {
    if (!this.currentOwnerState) return 0;
    if (!this.currentOwnerState.isPlaying) return this.currentOwnerState.positionMs;

    const elapsed = (Date.now() - this.currentOwnerState.timestamp) * this.currentOwnerState.playbackRate;
    return Math.min(this.currentOwnerState.durationMs, this.currentOwnerState.positionMs + elapsed);
  }

  private startPositionTicker() {
    this.positionTicker = setInterval(() => {
      // Only tick position if this device is a controller and remote owner is playing
      if (PlaybackOwnerEngine.getInstance().isOwner() || !this.currentOwnerState?.isPlaying) {
        return;
      }

      const estMs = this.getEstimatedPositionMs();
      usePlayerStore.setState({ currentTime: estMs / 1000 });
    }, 1000);
  }
}
