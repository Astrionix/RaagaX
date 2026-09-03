/**
 * RaagaX Connect — Drift-Compensated Zero-Re-render Timeline Scrubber Hook
 *
 * Implements a high-precision 60 FPS requestAnimationFrame loop:
 * 1. Direct Ref Mutation: Updates seekbar DOM nodes (transform / width) and textContent
 *    directly on attached refs without triggering 60 FPS React re-renders.
 * 2. Throttled State Fallback: Throttles React setState to >= 250ms for components
 *    that need reactive state, reducing Virtual DOM churn by >90%.
 * 3. Pause-State Halting: Shuts off the RAF loop completely when playback is paused.
 * 4. Drag Isolation: Suspends the interpolation loop while user drags, ensuring 0ms input latency.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TimelineAnchor } from './usePlaybackSync';

export interface UseTimelineScrubberProps {
  isPlaying: boolean;
  durationSec: number;
  anchor: TimelineAnchor;
  onSeekCommit?: (positionSec: number) => void;
  // Optional direct DOM element refs to bypass React state re-render cascades
  progressBarRef?: React.RefObject<HTMLElement | null>;
  thumbRef?: React.RefObject<HTMLElement | null>;
  currentTimeLabelRef?: React.RefObject<HTMLElement | null>;
  remainingTimeLabelRef?: React.RefObject<HTMLElement | null>;
}

export function formatScrubberTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function useTimelineScrubber({
  isPlaying,
  durationSec,
  anchor,
  onSeekCommit,
  progressBarRef,
  thumbRef,
  currentTimeLabelRef,
  remainingTimeLabelRef,
}: UseTimelineScrubberProps) {
  const [displaySec, setDisplaySec] = useState<number>(() => Math.max(0, anchor.positionMs / 1000));
  const isSeekingRef = useRef<boolean>(false);
  const seekTargetSecRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);
  const lastStateUpdateTimeRef = useRef<number>(0);
  const lastRenderTimeRef = useRef<number>(0);

  // Helper to directly mutate attached DOM nodes without triggering React reconciliation
  const updateDomNodes = useCallback(
    (sec: number, ratio: number) => {
      const pct = Math.min(100, Math.max(0, ratio * 100));

      if (progressBarRef?.current) {
        progressBarRef.current.style.width = `${pct}%`;
      }
      if (thumbRef?.current) {
        thumbRef.current.style.left = `${pct}%`;
      }
      if (currentTimeLabelRef?.current) {
        currentTimeLabelRef.current.textContent = formatScrubberTime(sec);
      }
      if (remainingTimeLabelRef?.current) {
        const remainingSec = Math.max(0, durationSec - sec);
        remainingTimeLabelRef.current.textContent = durationSec > 0 ? `-${formatScrubberTime(remainingSec)}` : '--:--';
      }
    },
    [durationSec, progressBarRef, thumbRef, currentTimeLabelRef, remainingTimeLabelRef]
  );

  // Reset when anchor updates or track changes
  useEffect(() => {
    if (!isSeekingRef.current) {
      const initialSec = Math.max(0, anchor.positionMs / 1000);
      const initialRatio = durationSec > 0 ? Math.min(1, initialSec / durationSec) : 0;
      updateDomNodes(initialSec, initialRatio);
      setDisplaySec(initialSec);
    }
  }, [anchor.positionMs, anchor.timestamp, durationSec, updateDomNodes]);

  // High-performance 60 FPS timeline interpolation loop
  useEffect(() => {
    // Pause-state loop halting: if paused, update DOM once and halt loop
    if (!isPlaying) {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      const pausedSec = Math.max(0, anchor.positionMs / 1000);
      const pausedRatio = durationSec > 0 ? Math.min(1, pausedSec / durationSec) : 0;
      updateDomNodes(pausedSec, pausedRatio);
      setDisplaySec(pausedSec);
      return; // Do NOT schedule next frame while paused
    }

    const loop = () => {
      // Suspend direct DOM loop while dragging; user input maintains absolute priority
      if (isSeekingRef.current) {
        animFrameIdRef.current = requestAnimationFrame(loop);
        return;
      }

      const now = performance.now();
      // 120Hz/144Hz Frame Throttling: Cap to ~60 FPS (~16ms delta)
      if (now - lastRenderTimeRef.current < 16) {
        animFrameIdRef.current = requestAnimationFrame(loop);
        return;
      }
      lastRenderTimeRef.current = now;

      const clockNow = Date.now();
      const elapsedMs = Math.max(0, clockNow - anchor.timestamp);
      const currentMs = anchor.positionMs + elapsedMs;
      const maxMs = durationSec > 0 ? durationSec * 1000 : Infinity;
      const clampedSec = Math.max(0, Math.min(currentMs, maxMs) / 1000);
      const ratio = durationSec > 0 ? Math.min(1, clampedSec / durationSec) : 0;

      // 1. DIRECT DOM MUTATION: 60 FPS buttery-smooth visual updates without React render cost
      updateDomNodes(clampedSec, ratio);

      // 2. THROTTLED REACT STATE: Dispatch setState at most every >= 250ms for components needing state
      if (now - lastStateUpdateTimeRef.current >= 250) {
        lastStateUpdateTimeRef.current = now;
        setDisplaySec(clampedSec);
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
  }, [isPlaying, durationSec, anchor.positionMs, anchor.timestamp, updateDomNodes]);

  const startSeek = useCallback(
    (targetSec: number) => {
      isSeekingRef.current = true;
      seekTargetSecRef.current = targetSec;
      const ratio = durationSec > 0 ? Math.min(1, targetSec / durationSec) : 0;
      updateDomNodes(targetSec, ratio);
      setDisplaySec(targetSec);
    },
    [durationSec, updateDomNodes]
  );

  const updateSeek = useCallback(
    (targetSec: number) => {
      seekTargetSecRef.current = targetSec;
      const ratio = durationSec > 0 ? Math.min(1, targetSec / durationSec) : 0;
      updateDomNodes(targetSec, ratio);
      setDisplaySec(targetSec);
    },
    [durationSec, updateDomNodes]
  );

  const commitSeek = useCallback(
    (targetSec?: number) => {
      const finalSec = typeof targetSec === 'number' ? targetSec : seekTargetSecRef.current;
      isSeekingRef.current = false;
      const ratio = durationSec > 0 ? Math.min(1, finalSec / durationSec) : 0;
      updateDomNodes(finalSec, ratio);
      setDisplaySec(finalSec);
      if (onSeekCommit) {
        onSeekCommit(finalSec);
      }
    },
    [durationSec, onSeekCommit, updateDomNodes]
  );

  const progressRatio = durationSec > 0 ? Math.min(1, Math.max(0, displaySec / durationSec)) : 0;

  return {
    displaySec,
    progressRatio,
    isSeeking: isSeekingRef.current,
    startSeek,
    updateSeek,
    commitSeek,
    formatTime: formatScrubberTime,
  };
}
