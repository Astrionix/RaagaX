'use client';

import React, { useRef, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Heart, MoreVertical, Disc3, Headphones, MonitorSmartphone, Radio } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useJamStore } from '@/context/useJamStore';
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
  const [isScrolled, setIsScrolled] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });

  React.useEffect(() => {
    setMounted(true);

    const mainEl = document.querySelector('.main-content');
    let ticking = false;

    const handleScroll = () => {
      const currentScrollY = mainEl ? mainEl.scrollTop : window.scrollY;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(currentScrollY > 25);
          ticking = false;
        });
        ticking = true;
      }
    };

    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (mainEl) mainEl.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const {
    currentSong: localCurrentSong,
    isPlaying: localIsPlaying,
    togglePlayPause,
    playNext,
    playPrev,
    togglePlayerExpanded,
    likedSongIds,
    toggleLikeSong,
  } = usePlayerStore();

  const { session, isInJam } = useJamStore();
  const currentSong = (isInJam && session?.currentSong) ? session.currentSong : localCurrentSong;
  const isPlaying = (isInJam && session) ? session.state === 'PLAYING' : localIsPlaying;

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
      className="md:hidden fixed left-4 right-4 z-40 max-w-[480px] mx-auto transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none pointer-events-none"
      style={{
        bottom: isScrolled 
          ? 'calc(3.45rem + env(safe-area-inset-bottom))' 
          : 'calc(3.75rem + env(safe-area-inset-bottom))',
        transform: `translate(${swipeOffset.x}px, ${swipeOffset.y}px)`,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Dynamic Album-derived Ambient Illumination Layer */}
      <div 
        className={`absolute -inset-1.5 rounded-3xl opacity-35 blur-xl pointer-events-none transition-all duration-700 ${
          isScrolled ? 'opacity-20 blur-md' : 'opacity-35 blur-xl'
        }`}
        style={{
          backgroundImage: `url(${coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(22px) saturate(180%)',
        }}
      />

      {/* Main 3D Floating Liquid Lens Panel (80dp Normal -> 52dp Collapsed) */}
      <div 
        className={`pointer-events-auto relative lens-floating flex flex-col justify-center overflow-hidden border border-white/12 shadow-[0_12px_32px_rgba(0,0,0,0.65)] backdrop-blur-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isScrolled 
            ? 'h-[52px] rounded-[18px] px-3 py-1.5' 
            : 'h-[78px] rounded-[22px] px-3.5 py-2.5'
        }`}
      >
        {/* Specular Light Refraction Rim */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

        {/* Top Edge Progress Indicator */}
        <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden pointer-events-none">
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
            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
          >
            {/* Artwork (44dp Normal -> 36dp Collapsed) */}
            <div 
              className={`relative flex-shrink-0 overflow-hidden shadow bg-black/50 border border-white/10 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isScrolled ? 'w-[36px] h-[36px] rounded-lg' : 'w-[44px] h-[44px] rounded-xl'
              }`}
            >
              <OptimizedImage
                src={coverUrl}
                alt={currentSong.title}
                size="thumb"
                className="w-full h-full object-cover"
              />
              {/* Playing Soundwave Pill Overlay */}
              {isPlaying && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-0.5 pointer-events-none">
                  <span className="w-0.5 h-2.5 bg-[#E50914] rounded-full animate-[pulse_0.4s_infinite_alternate]" />
                  <span className="w-0.5 h-3.5 bg-white rounded-full animate-[pulse_0.5s_infinite_alternate_0.1s]" />
                  <span className="w-0.5 h-2 bg-[#E50914] rounded-full animate-[pulse_0.45s_infinite_alternate_0.2s]" />
                </div>
              )}
            </div>

            {/* Metadata Text */}
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-[13px] font-bold text-[var(--text-primary)] truncate leading-tight">
                {currentSong.title}
              </h4>
              {!isScrolled && (
                <p className="text-[11px] text-[var(--text-secondary)] truncate leading-tight flex items-center gap-1 mt-0.5 animate-in fade-in duration-200">
                  <span>{currentSong.artist}</span>
                </p>
              )}
            </div>
          </div>

          {/* Right: Controls (Jam, Like, Play/Pause, Next) */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Remote Jam Party button */}
            {!isScrolled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  useJamStore.getState().toggleJamModal(true);
                }}
                aria-label="Jam Party"
                className="w-11 h-11 flex items-center justify-center text-[#94A3B8] hover:text-[#FA233B] active:scale-90 transition-transform cursor-pointer rounded-full"
              >
                <Radio
                  className={`w-4 h-4 transition-colors ${
                    useJamStore.getState().isInJam ? 'text-[#FA233B] animate-pulse' : ''
                  }`}
                  strokeWidth={2.2}
                />
              </button>
            )}

            {/* Favorite button (visible in Normal state) */}
            {!isScrolled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLikeSong(currentSong.id);
                }}
                aria-label="Favorite track"
                className="w-11 h-11 flex items-center justify-center text-[#94A3B8] hover:text-white active:scale-90 transition-transform cursor-pointer rounded-full"
              >
                <Heart
                  className={`w-4 h-4 transition-colors ${
                    isLiked ? 'fill-[#E50914] text-[#E50914]' : ''
                  }`}
                  strokeWidth={2.2}
                />
              </button>
            )}

            {/* Play/Pause Button (44dp Touch Target) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center active:scale-90 transition-transform shadow-[0_3px_12px_rgba(255,255,255,0.2)] cursor-pointer flex-shrink-0"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-black text-black" />
              ) : (
                <Play className="w-4 h-4 fill-black text-black ml-0.5" />
              )}
            </button>

            {/* Next Track Button */}
            {!isScrolled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playNext();
                }}
                aria-label="Next track"
                className="w-11 h-11 flex items-center justify-center text-[#94A3B8] hover:text-white active:scale-90 transition-transform cursor-pointer rounded-full"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
