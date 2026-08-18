'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Song } from '@/types/music';
import { Check, Download, Loader2, Sparkles, Heart } from 'lucide-react';
import { haptics } from '@/lib/haptics/HapticEngine';

interface Spatial3DArtworkProps {
  currentSong: Song;
  isPlaying: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onTap?: () => void;
  onLongPress?: () => void;
  isLiked?: boolean;
  isDownloaded?: boolean;
  isDownloading?: boolean;
  downloadProgress?: number;
  className?: string;
}

export function Spatial3DArtwork({
  currentSong,
  isPlaying,
  onSwipeLeft,
  onSwipeRight,
  onTap,
  onLongPress,
  isLiked = false,
  isDownloaded = false,
  isDownloading = false,
  downloadProgress = 0,
  className = '',
}: Spatial3DArtworkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prevSongId, setPrevSongId] = useState(currentSong.id);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isDragging = useRef(false);

  // High-resolution artwork URL with fallback
  const coverUrl = currentSong.coverUrl && !currentSong.coverUrl.includes('/null/') && !currentSong.coverUrl.includes('null/null')
    ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  // 1. Check reduced motion preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  // 2. Song transition depth animation
  useEffect(() => {
    if (currentSong.id !== prevSongId) {
      setIsTransitioning(true);
      setPrevSongId(currentSong.id);
      const timer = setTimeout(() => setIsTransitioning(false), 380);
      return () => clearTimeout(timer);
    }
  }, [currentSong.id, prevSongId]);

  // 3. Parallax Motion Sensor (Mobile DeviceOrientation / Gyroscope)
  useEffect(() => {
    if (prefersReducedMotion || typeof window === 'undefined') return;

    let lastTime = 0;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const now = Date.now();
      if (now - lastTime < 33) return; // 30 FPS throttle
      lastTime = now;

      if (e.gamma !== null && e.beta !== null) {
        const clampY = Math.max(-5, Math.min(5, (e.gamma / 15) * 3));
        const clampX = Math.max(-5, Math.min(5, ((e.beta - 45) / 20) * 3));
        setRotate({ x: -clampX, y: clampY });
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [prefersReducedMotion]);

  // 4. Mouse Tracking for Desktop Parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotY = (x / (rect.width / 2)) * 6;
    const rotX = -(y / (rect.height / 2)) * 6;
    setRotate({ x: rotX, y: rotY });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  // 5. Touch / Swipe Gesture Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;

    longPressTimer.current = setTimeout(() => {
      haptics.mediumImpact();
      onLongPress?.();
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartX.current;
    const diffY = currentY - (touchStartY.current || 0);

    if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    }

    if (Math.abs(diffX) > Math.abs(diffY)) {
      isDragging.current = true;
      setDragOffset(diffX * 0.35);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    if (isDragging.current) {
      if (dragOffset < -45) {
        haptics.lightImpact();
        onSwipeLeft?.();
      } else if (dragOffset > 45) {
        haptics.lightImpact();
        onSwipeRight?.();
      }
    } else if (Math.abs(dragOffset) < 5) {
      onTap?.();
    }

    setDragOffset(0);
    touchStartX.current = null;
    touchStartY.current = null;
    isDragging.current = false;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative select-none flex flex-col items-center justify-center cursor-pointer ${className}`}
      style={{
        perspective: '1200px',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* ── 3D ARTWORK CONTAINER ────────────────────────────────────────── */}
      <div
        className={`relative aspect-square rounded-[28px] sm:rounded-[32px] overflow-hidden transition-transform duration-300 ease-out flex-shrink-0 ${
          isTransitioning ? 'scale-95 opacity-80 rotate-1' : ''
        }`}
        style={{
          width: 'min(36vh, 82vw, 360px)',
          height: 'min(36vh, 82vw, 360px)',
          transform: prefersReducedMotion
            ? 'none'
            : `translateX(${dragOffset}px) translateY(${isPlaying ? '-4px' : '0px'}) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale(${isPlaying ? 1.01 : 1.0}) translateZ(15px)`,
          boxShadow: `
            0 24px 50px -10px rgba(0, 0, 0, 0.8),
            0 12px 28px -12px rgba(0, 0, 0, 0.9),
            0 0 40px var(--chameleon-glow, rgba(250, 35, 59, 0.25))
          `,
          transition: isDragging.current ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease',
        }}
      >
        {/* Physical Glass Edge Bevel */}
        <div className="absolute inset-0 rounded-[28px] sm:rounded-[32px] ring-1 ring-white/20 pointer-events-none z-20" />

        {/* Ambient Top Specular Light Sheen */}
        <div className="absolute inset-0 rounded-[28px] sm:rounded-[32px] bg-gradient-to-tr from-transparent via-white/[0.06] to-white/[0.14] pointer-events-none z-20" />

        {/* The Hero Album Artwork - Full containment with zero clipping */}
        <img
          src={coverUrl}
          alt={currentSong.title}
          className="w-full h-full object-cover rounded-[28px] sm:rounded-[32px] transition-transform duration-700 ease-out"
          style={{
            transform: isPlaying && !prefersReducedMotion ? 'scale(1.01)' : 'scale(1.0)',
          }}
        />

        {/* Subtle Bottom Vignette */}
        <div className="absolute inset-0 rounded-[28px] sm:rounded-[32px] bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none z-10" />

        {/* ── TOP-RIGHT: DOWNLOAD / OFFLINE BADGE ────────────────────────── */}
        <div className="absolute top-3.5 right-3.5 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-xl border border-white/15 text-white shadow-lg text-[10px] font-bold">
          {isDownloading ? (
            <>
              <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
              <span className="text-amber-400 font-mono">{downloadProgress}%</span>
            </>
          ) : isDownloaded ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Offline</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 text-[#fa233b]" />
              <span className="text-slate-300">RaagaX 3D</span>
            </>
          )}
        </div>

        {/* ── TOP-LEFT: PLAYING BREATHING AURA ────────────────────────────── */}
        {isPlaying && (
          <div className="absolute top-3.5 left-3.5 z-30 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-white text-[9px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#fa233b] animate-ping" />
            <span className="text-slate-300 uppercase tracking-wider font-semibold">Live 3D</span>
          </div>
        )}
      </div>

      {/* ── ABSOLUTE 3D BOTTOM REFLECTION (Takes 0 layout height) ────────── */}
      <div 
        className="absolute -bottom-6 w-full max-w-[280px] sm:max-w-[320px] h-8 rounded-b-[28px] overflow-hidden opacity-15 pointer-events-none blur-sm"
        style={{
          transform: 'scaleY(-1)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
        }}
      >
        <img
          src={coverUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
