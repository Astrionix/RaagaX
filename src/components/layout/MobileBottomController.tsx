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
import { useJamStore } from '@/context/useJamStore';
import { useConnectStore } from '@/context/useConnectStore';
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
    currentSong: localCurrentSong,
    isPlaying: localIsPlaying,
    togglePlayPause,
    playNext,
    playPrev,
    togglePlayerExpanded,
    isPlayerExpanded,
  } = usePlayerStore();

  const { session, isInJam } = useJamStore();
  const { isRemoteMode, activePlaybackDevice, remoteSession, sendPlay, sendPause, sendNext, sendPrev } = useConnectStore();

  const currentSong = (isRemoteMode && remoteSession?.currentSong)
    ? remoteSession.currentSong
    : (isInJam && session?.currentSong)
    ? session.currentSong
    : localCurrentSong;

  const isPlaying = (isRemoteMode && remoteSession)
    ? remoteSession.isPlaying
    : (isInJam && session)
    ? session.state === 'PLAYING'
    : localIsPlaying;

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
      if (isRemoteMode) {
        sendNext();
      } else {
        playNext();
      }
    } else if (diffX > 45 && Math.abs(diffX) > Math.abs(diffY)) {
      haptics.lightImpact();
      if (isRemoteMode) {
        sendPrev();
      } else {
        playPrev();
      }
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
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none select-none flex flex-col items-center">
      {/* ── 1. FLOATING MINI-PLAYER BAR (APPLE MUSIC PILL STYLE) ───────────── */}
      <div className="w-full px-3 pb-2 flex justify-center pointer-events-auto">
        {currentSong && !isPlayerSuppressed && (
          <div
            onClick={() => {
              haptics.lightImpact();
              togglePlayerExpanded();
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="w-full max-w-[430px] h-[52px] rounded-[16px] bg-[#1C1C1E]/80 backdrop-blur-2xl border border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.7)] flex items-center justify-between px-3 cursor-pointer active:scale-[0.985] transition-all overflow-hidden relative"
          >
            {/* Ambient Background Glow matching song cover art */}
            <div
              className="absolute -inset-1 opacity-25 blur-xl pointer-events-none"
              style={{
                backgroundImage: `url(${coverUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            {/* Left: Thumbnail & Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2 z-10">
              <div className="relative w-[38px] h-[38px] rounded-md overflow-hidden bg-black/60 border border-white/10 flex-shrink-0 shadow-sm">
                <OptimizedImage
                  src={coverUrl}
                  alt={currentSong.title}
                  size="thumb"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-[13px] font-semibold text-white truncate leading-snug tracking-tight">
                  {currentSong.title}
                </h4>
                {isRemoteMode && (
                  <p className="text-[10px] text-emerald-400 font-semibold truncate flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                    <span className="truncate">🔊 {activePlaybackDevice?.deviceName || 'Speaker'}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Right: Direct Solid White Action Icons (Play/Pause ▶ + FastForward ⏩) */}
            <div
              className="flex items-center gap-4 flex-shrink-0 pr-1 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  haptics.mediumImpact();
                  if (isRemoteMode) {
                    isPlaying ? sendPause() : sendPlay();
                  } else {
                    togglePlayPause();
                  }
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
                  if (isRemoteMode) {
                    sendNext();
                  } else {
                    playNext();
                  }
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


