import { DeviceIdentityManager } from './DeviceIdentityManager';
import { DeviceRegistry } from './DeviceRegistry';
import { DiscoveryEngine } from './DiscoveryEngine';
import { AuthorizationManager } from './AuthorizationManager';
import { TransportManager } from './TransportManager';
import { CommandManager } from './CommandManager';
import { PlaybackStateManager } from './PlaybackStateManager';
import { HandoffManager } from './HandoffManager';
import { ConnectDiagnostics } from './ConnectDiagnostics';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { usePlayerStore } from '@/context/usePlayerStore';
import { QueueManager } from '@/lib/queue/QueueManager';
import { MediaSessionManager } from '@/lib/playback/MediaSessionManager';
import { ConnectionState, ConnectCommand, CommandAck, DeviceInfo } from './types';

export class ConnectEngine {
  private static instance: ConnectEngine;
  private connectionState: ConnectionState = 'DISCONNECTED';
  private activePlayerDeviceId: string;
  private activeConnectionId: string | null = null;
  private currentUserId: string | null = null;

  private stateChangeSubscribers: Set<(state: ConnectionState) => void> = new Set();
  private activePlayerSubscribers: Set<(playerId: string) => void> = new Set();
  private activeControllerDeviceId: string | null = null;
  private activeControllerSubscribers: Set<(controllerId: string | null) => void> = new Set();
  private remotePlaybackUnsub: (() => void) | null = null;
  private isAutoHealSubscribed = false;

  private constructor() {
    this.activePlayerDeviceId = DeviceIdentityManager.getInstance().getDevice().deviceId;
    this.setupLocalPlayerCommandExecution();
    this.setupDiagnosticPings();
    this.setupIncomingConnectionHandler();
    this.setupRemotePlaybackStoreSync();
  }

  private setupRemotePlaybackStoreSync(): void {
    if (this.remotePlaybackUnsub) {
      this.remotePlaybackUnsub();
      this.remotePlaybackUnsub = null;
    }
    // When acting as remote controller, keep local UI synchronized with remote player's state
    this.remotePlaybackUnsub = PlaybackStateManager.getInstance().subscribe((remoteState) => {
      const self = DeviceIdentityManager.getInstance().getDevice();
      const store = usePlayerStore.getState();

      const localAudio = PlaybackService.getInstance().getActiveAudio();
      const isActuallyPlayingLocally = Boolean(localAudio && !localAudio.paused && store.isLocalPlayback);

      if (remoteState.playerDeviceId && remoteState.playerDeviceId !== self.deviceId) {
        // ONLY accept remote player state if that device is actually known and online in DeviceRegistry!
        const remoteDev = DeviceRegistry.getInstance().getDevice(remoteState.playerDeviceId);
        if (!remoteDev || remoteDev.isOnline === false) {
          return;
        }

        // CRITICAL GUARD: If this device is the authoritative local speaker,
        // NEVER surrender speaker status to a remote device's state packet!
        if (store.isLocalPlayback && this.activePlayerDeviceId === self.deviceId) {
          return;
        }

        // When acting as remote controller, silence local audio
        if (!this.isLocalSpeaker()) {
          PlaybackService.getInstance().pauseAudioElementOnly();
        }

        this.activePlayerDeviceId = remoteState.playerDeviceId;
        store.setActivePlaybackDeviceId(remoteState.playerDeviceId);

        if (remoteState.track) {
          usePlayerStore.setState({
            currentSong: remoteState.track,
            isPlaying: Boolean(remoteState.isPlaying),
            playbackIntent: remoteState.isPlaying ? 'PLAYING' : 'PAUSED',
            currentTime: (remoteState.positionMs || 0) / 1000,
            duration: (remoteState.durationMs || 0) / 1000,
            volume: typeof remoteState.volume === 'number' ? remoteState.volume / 100 : store.volume,
            repeatMode: (remoteState.repeat?.toLowerCase() as any) || store.repeatMode,
            shuffleMode: remoteState.shuffle ? 'STANDARD' : 'OFF',
            lastPositionTimestamp: remoteState.isPlaying ? performance.now() : null,
          } as any);

          MediaSessionManager.getInstance().updateSongMetadata(remoteState.track);
          MediaSessionManager.getInstance().setPlaybackState(remoteState.isPlaying ? 'playing' : 'paused');
          import('@/lib/sync/TabSyncCoordinator').then(({ TabSyncCoordinator }) => {
            TabSyncCoordinator.getInstance().broadcastTrackChange(
              remoteState.track!,
              Boolean(remoteState.isPlaying),
              typeof remoteState.queueIndex === 'number' ? remoteState.queueIndex : store.queueIndex,
              (remoteState.positionMs || 0) / 1000,
              (remoteState.durationMs || 0) / 1000,
              remoteState.queue || store.queue
            );
          }).catch(() => {});
        } else {
          usePlayerStore.setState({
            isPlaying: Boolean(remoteState.isPlaying),
            playbackIntent: remoteState.isPlaying ? 'PLAYING' : 'PAUSED',
            lastPositionTimestamp: null,
          });
        }

        // Spotify Jam: Synchronize shared queue on remote controllers
        if (remoteState.queue && Array.isArray(remoteState.queue) && remoteState.queue.length > 0) {
          try {
            QueueManager.getInstance().replaceQueue(remoteState.queue, remoteState.queueIndex || 0);
          } catch {}
          usePlayerStore.setState({
            queue: remoteState.queue,
            queueIndex: typeof remoteState.queueIndex === 'number' ? remoteState.queueIndex : usePlayerStore.getState().queueIndex,
          });
        }
      }
    });
  }

