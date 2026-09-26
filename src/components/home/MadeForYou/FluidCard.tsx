'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, Sparkles } from 'lucide-react';
import { FluidArtwork } from './FluidArtwork';
import { FLUID_PALETTES, PaletteName } from './palettes';
import { haptics } from '@/lib/haptics/HapticEngine';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { Song } from '@/types/music';

export interface MadeForYouCardData {
  id: string;
  title: string;
  description: string;
  badge?: string;
  badgeIcon?: React.ReactNode;
  trackCount?: string;
  palette: PaletteName;
  seed: number;
  thumbnails?: string[];
  queue?: Song[];
  isShuffle?: boolean;
}

export interface FluidCardProps {
  item: MadeForYouCardData;
  isPlaying?: boolean;
  onPlayClick?: (item: MadeForYouCardData) => void;
  staggerIndex?: number;
}

export function FluidCard({
  item,
  isPlaying = false,
  onPlayClick,
  staggerIndex = 0,
}: FluidCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });

  const paletteConfig = useMemo(
    () => FLUID_PALETTES[item.palette] || FLUID_PALETTES['midnight-violet'],
    [item.palette]
  );

  // Derive up to 4 distinct album art thumbnails from the song queue
  const thumbnails = useMemo(() => {
    if (item.thumbnails && item.thumbnails.length > 0) {
      return item.thumbnails.slice(0, 4);
    }
    if (item.queue && item.queue.length > 0) {
      const distinctCovers: string[] = [];
      for (const s of item.queue) {
        if (s.coverUrl && !distinctCovers.includes(s.coverUrl)) {
          distinctCovers.push(s.coverUrl);
        }
        if (distinctCovers.length >= 4) break;
      }
      return distinctCovers;
    }
    return [];
  }, [item.thumbnails, item.queue]);

  // Smooth mouse coordinates tracking for 3D displacement
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setMousePos({ x, y });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setMousePos({ x: 0.5, y: 0.5 });
  }, []);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.mediumImpact();
    if (onPlayClick) {
      onPlayClick(item);
    }
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onPlayClick && onPlayClick(item)}
      style={{
        borderRadius: '32px',
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        maskImage: 'radial-gradient(white, black)',
        isolation: 'isolate',
        boxShadow: isHovered
          ? `0 20px 48px -10px ${paletteConfig.glowColor}, 0 12px 32px rgba(0,0,0,0.7), inset 0 1px 2px rgba(255,255,255,0.25)`
          : '0 12px 32px -6px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.16)',
        animationDelay: `${staggerIndex * 75}ms`,
      }}
      className={`group relative w-full rounded-[32px] overflow-hidden cursor-pointer select-none transition-all duration-300 ease-out transform-gpu min-h-[220px] sm:min-h-[240px] lg:min-h-[255px] flex flex-col justify-between p-5 sm:p-6 lg:p-7 bg-[#080B14]/85 backdrop-blur-2xl border border-white/[0.09] hover:border-white/[0.22] ${
        isHovered ? '-translate-y-1' : 'translate-y-0'
      }`}
    >
      {/* ── Layer 1: Three.js WebGL 3D Slow-Moving Liquid Glass Fluid Canvas ── */}
      <div
        className="absolute inset-0 z-0 opacity-80 group-hover:opacity-95 transition-opacity duration-500 pointer-events-none rounded-[32px] overflow-hidden"
        style={{
          borderRadius: '32px',
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
          maskImage: 'radial-gradient(white, black)',
        }}
      >
        <FluidArtwork
          palette={item.palette}
          seed={item.seed}
          isHovered={isHovered}
          mousePos={mousePos}
          className="w-full h-full"
        />
      </div>

      {/* ── Layer 2: Glass Frosted Surface Overlay & Specular Sheen ── */}
      <div
        className="absolute inset-0 z-10 pointer-events-none rounded-[32px] bg-gradient-to-b from-white/[0.08] via-transparent to-black/80"
        style={{
          borderRadius: '32px',
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
          maskImage: 'radial-gradient(white, black)',
        }}
      />

      {/* ── Layer 3: Top Bar — Mix Label & Equalizer Status ── */}
      <div className="relative z-20 flex items-center justify-between w-full pointer-events-none">
        {/* Mix Label Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/45 border border-white/15 backdrop-blur-md shadow-sm">
          {isPlaying ? (
            <div className="flex items-end gap-0.5 h-3">
              <span className="w-0.5 h-3 bg-white rounded-full animate-[pulse_0.4s_infinite_alternate]" />
              <span className="w-0.5 h-2 bg-white rounded-full animate-[pulse_0.5s_infinite_alternate_0.15s]" />
              <span className="w-0.5 h-3 bg-white rounded-full animate-[pulse_0.45s_infinite_alternate_0.3s]" />
            </div>
          ) : (
            item.badgeIcon || <Sparkles className="w-3.5 h-3.5 text-white/80" />
          )}
          <span className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-widest text-white/90">
            {item.badge || 'MIX'}
          </span>
        </div>

        {/* Optional Track Count Badge */}
        {item.trackCount && (
          <span className="text-[9.5px] sm:text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-black/40 border border-white/10 text-white/75 backdrop-blur-md">
            {item.trackCount}
          </span>
        )}
      </div>

      {/* ── Layer 4: Middle Area — Large Minimalist Title & Subtitle ── */}
      <div className="relative z-20 my-auto py-3 pointer-events-none">
        <h3 className="text-xl sm:text-2xl lg:text-[23px] font-black text-white tracking-tight leading-tight drop-shadow-md">
          {item.title}
        </h3>
        <p className="text-xs sm:text-[13px] text-white/75 font-medium mt-1.5 line-clamp-1 drop-shadow-sm">
          {item.description}
        </p>
      </div>

      {/* ── Layer 5: Bottom Row — Thumbnails + Circular Glass Play Button ── */}
      <div className="relative z-20 flex items-center justify-between gap-3 w-full pt-1 pointer-events-none">
        {/* 3-4 Overlapping Album Cover Thumbnails */}
        {thumbnails.length > 0 ? (
          <div className="flex items-center -space-x-2.5 overflow-hidden py-0.5 pointer-events-none">
            {thumbnails.map((thumb, idx) => (
              <div
                key={`thumb-${item.id}-${idx}`}
                className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-black/80 bg-neutral-900 shadow-md overflow-hidden flex-shrink-0"
              >
                <OptimizedImage
                  src={thumb}
                  alt=""
                  size="thumb"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md">
            <Sparkles className="w-3 h-3 text-white/60" />
            <span className="text-[9.5px] font-mono font-bold text-white/60 uppercase">Curated</span>
          </div>
        )}

        {/* Circular Glass Play / Pause Button with Soft Hover Glow */}
        <button
          onClick={handlePlayClick}
          aria-label={isPlaying ? `Pause ${item.title}` : `Play ${item.title}`}
          title={isPlaying ? `Pause ${item.title}` : `Play ${item.title}`}
          className={`pointer-events-auto flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all duration-300 transform-gpu cursor-pointer shadow-lg ${
            isPlaying
              ? 'bg-white text-black border-white shadow-[0_0_24px_rgba(255,255,255,0.75)] scale-105'
              : 'bg-white/15 hover:bg-white/30 text-white border-white/25 hover:border-white/50 hover:shadow-[0_0_20px_rgba(255,255,255,0.35)] hover:scale-105 active:scale-95'
          }`}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current stroke-none" />
          ) : (
            <Play className="w-5 h-5 fill-current stroke-none ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}
