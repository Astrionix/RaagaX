/**
 * RaagaX Connect — Playback State Builder
 *
 * Provides factory functions and immutable state management for ConnectPlaybackSession.
 */

import { ConnectPlaybackSession, ConnectTrackMetadata } from '@/types/connect';
import { Song } from '@/types/music';

export class PlaybackState {
  public static createInitialSession(deviceId: string = 'dev_local', deviceName: string = 'This Device'): ConnectPlaybackSession {
    const now = Date.now();
    return {
      sessionId: `SESS_${now.toString(36)}`,
      playbackDeviceId: deviceId,
      playbackDeviceName: deviceName,
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
  }

  public static formatMetadata(song: Song | null): ConnectTrackMetadata | null {
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
}