  private setupIncomingConnectionHandler(): void {
    DiscoveryEngine.getInstance().setConnectionCallbacks(
      (connId, controllerDeviceId) => this.handleIncomingConnection(connId, controllerDeviceId),
      () => this.handleRemoteDisconnect()
    );
    DiscoveryEngine.getInstance().setDirectMessageCallback((event, data) => {
      if (event === 'CONNECT_REJECTED' && data?.reason === 'JAM_ACTIVE') {
        usePlayerStore.getState().setToastMessage(`${data.deviceName || 'Remote device'} is currently in a Jam session and cannot be connected.`);
      }
    });
  }

  public async handleIncomingConnection(connectionId: string, controllerDeviceId: string): Promise<void> {
    const self = DeviceIdentityManager.getInstance().getDevice();

    // Mutual Exclusion: If local device is currently active in a Jam, reject incoming connect
    try {
      const { JamSessionManager } = await import('@/lib/jam/JamSessionManager');
      if (JamSessionManager.getInstance().getState().isInJam) {
        console.warn('[Connect] Rejecting incoming connect: local device is in Jam session');
        DiscoveryEngine.getInstance().sendDirectMessage(controllerDeviceId, 'CONNECT_REJECTED', {
          reason: 'JAM_ACTIVE',
          deviceName: self.deviceName,
        });
        usePlayerStore.getState().setToastMessage('Blocked remote connection: this device is currently in a Jam session.');
        return;
      }
    } catch {}

    this.activeConnectionId = connectionId;
    this.setActiveControllerDeviceId(controllerDeviceId);
    // This device remains the player being controlled
    this.setActivePlayerDeviceId(self.deviceId);

    try {
      // Connect to relay channel as receiver (non-initiator)
      await TransportManager.getInstance().establishTransport(connectionId, controllerDeviceId, false);
      this.setConnectionState('CONNECTED');

      // Immediate affirmative handshake back to controller
      DiscoveryEngine.getInstance().broadcastInviteAccepted(connectionId, controllerDeviceId);

      // Only push current playing song if this device is already actively playing audio
      const store = usePlayerStore.getState();
      if (store.isPlaying && store.currentSong) {
        PlaybackStateManager.getInstance().syncNow();
      }
    } catch (err) {
      console.warn('[Connect] Error accepting incoming connection:', err);
    }
  }

  public handleRemoteDisconnect(): void {
    TransportManager.getInstance().teardown();
    this.activeConnectionId = null;
    this.setActiveControllerDeviceId(null);
    const self = DeviceIdentityManager.getInstance().getDevice();
    this.setActivePlayerDeviceId(self.deviceId);
    this.setConnectionState('DISCONNECTED');
    usePlayerStore.setState({
      isLocalPlayback: true,
      activePlaybackDeviceId: self.deviceId,
    });
    try {
      localStorage.setItem('raagax_active_playback_device_id', self.deviceId);
    } catch {}
  }

  public static getInstance(): ConnectEngine {
    if (!ConnectEngine.instance) {
      ConnectEngine.instance = new ConnectEngine();
    }
    return ConnectEngine.instance;
  }

