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
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ActiveTab } from '@/types/music';
import { SeekBar } from '@/components/player/SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { haptics } from '@/lib/haptics/HapticEngine';

export function MobileBottomController() {
  const [mounted, setMounted] = useState(false);
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
  } = usePlayerStore();

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none select-none flex flex-col items-center pb-[calc(0.35rem+env(safe-area-inset-bottom,0px))]">
      {/* ── 1. FLOATING MINI-PLAYER BAR (APPLE LIQUID GLASS & WATER DROP 3D STYLE) ───────────── */}
      {currentSong && !isPlayerSuppressed && (
        <div className="w-full px-3 pb-1.5 flex justify-center pointer-events-auto">
          <div
            onClick={() => {
              haptics.lightImpact();
              togglePlayerExpanded();
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="w-full max-w-[440px] h-[54px] rounded-[20px] bg-[#161619]/85 backdrop-blur-3xl border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.85),0_2px_12px_rgba(255,255,255,0.08)] flex items-center justify-between px-3 cursor-pointer active:scale-[0.985] transition-all overflow-hidden relative group"
          >
            {/* Top Specular Liquid Edge Highlight */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

            {/* Ambient Dynamic Background Glow matching album cover */}
            <div
              className="absolute -inset-2 opacity-30 blur-2xl pointer-events-none transition-all duration-700"
              style={{
                backgroundImage: `url(${coverUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            {/* Left: Thumbnail & Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2 z-10">
              <div className="relative w-[40px] h-[40px] rounded-xl overflow-hidden bg-black/60 border border-white/15 flex-shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                <OptimizedImage
                  src={coverUrl}
                  alt={currentSong.title}
                  size="thumb"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-[13px] font-bold text-white truncate leading-snug tracking-tight">
                  {currentSong.title}
                </h4>
                <p className="text-[11px] font-medium text-white/60 truncate flex items-center gap-1.5">
                  <span className="truncate">{currentSong.artist || 'RaagaX Music'}</span>
                </p>
              </div>
            </div>

            {/* Right: Direct Action Icons (Connect to Device + Play/Pause ▶ + FastForward ⏩) */}
            <div
              className="flex items-center gap-2.5 flex-shrink-0 pr-1 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Play / Pause Liquid Glass Button */}
              <button
                onClick={() => {
                  haptics.mediumImpact();
                  togglePlayPause();
                }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-90 transition-all cursor-pointer hover:scale-105"
              >
                {isPlaying ? (
                  <Pause className="w-4.5 h-4.5 fill-black text-black stroke-none" />
                ) : (
                  <Play className="w-4.5 h-4.5 fill-black text-black stroke-none ml-0.5" />
                )}
              </button>

              <button
                onClick={() => {
                  haptics.lightImpact();
                  playNext();
                }}
                aria-label="Next track"
                className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-transform cursor-pointer"
              >
                <FastForward className="w-5 h-5 fill-white text-white stroke-none" />
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ── 2. BOTTOM NAVIGATION BAR (GLASS FLOATING BAR) ──────────────── */}
      <div className="w-full px-3 flex justify-center pointer-events-auto">
        <div
          className="w-full max-w-[440px] h-[52px] px-2 flex items-center justify-around bg-[#121215]/90 backdrop-blur-2xl border border-white/10 rounded-[22px] shadow-[0_12px_32px_rgba(0,0,0,0.8)]"
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
                      : 'text-white/60 fill-none stroke-[1.8]'
                  }`}
                />

                <span
                  className={`text-[10px] font-medium tracking-tight mt-0.5 relative z-10 transition-colors ${
                    isActive ? 'text-[#FA233B] font-bold' : 'text-white/60'
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


