/**
 * ConnectSessionManager — Authoritative State Sync & Remote Playback Control
 *
 * Implements Architecture Spec §1, §10:
 * - Active player is AUTHORITATIVE (owns PlaybackState + monotonic revision).
 * - Controllers apply OPTIMISTIC local updates and reconcile on STATE_SYNC.
 * - Idempotency: Deduplicates by commandId (LRU cache).
 * - Transport-independent: Talks only to abstract TransportManager.
 */

import {
  ControlMessage,
  ControlMessageType,
  PlaybackState,
  AuthorizedPeer,
} from '../types';
import { TransportManager } from '../transport/TransportManager';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { DeviceKeyManager } from '../auth/DeviceKeyManager';
import { DeviceDiscoveryEngine } from '../discovery/DeviceDiscoveryEngine';
import { MediaSessionManager } from '@/lib/playback/MediaSessionManager';
import { QueueManager } from '@/lib/queue/QueueManager';
import { RaagaXNativePlayer } from '@/lib/playback/native/RaagaXNativePlayer';

export class ConnectSessionManager {
  private static instance: ConnectSessionManager;
  private transportManager = TransportManager.getInstance();
  private processedCommandIds = new Set<string>();
  private processedCommandLru: string[] = [];
  private readonly MAX_LRU_SIZE = 150;
  private currentSessionId: string = 'sess_default';
  private currentRevision: number = 1;
  private localSequenceNumber: number = 0;
  private activePeer: AuthorizedPeer | null = null;
  private syncInterval?: ReturnType<typeof setInterval>;
  private directChannels = new Map<string, RTCDataChannel>();
  private connectedControllers = new Set<string>();
  private lastStateUpdatedAt = 0;
  private volumeThrottleTimer: any = null;
  private volumeBroadcastTimer: any = null;
  private pendingVolumePayload: any = null;
  private lastTickerTime: number = 0;
  private debouncedBroadcastTimer: any = null;

  private constructor() {
    this.setupTransportListener();
    if (typeof window !== 'undefined') {
      import('../transport/P2PTransport').then(({ P2PTransport }) => {
        P2PTransport.initIncomingReceiver(DeviceDiscoveryEngine.getInstance());
      }).catch(() => {});

      window.addEventListener('beforeunload', () => {
        const store = usePlayerStore.getState();
        if (!store.isLocalPlayback && this.activePeer) {
          try {
            this.sendCommand('PAUSE');
            this.sendCommand('DISCONNECT', { reason: 'beforeunload' });
          } catch {}
        }
      });
    }
  }

  public registerDirectChannel(deviceId: string, dc: RTCDataChannel) {
    this.directChannels.set(deviceId, dc);
    this.connectedControllers.add(deviceId);
    if (usePlayerStore.getState().isLocalPlayback) {
      this.startAuthoritativeSyncBroadcast();
    }
    dc.onclose = () => {
      this.directChannels.delete(deviceId);
    };
  }

  public static getInstance(): ConnectSessionManager {
    if (!ConnectSessionManager.instance) {
      ConnectSessionManager.instance = new ConnectSessionManager();
    }
    return ConnectSessionManager.instance;
  }

  private setupTransportListener() {
    this.transportManager.on('message', (msg: ControlMessage) => {
      this.handleIncomingControlMessage(msg);
    });
    DeviceDiscoveryEngine.getInstance().onCommand((cmd: ControlMessage) => {
      this.handleIncomingControlMessage(cmd);
    });
  }