  // 1. Initialize Connect Engine (Boot on App Start)
  public async init(userId?: string | null): Promise<void> {
    this.currentUserId = userId || null;
    DeviceIdentityManager.getInstance().setUserId(this.currentUserId);

    // Start dual-track discovery
    await DiscoveryEngine.getInstance().startDiscovery(this.currentUserId);

    const self = DeviceIdentityManager.getInstance().getDevice();
    try {
      usePlayerStore.setState({ currentDeviceId: self.deviceId });
    } catch {}

    // Auto-heal local speaker if no other remote devices remain online (with 6s grace period)
    if (!this.isAutoHealSubscribed) {
      this.isAutoHealSubscribed = true;
      let disconnectGraceTimer: any = null;

      DeviceRegistry.getInstance().subscribe((devices) => {
        const currentSelf = DeviceIdentityManager.getInstance().getDevice();
        const otherOnline = devices.filter((d) => d.deviceId !== currentSelf.deviceId && d.isOnline !== false);
        const store = usePlayerStore.getState();

        if (!store.isLocalPlayback) {
          const isTargetOnline = otherOnline.some((d) => d.deviceId === store.activePlaybackDeviceId);
          if (otherOnline.length === 0 || !isTargetOnline) {
            if (!disconnectGraceTimer) {
              disconnectGraceTimer = setTimeout(() => {
                disconnectGraceTimer = null;
                const liveStore = usePlayerStore.getState();
                if (!liveStore.isLocalPlayback) {
                  const liveDevs = DeviceRegistry.getInstance().getAllDevices(currentSelf.deviceId);
                  const stillTargetOnline = liveDevs.some((d) => d.deviceId === liveStore.activePlaybackDeviceId);
                  if (liveDevs.length === 0 || !stillTargetOnline) {
                    console.log('[ConnectEngine] Remote device confirmed unavailable after 6s grace period. Auto-reverting.');
                    this.handleRemoteDisconnect();
                    usePlayerStore.getState().setActivePlaybackDeviceId(currentSelf.deviceId);
                    usePlayerStore.setState({ isLocalPlayback: true, activePlaybackDeviceId: currentSelf.deviceId });
                  }
                }
              }, 6000);
            }
          } else if (disconnectGraceTimer) {
            clearTimeout(disconnectGraceTimer);
            disconnectGraceTimer = null;
          }
        }
      });
    }

    // When booting, immediately ask if an active speaker already exists on the network
    setTimeout(() => {
      PlaybackStateManager.getInstance().requestPlaybackSync();
    }, 400);

    // Start authoritative playback heartbeat for local player
    PlaybackStateManager.getInstance().startHeartbeat(() => {
      const store = usePlayerStore.getState();
      const playback = PlaybackService.getInstance();
      let posMs = (store.currentTime || 0) * 1000;
      try {
        const active = playback.getActiveAudio();
        if (active && !isNaN(active.currentTime)) {
          posMs = active.currentTime * 1000;
        }
      } catch {}

      return {
        track: store.currentSong,
        isPlaying: store.isPlaying,
        positionMs: posMs,
        durationMs: (store.duration || 0) * 1000,
        volume: Math.round((store.volume || 1) * 100),
        shuffle: Boolean(store.shuffleMode && store.shuffleMode !== 'OFF'),
        repeat: store.repeatMode || 'OFF',
        queue: store.queue,
        queueIndex: store.queueIndex,
      };
    });
  }

