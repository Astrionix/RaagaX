/**
 * RaagaX Connect — Drift-Compensated Timeline Scrubber Hook
 *
 * Implements a high-precision 60 FPS requestAnimationFrame loop
 * deriving playback position from the authoritative server anchor.
 * Eliminates all setInterval timers, visual jitter, and -0:00 freezing.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TimelineAnchor } from './usePlaybackSync';

export interface UseTimelineScrubberProps {
  isPlaying: boolean;
  durationSec: number;
  anchor: TimelineAnchor;
  onSeekCommit?: (positionSec: number) => void;
}

export function useTimelineScrubber({
  isPlaying,
  durationSec,
  anchor,
  onSeekCommit,
}: UseTimelineScrubberProps) {
  const [displaySec, setDisplaySec] = useState<number>(() => Math.max(0, anchor.positionMs / 1000));
  const isSeekingRef = useRef<boolean>(false);
  const seekTargetSecRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);

  // Reset when anchor updates or track changes
  useEffect(() => {
    if (!isSeekingRef.current) {
      setDisplaySec(Math.max(0, anchor.positionMs / 1000));
    }
  }, [anchor.positionMs, anchor.timestamp]);

  // 60 FPS dynamic timeline calculation
  useEffect(() => {
    const loop = () => {
      if (!isSeekingRef.current) {
        if (!isPlaying) {
          const pausedSec = Math.max(0, anchor.positionMs / 1000);
          setDisplaySec(pausedSec);
        } else {
          const now = Date.now();
          const elapsedMs = Math.max(0, now - anchor.timestamp);
          const currentMs = anchor.positionMs + elapsedMs;
          const maxMs = durationSec > 0 ? durationSec * 1000 : Infinity;
          const clampedSec = Math.max(0, Math.min(currentMs, maxMs) / 1000);
          setDisplaySec(clampedSec);
        }
      }
      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isPlaying, durationSec, anchor.positionMs, anchor.timestamp]);

  const startSeek = useCallback((targetSec: number) => {
    isSeekingRef.current = true;
    seekTargetSecRef.current = targetSec;
    setDisplaySec(targetSec);
  }, []);

  const updateSeek = useCallback((targetSec: number) => {
    seekTargetSecRef.current = targetSec;
    setDisplaySec(targetSec);
  }, []);

  const commitSeek = useCallback(
    (targetSec?: number) => {
      const finalSec = typeof targetSec === 'number' ? targetSec : seekTargetSecRef.current;
      isSeekingRef.current = false;
      setDisplaySec(finalSec);
      if (onSeekCommit) {
        onSeekCommit(finalSec);
      }
    },
    [onSeekCommit]
  );

  const progressRatio = durationSec > 0 ? Math.min(1, Math.max(0, displaySec / durationSec)) : 0;

  return {
    displaySec,
    progressRatio,
    isSeeking: isSeekingRef.current,
    startSeek,
    updateSeek,
    commitSeek,
  };
}
