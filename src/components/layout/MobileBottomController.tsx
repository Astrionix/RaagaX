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

  const coverUrl = currentSong?.coverUrl && !currentSong.coverUrl.includes('/null/') && !currentSong.coverUrl.includes('null/null')
    ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  return (
    <div className="md:hidden fixed left-0 right-0 bottom-0 z-40 select-none pointer-events-auto">
      {/* Continuous Edge-to-Edge Dark Glass Dock */}
      <div className="relative w-full flex flex-col gap-0 bg-[#16161a]/96 backdrop-blur-2xl border-t border-white/[0.10] shadow-[0_-8px_32px_rgba(0,0,0,0.85)] pb-[env(safe-area-inset-bottom,0px)]">

        {/* ── 1. MINI-PLAYER BAR (APPLE MUSIC STYLE) ─────────────────────────── */}
        {currentSong && (
          <div
            className="relative h-[52px] px-3.5 flex items-center justify-between gap-3 border-b border-white/[0.08] cursor-pointer"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={() => {
              haptics.mediumImpact();
              togglePlayerExpanded();
            }}
          >
            {/* Top Border Progress Indicator */}
            <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden pointer-events-none z-20">
              <SeekBar className="w-full h-full" height="h-[2px]" thumbSize="w-0 h-0" />
            </div>

            {/* Left: Album Cover + Track Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative w-[38px] h-[38px] rounded-md overflow-hidden bg-black/60 border border-white/10 flex-shrink-0 shadow-sm">
                <OptimizedImage
                  src={coverUrl}
                  alt={currentSong.title}
                  size="thumb"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-[14px] font-semibold text-white truncate leading-snug tracking-tight">
                  {currentSong.title}
                </h4>
              </div>
            </div>

            {/* Right: Direct Solid White Action Icons (Play/Pause ▶ + FastForward ⏩) */}
            <div
              className="flex items-center gap-4 flex-shrink-0 pr-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  haptics.mediumImpact();
                  togglePlayPause();
                }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-9 h-9 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-white text-white stroke-none" />
                ) : (
                  <Play className="w-5 h-5 fill-white text-white stroke-none ml-0.5" />
                )}
              </button>

              <button
                onClick={() => {
                  haptics.lightImpact();
                  playNext();
                }}
                aria-label="Next track"
                className="w-9 h-9 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer"
              >
                <FastForward className="w-6 h-6 fill-white text-white stroke-none" />
              </button>
            </div>
          </div>
        )}

        {/* ── 2. BOTTOM NAVIGATION BAR (APPLE MUSIC 5-TAB BAR) ──────────────── */}
        <div
          className="h-[50px] px-1 flex items-center justify-around bg-transparent"
          role="navigation"
          aria-label="Apple Music Bottom Navigation"
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
                className="relative flex-1 flex flex-col items-center justify-center py-1 cursor-pointer transition-colors active:scale-95 bg-transparent"
              >
                <Icon
                  className={`w-5 h-5 transition-all duration-150 ${isActive
                      ? `text-[#FA233B] ${isFillable ? 'fill-[#FA233B]' : 'stroke-[2.4]'}`
                      : 'text-[#8E8E93] fill-none stroke-[1.8]'
                    }`}
                />

                <span
                  className={`text-[10px] font-medium tracking-tight mt-0.5 transition-colors ${isActive ? 'text-[#FA233B] font-semibold' : 'text-[#8E8E93]'
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


