'use client';

import React, { useRef, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Heart, MoreVertical, Disc3, Headphones } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SeekBar } from '@/components/player/SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';

/**
 * RaagaX Floating Liquid Glass Mini-Player (Tier 02 Deep Glass)
 * 
 * Features:
 * - Liquid glass backdrop blur with 1px crystal edge highlight
 * - Album artwork-derived dynamic atmospheric ambient glow
 * - Gesture support:
 *    • Swipe Up -> Expands to full player modal
 *    • Swipe Left / Right -> Play next / previous track
 *    • Tap -> Instant seamless expansion
 * - Progress scrubber line integrated directly on the top border
 * - Positioned precisely above the floating pill bottom nav
 */
export function MobileMiniPlayer() {
  const [mounted, setMounted] = React.useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const {
    currentSong,
    isPlaying,
    togglePlayPause,
    playNext,
    playPrev,
    togglePlayerExpanded,
    likedSongIds,
    toggleLikeSong,
    isActiveDevice,
    remoteDeviceName,
  } = usePlayerStore();

  if (!mounted || !currentSong) return null;

  const isLiked = likedSongIds.includes(currentSong.id);

  // Gesture Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;
    
    // Track small physical resistance
    setSwipeOffset({
      x: Math.max(-40, Math.min(40, diffX * 0.35)),
      y: Math.max(-30, Math.min(20, diffY * 0.35)),
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    // Reset offset
    setSwipeOffset({ x: 0, y: 0 });

    // Swipe Up -> Expand Full Player
    if (diffY < -45 && Math.abs(diffY) > Math.abs(diffX)) {
      togglePlayerExpanded();
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    // Swipe Left -> Next Track
    if (diffX < -50 && Math.abs(diffX) > Math.abs(diffY)) {
      playNext();
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    // Swipe Right -> Previous Track
    if (diffX > 50 && Math.abs(diffX) > Math.abs(diffY)) {
      playPrev();
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const coverUrl = currentSong.coverUrl && !currentSong.coverUrl.includes('/null/') && !currentSong.coverUrl.includes('null/null')
    ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  return (
    <div
      className="md:hidden fixed left-3 right-3 z-40 max-w-lg mx-auto transition-transform duration-150 ease-out select-none"
      style={{
        bottom: 'calc(4.1rem + env(safe-area-inset-bottom))',
        transform: `translate(${swipeOffset.x}px, ${swipeOffset.y}px)`,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Dynamic Album-derived Ambient Illumination Layer */}
      <div 
        className="absolute -inset-2 rounded-3xl opacity-40 blur-2xl pointer-events-none transition-all duration-700"
        style={{
          backgroundImage: `url(${coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(28px) saturate(200%)',
        }}
      />

      {/* Main 3D Floating Liquid Lens Panel */}
      <div className="relative lens-floating rounded-[22px] p-2.5 flex flex-col overflow-hidden border border-white/12 shadow-[0_16px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
        
        {/* Specular Light Refraction Rim */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

        {/* Top Edge Progress Indicator */}
        <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden pointer-events-none rounded-t-[22px]">
          <SeekBar
            className="w-full h-full"
            height="h-[2px]"
            thumbSize="w-0 h-0"
          />
        </div>

        <div className="flex items-center justify-between gap-3 w-full">
          {/* Left: Artwork + Title + Artist */}
          <div 
            onClick={togglePlayerExpanded}
            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer py-0.5"
          >
            <div className="relative flex-shrink-0 w-11 h-11 rounded-xl overflow-hidden shadow-lg bg-black/50 border border-white/10">
              <OptimizedImage
                src={coverUrl}
                alt={currentSong.title}
                size="thumb"
                className="w-full h-full object-cover"
              />
              {/* Playing Soundwave Pill Overlay */}
              {isPlaying && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-0.5 pointer-events-none">
                  <span className="w-0.5 h-3 bg-[#E50914] rounded-full animate-[pulse_0.4s_infinite_alternate]" />
                  <span className="w-0.5 h-4 bg-white rounded-full animate-[pulse_0.5s_infinite_alternate_0.1s]" />
                  <span className="w-0.5 h-2 bg-[#E50914] rounded-full animate-[pulse_0.45s_infinite_alternate_0.2s]" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-[13px] font-bold text-white truncate leading-snug">
                {currentSong.title}
              </h4>
              <p className="text-[11px] text-[#94A3B8] truncate leading-snug flex items-center gap-1.5 mt-0.5">
                {!isActiveDevice ? (
                  <span className="text-[#E50914] font-medium flex items-center gap-1">
                    <Disc3 className="w-3 h-3 animate-spin" />
                    {remoteDeviceName || 'Remote Device'}
                  </span>
                ) : (
                  <span>{currentSong.artist}</span>
                )}
              </p>
            </div>
          </div>

          {/* Right: Controls (Like, Play/Pause, Next) */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleLikeSong(currentSong.id);
              }}
              aria-label="Favorite track"
              className="p-2 text-[#94A3B8] hover:text-white active:scale-90 transition-transform cursor-pointer"
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  isLiked ? 'fill-[#E50914] text-[#E50914]' : ''
                }`}
                strokeWidth={2.2}
              />
            </button>

            {/* Audio Output Device Sheet Trigger */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                usePlayerStore.getState().toggleDeviceModal();
              }}
              aria-label="Output audio device"
              className={`p-2 rounded-full transition-all active:scale-90 ${
                !isActiveDevice ? 'text-[#E50914] animate-pulse' : 'text-[#94A3B8] hover:text-white'
              }`}
              title={remoteDeviceName ? `Playing on: ${remoteDeviceName}` : 'Switch Audio Device'}
            >
              <Headphones className="w-4 h-4" />
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center active:scale-90 transition-transform shadow-[0_4px_15px_rgba(255,255,255,0.25)] cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-black text-black" />
              ) : (
                <Play className="w-4 h-4 fill-black text-black ml-0.5" />
              )}
            </button>

            {/* Next Track */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                playNext();
              }}
              aria-label="Next track"
              className="p-2 text-[#94A3B8] hover:text-white active:scale-90 transition-transform cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
