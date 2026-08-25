'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Headphones, Disc3 } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaybackSession } from '@/hooks/usePlaybackSession';
import { SeekBar } from '@/components/player/SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';
import { haptics } from '@/lib/haptics/HapticEngine';

interface AndroidPlaybackPlayerCardProps {
  className?: string;
  onExpand?: () => void;
}

/**
 * RaagaX Native-Inspired Android Lock-Screen Playback Player Card
 * 
 * Layout:
 * ┌──────────────────────────────────────┐
 * │  [Album]  RaagaX        ◉            │
 * │           Song Title                 │
 * │           Artist                     │
 * │                                      │
 * │  ─────────────●────────────          │
 * │  01:22                       03:45   │
 * │                                      │
 * │       ◀       ❚❚       ▶             │
 * └──────────────────────────────────────┘
 */
export function AndroidPlaybackPlayerCard({
  className = '',
  onExpand,
}: AndroidPlaybackPlayerCardProps) {
  const {
    currentTrack: currentSong,
    isPlaying,
    position: currentTime,
    duration,
    togglePlayPause,
    playNext,
    playPrev,
  } = usePlaybackSession();

  const [palette, setPalette] = useState<ChameleonPalette | null>(null);

  const coverUrl = currentSong?.coverUrl && !currentSong.coverUrl.includes('/null/') && !currentSong.coverUrl.includes('null/null')
    ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  const currentOutputName = 'This Phone';

  // Extract dynamic colors from artwork
  useEffect(() => {
    let isMounted = true;
    if (coverUrl && coverUrl !== '/app-icon.png') {
      ArtworkColorExtractor.getInstance().extractPalette(coverUrl).then((p) => {
        if (isMounted) setPalette(p);
      });
    }
    return () => { isMounted = false; };
  }, [coverUrl]);

  if (!currentSong) return null;

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={onExpand}
      className={`relative w-full max-w-[390px] mx-auto rounded-[24px] p-4 sm:p-5 select-none overflow-hidden transition-all duration-300 ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(18, 20, 28, 0.75) 100%)',
        backdropFilter: 'blur(35px) saturate(180%)',
        WebkitBackdropFilter: 'blur(35px) saturate(180%)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.2) inset, 0 -1px 0 rgba(0,0,0,0.3) inset',
        border: '1px solid rgba(255, 255, 255, 0.15)',
      }}
    >
      {/* ── 1. SUBTLE AMBIENT COLOR DIFFUSION (Derived from artwork) ── */}
      {palette && (
        <div
          className="absolute -top-12 -left-12 w-48 h-48 rounded-full pointer-events-none transition-all duration-700 opacity-30 blur-3xl"
          style={{
            background: `radial-gradient(circle, ${palette.primary} 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Top Specular Edge Line */}
      <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

      {/* ── 2. HEADER & TRACK INFO (Artwork + RaagaX Badge + Output Device) ── */}
      <div className="relative z-10 flex items-start gap-3.5 mb-3.5">
        {/* Original Album Artwork (60dp, rounded-2xl, subtle shadow) */}
        <div className="relative w-15 h-15 rounded-2xl overflow-hidden shadow-[0_8px_18px_rgba(0,0,0,0.5)] border border-white/20 flex-shrink-0">
          <OptimizedImage
            src={coverUrl}
            alt={currentSong.title}
            size="card"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Brand Tag, Song Title, Artist */}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FA233B]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                RaagaX
              </span>
            </div>

            {/* Output Device Pill */}
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-slate-300 border border-white/10"
              title={`Output: ${currentOutputName}`}
            >
              <Headphones className="w-3 h-3 text-[#FA233B]" />
              <span className="truncate max-w-[85px]">{currentOutputName}</span>
            </div>
          </div>

          <h3 className="text-sm sm:text-base font-black text-white truncate tracking-tight leading-snug">
            {currentSong.title}
          </h3>
          <p className="text-xs font-semibold text-[#A8B2C2] truncate mt-0.5">
            {currentSong.artist}
          </p>
        </div>
      </div>

      {/* ── 3. THIN SLEEK PROGRESS BAR ── */}
      <div className="relative z-10 space-y-1.5 mb-2.5 px-0.5">
        <SeekBar height="h-[3px]" thumbSize="w-3 h-3" activeColor="bg-[#FA233B]" />
        <div className="flex items-center justify-between text-[10.5px] font-mono text-[#A8B2C2] font-semibold">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* ── 4. MINIMAL 3-BUTTON CONTROLS (Previous ◀  |  Play/Pause ❚❚  |  Next ▶) ── */}
      <div className="relative z-10 flex items-center justify-center gap-9 pt-1">
        {/* Previous Track ◀ */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptics.lightImpact();
            playPrev();
          }}
          className="p-2.5 text-white/80 hover:text-white active:scale-90 transition-transform cursor-pointer"
          title="Previous Track"
          aria-label="Previous Track"
        >
          <SkipBack className="w-5 h-5 fill-current" />
        </button>

        {/* Central Hero Play / Pause ❚❚ Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptics.mediumImpact();
            togglePlayPause();
          }}
          className="relative w-13 h-13 rounded-full flex items-center justify-center text-[#11131E] shadow-[0_10px_28px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.3),inset_0_2px_1px_#ffffff] active:scale-90 transition-transform cursor-pointer bg-gradient-to-b from-white via-[#F8F9FC] to-[#DDE2EE] border border-white/80"
          title={isPlaying ? 'Pause' : 'Play'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {/* Specular Droplet Highlight */}
          <div className="absolute top-1 left-2.5 right-2.5 h-[34%] bg-gradient-to-b from-white/95 to-transparent rounded-full pointer-events-none" />

          {isPlaying ? (
            <Pause className="w-5.5 h-5.5 fill-[#11131E] text-[#11131E]" strokeWidth={0} />
          ) : (
            <Play className="w-5.5 h-5.5 fill-[#11131E] text-[#11131E] ml-0.5" strokeWidth={0} />
          )}
        </button>

        {/* Next Track ▶ */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptics.lightImpact();
            playNext();
          }}
          className="p-2.5 text-white/80 hover:text-white active:scale-90 transition-transform cursor-pointer"
          title="Next Track"
          aria-label="Next Track"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>
      </div>
    </div>
  );
}
