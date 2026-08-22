'use client';

import { 
  LANPlaybackStatePayload, 
  LANPlaybackStateMessage, 
  LANRemoteCommandMessage,
  LANCommandAckMessage 
} from './types';
import { usePlayerStore } from '@/context/usePlayerStore';
import { DirectLANTransport } from './DirectLANTransport';
import { LocalDiscoveryService } from './LocalDiscoveryService';
import { PlaybackOwnerEngine } from './PlaybackOwnerEngine';
import { ConnectTelemetry } from './ConnectTelemetry';
import { MediaSessionManager } from '@/lib/playback/MediaSessionManager';

export class RemoteControlClient {
  private static instance: RemoteControlClient;
  private currentOwnerState: LANPlaybackStatePayload | null = null;
  private positionTicker: NodeJS.Timeout | null = null;
  private pendingCommands = new Map<string, { type: string; tapTimestamp: number }>();
  private sequenceCounter: number = 0;

  private constructor() {
    DirectLANTransport.getInstance().onMessage((msg) => {
      if (msg.type === 'PLAYBACK_STATE') {
        this.handlePlaybackStateUpdate(msg as LANPlaybackStateMessage);
      } else if (msg.type === 'CMD_ACK') {
        this.handleCommandAck(msg as LANCommandAckMessage);
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
    payload?: LANRemoteCommandMessage['payload'],
    tapTimestamp?: number
  ) {
    const tap = tapTimestamp || Date.now();
    const store = usePlayerStore.getState();
    const ownerId = store.connectedDeviceId || store.activeDeviceId || PlaybackOwnerEngine.getInstance().getActiveOwnerId();
    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;
    const commandId = 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    this.sequenceCounter++;

    // 1. Optimistic Local UI Execution for instant touch feel (0ms perceived latency)
    this.applyOptimisticUpdate(type, payload);

    // 2. Track pending command for telemetry reconciliation
    this.pendingCommands.set(commandId, { type, tapTimestamp: tap });

    // 3. Prepare Wire Message
    const cmdMsg: LANRemoteCommandMessage = {
      id: 'cmd_' + Math.random().toString(36).substring(2, 10),
      type,
      sourceDeviceId: localId,
      targetDeviceId: ownerId,
      commandId,
      sequence: this.sequenceCounter,
      expectedStateVersion: this.currentOwnerState?.stateVersion,
      timing: {
        tapTimestamp: tap,
        sendTimestamp: Date.now(),
      },
      payload,
      timestamp: Date.now(),
    };

    // 4. Send directly over LAN transport
    DirectLANTransport.getInstance().sendMessage(ownerId, cmdMsg);
  }

  private applyOptimisticUpdate(type: LANRemoteCommandMessage['type'], payload?: LANRemoteCommandMessage['payload']) {
    switch (type) {
      case 'CMD_PLAY':
        usePlayerStore.setState({ isPlaying: true });
        break;
      case 'CMD_PAUSE':
        usePlayerStore.setState({ isPlaying: false });
        break;
      case 'CMD_SEEK':
        if (payload?.positionMs !== undefined) {
          usePlayerStore.setState({ currentTime: payload.positionMs / 1000 });
        }
        break;
      case 'CMD_VOLUME':
        if (payload?.volume !== undefined) {
          usePlayerStore.setState({ volume: payload.volume });
        }
        if (payload?.isMuted !== undefined) {
          usePlayerStore.setState({ isMuted: payload.isMuted });
        }
        break;
      // Note: CMD_NEXT and CMD_PREV are NOT optimistically updated from local queue
      // to guarantee absolute fidelity with the Authoritative Owner's queue!
    }
  }

  public handleCommandAck(ack: LANCommandAckMessage) {
    const pending = this.pendingCommands.get(ack.commandId);
    if (pending) {
      this.pendingCommands.delete(ack.commandId);
    }
    const fullTiming = {
      tapTimestamp: pending?.tapTimestamp || ack.timing?.tapTimestamp || ack.timing?.sendTimestamp,
      sendTimestamp: ack.timing?.sendTimestamp || Date.now(),
      receiveTimestamp: ack.timing?.receiveTimestamp,
      executeTimestamp: ack.timing?.executeTimestamp,
      ackTimestamp: ack.timing?.ackTimestamp || Date.now(),
    };
    ConnectTelemetry.getInstance().recordCommandLifecycle(
      ack.commandId,
      pending?.type || 'CMD_REMOTE',
      fullTiming
    );
  }

  public handlePlaybackStateUpdate(msg: LANPlaybackStateMessage) {
    const payload = msg.payload;
    if (!payload) return;

    // Ignore if this device is currently the active playback owner
    const store = usePlayerStore.getState();
    const isOwner = store.isActiveDevice && !store.connectedDeviceId;
    if (isOwner) return;

    // Ignore stale or out-of-order state versions
    if (this.currentOwnerState && payload.stateVersion < this.currentOwnerState.stateVersion) {
      return;
    }

    const previousSongId = this.currentOwnerState?.songId || this.currentOwnerState?.song?.id;
    const newSongId = payload.songId || payload.song?.id;
    const isTrackChange = Boolean(newSongId && previousSongId !== newSongId);

    this.currentOwnerState = payload;

    // Extrapolate position accurately from timestamp
    const now = Date.now();
    const elapsedSec = (payload.isPlaying && !isTrackChange)
      ? ((now - payload.timestamp) / 1000) * payload.playbackRate
      : 0;
    const currentSec = isTrackChange 
      ? (payload.positionMs / 1000)
      : Math.min((payload.durationMs / 1000) || 0, (payload.positionMs / 1000) + elapsedSec);

    // ATOMIC SYNCHRONOUS STATE REPLACEMENT
    // Artwork, title, artist, duration, position, anchors, queue, and index update in ONE unified atomic transaction!
    // Always spread song into a NEW object reference so React detects the change even if only metadata fields differ.
    usePlayerStore.setState({
      activeDeviceId: payload.ownerDeviceId,
      connectedDeviceId: payload.ownerDeviceId,
      isActiveDevice: false,
      currentSong: payload.song ? { ...payload.song } : null,
      isPlaying: payload.isPlaying,
      playbackIntent: payload.isPlaying ? 'PLAYING' : 'PAUSED',
      currentTime: currentSec,
      duration: payload.durationMs ? payload.durationMs / 1000 : (payload.song?.duration || 0),
      remoteAnchorPositionMs: payload.positionMs,
      remoteAnchorTimeMs: payload.timestamp || now,
      queue: payload.queue ? [...payload.queue] : [],
      queueIndex: payload.queueIndex ?? 0,
      volume: payload.volume,
      isMuted: payload.isMuted,
      shuffleMode: (payload.shuffleMode as any) || 'OFF',
      repeatMode: (payload.repeatMode as any) || 'OFF',
    });

    // Update native Android lockscreen & notification media metadata
    if (payload.song) {
      MediaSessionManager.getInstance().updateSongMetadata(payload.song);
      MediaSessionManager.getInstance().setPlaybackState(payload.isPlaying ? 'playing' : 'paused');
      MediaSessionManager.getInstance().setPositionState({
        duration: payload.durationMs ? payload.durationMs / 1000 : (payload.song.duration || 0),
        position: currentSec,
      });
    }
  }

  public getEstimatedPositionMs(): number {
    if (!this.currentOwnerState) return 0;
    if (!this.currentOwnerState.isPlaying) return this.currentOwnerState.positionMs;

    const elapsed = (Date.now() - this.currentOwnerState.timestamp) * this.currentOwnerState.playbackRate;
    return Math.min(this.currentOwnerState.durationMs, this.currentOwnerState.positionMs + elapsed);
  }

  private startPositionTicker() {
    if (this.positionTicker) clearInterval(this.positionTicker);

    this.positionTicker = setInterval(() => {
      const store = usePlayerStore.getState();
      const isOwner = store.isActiveDevice && !store.connectedDeviceId;
      if (this.currentOwnerState && this.currentOwnerState.isPlaying && !isOwner) {
        const estimatedSec = this.getEstimatedPositionMs() / 1000;
        usePlayerStore.setState({ currentTime: estimatedSec });
      }
    }, 250); // smooth 4Hz local UI extrapolation without network overhead
  }

  public destroy() {
    if (this.positionTicker) {
      clearInterval(this.positionTicker);
      this.positionTicker = null;
    }
  }
}