  // 2. Setup Local Player Command Execution (When this device is controlled remotely)
  private setupLocalPlayerCommandExecution(): void {
    CommandManager.getInstance().setCommandExecutionHandler(async (cmd: ConnectCommand): Promise<CommandAck> => {
      const playback = PlaybackService.getInstance();
      const self = DeviceIdentityManager.getInstance().getDevice();

      if (cmd.controllerDeviceId) {
        TransportManager.getInstance().setTargetDeviceId(cmd.controllerDeviceId);
        if (this.activeControllerDeviceId !== cmd.controllerDeviceId) {
          this.setActiveControllerDeviceId(cmd.controllerDeviceId);
        }
      }

      if (cmd.commandType === 'RELINQUISH_SPEAKER') {
        playback.pause();
        playback.pauseAudioElementOnly();
        try {
          const { RaagaXNativePlayer } = await import('@/lib/playback/native/RaagaXNativePlayer');
          if (RaagaXNativePlayer.isNative()) {
            await RaagaXNativePlayer.pause();
          }
        } catch {}
        const newPlayerId = cmd.payload?.newPlayerDeviceId;
        if (newPlayerId) {
          this.setActivePlayerDeviceId(newPlayerId);
          usePlayerStore.getState().setActivePlaybackDeviceId(newPlayerId);
          usePlayerStore.setState({
            isLocalPlayback: false,
            activePlaybackDeviceId: newPlayerId,
            isPlaying: Boolean(cmd.payload?.isPlaying),
            playbackIntent: cmd.payload?.isPlaying ? 'PLAYING' : 'PAUSED',
          });
        }
        return { commandId: cmd.commandId, status: 'accepted' };
      }

      // Ensure this device acts as the authoritative speaker executing remote playback commands
      this.setActivePlayerDeviceId(self.deviceId);
      usePlayerStore.getState().setActivePlaybackDeviceId(self.deviceId);
      usePlayerStore.setState({ isLocalPlayback: true });

      switch (cmd.commandType) {
        case 'PLAY':
          usePlayerStore.setState({ isPlaying: true, playbackIntent: 'PLAYING', isLocalPlayback: true });
          playback.play();
          PlaybackStateManager.getInstance().emitLocalPlaybackState({ isPlaying: true });
          return { commandId: cmd.commandId, status: 'accepted' };

        case 'PAUSE':
        case 'PAUSED':
          usePlayerStore.setState({ isPlaying: false, playbackIntent: 'PAUSED', lastPositionTimestamp: null });
          playback.pause();
          playback.pauseAudioElementOnly();
          try {
            const { RaagaXNativePlayer } = await import('@/lib/playback/native/RaagaXNativePlayer');
            if (RaagaXNativePlayer.isNative()) {
              await RaagaXNativePlayer.pause();
            }
          } catch {}
          PlaybackStateManager.getInstance().emitLocalPlaybackState({ isPlaying: false });
          return { commandId: cmd.commandId, status: 'accepted' };

        case 'NEXT':
          await usePlayerStore.getState().playNext();
          setTimeout(() => PlaybackStateManager.getInstance().syncNow(), 150);
          return { commandId: cmd.commandId, status: 'accepted' };

        case 'PREVIOUS':
          await usePlayerStore.getState().playPrev();
          setTimeout(() => PlaybackStateManager.getInstance().syncNow(), 150);
          return { commandId: cmd.commandId, status: 'accepted' };

        case 'SEEK':
          if (typeof cmd.payload?.positionMs === 'number') {
            const sec = cmd.payload.positionMs / 1000;
            usePlayerStore.setState({
              currentTime: sec,
              lastPositionTimestamp: usePlayerStore.getState().isPlaying ? performance.now() : null,
            });
            playback.seek(sec);
            setTimeout(() => PlaybackStateManager.getInstance().syncNow(), 50);
            return { commandId: cmd.commandId, status: 'accepted' };
          }
          return { commandId: cmd.commandId, status: 'rejected', reason: 'Invalid seek position' };

        case 'SET_VOLUME':
          if (typeof cmd.payload?.volume === 'number') {
            const vol = Math.max(0, Math.min(1, cmd.payload.volume / 100));
            usePlayerStore.getState().setVolume(vol);
            setTimeout(() => PlaybackStateManager.getInstance().syncNow(), 50);
            return { commandId: cmd.commandId, status: 'accepted' };
          }
          return { commandId: cmd.commandId, status: 'rejected', reason: 'Invalid volume level' };

        case 'MUTE':
          usePlayerStore.getState().toggleMute();
          setTimeout(() => PlaybackStateManager.getInstance().syncNow(), 50);
          return { commandId: cmd.commandId, status: 'accepted' };

        case 'SET_SHUFFLE':
          usePlayerStore.getState().toggleShuffle();
          setTimeout(() => PlaybackStateManager.getInstance().syncNow(), 50);
          return { commandId: cmd.commandId, status: 'accepted' };

        case 'SET_REPEAT':
          if (cmd.payload?.repeat) {
            usePlayerStore.getState().setRepeatMode(cmd.payload.repeat);
            setTimeout(() => PlaybackStateManager.getInstance().syncNow(), 50);
            return { commandId: cmd.commandId, status: 'accepted' };
          }
          return { commandId: cmd.commandId, status: 'rejected', reason: 'Invalid repeat mode' };

        case 'ADD_TO_QUEUE':
          if (cmd.payload?.song) {
            const song = cmd.payload.song;
            const mode = cmd.payload.mode || 'end';
            try {
              const manager = QueueManager.getInstance();
              if (mode === 'next') {
                manager.playNext(song);
              } else {
                manager.addToQueue(song);
              }
              const snapshot = manager.getSnapshot();
              const updatedQueue = snapshot.items.map((i: any) => i.song).filter(Boolean);
              const updatedIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0;
              usePlayerStore.setState({ queue: updatedQueue, queueIndex: updatedIndex });
              PlaybackService.getInstance().loadQueueContext(updatedQueue, updatedIndex);

              // Broadcast updated queue to all participants in the Jam session
              PlaybackStateManager.getInstance().emitLocalPlaybackState({
                queue: updatedQueue,
                queueIndex: updatedIndex,
              });

              try {
                usePlayerStore.getState().setToastMessage(`Added "${song.title}" to shared queue`);
              } catch {}

              return { commandId: cmd.commandId, status: 'accepted' };
            } catch (err) {
              console.warn('[Connect] ADD_TO_QUEUE failed:', err);
            }
          }
          return { commandId: cmd.commandId, status: 'rejected', reason: 'Invalid song data' };

        case 'SYNC_QUEUE':
          if (cmd.payload?.queue && Array.isArray(cmd.payload.queue)) {
            const newIndex = typeof cmd.payload.queueIndex === 'number' ? cmd.payload.queueIndex : usePlayerStore.getState().queueIndex;
            try {
              QueueManager.getInstance().replaceQueue(cmd.payload.queue, newIndex);
            } catch {}
            usePlayerStore.setState({
              queue: cmd.payload.queue,
              queueIndex: newIndex,
            });
            PlaybackService.getInstance().loadQueueContext(cmd.payload.queue, newIndex);
            PlaybackStateManager.getInstance().emitLocalPlaybackState({
              queue: cmd.payload.queue,
              queueIndex: newIndex,
            });
            return { commandId: cmd.commandId, status: 'accepted' };
          }
          return { commandId: cmd.commandId, status: 'rejected', reason: 'Invalid queue data' };

        case 'TRANSFER_PLAYBACK':
          if (cmd.payload?.track) {
            this.setActivePlayerDeviceId(self.deviceId);
            usePlayerStore.getState().setActivePlaybackDeviceId(self.deviceId);

            const handedOffQueue = (cmd.payload.queue && Array.isArray(cmd.payload.queue) && cmd.payload.queue.length > 0)
              ? cmd.payload.queue
              : [cmd.payload.track];
            const handedOffIndex = typeof cmd.payload.queueIndex === 'number'
              ? cmd.payload.queueIndex
              : 0;
            const posSec = (cmd.payload.positionMs || 0) / 1000;

            try {
              QueueManager.getInstance().replaceQueue(handedOffQueue, handedOffIndex);
            } catch {}

            // Update player store on this device so the UI immediately shows the song & album art
            usePlayerStore.setState({
              currentSong: cmd.payload.track,
              isPlaying: Boolean(cmd.payload.isPlaying),
              playbackIntent: cmd.payload.isPlaying ? 'PLAYING' : 'PAUSED',
              currentTime: posSec,
              queue: handedOffQueue,
              queueIndex: handedOffIndex,
              isLocalPlayback: true,
              activePlaybackDeviceId: self.deviceId,
              lastPositionTimestamp: cmd.payload.isPlaying ? performance.now() : null,
            });

            const shouldPlay = Boolean(cmd.payload.isPlaying);

            // Start audio on this device's speakers at the exact handoff position
            await playback.playTrack(cmd.payload.track, shouldPlay, posSec);
            if (!shouldPlay) {
              playback.pause();
            }

            const liveStore = usePlayerStore.getState();
            PlaybackStateManager.getInstance().emitLocalPlaybackState({
              playerDeviceId: self.deviceId,
              track: cmd.payload.track,
              isPlaying: liveStore.isPlaying,
              positionMs: (liveStore.currentTime || posSec) * 1000,
            });
            return { commandId: cmd.commandId, status: 'accepted' };
          }
          return { commandId: cmd.commandId, status: 'rejected', reason: 'Missing track data for handoff' };

        default:
          return { commandId: cmd.commandId, status: 'unsupported', reason: 'Command not recognized' };
      }
    });
  }

