'use client';

import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

/**
 * usePlaybackSession
 * 
 * Canonical hook for observing the single authoritative RaagaX PlaybackSession.
 * 
 * Invariants:
 * 1. ONE Authoritative PlaybackSession & ONE Audio Engine.
 * 2. Full Player, MiniPlayer, Lock Screen, and Notification Shade READ the same state.
 * 3. All commands route through the global PlaybackController / PlaybackService.
 */
export function usePlaybackSession() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const shuffleMode = usePlayerStore((s) => s.shuffleMode);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const playbackStatus = usePlayerStore((s) => s.playbackStatus);

  // Authoritative Playback Controller Actions
  const playSong = usePlayerStore((s) => s.playSong);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrev = usePlayerStore((s) => s.playPrev);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeatMode = usePlayerStore((s) => s.cycleRepeatMode);

  const seek = (timeSec: number) => {
    setCurrentTime(timeSec);
    import('@/lib/playback/PlaybackService').then(({ PlaybackService }) => {
      PlaybackService.getInstance().seek(timeSec);
    }).catch(() => {});
  };

  return {
    // Current Track & Playback State
    currentTrack: currentSong,
    currentTrackId: currentSong?.id || null,
    isPlaying,
    position: currentTime,
    currentTime,
    duration,
    playbackStatus,

    // Queue State
    queue,
    currentQueueIndex: queueIndex,
    queueIndex,

    // Modes
    shuffleMode,
    repeatMode,

    // Authoritative Playback Controller Commands
    play: (track?: Song, queueContext?: Song[], contextInfo?: any) => {
      if (track) {
        playSong(track, queueContext, contextInfo);
      } else if (!isPlaying) {
        togglePlayPause();
      }
    },
    pause: () => {
      if (isPlaying) {
        togglePlayPause();
      }
    },
    toggle: togglePlayPause,
    togglePlayPause,
    next: playNext,
    playNext,
    previous: playPrev,
    playPrev,
    seek,
    seekTo: seek,
    toggleShuffle,
    cycleRepeatMode,
  };
}
