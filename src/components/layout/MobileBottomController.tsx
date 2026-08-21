'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Heart,
  Search,
  Home,
  Flame,
  Radio,
  Library,
  User,
  Disc,
  ListMusic,
  Download,
  Clock,
  BarChart3,
  Layers,
  Sparkles,
  Disc3,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ActiveTab } from '@/types/music';
import { SeekBar } from '@/components/player/SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { haptics } from '@/lib/haptics/HapticEngine';
import { LiquidGlass } from '@/components/common/LiquidGlass';


export function MobileBottomController() {
  const [mounted, setMounted] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollYRef = useRef(0);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });

  const {
    activeTab,
    setActiveTab,
    currentSong,
    isPlaying,
    togglePlayPause,
    playNext,
    playPrev,
    togglePlayerExpanded,
    likedSongIds = [],
    toggleLikeSong,
    isActiveDevice,
    remoteDeviceName,
  } = usePlayerStore();

  const isLiked = currentSong ? likedSongIds.includes(currentSong.id) : false;

  // ── 1. GLOBAL VERTICAL SCROLL LISTENER (NO HORIZONTAL INTERFERENCE) ────────
  useEffect(() => {
    setMounted(true);

    const mainEl = document.querySelector('.main-content');
    let ticking = false;

    const handleScroll = () => {
      const currentScrollY = mainEl ? mainEl.scrollTop : window.scrollY;
      const deltaY = currentScrollY - lastScrollYRef.current;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Only trigger on meaningful vertical scroll
          if (Math.abs(deltaY) > 3) {
            if (deltaY > 0 && currentScrollY > 25) {
              // Scrolling Down -> Activate Compact Controller (~54dp)
              setIsScrolling(true);
            } else if (deltaY < -12) {
              // Scrolling Up -> Restore Normal State (~132dp stack)
              setIsScrolling(false);
            }
          }

          lastScrollYRef.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }

      // Clear existing stop timer
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Stop Timer: Wait 600ms after scrolling stops to restore normal state
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 600);
    };

    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (mainEl) mainEl.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // ── 2. CONTEXTUAL SECTION ICON (LEFT IN COMPACT MODE) ─────────────────────
  const contextualIcon = useMemo(() => {
    switch (activeTab) {
      case 'home':
        return { icon: Home, label: 'Home', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) };
      case 'search':
        return { icon: Search, label: 'Search', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) };
      case 'new':
        return { icon: Flame, label: 'New', action: () => setActiveTab('new') };
      case 'radio':
        return { icon: Radio, label: 'Radio', action: () => setActiveTab('radio') };
      case 'library':
      case 'favorites':
        return { icon: Library, label: 'Library', action: () => setActiveTab('library') };
      case 'album':
        return { icon: Disc, label: 'Album', action: () => setActiveTab('library') };
      case 'artist':
        return { icon: User, label: 'Artist', action: () => setActiveTab('library') };
      case 'playlist':
        return { icon: ListMusic, label: 'Playlist', action: () => setActiveTab('library') };
      case 'genres':
        return { icon: Layers, label: 'Genres', action: () => setActiveTab('library') };
      case 'downloads':
        return { icon: Download, label: 'Downloads', action: () => setActiveTab('library') };
      case 'history':
        return { icon: Clock, label: 'History', action: () => setActiveTab('library') };
      case 'insights':
        return { icon: BarChart3, label: 'Insights', action: () => setActiveTab('library') };
      case 'profile':
      case 'settings':
        return { icon: User, label: 'You', action: () => setActiveTab('profile') };
      default:
        return { icon: Sparkles, label: 'RaagaX', action: () => setActiveTab('home') };
    }
  }, [activeTab, setActiveTab]);

  // ── 3. BOTTOM NAV ITEMS (HOME | NEW | RADIO | LIBRARY) ───────────────────────────
  const navItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'new' as const, label: 'New', icon: Flame },
    { id: 'radio' as const, label: 'Radio', icon: Radio },
    { id: 'library' as const, label: 'Library', icon: Library },
  ];

  const isNavItemActive = (id: string) => {
    if (id === 'home') return activeTab === 'home';
    if (id === 'new') return activeTab === 'new';
    if (id === 'radio') return activeTab === 'radio';
    if (id === 'library') return ['library', 'downloads', 'favorites', 'history', 'insights', 'recaps', 'album', 'artist', 'playlist', 'genres'].includes(activeTab);
    return activeTab === id;
  };

  // ── 4. GESTURE HANDLERS (SWIPE UP FOR FULL PLAYER, SWIPE L/R FOR TRACKS) ──
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;
    setSwipeOffset({
      x: Math.max(-30, Math.min(30, diffX * 0.25)),
      y: Math.max(-20, Math.min(10, diffY * 0.25)),
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    setSwipeOffset({ x: 0, y: 0 });

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

  const ContextualIconComponent = contextualIcon.icon;

  return (
    <div className="md:hidden fixed left-0 right-0 bottom-0 z-40 pointer-events-none select-none">
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* STATE 2: ACTIVE SCROLLING COMPACT CONTROLLER (~54dp)                    */}
      {/* [36dp Contextual] [36dp Cover] Song Title + Artist [36dp ▶] [36dp 🔍]   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {currentSong && (
        <div
          className={`fixed left-4 right-4 max-w-[480px] mx-auto pointer-events-none transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isScrolling
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto z-50'
              : 'opacity-0 translate-y-6 scale-95 pointer-events-none z-10'
          }`}
          style={{ bottom: 'calc(0.45rem + env(safe-area-inset-bottom))' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Subtle Ambient Glow */}
          <div
            className="absolute -inset-1 rounded-[28px] opacity-20 blur-md pointer-events-none"
            style={{
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />

          {/* Compact Pill Container — LiquidGlass Level 2 */}
          <LiquidGlass
            level={2}
            shape="rounded"
            className="relative h-[54px] px-2.5 flex items-center justify-between gap-2 overflow-hidden"
            style={{ borderRadius: '28px' }}
          >
            {/* Top Border Progress Indicator */}
            <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden pointer-events-none">
              <SeekBar className="w-full h-full" height="h-[2px]" thumbSize="w-0 h-0" />
            </div>

            {/* LEFT: Contextual Section Icon (Navigation Only) */}
            <button
              onClick={() => {
                haptics.lightImpact();
                contextualIcon.action();
              }}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 active:scale-90 transition-transform flex items-center justify-center text-slate-300 hover:text-white flex-shrink-0 cursor-pointer border border-white/5"
              title={contextualIcon.label}
              aria-label={contextualIcon.label}
            >
              <ContextualIconComponent className="w-4 h-4 text-[#FA233B]" />
            </button>

            {/* CENTER: Artwork (36dp) + Song Title + Play/Pause Button (36dp) */}
            <div
              onClick={() => {
                haptics.mediumImpact();
                togglePlayerExpanded();
              }}
              className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
            >
              <div className="relative w-[36px] h-[36px] rounded-lg overflow-hidden flex-shrink-0 bg-slate-900 border border-white/10 shadow-sm">
                <OptimizedImage src={coverUrl} alt={currentSong.title} size="thumb" className="w-full h-full object-cover" />
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/35 flex items-center justify-center gap-0.5">
                    <span className="w-0.5 h-2 bg-[#FA233B] rounded-full animate-[pulse_0.4s_infinite_alternate]" />
                    <span className="w-0.5 h-3 bg-white rounded-full animate-[pulse_0.5s_infinite_alternate_0.1s]" />
                    <span className="w-0.5 h-1.5 bg-[#FA233B] rounded-full animate-[pulse_0.45s_infinite_alternate_0.2s]" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white truncate leading-tight">
                  {currentSong.title}
                </h4>
                <p className="text-[10px] text-slate-400 truncate leading-tight">
                  {currentSong.artist}
                </p>
              </div>

              {/* Play / Pause Toggle Button — LiquidGlass Level 3 */}
              <LiquidGlass
                level={3}
                shape="circle"
                interactive
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  haptics.mediumImpact();
                  togglePlayPause();
                }}
                className="w-9 h-9 text-white flex-shrink-0 cursor-pointer"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-white stroke-none" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-white stroke-none ml-0.5" />
                )}
              </LiquidGlass>
            </div>

            {/* RIGHT: Quick Search Button — LiquidGlass Level 3 circle */}
            <LiquidGlass
              level={3}
              shape="circle"
              interactive
              onClick={() => {
                haptics.lightImpact();
                setActiveTab('search');
              }}
              className="w-9 h-9 text-slate-200 flex-shrink-0 cursor-pointer"
              title="Search"
              aria-label="Open Search"
            >
              <Search className="w-4 h-4" />
            </LiquidGlass>
          </LiquidGlass>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* STATE 1: NORMAL / IDLE (MiniPlayer ~66dp + Bottom Nav ~64dp = ~130dp)   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div
        className={`transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isScrolling
            ? 'opacity-0 translate-y-8 pointer-events-none scale-98'
            : 'opacity-100 translate-y-0 pointer-events-auto scale-100'
        }`}
      >
        {/* ── 1.1 NORMAL MINI-PLAYER (~66dp) ─────────────────────────────────── */}
        {currentSong && (
          <div
            className="fixed left-4 right-4 max-w-[480px] mx-auto select-none pointer-events-auto"
            style={{
              bottom: 'calc(3.95rem + env(safe-area-inset-bottom))',
              transform: `translate(${swipeOffset.x}px, ${swipeOffset.y}px)`,
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Ambient Illumination */}
            <div
              className="absolute -inset-1 rounded-[28px] opacity-25 blur-lg pointer-events-none"
              style={{
                backgroundImage: `url(${coverUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(16px) saturate(180%)',
              }}
            />

            {/* Main Normal MiniPlayer Container — LiquidGlass Level 2 */}
            <LiquidGlass
              level={2}
              shape="rounded"
              className="relative h-[66px] px-3 py-1.5 flex flex-col justify-center overflow-hidden"
              style={{
                borderRadius: '28px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.70), 0 0 0 0.5px rgba(255,255,255,0.08)',
              }}
            >
              {/* Top Edge Progress Indicator */}
              <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden pointer-events-none">
                <SeekBar className="w-full h-full" height="h-[2px]" thumbSize="w-0 h-0" />
              </div>

              <div className="flex items-center justify-between gap-2.5 w-full">
                {/* 40dp Artwork + 13sp Title + 11sp Artist */}
                <div
                  onClick={() => {
                    haptics.mediumImpact();
                    togglePlayerExpanded();
                  }}
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                >
                  <div className="relative w-[40px] h-[40px] rounded-xl overflow-hidden shadow bg-black/50 border border-white/10 flex-shrink-0">
                    <OptimizedImage src={coverUrl} alt={currentSong.title} size="thumb" className="w-full h-full object-cover" />
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-0.5 pointer-events-none">
                        <span className="w-0.5 h-2 bg-[#FA233B] rounded-full animate-[pulse_0.4s_infinite_alternate]" />
                        <span className="w-0.5 h-3 bg-white rounded-full animate-[pulse_0.5s_infinite_alternate_0.1s]" />
                        <span className="w-0.5 h-1.5 bg-[#FA233B] rounded-full animate-[pulse_0.45s_infinite_alternate_0.2s]" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-[13px] font-bold text-white truncate leading-tight">
                      {currentSong.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate leading-tight flex items-center gap-1 mt-0.5">
                      {!isActiveDevice ? (
                        <span className="text-[#FA233B] font-medium flex items-center gap-1">
                          <Disc3 className="w-3 h-3 animate-spin" />
                          {remoteDeviceName || 'Remote Device'}
                        </span>
                      ) : (
                        <span>{currentSong.artist}</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right Controls: 20dp Heart, 40dp Play/Pause, 18dp Next Track */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      haptics.lightImpact();
                      toggleLikeSong(currentSong.id);
                    }}
                    aria-label="Favorite track"
                    className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white active:scale-90 transition-transform cursor-pointer rounded-full"
                  >
                    <Heart
                      className={`w-[18px] h-[18px] transition-colors ${
                        isLiked ? 'fill-[#FA233B] text-[#FA233B]' : ''
                      }`}
                      strokeWidth={2.2}
                    />
                  </button>

                  {/* Play/Pause — LiquidGlass Level 3 circle */}
                  <LiquidGlass
                    level={3}
                    shape="circle"
                    interactive
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      haptics.mediumImpact();
                      togglePlayPause();
                    }}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    className="w-10 h-10 cursor-pointer"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 fill-white stroke-none" />
                    ) : (
                      <Play className="w-4 h-4 fill-white stroke-none ml-0.5" />
                    )}
                  </LiquidGlass>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      haptics.lightImpact();
                      playNext();
                    }}
                    aria-label="Next track"
                    className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white active:scale-90 transition-transform cursor-pointer rounded-full"
                  >
                    <SkipForward className="w-[18px] h-[18px] fill-current stroke-none" />
                  </button>
                </div>
              </div>
            </LiquidGlass>
          </div>
        )}

        {/* ── 1.2 NORMAL FLOATING NAVIGATION (HOME | NEW | LIBRARY) + FLOATING SEARCH ── */}
        <div
          className="fixed left-4 right-4 max-w-[480px] mx-auto z-40 flex items-center justify-between gap-2 pointer-events-none"
          style={{ bottom: 'calc(0.35rem + env(safe-area-inset-bottom))' }}
        >
          {/* Main 3-Tab Pill Surface — LiquidGlass Level 1 */}
          <LiquidGlass
            level={1}
            shape="rounded"
            className="pointer-events-auto flex-1 flex items-center justify-between gap-1 px-3 py-1.5 overflow-hidden h-[54px]"
            style={{ borderRadius: '26px' }}
            aria-label="Mobile Navigation"
            role="navigation"
          >

            {navItems.map((item) => {
              const isActive = isNavItemActive(item.id);
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    haptics.lightImpact();
                    setActiveTab(item.id as ActiveTab);
                  }}
                  className={`relative flex-1 flex flex-col items-center justify-center min-h-[42px] py-1 px-1.5 rounded-xl transition-all duration-200 cursor-pointer ${
                    isActive ? 'scale-105' : 'text-slate-400 hover:text-white active:scale-95'
                  }`}
                >
                  {/* Active Red Pill Indicator */}
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl bg-[#FA233B]/15 border border-[#FA233B]/30 shadow-[0_2px_10px_rgba(250,35,59,0.2)] pointer-events-none animate-in fade-in zoom-in-95 duration-150" />
                  )}

                  <Icon
                    className={`w-4 h-4 relative z-10 transition-transform duration-200 ${
                      isActive ? 'text-[#FA233B] stroke-[2.5]' : 'stroke-[1.75]'
                    }`}
                  />

                  <span
                    className={`text-[9.5px] font-sans font-bold tracking-tight mt-0.5 relative z-10 transition-all ${
                      isActive ? 'text-[#FA233B]' : 'text-slate-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </LiquidGlass>

          {/* Floating Circular Search Button — LiquidGlass Level 3 circle */}
          <LiquidGlass
            level={3}
            shape="circle"
            interactive
            onClick={() => {
              haptics.lightImpact();
              setActiveTab('search');
            }}
            refractionColor={activeTab === 'search' ? 'rgba(250,35,59,0.25)' : undefined}
            glowColor={activeTab === 'search' ? 'rgba(250,35,59,0.40)' : undefined}
            className="pointer-events-auto w-[54px] h-[54px] cursor-pointer flex-shrink-0"
            title="Search"
            aria-label="Search"
          >
            <Search className={`w-5 h-5 stroke-[2.2] ${activeTab === 'search' ? 'text-[#FA233B]' : 'text-slate-200'}`} />
          </LiquidGlass>
        </div>
      </div>
    </div>
  );
}