  // 3. Connect to Remote Player Device
  public async connectToDevice(targetDeviceId: string): Promise<boolean> {
    const self = DeviceIdentityManager.getInstance().getDevice();
    if (targetDeviceId === self.deviceId) {
      // Connect back to local device (local speaker)
      this.disconnect();
      return true;
    }

    // Mutual Exclusion: Cannot connect to remote device while in a Jam session
    try {
      const { JamSessionManager } = await import('@/lib/jam/JamSessionManager');
      if (JamSessionManager.getInstance().getState().isInJam) {
        console.warn('[ConnectEngine] Blocked: Cannot connect to remote device while in Jam');
        usePlayerStore.getState().setToastMessage('RaagaX Connect is unavailable during Spotify Jam. Leave Jam first.');
        return false;
      }
    } catch {}

    const registry = DeviceRegistry.getInstance();
    const target = registry.getDevice(targetDeviceId);
    if (!target) {
      this.setConnectionState('FAILED');
      return false;
    }

    this.setConnectionState('AUTHORIZING');
    const authMgr = AuthorizationManager.getInstance();
    if (!authMgr.isAuthorized(target.userId, targetDeviceId)) {
      this.setConnectionState('FAILED');
      return false;
    }

    this.setConnectionState('CONNECTING');
    // Deterministic connection ID
    const connId = [self.deviceId, targetDeviceId].sort().join('_');
    this.activeConnectionId = connId;

    try {
      // 1. Establish transport as initiator
      await TransportManager.getInstance().establishTransport(connId, targetDeviceId, true);

      // 2. Broadcast connect invite with burst retries to target device
      DiscoveryEngine.getInstance().broadcastInvite(connId, targetDeviceId);

      // 3. Wait up to 1800ms for positive acknowledgment from target device
      await new Promise<void>((resolve) => {
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }, 1800);

        DiscoveryEngine.getInstance().setInviteAcceptedCallback((acceptedConnId, fromDevId) => {
          if (!resolved && (acceptedConnId === connId || fromDevId === targetDeviceId)) {
            resolved = true;
            clearTimeout(timer);
            resolve();
          }
        });
      });

