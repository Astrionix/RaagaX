/**
 * RaagaX Connect — Playback Authority
 *
 * THE SINGLE SOURCE OF TRUTH FOR AUDIO PLAYBACK.
 * Owns the physical audio player (`PlaybackService`, `AudioPlayer`),
 * exact millisecond pause capture, single committed seeks, queue progression,
 * and atomic metadata sync.
 */

import { ConnectCommand, ConnectPlaybackSession } from '@/types/connect';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { RaagaXNativePlayer } from '@/lib/playback/native/RaagaXNativePlayer';
import { PlaybackState } from '../state/PlaybackState';
import { RevisionManager } from '../state/RevisionManager';
import { StateReplicator } from '../state/StateReplicator';
import { CommandValidator } from '../commands/CommandValidator';
import { CommandDeduplicator } from '../commands/CommandDeduplicator';
import { ControllerManager } from './ControllerManager';
import { Song } from '@/types/music';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { JioSaavnMediaPipeline } from '@/lib/media/JioSaavnMediaPipeline';

export class PlaybackAuthority {
  private static instance: PlaybackAuthority;
  private currentSession: ConnectPlaybackSession;
  private revisionManager: RevisionManager = new RevisionManager();

  private constructor() {
    this.currentSession = PlaybackState.createInitialSession();
  }

  public static getInstance(): PlaybackAuthority {
    if (!PlaybackAuthority.instance) {
      PlaybackAuthority.instance = new PlaybackAuthority();
    }
    return PlaybackAuthority.instance;
  }

  public getSession(): ConnectPlaybackSession {
    return { ...this.currentSession };
  }

