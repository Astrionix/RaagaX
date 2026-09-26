'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  FastForward,
  Search,
  Home,
  LayoutGrid,
  Radio,
  Library,
  Volume2,
  Speaker,
  MonitorSpeaker,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ActiveTab } from '@/types/music';
import { SeekBar } from '@/components/player/SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { haptics } from '@/lib/haptics/HapticEngine';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';

export function MobileBottomController() {
  const [mounted, setMounted] = useState(false);
  const [palette, setPalette] = useState<ChameleonPalette | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const {
    activeTab,
    setActiveTab,
    currentSong,
    isPlaying,
    togglePlayPause,
    playNext,
    playPrev,
    togglePlayerExpanded,
    isPlayerExpanded,
    toggleCastModal,
    isCastModalOpen,
    isLocalPlayback,
    activePlaybackDeviceName,
  } = usePlayerStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Extract subtle dominant ambient glow from artwork (matching desktop PlayerBar)
  useEffect(() => {
    let isSubscribed = true;
    if (currentSong?.coverUrl && !currentSong.coverUrl.includes('/null/')) {
      ArtworkColorExtractor.getInstance()
        .extractPalette(currentSong.coverUrl)
        .then((p) => {
          if (isSubscribed) setPalette(p);
        })
        .catch(() => {});
    } else {
      setPalette(null);
    }
    return () => {
      isSubscribed = false;
    };
  }, [currentSong?.coverUrl]);

  // ── BOTTOM NAVIGATION (HOME | NEW | LIBRARY | SEARCH) ──
  const navItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'new' as const, label: 'New', icon: LayoutGrid },
    { id: 'library' as const, label: 'Library', icon: Library },
    { id: 'search' as const, label: 'Search', icon: Search },
  ];

  const isNavItemActive = (id: string) => {
    if (id === 'home') return activeTab === 'home';
    if (id === 'new') return activeTab === 'new';
    if (id === 'search') return activeTab === 'search';
    if (id === 'library') {
      return ['library', 'downloads', 'favorites', 'history', 'insights', 'recaps', 'album', 'artist', 'playlist', 'genres'].includes(activeTab);
    }
    return activeTab === id;
  };

  // ── GESTURE HANDLERS (SWIPE UP FOR FULL PLAYER, SWIPE L/R FOR TRACKS) ──────
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    if (diffY < -40 && Math.abs(diffY) > Math.abs(diffX)) {
      haptics.mediumImpact();
      togglePlayerExpanded();
    } else if (diffX < -45 && Math.abs(diffX) > Math.abs(diffY)) {
      haptics.lightImpact();
      playNext();
    } else if (diffX > 45 && Math.abs(diffX) > Math.abs(diffY)) {
      haptics.lightImpact();
      playPrev();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  if (!mounted) return null;

  const isPlayerFull = isPlayerExpanded;
  const isPlayerSuppressed = isPlayerFull;

  const rawCover = currentSong?.coverUrl;
  const coverUrl = rawCover && !rawCover.includes('/null/') && !rawCover.includes('null/null')
    ? rawCover.replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none select-none flex flex-col items-center pb-[calc(0.45rem+env(safe-area-inset-bottom,0px))]">
      {/* ── 1. FLOATING MINI-PLAYER PILL BAR (GLASSMORPHISM + TRANSLUCENCY + MONOCHROME CONTROLS) ───────────── */}
      {currentSong && !isPlayerSuppressed && (
        <div className="w-full px-3 pb-2 flex justify-center pointer-events-auto">
          <div
            onClick={() => {
              haptics.lightImpact();
              togglePlayerExpanded();
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="w-full max-w-[440px] h-[58px] rounded-full backdrop-blur-3xl backdrop-saturate-[180%] border flex items-center justify-between px-3 cursor-pointer active:scale-[0.985] transition-all overflow-hidden touch-none select-none relative group bg-neutral-950/70 border-white/[0.12] hover:border-white/[0.2] shadow-[0_16px_40px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.18)]"
          >
            {/* Specular Liquid Edge Highlight */}
            <div className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            {/* Specular Glass Highlight Reflection Sheen */}
            <div className="absolute inset-0 rounded-full pointer-events-none bg-gradient-to-b from-white/[0.08] via-transparent to-black/25" />

            {/* External diffuse ambient halo behind pill */}
            <div
              className="absolute -inset-2 -z-20 rounded-full opacity-35 blur-2xl transition-all duration-700 pointer-events-none"
              style={{
                background: palette?.primary
                  ? `radial-gradient(ellipse at center, ${palette.primary}45 0%, transparent 72%)`
                  : 'radial-gradient(ellipse at center, rgba(255,255,255,0.15) 0%, transparent 72%)',
              }}
            />

            {/* Internal blurred artwork texture inside glass */}
            <div className="absolute inset-0 -z-10 overflow-hidden rounded-full pointer-events-none opacity-25 blur-2xl scale-125 transform-gpu transition-all duration-700">
              <img
                src={coverUrl}
                alt=""
                className="w-full h-full object-cover filter saturate-150"
              />
            </div>

            {/* Left: Thumbnail & Title */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-1.5 z-10">
              <div className="relative w-[38px] h-[38px] rounded-full overflow-hidden bg-black/60 border border-white/15 flex-shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex items-center justify-center">
                <OptimizedImage
                  src={coverUrl}
                  alt={currentSong.title}
                  size="thumb"
                  imageFit="cover"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-[12.5px] font-bold text-white truncate leading-snug tracking-tight">
                  {currentSong.title}
                </h4>
                {!isLocalPlayback ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      haptics.lightImpact();
                      toggleCastModal();
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-[#1DB954] hover:underline cursor-pointer mt-0.5 leading-tight truncate"
                    title={`Playing on ${activePlaybackDeviceName}`}
                    aria-label={`Playing on ${activePlaybackDeviceName}`}
                  >
                    <span className="text-[9px] leading-none">▶</span>
                    <span className="truncate">playing on {activePlaybackDeviceName}</span>
                  </button>
                ) : (
                  <p className="text-[11px] font-medium text-[#D0D0D0] truncate flex items-center gap-1.5 mt-0.5">
                    <span className="truncate">{currentSong.artist || 'RaagaX'}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Center: Centered Branding Pill */}
            <div className="hidden min-[380px]:flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] opacity-80 hover:opacity-100 transition-opacity z-10 flex-shrink-0 mx-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-pulse" />
              <span className="text-[8.5px] font-black tracking-[0.22em] text-[#D0D0D0] uppercase">
                RAAGAX
              </span>
            </div>

            {/* Right: Minimal Monochrome Action Controls */}
            <div
              className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Spotify Connect Device Button */}
              <button
                onClick={() => {
                  haptics.lightImpact();
                  toggleCastModal();
                }}
                aria-label={!isLocalPlayback ? `Playing on ${activePlaybackDeviceName}` : "Connect to a device"}
                className={`relative w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90 cursor-pointer ${
                  !isLocalPlayback || isCastModalOpen
                    ? 'text-[#1DB954] bg-[#1DB954]/15 shadow-sm'
                    : 'text-[#D0D0D0] hover:text-white hover:bg-white/10'
                }`}
                title={isLocalPlayback ? "Connect to a device" : `Playing on ${activePlaybackDeviceName}`}
              >
                <MonitorSpeaker className={`w-3.5 h-3.5 ${!isLocalPlayback ? 'animate-pulse text-[#1DB954]' : ''}`} />
                {!isLocalPlayback && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#1DB954] ring-2 ring-black animate-pulse" />
                )}
              </button>

              {/* Play / Pause - Minimal Monochrome Solid White Circle (matching desktop PlayerBar) */}
              <button
                onClick={() => {
                  haptics.mediumImpact();
                  togglePlayPause();
                }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-8 h-8 rounded-full bg-white text-black hover:bg-neutral-100 flex items-center justify-center shadow-[0_2px_12px_rgba(255,255,255,0.25)] active:scale-90 transition-all cursor-pointer flex-shrink-0"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-black text-black stroke-none" />
                ) : (
                  <Play className="w-4 h-4 fill-black text-black stroke-none ml-0.5" />
                )}
              </button>

              {/* Next Track (Minimal Monochrome) */}
              <button
                onClick={() => {
                  haptics.lightImpact();
                  playNext();
                }}
                aria-label="Next track"
                className="w-7 h-7 flex items-center justify-center text-[#D0D0D0] hover:text-white active:scale-90 transition-transform cursor-pointer"
              >
                <FastForward className="w-4 h-4 fill-current stroke-none" />
              </button>
            </div>

            {/* Integrated Progress Bar (Along Bottom Edge of Pill) */}
            <div className="absolute left-6 right-6 bottom-0 z-30 pointer-events-auto h-1.5 flex items-center">
              <SeekBar
                className="w-full !py-0 h-1.5 flex items-center"
                height="h-[2px]"
                thumbSize="w-0 h-0 opacity-0"
                activeColor="bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 2. BOTTOM NAVIGATION BAR (GLASS FLOATING BAR MATCHING PILL DESIGN) ──────────────── */}
      <div className="w-full px-3 flex justify-center pointer-events-auto">
        <div
          className="w-full max-w-[440px] h-[52px] px-2 flex items-center justify-around bg-neutral-950/70 backdrop-blur-3xl border border-white/[0.1] rounded-full shadow-[0_12px_32px_rgba(0,0,0,0.65)]"
          role="navigation"
          aria-label="Mobile Navigation"
        >
          {navItems.map((item) => {
            const isActive = isNavItemActive(item.id);
            const Icon = item.icon;
            const isFillable = item.id === 'home' || item.id === 'new' || item.id === 'library';

            return (
              <button
                key={item.id}
                onClick={() => {
                  haptics.lightImpact();
                  setActiveTab(item.id as ActiveTab);
                }}
                className={`relative flex-1 flex flex-col items-center justify-center py-1 cursor-pointer transition-all duration-200 active:scale-95 bg-transparent ${
                  isActive ? 'scale-105' : 'opacity-70 hover:opacity-100'
                }`}
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-xl bg-[#FA233B]/10 border border-[#FA233B]/20 pointer-events-none animate-in fade-in zoom-in-95 duration-150" />
                )}

                <Icon
                  className={`w-5 h-5 relative z-10 transition-all duration-150 ${
                    isActive
                      ? `text-[#FA233B] ${isFillable ? 'fill-[#FA233B]' : 'stroke-[2.4]'}`
                      : 'text-[var(--text-muted)] fill-none stroke-[1.8]'
                  }`}
                />

                <span
                  className={`text-[10px] font-medium tracking-tight mt-0.5 relative z-10 transition-colors ${
                    isActive ? 'text-[#FA233B] font-bold' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


