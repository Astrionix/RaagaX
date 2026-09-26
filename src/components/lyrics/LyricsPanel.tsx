'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLyricsStore } from '@/context/useLyricsStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useThemeStore } from '@/context/useThemeStore';
import { LyricsLine } from '@/lib/lyrics/LyricsTypes';
import { X, Mic2, Music, Sparkles, Sliders } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';


export function LyricsPanel() {
  const { 
    status, 
    type, 
    lines, 
    currentLineIndex, 
    scriptMode, 
    setScriptMode, 
    hasTransliteration,
    userOffsetMs,
    setUserOffsetMs,
  } = useLyricsStore();
  const {
    isLyricsOpen,
    toggleLyrics,
    currentSong,
    isKaraokeMode,
    toggleKaraokeMode,
    vocalReductionLevel,
    setVocalReductionLevel,
  } = usePlayerStore();

  // Lock background scroll when LyricsPanel is open
  useBodyScrollLock(isLyricsOpen);

  const { resolvedTheme } = useThemeStore();
  const isLight = resolvedTheme === 'light';
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track manual scrolling to pause auto-scroll
  const [isManualScroll, setIsManualScroll] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ensure LyricsEngine is tracking when panel opens or song changes
  useEffect(() => {
    if (isLyricsOpen && currentSong?.id) {
      import('@/lib/lyrics/LyricsEngine').then(({ LyricsEngine }) => {
        LyricsEngine.getInstance().loadTrack(currentSong.id, {
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album,
          durationMs: currentSong.duration ? currentSong.duration * 1000 : undefined,
        });
      });
    }
  }, [isLyricsOpen, currentSong?.id, currentSong?.title, currentSong?.artist]);

  // Auto-scroll logic: centers active line smoothly within container
  useEffect(() => {
    if (isManualScroll || currentLineIndex < 0 || lines.length === 0) return;
    
    const activeElement = document.getElementById(`lyric-line-${currentLineIndex}`);
    if (activeElement && scrollRef.current) {
      const container = scrollRef.current;
      const elementTop = activeElement.offsetTop;
      const elementHeight = activeElement.clientHeight;
      const containerHeight = container.clientHeight;
      const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
      
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    }
  }, [currentLineIndex, isManualScroll, lines]);

  // Handle user scroll
  const handleScroll = () => {
    if (type !== 'line-synced') return;
    
    setIsManualScroll(true);
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Resume auto-scroll after 3 seconds of inactivity
    scrollTimeoutRef.current = setTimeout(() => {
      setIsManualScroll(false);
    }, 3000);
  };

  const handleSyncToCurrent = () => {
    setIsManualScroll(false);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Trigger immediate scroll
    if (currentLineIndex >= 0) {
      const activeElement = document.getElementById(`lyric-line-${currentLineIndex}`);
      if (activeElement && scrollRef.current) {
        const container = scrollRef.current;
        const elementTop = activeElement.offsetTop;
        const elementHeight = activeElement.clientHeight;
        const containerHeight = container.clientHeight;
        const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
        
        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      }
    }
  };

  if (!isLyricsOpen || !currentSong) return null;

  const content = () => {
    if (status === 'loading') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400">
          <div className="w-8 h-8 border-2 border-red-500/30 border-t-[#FA233B] rounded-full animate-spin mb-4" />
          <p className="font-bold text-xs tracking-wider uppercase">Syncing Live Lyrics...</p>
        </div>
      );
    }

    if (status === 'unavailable' || lines.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
          <Mic2 className="w-12 h-12 stroke-[1.2] mb-3 text-slate-300 dark:text-slate-600" />
          <h4 className="text-base font-bold text-slate-800 dark:text-white mb-1">Lyrics Unavailable</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px]">
            No synchronized lyrics found for this track.
          </p>
        </div>
      );
    }

    return (
      <div 
        ref={scrollRef}
        onWheel={handleScroll}
        onTouchMove={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain no-scrollbar py-28 space-y-6 flex flex-col items-start px-2"
      >
        {/* Apple Music Instrumental Intro Bouncing Dots */}
        {currentLineIndex < 0 && (
          <div className="flex items-center gap-2 py-4 px-1 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-white/70 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/70 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/70 animate-bounce" />
          </div>
        )}

        {lines.map((line, index) => {
          const isActive = index === currentLineIndex;
          const distance = currentLineIndex >= 0 ? Math.abs(index - currentLineIndex) : 999;
          const displayContent = (scriptMode === 'transliteration' && line.romanizedText) 
            ? line.romanizedText 
            : (line.nativeText || line.text);

          const syncedClasses = isActive 
            ? 'text-2xl sm:text-3xl font-bold text-white scale-[1.03] opacity-100 z-10' 
            : distance === 1
              ? 'text-lg sm:text-xl font-semibold text-[#D4D4D4] opacity-75 hover:text-white hover:opacity-100'
              : distance === 2
                ? 'text-base sm:text-lg font-medium text-[#A8A8A8] opacity-55 hover:text-white hover:opacity-100'
                : 'text-sm sm:text-base font-normal text-[#808080] opacity-40 hover:text-white hover:opacity-100';

          return (
            <div
              key={line.id || index}
              id={`lyric-line-${index}`}
              style={{
                textShadow: isActive ? '0 0 8px rgba(255, 255, 255, 0.10)' : 'none',
                filter: 'none',
              }}
              className={`transition-all duration-300 transform origin-left w-full text-left cursor-pointer select-none filter-none
                ${type === 'plain' ? 'text-base text-white/90 font-medium' : ''}
                ${type === 'line-synced' ? syncedClasses : ''}
              `}
              onClick={() => {
                if (line.startMs !== undefined && line.startMs >= 0) {
                  const targetSeconds = line.startMs / 1000;
                  usePlayerStore.getState().seek(targetSeconds);
                  import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact()).catch(() => {});
                  import('@/lib/lyrics/LyricsEngine').then(({ LyricsEngine }) => {
                    LyricsEngine.getInstance().seek(line.startMs);
                  }).catch(() => {});
                }
              }}
            >
              <div className="leading-snug break-words tracking-tight">
                {displayContent}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-0 sm:top-20 sm:bottom-28 sm:right-6 sm:left-auto sm:w-[420px] z-[150] glass-panel backdrop-blur-3xl rounded-none sm:rounded-3xl p-5 sm:p-6 border-t sm:border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.85)] flex flex-col justify-between overscroll-contain animate-in fade-in slide-in-from-bottom sm:slide-in-from-right duration-300 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-gradient-to-b from-[#18080a]/98 via-[#121212]/98 to-[#101012]/98 text-white">
      {/* Header */}
      <div className={`flex items-center justify-between border-b pb-3 mb-3 ${isLight ? 'border-black/10' : 'border-white/10'}`}>
        <div className="flex items-center gap-2">
          <Mic2 className="w-5 h-5 text-[#FA233B]" />
          <h3 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>Live Lyrics</h3>
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FA233B]/20 text-[#FA233B] border border-[#FA233B]/30 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> LIVE
          </span>
        </div>
        
        {/* Script Mode Switcher: Option A (Native) ↔ Option B (Transliteration) */}
        {hasTransliteration && (
          <div className={`flex items-center p-0.5 rounded-lg border text-[11px] font-bold ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'
          }`}>
            <button
              onClick={() => setScriptMode('native')}
              className={`px-2.5 py-0.5 rounded-md transition-all ${
                scriptMode === 'native' 
                  ? (isLight ? 'bg-white text-slate-900 shadow-sm font-black' : 'bg-white/20 text-white shadow-sm font-black')
                  : (isLight ? 'text-slate-500 hover:text-slate-900' : 'text-white/50 hover:text-white')
              }`}
            >
              ● Native
            </button>
            <button
              onClick={() => setScriptMode('transliteration')}
              className={`px-2.5 py-0.5 rounded-md transition-all ${
                scriptMode === 'transliteration' 
                  ? (isLight ? 'bg-white text-slate-900 shadow-sm font-black' : 'bg-white/20 text-white shadow-sm font-black')
                  : (isLight ? 'text-slate-500 hover:text-slate-900' : 'text-white/50 hover:text-white')
              }`}
            >
              ● Transliteration
            </button>
          </div>
        )}

        <button
          onClick={toggleLyrics}
          className={`p-2 rounded-full transition-colors ${
            isLight 
              ? 'text-slate-500 hover:text-slate-900 hover:bg-black/5' 
              : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
          title="Close Lyrics"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Song Header Details */}
      <div className={`flex items-center gap-3 mb-3 p-3 rounded-2xl border ${
        isLight 
          ? 'bg-red-50/70 border-red-100' 
          : 'bg-white/5 border-white/5'
      }`}>
        <img
          src={currentSong.coverUrl ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500') : '/app-icon.png'}
          alt={currentSong.title}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
          className="w-12 h-12 rounded-xl object-cover shadow-md flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h4 className={`text-sm font-black truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{currentSong.title}</h4>
          <p className={`text-xs truncate font-medium ${isLight ? 'text-slate-500' : 'text-white/60'}`}>{currentSong.artist}</p>
        </div>
      </div>

      {/* 🎤 Apple Music Sing — Karaoke Mode Control Card */}
      <div className={`mb-3 p-3 rounded-2xl border transition-all ${
        isKaraokeMode
          ? (isLight ? 'bg-gradient-to-r from-rose-100 to-pink-100 border-rose-300' : 'bg-gradient-to-r from-[#FA233B]/20 to-rose-900/30 border-[#FA233B]/40 shadow-[0_0_20px_rgba(250,35,59,0.2)]')
          : (isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.03] border-white/10')
      }`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
              isKaraokeMode ? 'bg-[#FA233B] text-white animate-pulse' : 'bg-white/10 text-slate-400'
            }`}>
              <Mic2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className={`text-xs font-black leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Raaga Sing Mode
              </p>
              <p className={`text-[10px] leading-tight ${isLight ? 'text-slate-500' : 'text-white/50'}`}>
                {isKaraokeMode ? 'Vocal Attenuation Active' : 'Karaoke Lead Vocal Mute'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              toggleKaraokeMode();
              import('@/lib/haptics/HapticEngine').then(m => m.haptics.mediumImpact());
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              isKaraokeMode
                ? 'bg-[#FA233B] text-white shadow-md hover:bg-rose-600 scale-105'
                : (isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-white/10 hover:bg-white/20 text-white')
            }`}
          >
            {isKaraokeMode ? 'SING ON 🎤' : 'Enable Sing'}
          </button>
        </div>

        {isKaraokeMode && (
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-3 animate-in fade-in duration-200">
            <span className="text-[10px] font-bold text-rose-400 font-mono w-14">
              Vocal: {Math.round((1 - vocalReductionLevel) * 100)}%
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={vocalReductionLevel}
              onChange={(e) => setVocalReductionLevel(parseFloat(e.target.value))}
              className="flex-1 accent-[#FA233B] h-1.5 rounded-lg bg-white/20 cursor-pointer"
            />
            <span className="text-[10px] font-bold text-white/70 font-mono">
              {Math.round(vocalReductionLevel * 100)}% Mute
            </span>
          </div>
        )}
      </div>

      {/* ⏱ Pinpoint Sync Calibration Tuning */}
      {type === 'line-synced' && (
        <div className={`mb-3 px-3.5 py-1.5 rounded-2xl border flex items-center justify-between transition-all ${
          isLight 
            ? 'bg-slate-100/90 border-slate-200/80 text-slate-800' 
            : 'bg-white/[0.04] border-white/10 text-white/90'
        }`}>
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-[#FA233B]" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold">Sync Timing:</span>
              <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                userOffsetMs !== 0 
                  ? 'bg-[#FA233B]/20 text-[#FA233B] border border-[#FA233B]/30' 
                  : (isLight ? 'text-slate-400 bg-black/5' : 'text-white/40 bg-white/5')
              }`}>
                {userOffsetMs > 0 ? `+${userOffsetMs}ms` : `${userOffsetMs}ms`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setUserOffsetMs(userOffsetMs - 50);
                import('@/lib/haptics/HapticEngine').then(m => m.HapticEngine.getInstance().selectionTick()).catch(() => {});
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all active:scale-95 ${
                isLight ? 'bg-white shadow-sm hover:bg-slate-200 text-slate-700' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title="Shift lyrics 50ms earlier"
            >
              -50ms
            </button>
            {userOffsetMs !== 0 && (
              <button
                onClick={() => {
                  setUserOffsetMs(0);
                  import('@/lib/haptics/HapticEngine').then(m => m.HapticEngine.getInstance().selectionTick()).catch(() => {});
                }}
                className="px-2 py-0.5 text-[10px] font-bold text-[#FA233B] hover:underline transition-colors"
                title="Reset timing offset to zero"
              >
                Reset
              </button>
            )}
            <button
              onClick={() => {
                setUserOffsetMs(userOffsetMs + 50);
                import('@/lib/haptics/HapticEngine').then(m => m.HapticEngine.getInstance().selectionTick()).catch(() => {});
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all active:scale-95 ${
                isLight ? 'bg-white shadow-sm hover:bg-slate-200 text-slate-700' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title="Shift lyrics 50ms later"
            >
              +50ms
            </button>
          </div>
        </div>
      )}

      {/* Synchronized Lyrics Container */}
      <div className="flex-1 overflow-hidden relative">
        {content()}

        {/* Manual Scroll Override Indicator */}
        {isManualScroll && type === 'line-synced' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-bottom-3">
            <button 
              onClick={handleSyncToCurrent}
              className={`backdrop-blur-md border font-bold text-xs px-4 py-2 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                isLight 
                  ? 'bg-white/95 hover:bg-white text-slate-900 border-red-200 shadow-red-500/20' 
                  : 'bg-black/90 hover:bg-black text-white border-white/20 shadow-black/80'
              }`}
            >
              <Mic2 className="w-3.5 h-3.5 text-[#FA233B]" />
              <span>Sync to Current Line</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className={`pt-3 mt-2 border-t text-[11px] font-semibold text-center flex items-center justify-center gap-1.5 ${
        isLight 
          ? 'border-black/10 text-slate-400' 
          : 'border-white/10 text-white/40'
      }`}>
        <Music className="w-3.5 h-3.5 text-[#FA233B]" /> Powered by RaagaX Synced Lyrics Engine
      </div>
    </div>
  );
}

