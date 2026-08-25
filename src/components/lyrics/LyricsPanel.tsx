'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLyricsStore } from '@/context/useLyricsStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useThemeStore } from '@/context/useThemeStore';
import { LyricsLine } from '@/lib/lyrics/LyricsTypes';
import { X, Mic2, Music } from 'lucide-react';

export function LyricsPanel() {
  const { status, type, lines, currentLineIndex, scriptMode, setScriptMode, hasTransliteration } = useLyricsStore();
  const { isLyricsOpen, toggleLyrics, currentSong } = usePlayerStore();
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
        LyricsEngine.getInstance().loadTrack(currentSong.id);
      });
    }
  }, [isLyricsOpen, currentSong?.id]);

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
        <div className={`flex-1 flex flex-col items-center justify-center h-full ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          <div className="w-6 h-6 border-2 border-red-500/30 border-t-[#FA233B] rounded-full animate-spin mb-4" />
          <p className="font-bold text-sm">Loading lyrics...</p>
        </div>
      );
    }

    if (status === 'unavailable' || status === 'error' || lines.length === 0) {
      return (
        <div className={`flex-1 flex flex-col items-center justify-center h-full text-center px-4 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          <p className={`font-bold text-lg mb-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>Lyrics unavailable</p>
          <p className="text-sm">We couldn&apos;t find lyrics for this song.</p>
        </div>
      );
    }

    return (
      <div className="relative flex-1 h-full overflow-hidden flex flex-col">
        <div 
          ref={scrollRef}
          onWheel={handleScroll}
          onTouchMove={handleScroll}
          className="flex-1 overflow-y-auto scrollbar-hide py-32 space-y-5 flex flex-col items-start px-2"
        >
          {lines.map((line, index) => {
            const isActive = index === currentLineIndex;
            const isPassed = index < currentLineIndex;
            const displayContent = (scriptMode === 'transliteration' && line.romanizedText) 
              ? line.romanizedText 
              : (line.nativeText || line.text);

            return (
              <div
                key={line.id}
                id={`lyric-line-${index}`}
                className={`transition-all duration-300 transform origin-left w-full text-left cursor-pointer select-none
                  ${type === 'plain' ? (isLight ? 'text-base text-slate-800 font-medium' : 'text-base text-white font-medium') : ''}
                  ${type === 'line-synced' ? (
                    isActive 
                      ? (isLight 
                          ? 'text-2xl sm:text-3xl font-black text-[#D90429] drop-shadow-[0_0_14px_rgba(217,4,41,0.3)] scale-[1.02]' 
                          : 'text-2xl sm:text-3xl font-black text-[#FA233B] drop-shadow-[0_0_20px_rgba(250,35,59,0.55)] scale-[1.02]')
                      : isPassed 
                        ? (isLight ? 'text-lg sm:text-xl font-bold text-slate-400/70' : 'text-lg sm:text-xl font-bold text-white/30')
                        : (isLight ? 'text-lg sm:text-xl font-bold text-slate-600 hover:text-slate-900' : 'text-lg sm:text-xl font-bold text-white/60 hover:text-white/90')
                  ) : ''}
                `}
                onClick={() => {
                  if (line.startMs !== undefined && line.startMs >= 0) {
                    const targetSeconds = line.startMs / 1000;
                    usePlayerStore.getState().setCurrentTime(targetSeconds, true);
                    usePlayerStore.getState().setSeekTarget(targetSeconds);
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

        {/* Manual Scroll Override Indicator */}
        {isManualScroll && type === 'line-synced' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-in fade-in slide-in-from-bottom-4">
            <button 
              onClick={handleSyncToCurrent}
              className={`backdrop-blur-md border font-bold text-xs px-4 py-2 rounded-full shadow-xl transition-all hover:scale-105 active:scale-95 ${
                isLight 
                  ? 'bg-white/90 hover:bg-white text-slate-900 border-red-200 shadow-red-500/10' 
                  : 'bg-black/80 hover:bg-black text-white border-white/20 shadow-black/50'
              }`}
            >
              Sync to Current Line
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`fixed inset-x-0 bottom-0 top-0 sm:top-20 sm:bottom-28 sm:right-6 sm:left-auto sm:w-[420px] z-[150] glass-panel backdrop-blur-3xl rounded-none sm:rounded-3xl p-5 sm:p-6 border-t sm:border shadow-2xl flex flex-col justify-between animate-in fade-in slide-in-from-bottom sm:slide-in-from-right duration-300 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] ${
      isLight 
        ? 'bg-gradient-to-b from-[#fff5f5]/98 via-white/98 to-slate-50/98 border-black/10 text-slate-900 shadow-red-500/10' 
        : 'bg-gradient-to-b from-[#18080a]/98 via-[#121212]/98 to-[#101012]/98 border-white/10 text-white shadow-[0_20px_50px_rgba(250,35,59,0.2)]'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between border-b pb-3 mb-3 ${isLight ? 'border-black/10' : 'border-white/10'}`}>
        <div className="flex items-center gap-2">
          <Mic2 className="w-5 h-5 text-[#FA233B]" />
          <h3 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>Live Synced Lyrics</h3>
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

      {/* Synchronized Lyrics Container */}
      <div className="flex-1 overflow-hidden relative">
        {content()}
      </div>

      {/* Footer Info */}
      <div className={`pt-3 mt-2 border-t text-[11px] font-semibold text-center flex items-center justify-center gap-1.5 ${
        isLight 
          ? 'border-black/10 text-slate-400' 
          : 'border-white/10 text-white/40'
      }`}>
        <Music className="w-3.5 h-3.5 text-[#FA233B]" /> Powered by local LyricsEngine
      </div>
    </div>
  );
}