  /**
   * Spotify-style Handover: Transfers local playback session to a remote peer device
   */
  public async transferPlaybackToPeer(peer: AuthorizedPeer): Promise<void> {
    const store = usePlayerStore.getState();
    const service = PlaybackService.getInstance();
    const currentSong = store.currentSong;
    const isPlaying = store.isPlaying;
    const activeAudio = service.getActiveAudio();
    let position = 0;
    if (activeAudio && typeof activeAudio.currentTime === 'number' && activeAudio.currentTime > 0) {
      position = activeAudio.currentTime;
    } else if (typeof store.currentTime === 'number' && store.currentTime > 0) {
      position = store.currentTime;
    }
    const queue = store.queue;
    const queueIndex = store.queueIndex;

    this.activePeer = peer;
    this.currentSessionId = 'sess_' + peer.peer.deviceId;

    // 1. Establish transport link to remote target
    await this.transportManager.establish(peer);

    // 2. Re-capture live position right before pausing
    const freshAudio = service.getActiveAudio();
    if (freshAudio && typeof freshAudio.currentTime === 'number' && freshAudio.currentTime > 0) {
      position = freshAudio.currentTime;
    } else if (typeof store.currentTime === 'number' && store.currentTime > 0) {
      position = store.currentTime;
    }

    // 3. If we are currently playing music locally, pause local audio engine so sound shifts to remote
    if (store.isLocalPlayback) {
      service.pauseAudioElementOnly();
      if (RaagaXNativePlayer.isNative()) {
        RaagaXNativePlayer.pause().catch(() => {});
        RaagaXNativePlayer.setRemotePlayback(true, peer.peer.deviceName || 'Remote Device').catch(() => {});
      }
    }

    // 4. Mark local device as remote controller for the target peer
    store.setActivePlaybackDeviceId(peer.peer.deviceId, peer.peer.deviceName || 'Remote Device');

    // 4. Send SWITCH_PLAYBACK command with full context (song, timestamp, queue) to target device
    await this.sendCommand('SWITCH_PLAYBACK', {
      song: currentSong,
      position,
      isPlaying,
      queue,
      queueIndex,
      targetDeviceId: peer.peer.deviceId,
    });

    // 5. Request continuous state updates from the new authoritative player
    this.sendCommand('STATE_SYNC', { requestInitialSync: true });
    this.startControllerInterpolation();
  }

  public async connectToPeer(peer: AuthorizedPeer): Promise<void> {
    this.activePeer = peer;
    this.currentSessionId = 'sess_' + peer.peer.deviceId;

    await this.transportManager.establish(peer);

    // If local device is controller, request initial state sync from player
    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    const isLocalPlayer = usePlayerStore.getState().isLocalPlayback;

    if (!isLocalPlayer) {
      this.sendCommand('STATE_SYNC', { requestInitialSync: true });
      this.startControllerInterpolation();
    } else {
      this.startAuthoritativeSyncBroadcast();
    }
  }

