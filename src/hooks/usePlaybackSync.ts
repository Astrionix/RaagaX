/**
 * RaagaX Connect — Unified Multi-Device Playback Sync Hook
 *
 * Ensures BOTH Host and Client maintain identical playback state,
 * track metadata (artwork, title, artist), transport status, and timeline anchors.
 * Completely eliminates unidirectional drift and frozen host UI.
 */

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useConnectStore } from '@/context/useConnectStore';
import { ConnectPlaybackSession } from '@/types/connect';
import { Song } from '@/types/music';

export interface TimelineAnchor {
  positionMs: number;
  timestamp: number;
}

export function usePlaybackSync() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);

  const { isRemoteMode, remoteSession, activePlaybackDevice } = useConnectStore();

  const lastAppliedRevisionRef = useRef<number>(0);
  const timelineAnchorRef = useRef<TimelineAnchor>({
    positionMs: Math.round(currentTime * 1000),
    timestamp: Date.now(),
  });

  // Effective unified active song across Host and Client
  const activeSong: Song | null =
    (isRemoteMode && remoteSession?.currentSong)
      ? remoteSession.currentSong
      : (remoteSession?.currentSong && remoteSession.currentSong.id !== currentSong?.id)
      ? remoteSession.currentSong
      : currentSong;

  const activeIsPlaying = isRemoteMode && remoteSession ? remoteSession.isPlaying : isPlaying;

  const effectiveDuration =
    (isRemoteMode && remoteSession?.durationMs)
      ? remoteSession.durationMs / 1000
      : activeSong?.duration || duration || 0;

  // Synchronize incoming authoritative sessions into local store
  useEffect(() => {
    if (!remoteSession) return;

    // Monotonic revision check
    if (remoteSession.revision < lastAppliedRevisionRef.current) {
      return;
    }
    lastAppliedRevisionRef.current = remoteSession.revision;

    // Update timeline anchor
    timelineAnchorRef.current = {
      positionMs: remoteSession.positionMs,
      timestamp: remoteSession.anchorTimeMs || remoteSession.updatedAt || Date.now(),
    };

    // If remote track changed or play state changed, synchronize into store
    const store = usePlayerStore.getState();
    const isDifferentTrack = remoteSession.currentSong && remoteSession.currentSong.id !== store.currentSong?.id;
    const isDifferentPlayState = remoteSession.isPlaying !== store.isPlaying;

    if (isDifferentTrack || isDifferentPlayState) {
      usePlayerStore.setState({
        currentSong: remoteSession.currentSong || store.currentSong,
        isPlaying: remoteSession.isPlaying,
        playbackIntent: remoteSession.isPlaying ? 'PLAYING' : 'PAUSED',
        duration: remoteSession.durationMs ? remoteSession.durationMs / 1000 : store.duration,
        queue: remoteSession.queue && remoteSession.queue.length > 0 ? remoteSession.queue : store.queue,
        queueIndex: typeof remoteSession.queueIndex === 'number' ? remoteSession.queueIndex : store.queueIndex,
      });
    }
  }, [remoteSession]);

  return {
    activeSong,
    isPlaying: activeIsPlaying,
    duration: effectiveDuration,
    queue,
    queueIndex,
    isRemoteMode,
    remoteSession,
    activePlaybackDevice,
    timelineAnchor: timelineAnchorRef.current,
  };
}