      this.setActivePlayerDeviceId(targetDeviceId);
      this.setConnectionState('CONNECTED');

      // 4. Request instantaneous playback state so remote seekbar and track details show immediately
      PlaybackStateManager.getInstance().requestPlaybackSync();

      ConnectDiagnostics.getInstance().updateDiagnostics({
        reachability: true,
        handshake: true,
        authorization: true,
      });
      return true;
    } catch {
      this.setConnectionState('FAILED');
      return false;
    }
  }

  // 4. Disconnect from Remote Player (Local Device Becomes Player)
  public disconnect(): void {
    const self = DeviceIdentityManager.getInstance().getDevice();
    if (this.activeConnectionId && this.activePlayerDeviceId && !this.isLocalSpeaker()) {
      DiscoveryEngine.getInstance().broadcastDisconnect(this.activeConnectionId, this.activePlayerDeviceId);
    }
    TransportManager.getInstance().teardown();
    this.activeConnectionId = null;
    this.setActivePlayerDeviceId(self.deviceId);
    this.setConnectionState('DISCONNECTED');
    usePlayerStore.setState({
      isLocalPlayback: true,
      activePlaybackDeviceId: self.deviceId,
    });
    try {
      localStorage.setItem('raagax_active_playback_device_id', self.deviceId);
    } catch {}
  }

  // 5. Send Remote Command
  public async sendRemoteCommand(type: any, payload?: any): Promise<boolean> {
    const self = DeviceIdentityManager.getInstance().getDevice();
    const store = usePlayerStore.getState();

    // If strictly local playback on this device, no remote command needed
    if (this.isLocalSpeaker()) {
      return true;
    }

    // Determine target remote player device ID (reject self and local placeholders)
    let playerDeviceId = (this.activePlayerDeviceId && this.activePlayerDeviceId !== self.deviceId && this.activePlayerDeviceId !== 'dev_local')
      ? this.activePlayerDeviceId
      : (store.activePlaybackDeviceId && store.activePlaybackDeviceId !== self.deviceId && store.activePlaybackDeviceId !== 'dev_local')
        ? store.activePlaybackDeviceId
        : null;

    if (!playerDeviceId && !store.isLocalPlayback) {
      const allDevs = DeviceRegistry.getInstance().getAllDevices(self.deviceId);
      if (allDevs.length > 0) {
        playerDeviceId = allDevs[0].deviceId;
      }
    }

    if (!playerDeviceId || playerDeviceId === self.deviceId || playerDeviceId === 'dev_local') {
      return false;
    }

    const connId = this.activeConnectionId || [self.deviceId, playerDeviceId].sort().join('_');
    this.activeConnectionId = connId;
    TransportManager.getInstance().setTargetDeviceId(playerDeviceId);

    try {
      const ack = await CommandManager.getInstance().sendCommand(
        connId,
        playerDeviceId,
        type,
        payload
      );
      if (ack.status === 'accepted') {
        if (type === 'PLAY') {
          PlaybackStateManager.getInstance().updateLocalSnapshot({ isPlaying: true });
        } else if (type === 'PAUSE') {
          PlaybackStateManager.getInstance().updateLocalSnapshot({ isPlaying: false });
        }
      }
      return ack.status === 'accepted';
    } catch (err) {
      console.warn(`[ConnectEngine] sendRemoteCommand ${type} error:`, err);
      return false;
    }
  }

  // 6. Transactional Switch Playback (Handoff)
  public async switchPlaybackTo(targetDeviceId: string): Promise<boolean> {
    const self = DeviceIdentityManager.getInstance().getDevice();

    // Mutual Exclusion: Cannot switch to a remote device while in a Jam session
    if (targetDeviceId !== self.deviceId) {
      try {
        const { JamSessionManager } = await import('@/lib/jam/JamSessionManager');
        if (JamSessionManager.getInstance().getState().isInJam) {
          console.warn('[ConnectEngine] Blocked: Cannot switch to remote device while in Jam');
          usePlayerStore.getState().setToastMessage('RaagaX Connect is unavailable during Spotify Jam. Leave Jam first.');
          return false;
        }
      } catch {}
    }

    if (targetDeviceId === self.deviceId) {
      // User tapped 'This Device' (Play Here):
      const state = PlaybackStateManager.getInstance().getCurrentState();

      const storeState = usePlayerStore.getState();
      const previousPlayerId = (this.activePlayerDeviceId && this.activePlayerDeviceId !== self.deviceId)
        ? this.activePlayerDeviceId
        : (storeState.activePlaybackDeviceId && storeState.activePlaybackDeviceId !== self.deviceId)
          ? storeState.activePlaybackDeviceId
          : null;

      // 1. Explicitly notify previous remote speaker to relinquish speaker status and pause audio
      if (previousPlayerId) {
        try {
          const connId = this.activeConnectionId || [self.deviceId, previousPlayerId].sort().join('_');
          await CommandManager.getInstance().sendCommand(
            connId,
            previousPlayerId,
            'RELINQUISH_SPEAKER',
            { newPlayerDeviceId: self.deviceId, isPlaying: true },
            4000
          );
        } catch (err) {
          console.warn('[ConnectEngine] Failed to notify remote speaker to relinquish:', err);
        }
      }

      // 2. Update engine & store: this device is now authoritative local speaker
      this.activeConnectionId = null;
      this.setActivePlayerDeviceId(self.deviceId);
      usePlayerStore.getState().setActivePlaybackDeviceId(self.deviceId);
      usePlayerStore.setState({ isLocalPlayback: true });

      const liveStore = usePlayerStore.getState();
      const candidateTrack = state.track || liveStore.currentSong;
      let posSec = (state.positionMs || 0) / 1000 || liveStore.currentTime || 0;
      if (liveStore.lastPositionTimestamp && liveStore.isPlaying) {
        const elapsedSec = (performance.now() - liveStore.lastPositionTimestamp) / 1000;
        posSec = Math.max(0, (liveStore.currentTime || 0) + elapsedSec);
      }

      // 3. Broadcast to all devices on the network that this device is now playing
      PlaybackStateManager.getInstance().emitLocalPlaybackState({
        playerDeviceId: self.deviceId,
        track: candidateTrack,
        isPlaying: true,
        positionMs: posSec * 1000,
      });

      // 4. Start local playback
      if (candidateTrack) {
        usePlayerStore.setState({
          currentSong: candidateTrack,
          isPlaying: true,
          playbackIntent: 'PLAYING',
          currentTime: posSec,
          isLocalPlayback: true,
        });

        await PlaybackService.getInstance().playTrack(candidateTrack, true, posSec);
        if (posSec > 0) {
          PlaybackService.getInstance().seek(posSec);
        }
      }

      setTimeout(() => PlaybackStateManager.getInstance().syncNow(), 150);
      return true;
    }

    // Step A: Connect to target device first (establishes transport & sends invite so target joins)
    const connected = await this.connectToDevice(targetDeviceId);
    if (!connected) {
      return false;
    }

    // Step B: Update player store and active player so this device acts as controller
    this.setActivePlayerDeviceId(targetDeviceId);
    const store = usePlayerStore.getState();
    store.setActivePlaybackDeviceId(targetDeviceId);

    // Step C: If there is an active song or queue candidate, hand it off to the target device
    const candidateTrack = store.currentSong || (store.queue && store.queue.length > 0 ? store.queue[0] : null);
    if (candidateTrack) {
      const connId = this.activeConnectionId || [self.deviceId, targetDeviceId].sort().join('_');
      const handoffResult = await HandoffManager.getInstance().switchPlaybackTo(connId, targetDeviceId);
      if (!handoffResult.success) {
        console.warn('[ConnectEngine] Handoff failed, retaining local playback:', handoffResult.reason);
        this.setActivePlayerDeviceId(self.deviceId);
        usePlayerStore.getState().setActivePlaybackDeviceId(self.deviceId);
        usePlayerStore.setState({ isLocalPlayback: true });
        usePlayerStore.getState().setToastMessage(`Failed to switch to remote device: ${handoffResult.reason || 'Device not ready'}`);
        return false;
      }
    } else {
      PlaybackStateManager.getInstance().requestPlaybackSync();
    }

    return true;
  }

  // Diagnostic Pings
  private setupDiagnosticPings(): void {
    TransportManager.getInstance().onMessage((event, payload) => {
      if (event === 'PING') {
        const self = DeviceIdentityManager.getInstance().getDevice();
        TransportManager.getInstance().sendMessage('PONG', {
          targetDeviceId: payload.senderDeviceId,
          originTimestamp: payload.timestamp,
        });
      } else if (event === 'PONG') {
        ConnectDiagnostics.getInstance().recordPong(payload.originTimestamp);
      }
    });
  }

  public isLocalSpeaker(): boolean {
    const self = DeviceIdentityManager.getInstance().getDevice();
    const store = usePlayerStore.getState();
    const activeId = (this.activePlayerDeviceId && this.activePlayerDeviceId !== self.deviceId)
      ? this.activePlayerDeviceId
      : store.activePlaybackDeviceId;
    return store.isLocalPlayback && (!activeId || activeId === self.deviceId);
  }

  public getActivePlayerDeviceId(): string {
    return this.activePlayerDeviceId;
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public getAvailableDevices(): DeviceInfo[] {
    const self = DeviceIdentityManager.getInstance().getDevice();
    return DeviceRegistry.getInstance().getAllDevices(self.deviceId);
  }

  public getThisDevice(): DeviceInfo {
    return DeviceIdentityManager.getInstance().getDevice();
  }

  public async renameDevice(newName: string): Promise<DeviceInfo> {
    DeviceIdentityManager.getInstance().setDeviceName(newName);
    const updated = DeviceIdentityManager.getInstance().getDevice();
    await DiscoveryEngine.getInstance().broadcastDeviceRename(newName);
    return updated;
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.stateChangeSubscribers.forEach((cb) => cb(state));
  }

  private setActivePlayerDeviceId(id: string): void {
    this.activePlayerDeviceId = id;
    try {
      usePlayerStore.getState().setActivePlaybackDeviceId(id);
    } catch {}
    this.activePlayerSubscribers.forEach((cb) => cb(id));
  }

  private setActiveControllerDeviceId(id: string | null): void {
    this.activeControllerDeviceId = id;
    this.activeControllerSubscribers.forEach((cb) => cb(id));
  }

  public getActiveControllerDeviceId(): string | null {
    return this.activeControllerDeviceId;
  }

  public onActiveControllerChange(cb: (id: string | null) => void): () => void {
    this.activeControllerSubscribers.add(cb);
    cb(this.activeControllerDeviceId);
    return () => { this.activeControllerSubscribers.delete(cb); };
  }

  public onConnectionStateChange(cb: (state: ConnectionState) => void): () => void {
    this.stateChangeSubscribers.add(cb);
    cb(this.connectionState);
    return () => { this.stateChangeSubscribers.delete(cb); };
  }

  public onActivePlayerChange(cb: (id: string) => void): () => void {
    this.activePlayerSubscribers.add(cb);
    cb(this.activePlayerDeviceId);
    return () => { this.activePlayerSubscribers.delete(cb); };
  }
}

export const connectEngine = ConnectEngine.getInstance();
