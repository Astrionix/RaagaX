'use client';

import React, { useRef, useState, useEffect } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function SeekBar({
  className = '',
  height = 'h-1',
  thumbSize = 'w-3 h-3',
  activeColor = 'bg-[#fa233b]',
  trackColor = 'bg-white/10',
}: {
  className?: string;
  height?: string;
  thumbSize?: string;
  activeColor?: string;
  trackColor?: string;
}) {
  const { currentTime, duration, setCurrentTime, setSeekTarget } = usePlayerStore();
  const trackRef = useRef<HTMLDivElement>(null);
  
  const [isSeeking, setIsSeeking] = useState(false);
  const [localProgress, setLocalProgress] = useState(0); // 0 to 1
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);

  // 60 FPS ultra-smooth local progress prediction driven by PlaybackEngine
  useEffect(() => {
    let animFrame: number;

    const tick = () => {
      if (!isSeeking && duration > 0) {
        const engine = require('@/lib/playback/PlaybackEngine').PlaybackEngine.getInstance();
        if (engine.isPlayingLocally()) {
          const liveSec = engine.getCanonicalPositionMs() / 1000;
          setLocalProgress(Math.min(1, Math.max(0, liveSec / duration)));
        } else {
          setLocalProgress(Math.min(1, Math.max(0, currentTime / duration)));
        }
      }
      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animFrame);
  }, [currentTime, duration, isSeeking]);

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
    
    setIsSeeking(true);
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
      setIsSeeking(false);
      const p = calculateProgressFromEvent(e);
      const newTime = p * duration;
      setCurrentTime(newTime);
      setSeekTarget(newTime);
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    setHoverProgress(null);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
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
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {/* 1. Track Background */}
      <div className={`absolute left-0 right-0 ${height} ${trackColor} rounded-full`} />
      
      {/* 2. Played Progress */}
      <div 
        className={`absolute left-0 ${height} ${activeColor} rounded-full pointer-events-none`} 
        style={{ width: `${currentPercent}%` }}
      />
      
      {/* 3. Thumb */}
      <div 
        className={`absolute ${thumbSize} bg-white rounded-full shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center ${isSeeking ? 'opacity-100 scale-125' : ''}`}
        style={{ 
          left: `${currentPercent}%`,
          transform: 'translateX(-50%)',
          transition: isSeeking ? 'none' : 'left 0.1s linear'
        }}
      />
      
      {/* Hover Tooltip */}
      {hoverProgress !== null && !isSeeking && (
        <div 
          className="absolute bottom-full mb-2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none"
          style={{ 
            left: `${hoverProgress * 100}%`,
            transform: 'translateX(-50%)' 
          }}
        >
          {formatTime(hoverProgress * duration)}
        </div>
      )}
    </div>
  );
}
