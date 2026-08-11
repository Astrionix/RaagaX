'use client';

import React, { useRef } from 'react';
import { Play, Pause, MonitorSpeaker, Heart, Tv } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SeekBar } from '@/components/player/SeekBar';

export function MobileMiniPlayer() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    togglePlayerExpanded,
    likedSongIds,
    toggleLikeSong,
    isActiveDevice,
    remoteDeviceName,
    activeRenderer,
  } = usePlayerStore();

  if (!currentSong) return null;

  return (
    <div className={`md:hidden fixed z-40 bg-[#192629] border-t border-black/20 px-2 flex flex-col justify-center select-none active:scale-[0.99] transition-all duration-300 w-[calc(100%-16px)] left-2 rounded-md h-[54px] shadow-lg`} style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
      
      <div className="flex items-center justify-between w-full relative h-full">
      {/* Custom Draggable Progress Bar - Spotify Style */}
      <div className="absolute bottom-0 left-0 w-full h-[2px] z-10 flex items-end rounded-b-md overflow-hidden">
        <SeekBar 
          className="w-full h-full"
          height="h-[2px]"
          thumbSize="w-0 h-0" // Hide thumb completely for pure look
        />
      </div>

      {/* Left: Artwork & Song Info */}
      <div
        onClick={togglePlayerExpanded}
        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer h-full py-1.5"
      >
        <img
          src={currentSong.coverUrl}
          alt={currentSong.title}
          onError={(e) => {
            e.currentTarget.src = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300&h=300";
          }}
          className="w-10 h-10 rounded-[4px] object-cover flex-shrink-0"
        />
        <div className="min-w-0 flex-1 pr-2 flex flex-col justify-center">
          <h4 className={`text-[13px] font-bold truncate leading-tight ${!isActiveDevice ? 'text-[#1ed760]' : 'text-white'}`}>
            {!isActiveDevice && <MonitorSpeaker className="w-3 h-3 inline-block mr-1 align-baseline -mt-0.5" />}
            {activeRenderer === 'video' && isActiveDevice && <Tv className="w-3 h-3 inline-block mr-1 align-baseline -mt-0.5" />}
            {currentSong.title}
          </h4>
          <p className={`text-[11px] truncate leading-tight mt-0.5 ${!isActiveDevice ? 'text-[#1ed760]/80' : 'text-slate-300'}`}>
            {!isActiveDevice ? `Playing on ${remoteDeviceName || 'Remote Device'}` : (activeRenderer === 'video' ? 'Playing video' : currentSong.artist)}
          </p>
        </div>
      </div>

      {/* Right: Touch Play/Pause & Heart */}
      <div className="flex items-center gap-3 flex-shrink-0 pr-2 relative">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleLikeSong(currentSong.id);
          }}
          className="p-1 rounded-full active:scale-95 transition-transform"
        >
          <Heart 
            className={`w-[22px] h-[22px] ${likedSongIds.includes(currentSong.id) ? 'fill-[#1ed760] text-[#1ed760]' : 'text-slate-300'}`} 
            strokeWidth={1.5}
          />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlayPause();
          }}
          className="p-1 text-white active:scale-95 transition-transform"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-white" strokeWidth={0} />
          ) : (
            <Play className="w-6 h-6 fill-white" strokeWidth={0} />
          )}
        </button>
      </div>
    </div>
    </div>
  );
}
