'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLyricsStore } from '@/context/useLyricsStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { LyricsLine } from '@/lib/lyrics/LyricsTypes';
import { X, Mic2, Music } from 'lucide-react';

export function LyricsPanel() {
  const { status, type, lines, currentLineIndex } = useLyricsStore();
  const { isLyricsOpen, toggleLyrics, currentSong } = usePlayerStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Track manual scrolling to pause auto-scroll
  const [isManualScroll, setIsManualScroll] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (isManualScroll || currentLineIndex < 0 || lines.length === 0) return;
    
    const activeElement = document.getElementById(`lyric-line-${currentLineIndex}`);
    if (activeElement && scrollRef.current) {
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
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
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  };

  if (!isLyricsOpen || !currentSong) return null;

  const content = () => {
    if (status === 'loading') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400">
          <div className="w-6 h-6 border-2 border-slate-500 border-t-white rounded-full animate-spin mb-4" />
          <p className="font-bold text-sm">Loading lyrics...</p>
        </div>
      );
    }

    if (status === 'unavailable' || status === 'error' || lines.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400">
          <p className="font-bold text-lg mb-2">Lyrics unavailable</p>
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
          className="flex-1 overflow-y-auto scrollbar-hide py-32 space-y-4 flex flex-col items-start px-2"
        >
          {lines.map((line, index) => {
            const isActive = index === currentLineIndex;
            const isPassed = index < currentLineIndex;
            
            return (
              <div
                key={line.id}
                id={`lyric-line-${index}`}
                className={`transition-all duration-300 transform origin-left w-full text-left cursor-pointer
                  ${type === 'plain' ? 'text-sm text-white font-medium' : ''}
                  ${type === 'line-synced' ? (
                    isActive 
                      ? 'text-xl sm:text-2xl font-black text-[#1ed760] scale-[1.02]' 
                      : isPassed 
                        ? 'text-base sm:text-lg font-bold text-white/40' 
                        : 'text-base sm:text-lg font-bold text-white/60 hover:text-white/90'
                  ) : ''}
                `}
                onClick={() => {
                  // Future Phase: clicking a line seeks the audio
                  // PlaybackEngine.getInstance().seek(line.startMs);
                }}
              >
                {line.text}
              </div>
            );
          })}
        </div>

        {/* Manual Scroll Override Indicator */}
        {isManualScroll && type === 'line-synced' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-in fade-in slide-in-from-bottom-4">
            <button 
              onClick={handleSyncToCurrent}
              className="bg-black/80 hover:bg-black backdrop-blur-md border border-white/20 text-white font-bold text-xs px-4 py-2 rounded-full shadow-xl transition-colors"
            >
              Sync to Current Line
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed right-6 top-20 bottom-28 z-[150] w-[400px] glass-panel bg-[#121212]/95 backdrop-blur-3xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col justify-between animate-in fade-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Mic2 className="w-5 h-5 text-[#1ed760]" />
          <h3 className="text-sm font-black text-white">Synced Lyrics</h3>
        </div>
        <button
          onClick={toggleLyrics}
          className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Song Header Details */}
      <div className="flex items-center gap-3 mb-4 p-2 rounded-2xl bg-white/5 border border-white/5">
        <img
          src={currentSong.coverUrl || '/app-icon.png'}
          alt={currentSong.title}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
          className="w-12 h-12 rounded-xl object-cover"
        />
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-white truncate">{currentSong.title}</h4>
          <p className="text-[10px] text-white/60 truncate">{currentSong.artist}</p>
        </div>
      </div>

      {/* Synchronized Lyrics Container */}
      <div className="flex-1 overflow-hidden relative">
        {content()}
      </div>

      {/* Footer Info */}
      <div className="pt-4 mt-2 border-t border-white/10 text-[10px] text-white/40 font-semibold text-center flex items-center justify-center gap-1.5">
        <Music className="w-3 h-3 text-[#1ed760]" /> Powered by local LyricsEngine
      </div>
    </div>
  );
}
