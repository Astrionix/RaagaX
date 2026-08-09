'use client';

import React from 'react';
import { Play, Pause, SkipForward, MonitorSpeaker, Heart } from 'lucide-react';
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
    toggleDeviceModal,
    likedSongIds,
    toggleLikeSong,
  } = usePlayerStore();

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`md:hidden fixed z-40 h-14 rounded-2xl glass-card p-2 flex items-center justify-between select-none overflow-hidden active:scale-[0.99] transition-all duration-300 w-[calc(100%-24px)] left-3 ${isPlaying ? 'shadow-[0_0_20px_rgba(239,35,60,0.15)] border-[#fa233b]/30' : ''}`} style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 12px)' }}>
      {/* Subtle Progress Bar line */}
      <div
        className="absolute bottom-0 left-0 h-1 bg-[#fa233b] transition-all duration-300 opacity-90 rounded-b-2xl"
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
          onError={(e) => {
            e.currentTarget.src = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300&h=300";
          }}
          className="w-10 h-10 rounded-lg object-cover shadow-sm flex-shrink-0"
        />
        <div className="min-w-0 flex-1 pr-2">
          <h4 className="text-xs font-bold text-white truncate leading-snug">{currentSong.title}</h4>
          <p className="text-[11px] text-slate-400 truncate leading-snug mt-0.5">{currentSong.artist}</p>
        </div>
      </div>

      {/* Right: Touch Play/Pause & Skip */}
      <div className="flex items-center gap-1 flex-shrink-0 pr-1 relative">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleLikeSong(currentSong.id);
          }}
          className="p-2 rounded-full hover:bg-white/5 transition-colors"
        >
          <Heart className={`w-4 h-4 ${likedSongIds.includes(currentSong.id) ? 'fill-[#fa233b] text-[#fa233b]' : 'text-slate-400'}`} />
        </button>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleDeviceModal();
          }}
          className="p-2 rounded-full text-slate-400 hover:text-[#1ed760] transition-colors"
        >
          <MonitorSpeaker className="w-5 h-5" />
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlayPause();
          }}
          className="p-2 text-white hover:text-[#fa233b] active:scale-95 transition-transform"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
        </button>

        <button
          onClick={playNext}
          className="p-2 text-white hover:text-[#fa233b] active:scale-95 transition-transform"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>
      </div>
    </div>
  );
}
