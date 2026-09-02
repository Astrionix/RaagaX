/**
 * RaagaX Connect — Authoritative Playback Device Engine
 *
 * Runs on the ONE designated Audio Playback Device.
 * Owns the audio player, buffer, authoritative timeline, queue, history, and metadata.
 *
 * Invariants:
 * 1. ONE PLAYBACK DEVICE = ACTUAL AUDIO PLAYBACK DEVICE
 * 2. IDEMPOTENT COMMAND EXECUTION (duplicate requestIds rejected)
 * 3. STRUCTURED LOGGING ([CONNECT_SESSION], [CONNECT_COMMAND], [CONNECT_PLAYBACK_STATE], etc.)
 * 4. DISCONNECT = REMOVE CONTROL RELATIONSHIP, NOT STOP MUSIC.
 * 5. DEVICE SWITCH = CONTINUOUS HANDOFF, NOT PLAYBACK RESTART.
 */

import { ConnectCommand, ConnectPlaybackSession, ConnectEvent, ConnectTrackMetadata } from '@/types/connect';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { RaagaXNativePlayer } from '@/lib/playback/native/RaagaXNativePlayer';
import { ConnectDiscoveryEngine } from './ConnectDiscoveryEngine';
import { Song } from '@/types/music';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { JioSaavnMediaPipeline } from '@/lib/media/JioSaavnMediaPipeline';
import { SeekLock } from '@/lib/playback/SeekLock';
import { getApiUrl } from '@/lib/config/apiConfig';

type SessionUpdateListener = (session: ConnectPlaybackSession) => void;

export class ConnectServerEngine {
  private static instance: ConnectServerEngine;
  private currentSession: ConnectPlaybackSession;
  private listeners: Set<SessionUpdateListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private periodicSyncTimer: any = null;
  private processedRequestIds: Map<string, { revision: number; timestamp: number }> = new Map();

  private constructor() {
    const now = Date.now();
    let initialDeviceId = 'dev_local';
    let initialDeviceName = 'This Device';
    if (typeof window !== 'undefined') {
      try {
        const local = ConnectDiscoveryEngine.getInstance().getLocalDevice();
        if (local && local.deviceId) {
          initialDeviceId = local.deviceId;
          initialDeviceName = local.deviceName;
        }
      } catch { }
    }

    this.currentSession = {
      sessionId: `SESS_${now.toString(36)}`,
      playbackDeviceId: initialDeviceId,
      playbackDeviceName: initialDeviceName,
      controllerIds: [],
      currentTrackId: null,
      currentQueueItemId: null,
      currentSong: null,
      metadata: null,
      queue: [],
      queueIndex: 0,
      history: [],
      isPlaying: false,
      playbackState: 'IDLE',
      positionMs: 0,
      durationMs: 0,
      volume: 0.8,
      shuffle: false,
      repeat: 'OFF',
      revision: 1,
      generation: 1,
      timelineId: `TL_${now.toString(36)}`,
      anchorPositionMs: 0,
      anchorTimeMs: now,
      updatedAt: now,
    };

    this.logSession();

    if (typeof window !== 'undefined') {
      this.setupBroadcastChannel();
      this.setupStoreSubscription();
      this.startPeriodicSync();
    }
  }

  public static getInstance(): ConnectServerEngine {
    if (!ConnectServerEngine.instance) {
      ConnectServerEngine.instance = new ConnectServerEngine();
    }
    return ConnectServerEngine.instance;
  }

