'use client';

import React, { useRef, useState, useEffect } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackEngine } from '@/lib/playback/PlaybackEngine';
import { SeekLock } from '@/lib/playback/SeekLock';

export function SeekBar({
  className = '',
  height = 'h-1',
  thumbSize = 'w-3 h-3',
  activeColor = 'bg-[#fa233b]',
  accentGradient,
  accentGlow,
  trackColor = 'bg-white/10',
}: {
  className?: string;
  height?: string;
  thumbSize?: string;
  activeColor?: string;
  accentGradient?: string;
  accentGlow?: string;
  trackColor?: string;
}) {
  const duration = usePlayerStore((s) => s.duration);
  const currentSongDuration = usePlayerStore((s) => s.currentSong?.duration);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setSeekTarget = usePlayerStore((s) => s.setSeekTarget);
  const trackRef = useRef<HTMLDivElement>(null);
  
  const [isSeeking, setIsSeeking] = useState(false);
  const [isSeekSettling, setIsSeekSettling] = useState(false);
  const [localProgress, setLocalProgress] = useState(0); // 0 to 1
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);

  const effectiveDuration = Number.isFinite(duration) && duration > 0 
    ? duration 
    : (Number.isFinite(currentSongDuration) && (currentSongDuration || 0) > 0 ? (currentSongDuration || 0) : 0);

  const prevProgressRef = useRef(0);

  // 60 FPS ultra-smooth local progress prediction driven by PlaybackEngine & Remote Anchor Clock
  useEffect(() => {
    let animFrame: number;

    const tick = () => {
      if (!isSeeking && !isSeekSettling && effectiveDuration > 0) {
        const store = usePlayerStore.getState();
        const engine = PlaybackEngine.getInstance();
        const liveSec = engine.isPlayingLocally() ? engine.getCanonicalPositionMs() / 1000 : store.currentTime;
        const validSec = Number.isFinite(liveSec) && !isNaN(liveSec) && liveSec >= 0 ? liveSec : 0;

        const newProgress = Math.min(1, Math.max(0, validSec / effectiveDuration));
        if (Math.abs(newProgress - prevProgressRef.current) >= 0.0005) {
          prevProgressRef.current = newProgress;
          setLocalProgress(newProgress);
        }
      }
      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animFrame);
  }, [effectiveDuration, isSeeking, isSeekSettling]);

  const calculateProgressFromEvent = (e: React.PointerEvent) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    return x / rect.width;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    // Only handle primary button (left click) or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    if (trackRef.current) {
      trackRef.current.setPointerCapture(e.pointerId);
    }
    
    // Lock out remote position updates while the user is dragging
    SeekLock.startSeeking();

    setIsSeeking(true);
    setIsSeekSettling(false);
    if (effectiveDuration <= 0) return;
    
    const p = calculateProgressFromEvent(e);
    setLocalProgress(p);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    
    // Always calculate hover progress for the tooltip if it's a mouse
    if (e.pointerType === 'mouse' && trackRef.current) {
      setHoverProgress(calculateProgressFromEvent(e));
    }

    if (isSeeking) {
      if (effectiveDuration <= 0) return;
      const p = calculateProgressFromEvent(e);
      setLocalProgress(p);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (trackRef.current) {
      trackRef.current.releasePointerCapture(e.pointerId);
    }
    
    if (isSeeking) {
      if (effectiveDuration <= 0) {
        setIsSeeking(false);
        setIsSeekSettling(false);
        return;
      }
      
      const p = calculateProgressFromEvent(e);
      const newTime = Math.min(effectiveDuration, Math.max(0, p * effectiveDuration));
      
      console.log('[SEEKBAR RELEASE]', {
        effectiveDuration,
        progress: p,
        targetSeconds: newTime,
        targetMs: Math.round(newTime * 1000)
      });

      setIsSeeking(false);
      setIsSeekSettling(true);
      setLocalProgress(p);
      
      // End SeekLock with a settling window — blocks stale remote position
      // updates for 800ms after release so ExoPlayer can confirm the seek
      SeekLock.endSeeking(800);

      setCurrentTime(newTime);
      setSeekTarget(newTime);

      setTimeout(() => {
        setIsSeekSettling(false);
      }, 800);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (trackRef.current) {
      try {
        trackRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }
    SeekLock.endSeeking(0); // cancel drag — no settle window needed
    setIsSeeking(false);
    const currentSec = usePlayerStore.getState().currentTime;
    setLocalProgress(effectiveDuration > 0 ? Math.min(1, Math.max(0, currentSec / effectiveDuration)) : 0);
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    setHoverProgress(null);
  };

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '--:--';
    }
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentPercent = localProgress * 100;

  return (
    <div
      className={`relative cursor-pointer touch-none group flex items-center ${className}`}
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
    >
      {/* ── 1. Glass Track Background ─── */}
      <div
        className={`absolute left-0 right-0 ${height} rounded-full`}
        style={{
          background: 'rgba(255,255,255,0.08)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), 0 0.5px 0 rgba(255,255,255,0.07)',
        }}
      />

      {/* ── 2. Progress Fill (RaagaX Red or Artwork Gradient) ─── */}
      <div
        className={`absolute left-0 ${height} rounded-full pointer-events-none transition-all duration-75`}
        style={{
          width: `${currentPercent}%`,
          background: accentGradient || 'linear-gradient(90deg, #c91c30 0%, #FA233B 100%)',
          boxShadow: accentGlow || '0 0 8px rgba(250,35,59,0.45)',
        }}
      />

      {/* ── 3. Water-Drop Sphere Thumb ─── */}
      <div
        className={`absolute ${thumbSize} rounded-full pointer-events-none ${
          isSeeking ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{
          left: `${currentPercent}%`,
          transform: `translateX(-50%) ${isSeeking ? 'scale(1.22)' : ''}`,
          transition: isSeeking ? 'none' : 'left 0.1s linear, opacity 0.15s',
          background: 'radial-gradient(circle at 38% 30%, rgba(255,255,255,0.96) 0%, rgba(220,220,225,0.88) 55%, rgba(185,185,198,0.70) 100%)',
          boxShadow: [
            '0 2px 8px rgba(0,0,0,0.55)',
            '0 0 0 1px rgba(255,255,255,0.22)',
            'inset 0 1px 0 rgba(255,255,255,0.92)',
            'inset 0 -1px 2px rgba(0,0,0,0.18)',
          ].join(', '),
        }}
      />

      {/* ── 4. Hover Tooltip ─── */}
      {hoverProgress !== null && !isSeeking && (
        <div
          className="absolute bottom-full mb-2 bg-black/85 backdrop-blur-md text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg shadow-xl pointer-events-none border border-white/15 z-30"
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
}
