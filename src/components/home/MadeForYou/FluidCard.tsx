'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { FluidArtwork } from './FluidArtwork';
import { FLUID_PALETTES, PaletteName } from './palettes';
import { haptics } from '@/lib/haptics/HapticEngine';

export interface MadeForYouCardData {
  id: string;
  title: string;
  artist: string;
  palette: PaletteName;
  seed: number;
  audioUrl?: string;
  coverUrl?: string;
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

  const paletteConfig = FLUID_PALETTES[item.palette] || FLUID_PALETTES.magenta;

  // Track mouse coordinates over card rect for interactive shader distortion & parallax
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
        animationDelay: `${staggerIndex * 90}ms`,
      }}
      className={`group relative aspect-[4/5] w-full rounded-[28px] sm:rounded-[32px] overflow-hidden cursor-pointer select-none transition-all duration-500 ease-out transform-gpu ${
        isHovered
          ? '-translate-y-2 scale-[1.015] shadow-[0_20px_50px_rgba(0,0,0,0.85)]'
          : 'translate-y-0 scale-100 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
      }`}
    >
      {/* ── Layer 1: Ambient Background Color Glow ── */}
      <div
        className="absolute -inset-1 rounded-[32px] opacity-40 group-hover:opacity-75 blur-2xl transition-opacity duration-700 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${mousePos.x * 100}% ${
            mousePos.y * 100
          }%, ${paletteConfig.glowColor}, transparent 70%)`,
        }}
      />

      {/* ── Layer 2: Glossy 3D Fluid Sculpture (Three.js WebGL) ── */}
      <div className="absolute inset-0 z-0 bg-neutral-950/80">
        <FluidArtwork
          palette={item.palette}
          seed={item.seed}
          isHovered={isHovered}
          mousePos={mousePos}
          className="w-full h-full"
        />
      </div>

      {/* ── Layer 3: Glass / Internal Reflection Overlay ── */}
      <div className="absolute inset-0 z-10 rounded-[28px] sm:rounded-[32px] border border-white/[0.12] group-hover:border-white/[0.22] transition-colors duration-500 pointer-events-none bg-gradient-to-b from-white/[0.1] via-transparent to-black/80" />

      {/* Subtle glass specular streak along top edge */}
      <div className="absolute top-0 inset-x-0 h-1/3 bg-gradient-to-b from-white/[0.08] to-transparent rounded-t-[28px] sm:rounded-t-[32px] pointer-events-none z-10" />

      {/* ── Layer 4: Song Metadata & Controls Container ── */}
      <div className="absolute inset-0 z-20 flex flex-col justify-end p-5 sm:p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none">
        <div className="flex items-end justify-between gap-3 w-full">
          {/* Metadata Text */}
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-snug truncate drop-shadow-md group-hover:text-white transition-colors">
              {item.title}
            </h3>
            <p className="text-xs sm:text-sm font-medium text-white/75 truncate mt-0.5 drop-shadow">
              {item.artist}
            </p>
          </div>

          {/* ── Layer 5: Translucent Glass Play Button ── */}
          <button
            onClick={handlePlayClick}
            aria-label={isPlaying ? `Pause ${item.title}` : `Play ${item.title}`}
            className={`pointer-events-auto flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all duration-300 transform-gpu ${
              isPlaying
                ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.4)] scale-105'
                : 'bg-white/20 hover:bg-white/35 text-white border-white/30 hover:border-white/60 hover:scale-105 shadow-lg active:scale-95'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
