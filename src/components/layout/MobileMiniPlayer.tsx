'use client';

import React, { useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, MonitorSpeaker, Heart } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SeekBar } from '@/components/player/SeekBar';

export function MobileMiniPlayer() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    playNext,
    playPrev,
    setCurrentTime,
    togglePlayerExpanded,
    toggleDeviceModal,
    likedSongIds,
    toggleLikeSong,
    isActiveDevice,
    remoteDeviceName,
  } = usePlayerStore();

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`md:hidden fixed z-40 bg-[#161618]/95 backdrop-blur-xl border-t border-white/10 px-3 flex flex-col justify-center select-none active:scale-[0.99] transition-all duration-300 w-full left-0 ${!isActiveDevice ? 'h-20 shadow-[0_-5px_20px_rgba(30,215,96,0.15)] border-[#1ed760]/30' : (isPlaying ? 'h-16 shadow-[0_-5px_20px_rgba(239,35,60,0.15)]' : 'h-16')}`} style={{ bottom: 'calc(3.75rem + env(safe-area-inset-bottom))' }}>
      
      {/* Remote Playback Banner integrated */}
      {!isActiveDevice && (
        <div className="w-full flex items-center gap-1.5 justify-center py-1 text-[#1ed760] font-bold text-[10px] uppercase tracking-widest border-b border-white/5 mb-1 animate-pulse">
          <MonitorSpeaker className="w-3 h-3" />
          <span>Playing on {remoteDeviceName || 'Remote Device'}</span>
        </div>
      )}

      <div className="flex items-center justify-between w-full relative">
      {/* Custom Draggable Progress Bar - Spotify Style */}
      <div className="absolute bottom-0 left-0 w-full h-6 z-10 flex items-end translate-y-0">
        <SeekBar 
          className="w-full h-full"
          height="h-[2px]"
          thumbSize="w-3 h-3"
        />
      </div>

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
      <div className="flex items-center gap-0 flex-shrink-0 pr-1 relative">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleLikeSong(currentSong.id);
          }}
          className="p-1 rounded-full hover:bg-white/5 transition-colors hidden sm:block"
        >
          <Heart className={`w-4 h-4 ${likedSongIds.includes(currentSong.id) ? 'fill-[#fa233b] text-[#fa233b]' : 'text-slate-400'}`} />
        </button>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleDeviceModal();
          }}
          className="p-1 rounded-full text-slate-400 hover:text-[#1ed760] transition-colors hidden sm:block"
        >
          <MonitorSpeaker className="w-5 h-5" />
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            playPrev();
          }}
          className="p-1 text-white hover:text-[#fa233b] active:scale-95 transition-transform"
        >
          <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlayPause();
          }}
          className="p-1 mx-1 text-white hover:text-[#fa233b] active:scale-95 transition-transform"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            playNext();
          }}
          className="p-1 text-white hover:text-[#fa233b] active:scale-95 transition-transform"
        >
          <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
        </button>
      </div>
    </div>
    </div>
  );
}
