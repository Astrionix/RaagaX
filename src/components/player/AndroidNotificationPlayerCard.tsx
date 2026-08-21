'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, MoreVertical, Headphones } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaybackSession } from '@/hooks/usePlaybackSession';
import { SeekBar } from '@/components/player/SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';
import { haptics } from '@/lib/haptics/HapticEngine';

interface AndroidNotificationPlayerCardProps {
  className?: string;
  onExpand?: () => void;
}

/**
 * RaagaX Native-Inspired Android Notification Playback Player Card
 * 
 * Layout:
 * ┌──────────────────────────────────────┐
 * │  RaagaX                         ⋮    │
 * │                                      │
 * │  [Artwork]  Song Title               │
 * │             Artist                   │
 * │                                      │
 * │       ◀        ❚❚        ▶           │
 * │                                      │
 * │  ━━━━━━━━━━━━━●━━━━━━━━━━            │
 * └──────────────────────────────────────┘
 */
export function AndroidNotificationPlayerCard({
  className = '',
  onExpand,
}: AndroidNotificationPlayerCardProps) {
  const {
    currentTrack: currentSong,
    isPlaying,
    position: currentTime,
    duration,
    togglePlayPause,
    playNext,
    playPrev,
    activeDeviceId,
    isActiveDevice,
  } = usePlaybackSession();

  const {
    onlineDevices,
    deviceId,
    remoteDeviceName,
    toggleDeviceModal,
  } = usePlayerStore();

  const [palette, setPalette] = useState<ChameleonPalette | null>(null);

  const coverUrl = currentSong?.coverUrl && !currentSong.coverUrl.includes('/null/') && !currentSong.coverUrl.includes('null/null')
    ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  const activeDeviceObj = onlineDevices.find((d) => d.id === activeDeviceId);
  const localDeviceObj = onlineDevices.find((d) => d.id === deviceId);
  const currentOutputName = !isActiveDevice
    ? (remoteDeviceName || activeDeviceObj?.name || 'Remote Device')
    : (localDeviceObj?.name || 'This Phone');

  // Extract subtle colors from artwork
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
      className={`relative w-full max-w-[390px] mx-auto rounded-[22px] p-4 sm:p-4.5 select-none overflow-hidden transition-all duration-300 ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(16, 18, 26, 0.85) 100%)',
        backdropFilter: 'blur(30px) saturate(170%)',
        WebkitBackdropFilter: 'blur(30px) saturate(170%)',
        boxShadow: '0 14px 36px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.18) inset, 0 -1px 0 rgba(0,0,0,0.3) inset',
        border: '1px solid rgba(255, 255, 255, 0.12)',
      }}
    >
      {/* ── 1. SUBTLE AMBIENT COLOR TINT (derived from artwork) ── */}
      {palette && (
        <div
          className="absolute -top-10 -left-10 w-44 h-44 rounded-full pointer-events-none transition-all duration-700 opacity-25 blur-3xl"
          style={{
            background: `radial-gradient(circle, ${palette.primary} 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Top Specular Edge Glow */}
      <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

      {/* ── 2. HEADER: RaagaX Logo & More / Output ⋮ ── */}
      <div className="relative z-10 flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FA233B]" />
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-200">
            RaagaX
          </span>
          <span className="text-[10px] text-slate-500 font-medium">• now</span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            haptics.selectionTick();
            toggleDeviceModal();
          }}
          className="p-1 -mr-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title={`Output Options (${currentOutputName})`}
          aria-label="Output Options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* ── 3. TRACK INFO: Artwork + Title + Artist ── */}
      <div className="relative z-10 flex items-center gap-3.5 mb-3.5">
        {/* Original Artwork (54dp) */}
        <div className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-xl overflow-hidden shadow-[0_6px_16px_rgba(0,0,0,0.5)] border border-white/15 flex-shrink-0">
          <OptimizedImage
            src={coverUrl}
            alt={currentSong.title}
            size="card"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Title and Artist */}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white truncate leading-snug">
            {currentSong.title}
          </h3>
          <p className="text-xs text-[#A8B2C2] truncate mt-0.5 font-medium">
            {currentSong.artist}
          </p>
        </div>
      </div>

      {/* ── 4. CONTROLS: Previous ◀ | Play/Pause ❚❚ | Next ▶ ── */}
      <div className="relative z-10 flex items-center justify-center gap-8 mb-2.5">
        {/* Previous ◀ */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptics.lightImpact();
            playPrev();
          }}
          className="p-2 text-white/80 hover:text-white active:scale-90 transition-transform cursor-pointer"
          title="Previous Track"
          aria-label="Previous Track"
        >
          <SkipBack className="w-5 h-5 fill-current" />
        </button>

        {/* Play / Pause ❚❚ */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptics.mediumImpact();
            togglePlayPause();
          }}
          className="relative w-11 h-11 rounded-full flex items-center justify-center text-[#11131E] shadow-[0_8px_20px_rgba(0,0,0,0.45),inset_0_2px_1px_#ffffff] active:scale-90 transition-transform cursor-pointer bg-gradient-to-b from-white via-[#F8F9FC] to-[#DDE2EE] border border-white/80"
          title={isPlaying ? 'Pause' : 'Play'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-[#11131E] text-[#11131E]" strokeWidth={0} />
          ) : (
            <Play className="w-5 h-5 fill-[#11131E] text-[#11131E] ml-0.5" strokeWidth={0} />
          )}
        </button>

        {/* Next ▶ */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptics.lightImpact();
            playNext();
          }}
          className="p-2 text-white/80 hover:text-white active:scale-90 transition-transform cursor-pointer"
          title="Next Track"
          aria-label="Next Track"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>
      </div>

      {/* ── 5. PROGRESS SCRUBBER ── */}
      <div className="relative z-10 space-y-1 px-0.5">
        <SeekBar height="h-[2.5px]" thumbSize="w-2.5 h-2.5" activeColor="bg-[#FA233B]" />
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 font-medium">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
