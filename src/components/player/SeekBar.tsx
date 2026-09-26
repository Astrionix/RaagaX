'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SeekLock } from '@/lib/playback/SeekLock';
import { PlaybackService } from '@/lib/playback/PlaybackService';

/**
 * Universal Audio Time Formatter
 * Always returns '0:00' if input is NaN, null, undefined, infinite, negative, or 0.
 * Never renders NaN, Infinity, undefined, or empty strings.
 */
export function formatTime(seconds: number): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || isNaN(seconds) || seconds <= 0) {
    return '0:00';
  }
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface SeekBarProps {
  className?: string;
  height?: string;
  thumbSize?: string;
  activeColor?: string;
  accentGradient?: string;
  accentGlow?: string;
  trackColor?: string;
  showTimeLabels?: boolean;
  timeLabelClass?: string;
  disabled?: boolean;
}

export function SeekBar({
  className = '',
  height = 'h-[3px]',
  thumbSize = 'w-3 h-3',
  accentGradient,
  accentGlow,
  trackColor,
  showTimeLabels = false,
  timeLabelClass = 'text-xs text-white/40 font-mono font-medium',
  disabled = false,
}: SeekBarProps) {
  const storeSong = usePlayerStore((s) => s.currentSong);
  const storeDuration = usePlayerStore((s) => s.duration);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setSeekTarget = usePlayerStore((s) => s.setSeekTarget);

  const trackRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const timeLabelLeftRef = useRef<HTMLSpanElement>(null);

  const [isSeeking, setIsSeeking] = useState(false);
  const [isSeekSettling, setIsSeekSettling] = useState(false);
  const [localProgress, setLocalProgress] = useState(0); // 0 to 1
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);

  const activeSong = storeSong;
  const hasTrack = Boolean(activeSong);

  // Effective duration calculation
  const effectiveDuration = useMemo(() => {
    if (activeSong?.duration && Number.isFinite(activeSong.duration) && activeSong.duration > 0) {
      return activeSong.duration;
    }
    if (Number.isFinite(storeDuration) && storeDuration > 0) {
      return storeDuration;
    }
    return 0;
  }, [activeSong?.duration, storeDuration]);

  const isDurationValid = hasTrack && Number.isFinite(effectiveDuration) && effectiveDuration > 0;
  const isInteractive = hasTrack && isDurationValid && !disabled;

  const prevProgressRef = useRef(0);
  const lastStateUpdateTimeRef = useRef<number>(0);
  const lastRenderTimeRef = useRef<number>(0);

  // Instantly reset seek progress when track switches or duration clears
  useEffect(() => {
    prevProgressRef.current = 0;
    if (progressFillRef.current) progressFillRef.current.style.width = '0%';
    if (thumbRef.current) thumbRef.current.style.left = '0%';
    if (timeLabelLeftRef.current) timeLabelLeftRef.current.textContent = '0:00';
    setLocalProgress(0);
  }, [activeSong?.id, effectiveDuration]);

  // 60 FPS continuous high-performance render loop for Seekbar & time label
  useEffect(() => {
    let animFrame: number;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      const now = performance.now();
      // Cap updates to ~60 FPS (~16ms delta)
      if (now - lastRenderTimeRef.current < 16) {
        animFrame = requestAnimationFrame(tick);
        return;
      }
      lastRenderTimeRef.current = now;

      if (!isSeeking && !isSeekSettling && isDurationValid) {
        let liveSec: number;
        let activeAudio: HTMLAudioElement | null = null;
        try {
          activeAudio = PlaybackService.getInstance().getActiveAudio();
        } catch {}

        const store = usePlayerStore.getState();
        const isMatchingTrack =
          activeAudio &&
          (!activeAudio.dataset?.trackId ||
            !activeSong?.id ||
            activeAudio.dataset.trackId === activeSong.id);

        if (
          isMatchingTrack &&
          activeAudio &&
          !activeAudio.paused &&
          !activeAudio.seeking &&
          !isNaN(activeAudio.currentTime) &&
          activeAudio.currentTime >= 0
        ) {
          liveSec = activeAudio.currentTime;
        } else if (!store.isLocalPlayback && store.isPlaying && store.lastPositionTimestamp) {
          const elapsed = (now - store.lastPositionTimestamp) / 1000;
          liveSec = Math.min(effectiveDuration, (store.currentTime || 0) + elapsed);
        } else {
          liveSec = store.currentTime || 0;
        }

        const validSec =
          Number.isFinite(liveSec) && !isNaN(liveSec) && liveSec >= 0 ? liveSec : 0;
        const newProgress = Math.min(1, Math.max(0, validSec / effectiveDuration));
        const pct = newProgress * 100;

        // 1. Direct DOM mutations for 0-latency seekbar fill & thumb updates
        if (progressFillRef.current) {
          progressFillRef.current.style.width = `${pct}%`;
        }
        if (thumbRef.current) {
          thumbRef.current.style.left = `${pct}%`;
        }
        if (timeLabelLeftRef.current) {
          timeLabelLeftRef.current.textContent = formatTime(validSec);
        }

        // 2. Throttled React State Dispatch (>= 250ms interval)
        if (now - lastStateUpdateTimeRef.current >= 250) {
          lastStateUpdateTimeRef.current = now;
          if (Math.abs(newProgress - prevProgressRef.current) >= 0.0005) {
            prevProgressRef.current = newProgress;
            setLocalProgress(newProgress);
          }
        }
      }

      if (!cancelled) {
        animFrame = requestAnimationFrame(tick);
      }
    };

    animFrame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrame);
    };
  }, [effectiveDuration, isDurationValid, isSeeking, isSeekSettling, activeSong?.id]);

  const calculateProgressFromEvent = (e: React.PointerEvent) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    return x / rect.width;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isInteractive) return;
    e.stopPropagation();

    if (e.button !== 0 && e.pointerType === 'mouse') return;

    if (trackRef.current) {
      trackRef.current.setPointerCapture(e.pointerId);
    }

    SeekLock.startSeeking();
    setIsSeeking(true);
    setIsSeekSettling(false);

    const p = calculateProgressFromEvent(e);
    const pct = p * 100;
    if (progressFillRef.current) progressFillRef.current.style.width = `${pct}%`;
    if (thumbRef.current) thumbRef.current.style.left = `${pct}%`;
    if (timeLabelLeftRef.current) timeLabelLeftRef.current.textContent = formatTime(p * effectiveDuration);
    setLocalProgress(p);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isInteractive) return;
    e.stopPropagation();

    if (e.pointerType === 'mouse' && trackRef.current) {
      setHoverProgress(calculateProgressFromEvent(e));
    }

    if (isSeeking) {
      const p = calculateProgressFromEvent(e);
      const pct = p * 100;
      if (progressFillRef.current) progressFillRef.current.style.width = `${pct}%`;
      if (thumbRef.current) thumbRef.current.style.left = `${pct}%`;
      if (timeLabelLeftRef.current) timeLabelLeftRef.current.textContent = formatTime(p * effectiveDuration);
      setLocalProgress(p);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isInteractive) return;
    e.stopPropagation();

    if (trackRef.current) {
      try {
        trackRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }

    if (isSeeking) {
      const p = calculateProgressFromEvent(e);
      const pct = p * 100;
      if (progressFillRef.current) progressFillRef.current.style.width = `${pct}%`;
      if (thumbRef.current) thumbRef.current.style.left = `${pct}%`;

      const newTime = Math.min(effectiveDuration, Math.max(0, p * effectiveDuration));
      if (timeLabelLeftRef.current) timeLabelLeftRef.current.textContent = formatTime(newTime);

      setIsSeeking(false);
      setIsSeekSettling(true);
      setLocalProgress(p);

      SeekLock.endSeeking(800);

      // Seek to target time via store (preserves current play/pause state)
      setCurrentTime(newTime);
      setSeekTarget(newTime);
      usePlayerStore.getState().seek(newTime);

      setTimeout(() => {
        setIsSeekSettling(false);
      }, 800);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!isInteractive) return;
    if (trackRef.current) {
      try {
        trackRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }
    SeekLock.endSeeking(0);
    setIsSeeking(false);

    const currentSec = usePlayerStore.getState().currentTime;
    const p = isDurationValid ? Math.min(1, Math.max(0, currentSec / effectiveDuration)) : 0;
    const pct = p * 100;
    if (progressFillRef.current) progressFillRef.current.style.width = `${pct}%`;
    if (thumbRef.current) thumbRef.current.style.left = `${pct}%`;
    if (timeLabelLeftRef.current) timeLabelLeftRef.current.textContent = formatTime(currentSec);
    setLocalProgress(p);
  };

  const handlePointerLeave = () => {
    setHoverProgress(null);
  };

  const currentPercent = isDurationValid ? localProgress * 100 : 0;
  const currentDisplayedSec = isDurationValid ? localProgress * effectiveDuration : 0;

  const hasCustomPadding = className.includes('py-') || className.includes('p-') || className.includes('h-full');
  const paddingClass = hasCustomPadding ? '' : 'py-3';

  // Seekbar Track Component
  const seekbarTrack = (
    <div
      role="slider"
      aria-label="Seek through current song"
      aria-disabled={!isInteractive}
      aria-valuenow={Math.round(currentDisplayedSec)}
      aria-valuemin={0}
      aria-valuemax={Math.round(effectiveDuration)}
      data-no-swipe="true"
      tabIndex={isInteractive ? 0 : -1}
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      className={`relative w-full ${paddingClass} ${
        isInteractive ? 'cursor-pointer touch-none' : 'cursor-not-allowed pointer-events-none'
      } group flex items-center select-none ${className}`}
    >
      {/* ── 1. Glass Track Background ── */}
      <div
        className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 ${height} group-hover:h-[4px] sm:group-hover:h-[5px] rounded-full transition-all duration-200`}
        style={{
          background: trackColor || 'rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
        }}
      />

      {/* ── 2. Subtle Translucent White Progress Fill ── */}
      <div
        ref={progressFillRef}
        className={`absolute left-0 top-1/2 -translate-y-1/2 ${height} group-hover:h-[4px] sm:group-hover:h-[5px] rounded-full pointer-events-none transition-all duration-75`}
        style={{
          width: `${currentPercent}%`,
          background:
            accentGradient ||
            'linear-gradient(90deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.98) 100%)',
          boxShadow: accentGlow || 'none',
        }}
      />

      {/* ── 3. Small White Glass Circle Thumb ── */}
      <div
        ref={thumbRef}
        className={`absolute top-1/2 ${thumbSize} rounded-full pointer-events-none transition-all duration-150 ease-out transform-gpu ${
          isInteractive
            ? isSeeking
              ? 'opacity-100 scale-125'
              : 'opacity-0 group-hover:opacity-100 group-hover:scale-100'
            : 'opacity-0'
        }`}
        style={{
          left: `${currentPercent}%`,
          transform: `translate(-50%, -50%) ${isSeeking ? 'scale(1.22)' : ''}`,
          background: '#FFFFFF',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.3)',
        }}
      />

      {/* ── 4. Hover Time Tooltip ── */}
      {hoverProgress !== null && isInteractive && !isSeeking && (
        <div
          className="absolute bottom-full mb-2 bg-black/90 backdrop-blur-md text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-xl pointer-events-none border border-white/15 z-30"
          style={{
            left: `${hoverProgress * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          {formatTime(hoverProgress * effectiveDuration)}
        </div>
      )}
    </div>
  );

  if (!showTimeLabels) {
    return seekbarTrack;
  }

  return (
    <div className="w-full space-y-1">
      {seekbarTrack}
      <div className="flex items-center justify-between w-full select-none">
        <span ref={timeLabelLeftRef} className={timeLabelClass}>
          {formatTime(currentDisplayedSec)}
        </span>
        <span className={timeLabelClass}>{formatTime(effectiveDuration)}</span>
      </div>
    </div>
  );
}