  public async executeCommand(command: ConnectCommand): Promise<{ success: boolean; session: ConnectPlaybackSession; duplicate?: boolean }> {
    const reqId = command.requestId || command.commandId;
    const deduplicator = CommandDeduplicator.getInstance();

    // 1. Idempotency Check
    if (reqId && deduplicator.isDuplicate(reqId)) {
      console.log(`[CONNECT_COMMAND_IDEMPOTENT] Duplicate suppressed: ${reqId}`);
      return { success: true, session: this.getSession(), duplicate: true };
    }

    // 2. Command Validation
    const validation = CommandValidator.getInstance().validate(command, this.currentSession.revision);
    if (!validation.valid) {
      console.warn(`[CONNECT_COMMAND_REJECTED] ${validation.reason}`);
      return { success: false, session: this.getSession() };
    }

    // 3. Register Controller
    if (command.senderDeviceId) {
      ControllerManager.getInstance().registerController(command.senderDeviceId);
      if (!this.currentSession.controllerIds.includes(command.senderDeviceId)) {
        this.currentSession.controllerIds.push(command.senderDeviceId);
      }
    }

    const store = usePlayerStore.getState();
    const now = Date.now();

    console.log(`[CONNECT_COMMAND]\ncommand=${command.action}\nrequestId=${reqId}\nexpectedRevision=${command.expectedRevision ?? 'none'}`);

    switch (command.action) {
      case 'TRANSFER_PLAYBACK': {
        const payload = command.payload;
        if (!payload || !payload.song) return { success: false, session: this.getSession() };

        const song = payload.song;
        const queue = payload.queue && payload.queue.length > 0 ? payload.queue : [song];
        const queueIndex = typeof payload.queueIndex === 'number' ? payload.queueIndex : 0;
        const startPositionMs = payload.positionMs || 0;
        const shouldPlay = payload.isPlaying !== false;

        console.log(`[CONNECT_HANDOFF]\nfromDevice=${payload.sourceDeviceId || command.senderDeviceId}\ntoDevice=${command.targetDeviceId}\npositionMs=${startPositionMs}`);

        this.currentSession = {
          ...this.currentSession,
          playbackDeviceId: command.targetDeviceId,
          currentTrackId: song.id,
          currentQueueItemId: `qitem_${song.id}_${now}`,
          currentSong: song,
          metadata: PlaybackState.formatMetadata(song),
          queue,
          queueIndex,
          positionMs: startPositionMs,
          anchorPositionMs: startPositionMs,
          anchorTimeMs: now,
          durationMs: Math.round((song.duration || 0) * 1000),
          isPlaying: shouldPlay,
          playbackState: shouldPlay ? 'PLAYING' : 'PAUSED',
          volume: typeof payload.volume === 'number' ? payload.volume : store.volume,
          generation: this.revisionManager.nextGeneration(),
          revision: this.revisionManager.nextRevision(),
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
        if (shouldPlay) {
          if (RaagaXNativePlayer.isNative() && formattedTrack.audioUrl) {
            await RaagaXNativePlayer.setQueue(
              [{ url: formattedTrack.audioUrl, title: formattedTrack.title, artist: formattedTrack.artist || '', artworkUrl: formattedTrack.coverUrl, trackId: formattedTrack.id }],
              0,
              true,
              startPositionMs
            ).catch(() => {});
          } else {
            const pb = PlaybackService.getInstance();
            const reqId = Date.now();
            pb.setPlaybackRequestId(reqId);
            await pb.loadAudioSource(formattedTrack, reqId, true, startPositionMs / 1000);
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
        this.currentSession.revision = this.revisionManager.nextRevision();
        this.currentSession.updatedAt = now;

        store.setIsPlaying(true);
        if (RaagaXNativePlayer.isNative()) {
          await RaagaXNativePlayer.resume().catch(() => {});
        } else {
          const pb = PlaybackService.getInstance().getActiveAudio();
          if (pb) pb.play().catch(() => {});
        }
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
        this.currentSession.revision = this.revisionManager.nextRevision();
        this.currentSession.updatedAt = now;

        store.setIsPlaying(false);
        if (RaagaXNativePlayer.isNative()) {
          await RaagaXNativePlayer.pause().catch(() => {});
        } else {
          const pb = PlaybackService.getInstance().getActiveAudio();
          if (pb) pb.pause();
        }
        break;
      }

      case 'SEEK': {
        const durationMs = this.currentSession.durationMs || (store.duration ? store.duration * 1000 : 0);
        const requestedMs = command.payload?.positionMs ?? 0;
        const clampedMs = Math.max(0, durationMs > 0 ? Math.min(requestedMs, durationMs) : requestedMs);

        this.currentSession.positionMs = clampedMs;
        this.currentSession.anchorPositionMs = clampedMs;
        this.currentSession.anchorTimeMs = now;
        this.currentSession.revision = this.revisionManager.nextRevision();
        this.currentSession.updatedAt = now;

        store.setCurrentTime(clampedMs / 1000);
        if (RaagaXNativePlayer.isNative()) {
          await RaagaXNativePlayer.seekTo(clampedMs / 1000).catch(() => {});
        } else {
          const pb = PlaybackService.getInstance().getActiveAudio();
          if (pb) pb.currentTime = clampedMs / 1000;
        }
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
            this.currentSession.revision = this.revisionManager.nextRevision();
            this.currentSession.updatedAt = now;

            usePlayerStore.setState({
              isPlaying: false,
              playbackIntent: 'PAUSED',
              currentTime: 0,
            });

            if (RaagaXNativePlayer.isNative()) {
              await RaagaXNativePlayer.pause().catch(() => {});
            } else {
              const pb = PlaybackService.getInstance().getActiveAudio();
              if (pb) pb.pause();
            }
            break;
          }

          const nextSong = queue[nextIdx];
          if (nextSong) {
            this.currentSession.currentTrackId = nextSong.id;
            this.currentSession.currentQueueItemId = `qitem_${nextSong.id}_${now}`;
            this.currentSession.currentSong = nextSong;
            this.currentSession.metadata = PlaybackState.formatMetadata(nextSong);
            this.currentSession.queueIndex = nextIdx;
            this.currentSession.positionMs = 0;
            this.currentSession.anchorPositionMs = 0;
            this.currentSession.anchorTimeMs = now;
            this.currentSession.durationMs = Math.round((nextSong.duration || 0) * 1000);
            this.currentSession.isPlaying = true;
            this.currentSession.playbackState = 'PLAYING';
            this.currentSession.generation = this.revisionManager.nextGeneration();
            this.currentSession.revision = this.revisionManager.nextRevision();
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

            if (RaagaXNativePlayer.isNative() && nextSong.audioUrl) {
              await RaagaXNativePlayer.setQueue(
                [{ url: nextSong.audioUrl, title: nextSong.title, artist: nextSong.artist || '', artworkUrl: nextSong.coverUrl, trackId: nextSong.id }],
                0,
                true,
                0
              ).catch(() => {});
            } else {
              const pb = PlaybackService.getInstance();
              const reqId = Date.now();
              pb.setPlaybackRequestId(reqId);
              await pb.loadAudioSource(nextSong, reqId, true, 0);
            }
          }
        }
        break;
      }

      case 'SKIP_PREV': {
        const queue = this.currentSession.queue;
        if (queue.length > 0) {
          const currentIdx = this.currentSession.queueIndex;
          const currentSec = usePlayerStore.getState().currentTime || 0;
          const repeat = (this.currentSession.repeat || 'OFF').toUpperCase();

          if (currentSec > 3) {
            this.currentSession.positionMs = 0;
            this.currentSession.anchorPositionMs = 0;
            this.currentSession.anchorTimeMs = now;
            this.currentSession.revision = this.revisionManager.nextRevision();
            this.currentSession.updatedAt = now;
            usePlayerStore.getState().setCurrentTime(0);
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
            this.currentSession.currentTrackId = prevSong.id;
            this.currentSession.currentQueueItemId = `qitem_${prevSong.id}_${now}`;
            this.currentSession.currentSong = prevSong;
            this.currentSession.metadata = PlaybackState.formatMetadata(prevSong);
            this.currentSession.queueIndex = prevIdx;
            this.currentSession.positionMs = 0;
            this.currentSession.anchorPositionMs = 0;
            this.currentSession.anchorTimeMs = now;
            this.currentSession.durationMs = Math.round((prevSong.duration || 0) * 1000);
            this.currentSession.isPlaying = true;
            this.currentSession.playbackState = 'PLAYING';
            this.currentSession.generation = this.revisionManager.nextGeneration();
            this.currentSession.revision = this.revisionManager.nextRevision();
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

            if (RaagaXNativePlayer.isNative() && prevSong.audioUrl) {
              await RaagaXNativePlayer.setQueue(
                [{ url: prevSong.audioUrl, title: prevSong.title, artist: prevSong.artist || '', artworkUrl: prevSong.coverUrl, trackId: prevSong.id }],
                0,
                true,
                0
              ).catch(() => {});
            } else {
              const pb = PlaybackService.getInstance();
              const reqId = Date.now();
              pb.setPlaybackRequestId(reqId);
              await pb.loadAudioSource(prevSong, reqId, true, 0);
            }
          }
        }
        break;
      }

      case 'SET_VOLUME': {
        const vol = typeof command.payload?.volume === 'number' ? Math.max(0, Math.min(1, command.payload.volume)) : 0.8;
        this.currentSession.volume = vol;
        this.currentSession.revision = this.revisionManager.nextRevision();
        this.currentSession.updatedAt = now;
        store.setVolume(vol);
        try {
          const pb = PlaybackService.getInstance().getActiveAudio();
          if (pb) pb.volume = vol;
        } catch {}
        break;
      }

      case 'ADD_TO_QUEUE': {
        if (command.payload?.song) {
          const newQueue = [...this.currentSession.queue, command.payload.song];
          this.currentSession.queue = newQueue;
          this.currentSession.revision = this.revisionManager.nextRevision();
          this.currentSession.updatedAt = now;
          usePlayerStore.setState({ queue: newQueue });
        }
        break;
      }

      case 'REMOVE_FROM_QUEUE': {
        if (typeof command.payload?.newIndex === 'number') {
          const newQueue = this.currentSession.queue.filter((_, idx) => idx !== command.payload?.newIndex);
          this.currentSession.queue = newQueue;
          this.currentSession.revision = this.revisionManager.nextRevision();
          this.currentSession.updatedAt = now;
          usePlayerStore.setState({ queue: newQueue });
        }
        break;
      }

      case 'SET_SHUFFLE': {
        this.currentSession.shuffle = !!command.payload?.shuffle;
        this.currentSession.revision = this.revisionManager.nextRevision();
        this.currentSession.updatedAt = now;
        break;
      }

      case 'SET_REPEAT': {
        this.currentSession.repeat = command.payload?.repeat || 'OFF';
        this.currentSession.revision = this.revisionManager.nextRevision();
        this.currentSession.updatedAt = now;
        break;
      }

      case 'DISCONNECT_CONTROLLER': {
        // INVARIANT: DISCONNECT MUST NOT STOP THE MUSIC.
        const controllerId = command.senderDeviceId;
        ControllerManager.getInstance().removeController(controllerId);
        this.currentSession.controllerIds = this.currentSession.controllerIds.filter((id) => id !== controllerId);
        break;
      }

      default:
        break;
    }

    if (reqId) {
      deduplicator.recordProcessed(reqId, this.currentSession.revision);
    }

    console.log(`[CONNECT_COMMAND_ACCEPTED]\nrequestId=${reqId}\nrevision=${this.currentSession.revision}`);
    console.log(`[CONNECT_PLAYBACK_STATE]\ntrackId=${this.currentSession.currentTrackId || 'none'}\npositionMs=${this.currentSession.positionMs}\nisPlaying=${this.currentSession.isPlaying}\nrevision=${this.currentSession.revision}\ntimelineId=${this.currentSession.timelineId}`);

    StateReplicator.getInstance().replicate(this.currentSession);
    return { success: true, session: this.getSession() };
  }
}
