'use client';

import React from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function MobileMiniPlayer() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    playNext,
    togglePlayerExpanded,
  } = usePlayerStore();

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="md:hidden fixed bottom-[68px] left-3 right-3 z-40 h-14 rounded-2xl bg-[#1C1C1E]/90 backdrop-blur-xl border border-white/10 shadow-2xl p-2 flex items-center justify-between select-none overflow-hidden active:scale-[0.99] transition-transform">
      {/* Subtle Progress Bar line */}
      <div
        className="absolute top-0 left-0 h-0.5 bg-[#EF233C] transition-all duration-300 opacity-80"
        style={{ width: `${progressPercent}%` }}
      />

      {/* Left: Artwork & Song Info */}
      <div
        onClick={togglePlayerExpanded}
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
      >
        <img
          src={currentSong.coverUrl}
          alt={currentSong.title}
          className="w-10 h-10 rounded-lg object-cover shadow-sm flex-shrink-0"
        />
        <div className="min-w-0 flex-1 pr-2">
          <h4 className="text-xs font-bold text-white truncate leading-snug">{currentSong.title}</h4>
          <p className="text-[11px] text-slate-400 truncate leading-snug mt-0.5">{currentSong.artist}</p>
        </div>
      </div>

      {/* Right: Touch Play/Pause & Skip */}
      <div className="flex items-center gap-1 flex-shrink-0 pr-1">
        <button
          onClick={togglePlayPause}
          className="p-2 text-white hover:text-[#EF233C] active:scale-95 transition-transform"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
        </button>

        <button
          onClick={playNext}
          className="p-2 text-white hover:text-[#EF233C] active:scale-95 transition-transform"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>
      </div>
    </div>
  );
}