  /**
   * Disconnects the session. If acting as a remote controller, sends PAUSE to remote speaker so audio stops.
   */
  public async disconnect(sendRemotePause: boolean = true): Promise<void> {
    const store = usePlayerStore.getState();
    if (sendRemotePause && !store.isLocalPlayback && this.activePeer) {
      try {
        await this.sendCommand('PAUSE');
        await this.sendCommand('DISCONNECT', { reason: 'user_disconnect' });
        await new Promise((r) => setTimeout(r, 60));
      } catch (e) {
        console.warn('[ConnectSessionManager] Failed to send PAUSE on disconnect:', e);
      }
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
    this.stopControllerInterpolation();
    this.activePeer = null;
    this.transportManager.closeAll().catch(() => {});
    if (RaagaXNativePlayer.isNative()) {
      RaagaXNativePlayer.setRemotePlayback(false, '').catch(() => {});
      RaagaXNativePlayer.clearRemotePlayback().catch(() => {});
    }
  }

  /**
   * Transfers playback back to the local device (e.g. iPad):
   * 1. Pauses the remote speaker (Desk) immediately so it stops playing audio.
   * 2. Closes the remote connection cleanly.
   * 3. Sets active playback device to 'dev_local'.
   * 4. Resumes playback locally on iPad with the same song and exact timestamp.
   */
  public async transferPlaybackToLocal(resumeLocal: boolean = true): Promise<void> {
    const store = usePlayerStore.getState();
    if (store.isLocalPlayback) return;

    const currentSong = store.currentSong;
    const wasPlaying = store.isPlaying;
    const position = store.currentTime || 0;
    const queueIndex = store.queueIndex;

    console.log(`[ConnectSessionManager] Handover to local device. Pausing remote speaker. (wasPlaying=${wasPlaying}, pos=${position})`);

    // 1. Tell remote speaker to pause immediately
    try {
      await this.sendCommand('PAUSE');
      await this.sendCommand('DISCONNECT', { reason: 'transfer_to_local' });
    } catch (e) {
      console.warn('[ConnectSessionManager] Failed to send PAUSE before local handover:', e);
    }

    // Allow network frame to flush across socket / WebRTC
    await new Promise((r) => setTimeout(r, 60));

    // 2. Tear down remote connection without sending redundant pause
    await this.disconnect(false);

    // 3. Mark local device as active playback device
    store.setActivePlaybackDeviceId('dev_local', 'This Device');
    if (RaagaXNativePlayer.isNative()) {
      RaagaXNativePlayer.setRemotePlayback(false, '').catch(() => {});
      RaagaXNativePlayer.clearRemotePlayback().catch(() => {});
    }

    // 4. Seamlessly resume playback locally on this device
    if (currentSong) {
      const shouldPlay = resumeLocal && wasPlaying;
      try {
        await store.switchTrack(currentSong, queueIndex, shouldPlay, position);
      } catch (err) {
        console.warn('[ConnectSessionManager] Failed to resume audio locally after handover:', err);
      }
    }
  }

  /**
   * Dispatches a command to the remote peer via the active transport with intelligent throttling
   */
  public async sendCommand(type: ControlMessageType, payload: any = {}): Promise<void> {
    // 1. Throttle high-frequency continuous VOLUME slider updates (60fps UI, 50ms network rate)
    if (type === 'VOLUME') {
      this.pendingVolumePayload = payload;
      const store = usePlayerStore.getState();
      if (!store.isLocalPlayback) {
        this.applyOptimisticUpdate(type, payload);
      }
      if (this.volumeThrottleTimer) {
        return;
      }
      this.volumeThrottleTimer = setTimeout(() => {
        this.volumeThrottleTimer = null;
        if (this.pendingVolumePayload) {
          const p = this.pendingVolumePayload;
          this.pendingVolumePayload = null;
          this.dispatchCommand('VOLUME', p);
        }
      }, 50);
      return;
    }

    return this.dispatchCommand(type, payload);
  }

  private async dispatchCommand(type: ControlMessageType, payload: any = {}): Promise<void> {
    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    const commandId = crypto.randomUUID ? crypto.randomUUID() : 'cmd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    const msg: ControlMessage = {
      commandId,
      sessionId: this.currentSessionId,
      sequenceNumber: ++this.localSequenceNumber,
      timestamp: Date.now(),
      type,
      payload,
      senderDeviceId: myDeviceId,
    };

    // Apply optimistic updates locally on controller
    const store = usePlayerStore.getState();
    if (!store.isLocalPlayback) {
      this.applyOptimisticUpdate(type, payload);
    }

    const targetId = this.activePeer?.peer?.deviceId || payload?.targetDeviceId;

    // 1. Direct WebRTC DataChannel (sub-5ms direct Wi-Fi)
    if (targetId && this.directChannels.has(targetId)) {
      const dc = this.directChannels.get(targetId);
      if (dc && dc.readyState === 'open') {
        try {
          dc.send(JSON.stringify(msg));
        } catch {}
      }
    }

    // 2. Local BroadcastChannel for instant 0ms cross-tab execution
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('raagax_connect_bus');
        bc.postMessage({
          type: 'CONNECT_COMMAND',
          targetDeviceId: targetId,
          command: msg,
        });
        bc.close();
      }
    } catch {}

    // 3. TransportManager (Wi-Fi P2P / LAN / Cloud fallback)
    try {
      await this.transportManager.send(msg);
    } catch (err) {
      console.warn('[ConnectSessionManager] Failed to send command via TransportManager:', err);
    }
  }

  /**
   * Optimistic local UI mutations on controller before receiving authoritative ack
   */
  private applyOptimisticUpdate(type: ControlMessageType, payload: any) {
    const store = usePlayerStore.getState();

    switch (type) {
      case 'SWITCH_PLAYBACK': {
        const updates: any = {};
        if (payload?.song) updates.currentSong = payload.song;
        if (typeof payload?.position === 'number') {
          updates.currentTime = payload.position;
          updates.seekTarget = payload.position;
          updates.lastPositionTimestamp = payload?.isPlaying !== false ? performance.now() : null;
        }
        if (typeof payload?.queueIndex === 'number') updates.queueIndex = payload.queueIndex;
        if (typeof payload?.isPlaying === 'boolean') {
          updates.isPlaying = payload.isPlaying;
          updates.playbackIntent = payload.isPlaying ? 'PLAYING' : 'PAUSED';
          if (!payload.isPlaying) {
            updates.lastPositionTimestamp = null;
          }
        }
        if (Array.isArray(payload?.queue)) updates.queue = payload.queue;
        store.setRemoteState(updates);
        if (payload?.isPlaying !== false) {
          this.startControllerInterpolation();
        } else {
          this.stopControllerInterpolation();
        }
        break;
      }
      case 'PLAY':
        store.setRemoteState({
          isPlaying: true,
          playbackIntent: 'PLAYING',
          lastPositionTimestamp: performance.now(),
        });
        this.startControllerInterpolation();
        break;
      case 'PAUSE':
      case 'DISCONNECT':
        store.setRemoteState({
          isPlaying: false,
          playbackIntent: 'PAUSED',
          lastPositionTimestamp: null,
        });
        this.stopControllerInterpolation();
        break;
      case 'SEEK':
        if (typeof payload?.position === 'number') {
          store.setRemoteState({
            currentTime: payload.position,
            seekTarget: payload.position,
            lastPositionTimestamp: store.isPlaying ? performance.now() : null,
          });
        }
        break;
      case 'VOLUME':
        if (typeof payload?.volume === 'number') {
          store.setRemoteState({ volume: payload.volume });
        }
        break;
      case 'NEXT': {
        const queue = store.queue;
        const qIndex = store.queueIndex;
        const nextIdx = (qIndex + 1 < queue.length) ? qIndex + 1 : (store.repeatMode === 'all' ? 0 : -1);
        if (nextIdx >= 0 && nextIdx < queue.length) {
          const nextSong = queue[nextIdx];
          store.setRemoteState({
            currentSong: nextSong,
            queueIndex: nextIdx,
            currentTime: 0,
            duration: nextSong.duration || 0,
            isPlaying: true,
            lastPositionTimestamp: performance.now(),
          });
          this.startControllerInterpolation();
        }
        break;
      }
      case 'PREV': {
        if (store.currentTime > 3) {
          store.setRemoteState({
            currentTime: 0,
            seekTarget: 0,
            lastPositionTimestamp: store.isPlaying ? performance.now() : null,
          });
        } else {
          const queue = store.queue;
          const qIndex = store.queueIndex;
          const prevIdx = qIndex > 0 ? qIndex - 1 : 0;
          if (prevIdx >= 0 && prevIdx < queue.length) {
            const prevSong = queue[prevIdx];
            store.setRemoteState({
              currentSong: prevSong,
              queueIndex: prevIdx,
              currentTime: 0,
              duration: prevSong.duration || 0,
              isPlaying: true,
              lastPositionTimestamp: performance.now(),
            });
            this.startControllerInterpolation();
          }
        }
        break;
      }
    }
  }

  /**
   * Handles incoming remote control commands with LRU idempotency & revision checks
   */
  public async handleIncomingControlMessage(msg: ControlMessage): Promise<void> {
    // 1. Idempotency Check (LRU deduplication)
    if (this.processedCommandIds.has(msg.commandId)) {
      return;
    }

    this.processedCommandIds.add(msg.commandId);
    this.processedCommandLru.push(msg.commandId);
    if (this.processedCommandLru.length > this.MAX_LRU_SIZE) {
      const oldest = this.processedCommandLru.shift();
      if (oldest) this.processedCommandIds.delete(oldest);
    }

    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    const store = usePlayerStore.getState();
    const isAuthoritativePlayer = store.isLocalPlayback;

    // Track remote controller device ID
    if (msg.senderDeviceId && msg.senderDeviceId !== myDeviceId) {
      this.connectedControllers.add(msg.senderDeviceId);
      if (isAuthoritativePlayer) {
        this.startAuthoritativeSyncBroadcast();
      }
    }

    // 2. STATE_SYNC Handling on Controller or Player
    if (msg.type === 'STATE_SYNC') {
      const payload = msg.payload as any;
      if (payload?.requestInitialSync && isAuthoritativePlayer) {
        this.broadcastCurrentState();
        return;
      }
      const state = msg.payload as PlaybackState;
      if (state && !isAuthoritativePlayer) {
        this.reconcileAuthoritativeState(state);
      }
      return;
    }

    // 3. Command Execution on Authoritative Player (or SWITCH_PLAYBACK which makes this device authoritative)
    if (isAuthoritativePlayer || msg.type === 'SWITCH_PLAYBACK' || (msg.type as string) === 'PLAY_SONG' || msg.type === 'DISCONNECT') {
      await this.executeAuthoritativeCommand(msg);
      // Immediately broadcast updated authoritative state to all controllers (skip immediate for VOLUME, use debounce)
      if (msg.type !== 'VOLUME') {
        this.broadcastCurrentState();
      } else {
        if (this.volumeBroadcastTimer) clearTimeout(this.volumeBroadcastTimer);
        this.volumeBroadcastTimer = setTimeout(() => {
          this.volumeBroadcastTimer = null;
          this.broadcastCurrentState();
        }, 120);
      }
    }
  }

  /**
   * Authoritative execution on physical player device
   */
  private async executeAuthoritativeCommand(msg: ControlMessage) {
    const store = usePlayerStore.getState();
    const payload = msg.payload as any;

    console.log(`[ConnectSessionManager] Executing remote command: ${msg.type} from ${msg.senderDeviceId}`);

    switch (msg.type) {
      case 'PLAY':
        store.setActivePlaybackDeviceId('dev_local', 'This Device');
        const playPos = typeof payload?.position === 'number' && payload.position > 0 ? payload.position : 0;
        if (payload?.queue && Array.isArray(payload.queue) && payload.queue.length > 0) {
          const qIndex = typeof payload.queueIndex === 'number' ? payload.queueIndex : 0;
          usePlayerStore.setState({ queue: payload.queue, queueIndex: qIndex });
          try {
            QueueManager.getInstance().replaceQueue(payload.queue, qIndex);
          } catch {}
        }
        if (payload?.song && (!store.currentSong || store.currentSong.id !== payload.song.id)) {
          await store.switchTrack(payload.song, payload.queueIndex || 0, true, playPos);
        } else {
          if (playPos > 0) {
            store.seek(playPos);
          }
          await store.setIsPlaying(true);
          PlaybackService.getInstance().play();
        }
        break;

      case 'PAUSE':
      case 'DISCONNECT':
        console.log(`[ConnectSessionManager] Remote ${msg.type} received: pausing speaker audio.`);
        await store.setIsPlaying(false);
        PlaybackService.getInstance().pause();
        if (msg.senderDeviceId) {
          this.connectedControllers.delete(msg.senderDeviceId);
        }
        break;

      case 'SEEK':
        if (typeof payload?.position === 'number') {
          store.seek(payload.position);
        }
        break;

      case 'NEXT':
        await store.playNext(false, true);
        break;

      case 'PREV':
        await store.playPrev(true);
        break;

      case 'VOLUME':
        if (typeof payload?.volume === 'number') {
          store.setVolume(payload.volume);
        }
        break;

      case 'SHUFFLE':
        await store.toggleShuffle();
        break;

      case 'REPEAT':
        if (payload?.mode) {
          await store.setRepeatMode(payload.mode);
        } else {
          store.cycleRepeatMode();
        }
        break;

      case 'QUEUE_UPDATE':
        if (payload?.action === 'add' && payload?.song) {
          await store.addToQueue(payload.song);
        } else if (payload?.action === 'remove' && payload?.songId) {
          await store.removeFromQueue(payload.songId);
        } else if (payload?.action === 'reorder' && Array.isArray(payload?.newQueue)) {
          await store.reorderQueue(payload.newQueue);
        } else if (payload?.action === 'clear') {
          await store.clearQueue();
        }
        break;

      case 'SWITCH_PLAYBACK':
      case 'PLAY_SONG' as any: {
        // Transfer playback lease to this device
        store.setActivePlaybackDeviceId('dev_local', 'This Device');
        if (payload?.song) {
          const pos = typeof payload?.position === 'number' && payload.position > 0 ? payload.position : 0;
          const qIndex = typeof payload?.queueIndex === 'number' ? payload.queueIndex : 0;
          const shouldPlay = payload?.isPlaying !== false;

          if (Array.isArray(payload?.queue) && payload.queue.length > 0) {
            usePlayerStore.setState({ queue: payload.queue, queueIndex: qIndex });
            try {
              QueueManager.getInstance().replaceQueue(payload.queue, qIndex);
            } catch {}
          }

          const activeAudio = PlaybackService.getInstance().getActiveAudio();
          const isSameSongLoaded = store.currentSong && store.currentSong.id === payload.song.id && Boolean(activeAudio?.src);

          if (isSameSongLoaded) {
            if (pos > 0) {
              store.seek(pos);
            }
            if (shouldPlay) {
              await store.setIsPlaying(true);
              PlaybackService.getInstance().play();
            } else {
              await store.setIsPlaying(false);
              PlaybackService.getInstance().pause();
            }
          } else {
            await store.switchTrack(payload.song, qIndex, shouldPlay, pos);
            if (pos > 0) {
              // Safety verification at 350ms and 800ms to guarantee seek isn't lost during audio network buffering
              setTimeout(() => {
                const cur = PlaybackService.getInstance().getActiveAudio()?.currentTime;
                if (typeof cur === 'number' && Math.abs(cur - pos) > 1.0) {
                  store.seek(pos);
                }
              }, 350);
              setTimeout(() => {
                const cur = PlaybackService.getInstance().getActiveAudio()?.currentTime;
                if (typeof cur === 'number' && Math.abs(cur - pos) > 1.0) {
                  store.seek(pos);
                }
              }, 800);
            }
          }
        }
        this.startAuthoritativeSyncBroadcast();
        break;
      }
    }

    this.currentRevision++;
  }

  /**
   * Reconciles authoritative state on controller devices
   */
  private reconcileAuthoritativeState(state: PlaybackState) {
    // Drop if stale timestamp from network delays
    if (state.updatedAt && this.lastStateUpdatedAt && state.updatedAt < this.lastStateUpdatedAt) {
      return;
    }
    this.lastStateUpdatedAt = state.updatedAt || Date.now();
    this.currentRevision = state.revision;
    const store = usePlayerStore.getState();

    // Reconcile playback state & controller timeline ticker
    if (store.isPlaying !== state.isPlaying) {
      store.setIsPlaying(state.isPlaying, true);
    }
    if (state.isPlaying) {
      this.startControllerInterpolation();
    } else {
      this.stopControllerInterpolation();
    }

    // Always keep controller time aligned with authoritative position
    if (typeof state.position === 'number') {
      const liveTime = store.currentTime;
      // If paused, snap unconditionally so controller and speaker show exact same second!
      // If playing, snap if drift is > 0.25s
      const shouldSnap = !state.isPlaying || Math.abs(liveTime - state.position) > 0.25;
      if (shouldSnap) {
        store.setRemoteState({
          currentTime: state.position,
          lastPositionTimestamp: state.isPlaying ? performance.now() : null,
        });
        this.lastTickerTime = performance.now();
      }
    }

    if (typeof state.volume === 'number' && Math.abs(store.volume - state.volume) > 0.005) {
      store.setRemoteState({ volume: state.volume });
    }

    if (state.repeat && store.repeatMode !== state.repeat) {
      store.setRemoteState({ repeatMode: state.repeat as any });
    }

    if (typeof state.shuffle === 'boolean') {
      const isShuffled = store.shuffleMode !== 'OFF';
      if (isShuffled !== state.shuffle) {
        store.setRemoteState({ shuffleMode: state.shuffle ? 'STANDARD' : 'OFF' });
      }
    }

    // Reconcile full queue metadata if present
    if (state.queueSongs && Array.isArray(state.queueSongs) && state.queueSongs.length > 0) {
      const currentQueueIds = store.queue.map(s => s.id).join(',');
      const incomingQueueIds = state.queueSongs.map(s => s.id).join(',');
      if (currentQueueIds !== incomingQueueIds) {
        store.setRemoteState({ queue: state.queueSongs });
      }
    }

    // Update song data if attached or resolve from queue
    const targetSong = state.currentSongData || store.queue.find(s => s.id === state.trackId);
    if (targetSong && (!store.currentSong || store.currentSong.id !== state.trackId)) {
      const qIdx = typeof state.queueIndex === 'number'
        ? state.queueIndex
        : store.queue.findIndex(s => s.id === targetSong.id);

      store.setRemoteState({
        currentSong: targetSong,
        duration: state.duration || targetSong.duration || 0,
        currentTime: state.position || 0,
        isPlaying: state.isPlaying,
        lastPositionTimestamp: state.isPlaying ? performance.now() : null,
        ...(qIdx >= 0 ? { queueIndex: qIdx } : {}),
      });

      // Synchronize controller lockscreen / control center / media notifications
      try {
        MediaSessionManager.getInstance().updateSongMetadata(targetSong);
        MediaSessionManager.getInstance().setPlaybackState(state.isPlaying ? 'playing' : 'paused');
        MediaSessionManager.getInstance().setPositionState({
          duration: state.duration || targetSong.duration || 0,
          position: state.position || 0,
        });
      } catch {}

      if (RaagaXNativePlayer.isNative()) {
        RaagaXNativePlayer.updateRemotePlayback({
          trackId: targetSong.id,
          title: targetSong.title,
          artist: targetSong.artist || '',
          artworkUrl: targetSong.coverUrl || '',
          isPlaying: state.isPlaying,
          deviceName: store.activePlaybackDeviceName || 'Remote Device',
        }).catch(() => {});
      }
    } else if (state.currentSongData && store.currentSong && store.currentSong.id === state.trackId) {
      const updates: any = {};
      if (state.duration && state.duration !== store.duration) {
        updates.duration = state.duration;
      }
      if (state.currentSongData.coverUrl && state.currentSongData.coverUrl !== store.currentSong.coverUrl) {
        updates.currentSong = { ...store.currentSong, coverUrl: state.currentSongData.coverUrl };
      }
      if (typeof state.queueIndex === 'number' && state.queueIndex !== store.queueIndex) {
        updates.queueIndex = state.queueIndex;
      }
      if (Object.keys(updates).length > 0) {
        store.setRemoteState(updates);
      }
    }
  }

  public broadcastCurrentStateDebounced(ms: number = 80): void {
    if (this.debouncedBroadcastTimer) clearTimeout(this.debouncedBroadcastTimer);
    this.debouncedBroadcastTimer = setTimeout(() => {
      this.debouncedBroadcastTimer = null;
      this.broadcastCurrentState();
    }, ms);
  }

  /**
   * Broadcasts authoritative PlaybackState snapshot to controllers
   */
  public broadcastCurrentState(): void {
    const store = usePlayerStore.getState();
    if (!store.isLocalPlayback) return;

    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    const activeAudio = PlaybackService.getInstance().getActiveAudio();
    const targetSeek = store.seekTarget;

    let livePos = store.currentTime || 0;
    if (targetSeek !== null && targetSeek > 0) {
      if (activeAudio && Math.abs(activeAudio.currentTime - targetSeek) <= 1.0) {
        livePos = activeAudio.currentTime;
      } else {
        livePos = targetSeek;
      }
    } else if (activeAudio && !activeAudio.paused && typeof activeAudio.currentTime === 'number' && activeAudio.currentTime > 0) {
      livePos = activeAudio.currentTime;
    }

    const liveState: PlaybackState = {
      sessionId: this.currentSessionId,
      revision: ++this.currentRevision,
      trackId: store.currentSong?.id || '',
      position: livePos,
      duration: store.duration,
      isPlaying: store.isPlaying,
      volume: store.volume,
      queue: store.queue.map(s => s.id),
      queueIndex: store.queueIndex,
      shuffle: store.shuffleMode !== 'OFF',
      repeat: store.repeatMode === 'one' ? 'one' : store.repeatMode === 'all' ? 'all' : 'off',
      activePlayerDeviceId: myDeviceId,
      updatedAt: Date.now(),
      currentSongData: store.currentSong,
      queueSongs: store.queue,
    };

    const msg: ControlMessage = {
      commandId: crypto.randomUUID ? crypto.randomUUID() : 'sync_' + Date.now(),
      sessionId: this.currentSessionId,
      sequenceNumber: ++this.localSequenceNumber,
      timestamp: Date.now(),
      type: 'STATE_SYNC',
      payload: liveState,
      senderDeviceId: myDeviceId,
    };

    // 1. Direct WebRTC DataChannels (sub-5ms direct Wi-Fi)
    for (const [devId, dc] of this.directChannels.entries()) {
      if (dc.readyState === 'open') {
        try {
          dc.send(JSON.stringify(msg));
        } catch {}
      }
    }

    // 2. BroadcastChannel for same-machine tabs (omit targetDeviceId so all local controller tabs receive state sync)
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('raagax_connect_bus');
        bc.postMessage({
          type: 'CONNECT_COMMAND',
          command: msg,
        });
        bc.close();
      }
    } catch {}

    // 3. Dispatch to all known connected controllers via Cloud Coordinator fallback
    const discovery = DeviceDiscoveryEngine.getInstance();
    for (const controllerId of this.connectedControllers) {
      if (controllerId && controllerId !== myDeviceId) {
        discovery.sendCloudCommand(controllerId, msg);
      }
    }

    if (this.activePeer?.peer?.deviceId && !this.connectedControllers.has(this.activePeer.peer.deviceId)) {
      discovery.sendCloudCommand(this.activePeer.peer.deviceId, msg);
    }
  }

  private startAuthoritativeSyncBroadcast() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    // Periodically broadcast sync state every 1 second to keep controllers aligned
    this.syncInterval = setInterval(() => {
      this.broadcastCurrentState();
    }, 1000);
  }

  private controllerTickInterval?: ReturnType<typeof setInterval>;

  public startControllerInterpolation(): void {
    if (this.controllerTickInterval) clearInterval(this.controllerTickInterval);
    this.lastTickerTime = performance.now();
    this.controllerTickInterval = setInterval(() => {
      const store = usePlayerStore.getState();
      if (!store.isLocalPlayback && store.isPlaying && store.currentSong) {
        const now = performance.now();
        const deltaSec = (now - this.lastTickerTime) / 1000;
        this.lastTickerTime = now;
        const cur = store.currentTime || 0;
        const dur = store.duration || store.currentSong.duration || 0;
        if (dur > 0 && cur < dur && deltaSec > 0 && deltaSec < 2.0) {
          const nextPos = Math.min(dur, cur + deltaSec);
          store.setCurrentTime(nextPos, false);
          usePlayerStore.setState({ lastPositionTimestamp: now });
        }
      }
    }, 250);
  }

  public stopControllerInterpolation(): void {
    if (this.controllerTickInterval) {
      clearInterval(this.controllerTickInterval);
      this.controllerTickInterval = undefined;
    }
  }
}