  private setupBroadcastChannel() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel('raaga_connect_rpc_channel');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'CONNECT_COMMAND' && event.data.command) {
          const cmd = event.data.command as ConnectCommand;
          const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();
          if (cmd.targetDeviceId === localDevice.deviceId || cmd.targetDeviceId === this.currentSession.playbackDeviceId || cmd.targetDeviceId === 'dev_local') {
            this.handleIncomingCommand(cmd);
          }
        }
      };
    } catch { }
  }

  public getSession(): ConnectPlaybackSession {
    return { ...this.currentSession };
  }

  private logSession() {
    console.log(`[CONNECT_SESSION]\nsessionId=${this.currentSession.sessionId}\nplaybackDeviceId=${this.currentSession.playbackDeviceId}`);
  }

  private logPlaybackState() {
    console.log(`[CONNECT_PLAYBACK_STATE]\ntrackId=${this.currentSession.currentTrackId || 'none'}\npositionMs=${this.currentSession.positionMs}\nisPlaying=${this.currentSession.isPlaying}\nrevision=${this.currentSession.revision}\ntimelineId=${this.currentSession.timelineId}`);
  }

  private extractMetadata(song: Song | null): ConnectTrackMetadata | null {
    if (!song) return null;
    return {
      trackId: song.id,
      title: song.title,
      artist: song.artist || 'Unknown Artist',
      album: song.album || 'Unknown Album',
      artworkUrl: song.coverUrl || '',
      durationMs: Math.round((song.duration || 0) * 1000),
      audioUrl: song.audioUrl || undefined,
    };
  }

  private startPeriodicSync() {
    if (this.periodicSyncTimer) return;
    this.periodicSyncTimer = setInterval(() => {
      if (this.currentSession.isPlaying) {
        this.publishPeriodicAnchor();
      }
    }, 1000);
  }

  private publishPeriodicAnchor() {
    const store = usePlayerStore.getState();
    let actualCurrentSec = store.currentTime || 0;
    try {
      const { PlaybackService } = require('@/lib/playback/PlaybackService');
      const active = PlaybackService.getInstance().getActiveAudio();
      if (active && !active.paused && !isNaN(active.currentTime)) {
        actualCurrentSec = active.currentTime;
      }
    } catch { }

    const actualCurrentMs = Math.round(actualCurrentSec * 1000);
    const now = Date.now();
    const durationMs = Math.round((store.duration || store.currentSong?.duration || 0) * 1000);

    this.currentSession.positionMs = actualCurrentMs;
    this.currentSession.anchorPositionMs = actualCurrentMs;
    this.currentSession.anchorTimeMs = now;
    this.currentSession.updatedAt = now;
    this.currentSession.durationMs = durationMs;

    // Keep the host store's currentTime fresh so the seekbar reads the live
    // position without relying on a BroadcastChannel echo (which is 2 s stale).
    if (!SeekLock.shouldBlockRemoteUpdate) {
      store.setCurrentTime(actualCurrentSec);
    }

    this.broadcastSessionUpdate();
  }

  /**
   * Execute an incoming remote command with strict idempotency and revision protection
   */
  public async handleIncomingCommand(command: ConnectCommand): Promise<{ success: boolean; session: ConnectPlaybackSession; duplicate?: boolean }> {
    // In browser environment, verify target is this device
    if (typeof window !== 'undefined') {
      const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();
      const isTargetMe = command.targetDeviceId === localDevice.deviceId ||
        command.targetDeviceId === this.currentSession.playbackDeviceId ||
        command.targetDeviceId === 'dev_local';
      if (!isTargetMe) {
        return { success: false, session: this.getSession() };
      }
    }

    const store = usePlayerStore.getState();
    const now = Date.now();

    console.log(`[CONNECT_COMMAND]\ncommand=${command.action}\nrequestId=${command.requestId || command.commandId}\nexpectedRevision=${command.expectedRevision ?? 'none'}`);

    // 1. Command Idempotency Protection: check if requestId was already processed
    const reqId = command.requestId || command.commandId;
    if (reqId && this.processedRequestIds.has(reqId)) {
      console.log(`[CONNECT_COMMAND_IDEMPOTENT] Ignoring duplicate requestId: ${reqId}`);
      return { success: true, session: this.getSession(), duplicate: true };
    }

    // 2. Register controller in active session if command came from an external controller
    const localDevice = typeof window !== 'undefined' ? ConnectDiscoveryEngine.getInstance().getLocalDevice() : null;
    const isFromRemoteController = command.senderDeviceId && (!localDevice || (command.senderDeviceId !== localDevice.deviceId && command.senderDeviceId !== 'dev_local'));

    if (
      isFromRemoteController &&
      command.action !== 'DISCONNECT_CONTROLLER' &&
      command.action !== 'CONTROLLER_DETACH_SELF' &&
      command.action !== 'SPEAKER_DETACH_CONTROLLER'
    ) {
      this.currentSession.controllerDeviceId = command.senderDeviceId;
      this.currentSession.controllerDeviceName = command.senderName || 'Remote Device';
      if (!this.currentSession.controllerIds.includes(command.senderDeviceId)) {
        this.currentSession.controllerIds.push(command.senderDeviceId);
      }
    }

    // 3. Stale revision protection: skip for authoritative user actions
    const bypassStaleCheck =
      command.action === 'TRANSFER_PLAYBACK' ||
      command.action === 'PLAY_SONG' ||
      command.action === 'SPEAKER_DETACH_CONTROLLER' ||
      command.action === 'CONTROLLER_DETACH_SELF' ||
      command.action === 'DISCONNECT_CONTROLLER';

    if (!bypassStaleCheck && typeof command.expectedRevision === 'number' && command.expectedRevision < this.currentSession.revision) {
      console.warn(`[CONNECT_COMMAND_REJECTED] Stale revision (expected ${command.expectedRevision} < current ${this.currentSession.revision})`);
      return { success: false, session: this.getSession() };
    }

    switch (command.action) {
      // PLAY_SONG: controller selects a specific track to play on this speaker.
      // Falls through to TRANSFER_PLAYBACK which handles the full load+play sequence.
      case 'PLAY_SONG':
      case 'TRANSFER_PLAYBACK': {
        const payload = command.payload;
        if (!payload || !payload.song) {
          return { success: false, session: this.getSession() };
        }

        const song = payload.song;
        const queue = payload.queue && payload.queue.length > 0 ? payload.queue : [song];
        const queueIndex = typeof payload.queueIndex === 'number' ? payload.queueIndex : 0;
        const startPositionMs = payload.positionMs || 0;
        const shouldPlay = payload.isPlaying !== false;

        const localDevice = typeof window !== 'undefined' ? ConnectDiscoveryEngine.getInstance().getLocalDevice() : null;

        // 0ms INSTANT SOUND CUT: Stop previous audio buffer immediately on speaker
        PlaybackService.getInstance().hardResetAudioPipeline();

        this.currentSession = {
          ...this.currentSession,
          playbackDeviceId: localDevice?.deviceId || command.targetDeviceId,
          playbackDeviceName: localDevice?.deviceName || this.currentSession.playbackDeviceName,
          currentTrackId: song.id,
          currentQueueItemId: `qitem_${song.id}_${now}`,
          currentSong: song,
          metadata: this.extractMetadata(song),
          queue,
          queueIndex,
          positionMs: startPositionMs,
          anchorPositionMs: startPositionMs,
          anchorTimeMs: now,
          durationMs: Math.round((song.duration || 0) * 1000),
          isPlaying: shouldPlay,
          playbackState: shouldPlay ? 'BUFFERING' : 'PAUSED',
          volume: typeof payload.volume === 'number' ? payload.volume : store.volume,
          generation: this.currentSession.generation + 1,
          revision: this.currentSession.revision + 1,
          timelineId: payload.timelineId || `TL_${now.toString(36)}`,
          updatedAt: now,
        };

        const formattedTrack: Song = SongFormatter.formatSong({
          ...song,
          coverUrl: JioSaavnMediaPipeline.getInstance().resolveSongArtwork({
            songCoverUrl: song.songCoverUrl,
            albumCoverUrl: song.albumCoverUrl,
            coverUrl: song.coverUrl,
          }) || song.coverUrl,
        });

        usePlayerStore.setState({
          queue,
          queueIndex,
          currentSong: formattedTrack,
          currentTime: startPositionMs / 1000,
          duration: formattedTrack.duration || song.duration || 0,
          isPlaying: shouldPlay,
          playbackIntent: shouldPlay ? 'PLAYING' : 'PAUSED',
        });

        if (typeof payload.volume === 'number') {
          usePlayerStore.getState().setVolume(payload.volume);
        }

        // Broadcast initial BUFFERING session state immediately to remote controllers
        this.broadcastSessionUpdate();

        if (shouldPlay) {
          if (RaagaXNativePlayer.isNative() && formattedTrack.audioUrl) {
            await RaagaXNativePlayer.setQueue(
              [{ url: formattedTrack.audioUrl, title: formattedTrack.title, artist: formattedTrack.artist || '', artworkUrl: formattedTrack.coverUrl, trackId: formattedTrack.id }],
              0,
              true,
              startPositionMs
            ).catch(() => { });
            this.currentSession.playbackState = 'PLAYING';
            this.broadcastSessionUpdate();
            try { PlaybackService.getInstance().triggerNextPreload(); } catch { }
          } else {
            const pb = PlaybackService.getInstance();
            const reqId = Date.now();
            pb.setPlaybackRequestId(reqId);
            await pb.loadAudioSource(formattedTrack, reqId, true, startPositionMs / 1000);
            this.currentSession.playbackState = 'PLAYING';
            this.broadcastSessionUpdate();
            try { pb.triggerNextPreload(); } catch { }
          }
        }
        break;
      }

      case 'PLAY':
      case 'RESUME': {
        const currentSec = store.currentTime || 0;
        const currentMs = Math.round(currentSec * 1000);
        const resumePosMs = this.currentSession.positionMs > 0 ? this.currentSession.positionMs : currentMs;

        this.currentSession.isPlaying = true;
        this.currentSession.playbackState = 'PLAYING';
        this.currentSession.positionMs = resumePosMs;
        this.currentSession.anchorPositionMs = resumePosMs;
        this.currentSession.anchorTimeMs = now;
        this.currentSession.revision += 1;
        this.currentSession.updatedAt = now;

        store.setIsPlaying(true);
        if (RaagaXNativePlayer.isNative()) {
          await RaagaXNativePlayer.resume().catch(() => { });
        } else {
          const pb = PlaybackService.getInstance().getActiveAudio();
          if (pb) pb.play().catch(() => { });
        }
        this.broadcastSessionUpdate();
        break;
      }

      case 'PAUSE': {
        // Authoritative actual player position capture
        const exactCurrentSec = store.currentTime || 0;
        const exactCurrentMs = Math.round(exactCurrentSec * 1000);

        this.currentSession.isPlaying = false;
        this.currentSession.playbackState = 'PAUSED';
        this.currentSession.positionMs = exactCurrentMs;
        this.currentSession.anchorPositionMs = exactCurrentMs;
        this.currentSession.anchorTimeMs = now;
        this.currentSession.revision += 1;
        this.currentSession.updatedAt = now;

        store.setIsPlaying(false);
        if (RaagaXNativePlayer.isNative()) {
          await RaagaXNativePlayer.pause().catch(() => { });
        } else {
          const pb = PlaybackService.getInstance().getActiveAudio();
          if (pb) pb.pause();
        }
        this.broadcastSessionUpdate();
        break;
      }

      case 'SEEK': {
        const durationMs = this.currentSession.durationMs || (store.duration ? store.duration * 1000 : 0);
        const requestedMs = command.payload?.positionMs ?? 0;
        const clampedMs = Math.max(0, durationMs > 0 ? Math.min(requestedMs, durationMs) : requestedMs);

        this.currentSession.positionMs = clampedMs;
        this.currentSession.anchorPositionMs = clampedMs;
        this.currentSession.anchorTimeMs = now;
        this.currentSession.revision += 1;
        this.currentSession.updatedAt = now;

        store.setCurrentTime(clampedMs / 1000);
        if (RaagaXNativePlayer.isNative()) {
          await RaagaXNativePlayer.seekTo(clampedMs / 1000).catch(() => { });
        } else {
          const pb = PlaybackService.getInstance().getActiveAudio();
          if (pb) pb.currentTime = clampedMs / 1000;
        }
        this.broadcastSessionUpdate();
        break;
      }

      case 'SKIP_NEXT': {
        const queue = this.currentSession.queue;
        if (queue.length > 0) {
          const currentIdx = this.currentSession.queueIndex;
          const repeat = (this.currentSession.repeat || 'OFF').toUpperCase();

          let nextIdx = -1;
          if (repeat === 'ONE' || repeat === 'TRACK') {
            nextIdx = currentIdx;
          } else if (currentIdx + 1 < queue.length) {
            nextIdx = currentIdx + 1;
          } else if (repeat === 'ALL' || repeat === 'CONTEXT') {
            nextIdx = 0;
          } else {
            // Repeat OFF: Queue Exhausted! Do NOT loop back to track 0!
            nextIdx = -1;
          }

          if (this.currentSession.currentSong) {
            this.currentSession.history.push(this.currentSession.currentSong);
          }

          if (nextIdx === -1) {
            // Strict Queue Exhaustion: pause playback gracefully
            this.currentSession.isPlaying = false;
            this.currentSession.playbackState = 'PAUSED';
            this.currentSession.positionMs = 0;
            this.currentSession.anchorPositionMs = 0;
            this.currentSession.anchorTimeMs = now;
            this.currentSession.revision += 1;
            this.currentSession.updatedAt = now;

            usePlayerStore.setState({
              isPlaying: false,
              playbackIntent: 'PAUSED',
              currentTime: 0,
            });

            if (RaagaXNativePlayer.isNative()) {
              await RaagaXNativePlayer.pause().catch(() => { });
            } else {
              const pb = PlaybackService.getInstance().getActiveAudio();
              if (pb) pb.pause();
            }
            break;
          }

          const nextSong = queue[nextIdx];
          if (nextSong) {
            // 0ms INSTANT SOUND CUT: Stop previous audio buffer immediately on speaker
            PlaybackService.getInstance().hardResetAudioPipeline();

            this.currentSession.currentTrackId = nextSong.id;
            this.currentSession.currentQueueItemId = `qitem_${nextSong.id}_${now}`;
            this.currentSession.currentSong = nextSong;
            this.currentSession.metadata = this.extractMetadata(nextSong);
            this.currentSession.queueIndex = nextIdx;
            this.currentSession.positionMs = 0;
            this.currentSession.anchorPositionMs = 0;
            this.currentSession.anchorTimeMs = now;
            this.currentSession.durationMs = Math.round((nextSong.duration || 0) * 1000);
            this.currentSession.isPlaying = true;
            this.currentSession.playbackState = 'BUFFERING';
            this.currentSession.generation += 1;
            this.currentSession.revision += 1;
            this.currentSession.timelineId = `TL_${now.toString(36)}`;
            this.currentSession.updatedAt = now;

            usePlayerStore.setState({
              currentSong: nextSong,
              queueIndex: nextIdx,
              currentTime: 0,
              duration: nextSong.duration || 0,
              isPlaying: true,
              playbackIntent: 'PLAYING',
            });

            this.broadcastSessionUpdate();

            if (RaagaXNativePlayer.isNative() && nextSong.audioUrl) {
              await RaagaXNativePlayer.setQueue(
                [{ url: nextSong.audioUrl, title: nextSong.title, artist: nextSong.artist || '', artworkUrl: nextSong.coverUrl, trackId: nextSong.id }],
                0,
                true,
                0
              ).catch(() => { });
              this.currentSession.playbackState = 'PLAYING';
              this.broadcastSessionUpdate();
              try { PlaybackService.getInstance().triggerNextPreload(); } catch { }
            } else {
              const pb = PlaybackService.getInstance();
              const reqId = Date.now();
              pb.setPlaybackRequestId(reqId);
              await pb.loadAudioSource(nextSong, reqId, true, 0);
              this.currentSession.playbackState = 'PLAYING';
              this.broadcastSessionUpdate();
              try { pb.triggerNextPreload(); } catch { }
            }
          }
        }
        break;
      }

      case 'SKIP_PREV': {
        const queue = this.currentSession.queue;
        if (queue.length > 0) {
          const currentIdx = this.currentSession.queueIndex;
          const currentSec = store.currentTime || 0;
          const repeat = (this.currentSession.repeat || 'OFF').toUpperCase();

          // If listened to more than 3 seconds, seek back to 0 of current song
          if (currentSec > 3) {
            this.currentSession.positionMs = 0;
            this.currentSession.anchorPositionMs = 0;
            this.currentSession.anchorTimeMs = now;
            this.currentSession.revision += 1;
            this.currentSession.updatedAt = now;
            store.setCurrentTime(0);
            const pb = PlaybackService.getInstance().getActiveAudio();
            if (pb) pb.currentTime = 0;
            break;
          }

          let prevIdx = 0;
          if (repeat === 'ONE' || repeat === 'TRACK') {
            prevIdx = currentIdx;
          } else if (currentIdx > 0) {
            prevIdx = currentIdx - 1;
          } else if (repeat === 'ALL' || repeat === 'CONTEXT') {
            prevIdx = queue.length - 1;
          } else {
            prevIdx = 0;
          }

          const prevSong = queue[prevIdx];
          if (prevSong) {
            // 0ms INSTANT SOUND CUT: Stop previous audio buffer immediately on speaker
            PlaybackService.getInstance().hardResetAudioPipeline();

            this.currentSession.currentTrackId = prevSong.id;
            this.currentSession.currentQueueItemId = `qitem_${prevSong.id}_${now}`;
            this.currentSession.currentSong = prevSong;
            this.currentSession.metadata = this.extractMetadata(prevSong);
            this.currentSession.queueIndex = prevIdx;
            this.currentSession.positionMs = 0;
            this.currentSession.anchorPositionMs = 0;
            this.currentSession.anchorTimeMs = now;
            this.currentSession.durationMs = Math.round((prevSong.duration || 0) * 1000);
            this.currentSession.isPlaying = true;
            this.currentSession.playbackState = 'BUFFERING';
            this.currentSession.generation += 1;
            this.currentSession.revision += 1;
            this.currentSession.timelineId = `TL_${now.toString(36)}`;
            this.currentSession.updatedAt = now;

            usePlayerStore.setState({
              currentSong: prevSong,
              queueIndex: prevIdx,
              currentTime: 0,
              duration: prevSong.duration || 0,
              isPlaying: true,
              playbackIntent: 'PLAYING',
            });

            this.broadcastSessionUpdate();

            if (RaagaXNativePlayer.isNative() && prevSong.audioUrl) {
              await RaagaXNativePlayer.setQueue(
                [{ url: prevSong.audioUrl, title: prevSong.title, artist: prevSong.artist || '', artworkUrl: prevSong.coverUrl, trackId: prevSong.id }],
                0,
                true,
                0
              ).catch(() => { });
              this.currentSession.playbackState = 'PLAYING';
              this.broadcastSessionUpdate();
              try { PlaybackService.getInstance().triggerNextPreload(); } catch { }
            } else {
              const pb = PlaybackService.getInstance();
              const reqId = Date.now();
              pb.setPlaybackRequestId(reqId);
              await pb.loadAudioSource(prevSong, reqId, true, 0);
              this.currentSession.playbackState = 'PLAYING';
              this.broadcastSessionUpdate();
              try { pb.triggerNextPreload(); } catch { }
            }
          }
        }
        break;
      }

      case 'SET_VOLUME': {
        const vol = typeof command.payload?.volume === 'number' ? Math.max(0, Math.min(1, command.payload.volume)) : 0.8;
        this.currentSession.volume = vol;
        this.currentSession.revision += 1;
        this.currentSession.updatedAt = now;
        store.setVolume(vol);
        // Use smooth ramp (25ms rAF-based linear interpolation) to avoid audio pop on gain change
        try {
          const { SpeakerVolumeGainManager } = require('@/lib/playback/SpeakerVolumeGainManager');
          SpeakerVolumeGainManager.getInstance().setSmoothVolume(vol);
        } catch {
          // Fallback: instant assignment if manager unavailable
          const { PlaybackService } = require('@/lib/playback/PlaybackService');
          const pb = PlaybackService.getInstance().getActiveAudio();
          if (pb) pb.volume = vol;
        }
        this.broadcastSessionUpdate();
        break;
      }

      case 'ADD_TO_QUEUE': {
        if (command.payload?.song) {
          const newQueue = [...this.currentSession.queue, command.payload.song];
          this.currentSession.queue = newQueue;
          this.currentSession.revision += 1;
          this.currentSession.updatedAt = now;
          usePlayerStore.setState({ queue: newQueue });
          this.broadcastSessionUpdate();
        }
        break;
      }

      case 'REMOVE_FROM_QUEUE': {
        if (typeof command.payload?.newIndex === 'number') {
          const newQueue = this.currentSession.queue.filter((_, idx) => idx !== command.payload?.newIndex);
          this.currentSession.queue = newQueue;
          this.currentSession.revision += 1;
          this.currentSession.updatedAt = now;
          usePlayerStore.setState({ queue: newQueue });
          this.broadcastSessionUpdate();
        } else if (command.payload?.trackId) {
          const newQueue = this.currentSession.queue.filter((s) => s.id !== command.payload?.trackId);
          this.currentSession.queue = newQueue;
          this.currentSession.revision += 1;
          this.currentSession.updatedAt = now;
          usePlayerStore.setState({ queue: newQueue });
          this.broadcastSessionUpdate();
        }
        break;
      }

      case 'REORDER_QUEUE': {
        if (Array.isArray(command.payload?.queue)) {
          this.currentSession.queue = command.payload.queue;
          if (typeof command.payload.queueIndex === 'number') {
            this.currentSession.queueIndex = command.payload.queueIndex;
          }
          this.currentSession.revision += 1;
          this.currentSession.updatedAt = now;
          usePlayerStore.setState({
            queue: command.payload.queue,
            ...(typeof command.payload.queueIndex === 'number' ? { queueIndex: command.payload.queueIndex } : {}),
          });
          this.broadcastSessionUpdate();
        }
        break;
      }

      case 'SET_SHUFFLE': {
        this.currentSession.shuffle = !!command.payload?.shuffle;
        this.currentSession.revision += 1;
        this.currentSession.updatedAt = now;
        this.broadcastSessionUpdate();
        break;
      }

      case 'SET_REPEAT': {
        this.currentSession.repeat = command.payload?.repeat || 'OFF';
        this.currentSession.revision += 1;
        this.currentSession.updatedAt = now;
        this.broadcastSessionUpdate();
        break;
      }

      case 'CONTROLLER_DETACH_SELF':
      case 'DISCONNECT_CONTROLLER': {
        // INVARIANT: DISCONNECT MUST NOT STOP THE MUSIC.
        const controllerId = command.senderDeviceId;
        this.currentSession.controllerIds = this.currentSession.controllerIds.filter((id) => id !== controllerId);
        if (this.currentSession.controllerDeviceId === controllerId) {
          this.currentSession.controllerDeviceId = null;
          this.currentSession.controllerDeviceName = null;
        }
        this.currentSession.revision += 1;
        this.currentSession.updatedAt = now;
        console.log(`[CONNECT_DISCONNECT]\ncontrollerId=${controllerId}\nplaybackContinues=true`);
        break;
      }

      case 'SPEAKER_DETACH_CONTROLLER': {
        // Device Y cuts off controller Device X. Music keeps playing locally.
        const targetControllerId = command.payload?.controllerId || this.currentSession.controllerDeviceId;
        this.currentSession.controllerDeviceId = null;
        this.currentSession.controllerDeviceName = null;
        this.currentSession.controllerIds = [];
        this.currentSession.revision += 1;
        this.currentSession.updatedAt = now;
        console.log(`[SPEAKER_DETACH_CONTROLLER]\ntargetControllerId=${targetControllerId}\nplaybackContinues=true`);

        if (this.broadcastChannel && targetControllerId) {
          try {
            this.broadcastChannel.postMessage({
              type: 'CONTROLLER_DETACHED_BY_SPEAKER',
              controllerId: targetControllerId,
              speakerId: this.currentSession.playbackDeviceId,
            });
          } catch { }
        }
        break;
      }

      case 'REQUEST_SNAPSHOT': {
        // Return latest authoritative snapshot
        break;
      }

      default:
        break;
    }

    // Cache requestId for idempotency
    if (reqId) {
      this.processedRequestIds.set(reqId, {
        revision: this.currentSession.revision,
        timestamp: now,
      });
    }

    console.log(`[CONNECT_COMMAND_ACCEPTED]\nrequestId=${reqId}\nrevision=${this.currentSession.revision}`);
    this.logPlaybackState();
    this.broadcastSessionUpdate();

    return { success: true, session: this.getSession() };
  }

  private syncFromLocalStoreAfterTrackChange(): void {
    const store = usePlayerStore.getState();
    const now = Date.now();
    const song = store.currentSong;

    this.currentSession = {
      ...this.currentSession,
      currentTrackId: song?.id || null,
      currentQueueItemId: song ? `qitem_${song.id}_${now}` : null,
      currentSong: song,
      metadata: this.extractMetadata(song),
      queue: store.queue,
      queueIndex: store.queueIndex,
      positionMs: 0,
      anchorPositionMs: 0,
      anchorTimeMs: now,
      durationMs: Math.round((store.duration || song?.duration || 0) * 1000),
      isPlaying: store.isPlaying,
      playbackState: store.isPlaying ? 'PLAYING' : 'PAUSED',
      generation: this.currentSession.generation + 1,
      revision: this.currentSession.revision + 1,
      timelineId: `TL_${now.toString(36)}`,
      updatedAt: now,
    };
  }

  private broadcastSessionUpdate(): void {
    if (this.broadcastChannel) {
      try {
        const event: ConnectEvent = {
          eventId: `EV_${Date.now().toString(36)}`,
          type: 'SESSION_STATE_CHANGED',
          senderDeviceId: this.currentSession.playbackDeviceId,
          session: this.currentSession,
          serverTimestamp: Date.now(),
        };
        this.broadcastChannel.postMessage(event);
      } catch { }
    }

    // Broadcast via Supabase Realtime across any network
    try {
      const { ConnectDiscoveryEngine } = require('./ConnectDiscoveryEngine');
      ConnectDiscoveryEngine.getInstance().sendSupabaseBroadcast('SESSION_UPDATE', this.currentSession);
    } catch { }

    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      fetch(getApiUrl('/api/connect/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.currentSession),
      }).catch(() => { });
    }

    this.notifyListeners();
  }

  private setupStoreSubscription(): void {
    if (typeof window === 'undefined') return;

    usePlayerStore.subscribe((state, prevState) => {
      // If this device is acting as a remote controller, do NOT broadcast as Host
      try {
        const { ConnectClientManager } = require('./ConnectClientManager');
        if (ConnectClientManager.getInstance().isRemoteMode()) {
          return;
        }
      } catch { }

      const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();
      this.currentSession.playbackDeviceId = localDevice.deviceId;
      this.currentSession.playbackDeviceName = localDevice.deviceName;

      const trackChanged = state.currentSong?.id !== prevState.currentSong?.id;
      const playStateChanged = state.isPlaying !== prevState.isPlaying;
      const queueIndexChanged = state.queueIndex !== prevState.queueIndex;
      const volumeChanged = state.volume !== prevState.volume;

      if (trackChanged || playStateChanged || queueIndexChanged || volumeChanged) {
        const now = Date.now();
        const curMs = Math.round((state.currentTime || 0) * 1000);
        const song = state.currentSong;

        this.currentSession.currentTrackId = song?.id || null;
        this.currentSession.currentSong = song;
        this.currentSession.metadata = this.extractMetadata(song);
        this.currentSession.queue = state.queue;
        this.currentSession.queueIndex = state.queueIndex;
        this.currentSession.isPlaying = state.isPlaying;
        this.currentSession.playbackState = state.isPlaying ? 'PLAYING' : 'PAUSED';
        this.currentSession.volume = state.volume;
        this.currentSession.durationMs = Math.round((state.duration || song?.duration || 0) * 1000);
        this.currentSession.positionMs = curMs;
        this.currentSession.anchorPositionMs = curMs;
        this.currentSession.anchorTimeMs = now;
        this.currentSession.revision += 1;
        this.currentSession.updatedAt = now;

        if (trackChanged) {
          this.currentSession.generation += 1;
          this.currentSession.timelineId = `TL_${now.toString(36)}`;
        }

        // Broadcast to all connected controllers immediately!
        this.broadcastSessionUpdate();
      }
    });
  }

  /**
   * Speaker Action: Disconnect and detach any remote controller currently driving playback.
   * Audio output on this speaker remains completely uninterrupted.
   */
  public disconnectRemoteController(): boolean {
    const now = Date.now();
    const oldControllerId = this.currentSession.controllerDeviceId;
    this.currentSession.controllerDeviceId = null;
    this.currentSession.controllerDeviceName = null;
    this.currentSession.controllerIds = [];
    this.currentSession.revision += 1;
    this.currentSession.updatedAt = now;

    console.log(`[SPEAKER_DETACH_CONTROLLER]\ndetachedController=${oldControllerId}\nplaybackContinues=true`);

    if (this.broadcastChannel && oldControllerId) {
      try {
        this.broadcastChannel.postMessage({
          type: 'CONTROLLER_DETACHED_BY_SPEAKER',
          controllerId: oldControllerId,
          speakerId: this.currentSession.playbackDeviceId,
        });
      } catch { }
    }

    this.broadcastSessionUpdate();
    return true;
  }

  public subscribe(listener: SessionUpdateListener): () => void {
    this.listeners.add(listener);
    listener(this.getSession());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const session = this.getSession();
    this.listeners.forEach((listener) => {
      try {
        listener(session);
      } catch { }
    });
  }
}
