'use client';

import React, { useRef, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Heart, MoreVertical, Disc3, Headphones, MonitorSpeaker, Mic2 } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SeekBar } from '@/components/player/SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { haptics } from '@/lib/haptics/HapticEngine';

export function MobileMiniPlayer() {
  const [mounted, setMounted] = React.useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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
    currentSong,
    isPlaying,
    togglePlayPause,
    playNext,
    playPrev,
    togglePlayerExpanded,
    likedSongIds,
    toggleLikeSong,
    toggleCastModal,
    isLocalPlayback,
    activePlaybackDeviceName,
    isLyricsOpen,
    toggleLyrics,
  } = usePlayerStore();

  React.useEffect(() => {
    import('@/lib/sync/TabSyncCoordinator').then(({ TabSyncCoordinator }) => {
      TabSyncCoordinator.getInstance().updateDocumentTitle(currentSong, isPlaying);
    }).catch(() => {});
  }, [currentSong?.id, isPlaying]);

  if (!mounted || !currentSong) return null;

  const isLiked = likedSongIds.includes(currentSong.id);

  // Spotify-Style Gesture Handlers with Dynamic Resistance & Directional Feedback
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;

    // Track fluid horizontal displacement (up to +-85px with elastic feel)
    setSwipeOffset({
      x: Math.max(-85, Math.min(85, diffX * 0.72)),
      y: Math.max(-45, Math.min(15, diffY * 0.4)),
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    touchStartX.current = null;
    touchStartY.current = null;

    // 1. Vertical Swipe Up -> Expand Full Player
    if (diffY < -45 && Math.abs(diffY) > Math.abs(diffX)) {
      setSwipeOffset({ x: 0, y: 0 });
      haptics.lightImpact();
      togglePlayerExpanded();
      return;
    }

    // 2. Horizontal Swipe Left -> Skip Next Track
    if (diffX < -50 && Math.abs(diffX) > Math.abs(diffY)) {
      haptics.mediumImpact();
      // Slide out briefly to complete momentum
      setSwipeOffset({ x: -120, y: 0 });
      setTimeout(() => {
        playNext();
        setSwipeOffset({ x: 0, y: 0 });
      }, 140);
      return;
    }

    // 3. Horizontal Swipe Right -> Previous Track
    if (diffX > 50 && Math.abs(diffX) > Math.abs(diffY)) {
      haptics.mediumImpact();
      // Slide out briefly to complete momentum
      setSwipeOffset({ x: 120, y: 0 });
      setTimeout(() => {
        playPrev();
        setSwipeOffset({ x: 0, y: 0 });
      }, 140);
      return;
    }

    // Spring back smoothly
    setSwipeOffset({ x: 0, y: 0 });
  };

  const coverUrl = currentSong.coverUrl && !currentSong.coverUrl.includes('/null/') && !currentSong.coverUrl.includes('null/null')
    ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  const swipeOpacity = Math.min(1, Math.abs(swipeOffset.x) / 50);

  return (
    <div
      className="md:hidden fixed left-4 right-4 z-40 max-w-[480px] mx-auto select-none pointer-events-none"
      style={{
        bottom: isScrolled 
          ? 'calc(3.45rem + env(safe-area-inset-bottom))' 
          : 'calc(3.75rem + env(safe-area-inset-bottom))',
      }}
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
          transform: `translate3d(${swipeOffset.x * 0.75}px, ${swipeOffset.y * 0.75}px, 0)`,
          transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.7s ease',
        }}
      />

      {/* Main 3D Floating Liquid Lens Panel (80dp Normal -> 52dp Collapsed) with Spotify-Style Swiping */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`pointer-events-auto relative lens-floating flex flex-col justify-center overflow-hidden backdrop-blur-2xl border border-white/12 shadow-[0_12px_32px_rgba(0,0,0,0.65)] ${
          isScrolled 
            ? 'h-[52px] rounded-[18px] px-3 py-1.5' 
            : 'h-[78px] rounded-[22px] px-3.5 py-2.5'
        }`}
        style={{
          transform: `translate3d(${swipeOffset.x}px, ${swipeOffset.y}px, 0) rotate(${swipeOffset.x * 0.035}deg)`,
          transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease',
        }}
      >
        {/* Directional Cue Badges during Horizontal Swipe */}
        {swipeOffset.x < -12 && (
          <div 
            className="absolute right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E50914]/90 text-white shadow-lg pointer-events-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
            style={{ opacity: swipeOpacity }}
          >
            <span className="text-[10px] font-bold tracking-wider uppercase">Next</span>
            <SkipForward className="w-3.5 h-3.5 fill-current" />
          </div>
        )}
        {swipeOffset.x > 12 && (
          <div 
            className="absolute left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white shadow-lg pointer-events-none backdrop-blur-md border border-white/20 animate-in fade-in zoom-in-95 duration-150"
            style={{ opacity: swipeOpacity }}
          >
            <SkipBack className="w-3.5 h-3.5 fill-current" />
            <span className="text-[10px] font-bold tracking-wider uppercase">Prev</span>
          </div>
        )}

        {/* Specular Light Refraction Rim */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

        {/* Top Edge Progress Indicator */}
        <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden pointer-events-none">
          <SeekBar
            className="w-full h-full"
            height="h-[2px]"
            thumbSize="w-0 h-0"
            activeColor="bg-[#FA233B]"
          />
        </div>

        <div className="flex items-center justify-between gap-3 w-full">
          {/* Left: Artwork + Title + Artist */}
          <div 
            onClick={() => {
              if (Math.abs(swipeOffset.x) > 10) return;
              togglePlayerExpanded();
            }}
            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
          >
            {/* Artwork (44dp Normal -> 36dp Collapsed) */}
            <div 
              className={`relative flex-shrink-0 overflow-hidden shadow bg-black/50 border border-white/10 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isScrolled ? 'w-[36px] h-[36px] rounded-lg' : 'w-[44px] h-[44px] rounded-xl'
              }`}
            >
              <OptimizedImage
                src={coverUrl}
                alt={currentSong.title}
                size="thumb"
                imageFit="contain"
                className="w-full h-full object-contain"
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
              {!isLocalPlayback ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCastModal();
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#1DB954] hover:underline cursor-pointer mt-0.5 leading-tight truncate"
                  title={`Playing on ${activePlaybackDeviceName}`}
                  aria-label={`Playing on ${activePlaybackDeviceName}`}
                >
                  <span className="text-[9px] leading-none">▶</span>
                  <span className="truncate">playing on {activePlaybackDeviceName}</span>
                </button>
              ) : (
                !isScrolled && (
                  <p className="text-[11px] text-[var(--text-secondary)] truncate leading-tight flex items-center gap-1 mt-0.5 animate-in fade-in duration-200">
                    <span>{currentSong.artist}</span>
                  </p>
                )
              )}
            </div>
          </div>

          {/* Right: Controls (Connect icon, Favorite, Play/Pause, Next) */}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            {/* Karaoke & Synced Lyrics Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                haptics.lightImpact();
                if (!isLyricsOpen) toggleLyrics();
                togglePlayerExpanded();
              }}
              aria-label="Karaoke & Synced Lyrics"
              title="Karaoke & Synced Lyrics"
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center active:scale-90 transition-transform cursor-pointer rounded-full ${
                isLyricsOpen ? 'text-[#FA233B] bg-[#FA233B]/20 border border-[#FA233B]/30' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Mic2 className="w-4 h-4" />
            </button>

            {/* Connect to Device icon button (Section 1 primary entry point) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCastModal();
              }}
              aria-label={!isLocalPlayback ? `Playing on ${activePlaybackDeviceName}` : "Connect to a device"}
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center transition-all active:scale-90 cursor-pointer rounded-full ${
                !isLocalPlayback 
                  ? 'text-[#1DB954] bg-[#1DB954]/15' 
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <MonitorSpeaker className={`w-4 h-4 ${!isLocalPlayback ? 'animate-pulse' : ''}`} />
            </button>

            {/* Favorite button (visible in Normal state when local) */}
            {!isScrolled && isLocalPlayback && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLikeSong(currentSong.id);
                }}
                aria-label="Favorite track"
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[#94A3B8] hover:text-white active:scale-90 transition-transform cursor-pointer rounded-full"
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
