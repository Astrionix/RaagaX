'use client';

import React from 'react';
import { Play, Pause, SkipForward, Heart, MonitorSpeaker } from 'lucide-react';
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
    togglePlayerExpanded,
    likedSongIds,
    toggleLikeSong,
    isActiveDevice,
    remoteDeviceName,
  } = usePlayerStore();

  if (!currentSong) return null;

  const isLiked = likedSongIds.includes(currentSong.id);

  return (
    <div
      className="md:hidden fixed z-40 bg-[#12141C]/95 backdrop-blur-xl border border-white/10 px-3 flex flex-col justify-center select-none active:scale-[0.99] transition-all duration-200 w-[calc(100%-16px)] left-2 rounded-xl h-[56px] shadow-2xl shadow-black/80"
      style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom))' }}
    >
      {/* Live Mini Scrubber Line */}
      <div className="absolute top-0 left-0 w-full h-[2.5px] z-10 flex items-start rounded-t-xl overflow-hidden pointer-events-none">
        <SeekBar
          className="w-full h-full"
          height="h-[2.5px]"
          thumbSize="w-0 h-0"
        />
      </div>

      <div className="flex items-center justify-between w-full relative h-full">
        {/* Left: Artwork & Song Info */}
        <div
          onClick={togglePlayerExpanded}
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer h-full py-1"
        >
          <img
            src={
              currentSong.coverUrl
                ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
                : '/app-icon.png'
            }
            alt={currentSong.title}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
            }}
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-slate-800 shadow-md"
          />
          <div className="min-w-0 flex-1 pr-2 flex flex-col justify-center">
            <h4
              className={`text-[13px] font-bold truncate leading-tight ${
                !isActiveDevice ? 'text-[#F51B3D]' : 'text-white'
              }`}
            >
              {!isActiveDevice && (
                <MonitorSpeaker className="w-3 h-3 inline-block mr-1 align-baseline -mt-0.5" />
              )}
              {currentSong.title}
            </h4>
            <p
              className={`text-[11px] truncate leading-tight mt-0.5 ${
                !isActiveDevice ? 'text-[#F51B3D]/80' : 'text-[#8E92A4]'
              }`}
            >
              {!isActiveDevice
                ? `Playing on ${remoteDeviceName || 'Remote Device'}`
                : currentSong.artist}
            </p>
          </div>
        </div>

        {/* Right: Touch Controls (Like, Play/Pause, Next) */}
        <div className="flex items-center gap-2 flex-shrink-0 relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleLikeSong(currentSong.id);
            }}
            aria-label="Like track"
            className="p-2 text-slate-400 hover:text-white active:scale-90 transition-transform"
          >
            <Heart
              className={`w-5 h-5 ${
                isLiked ? 'fill-[#F51B3D] text-[#F51B3D]' : 'text-[#8E92A4]'
              }`}
              strokeWidth={2}
            />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center active:scale-90 transition-transform shadow-md"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-black text-black" />
            ) : (
              <Play className="w-4 h-4 fill-black text-black ml-0.5" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              playNext();
            }}
            aria-label="Next track"
            className="p-2 text-slate-400 hover:text-white active:scale-90 transition-transform"
          >
            <SkipForward className="w-5 h-5 text-[#8E92A4]" />
          </button>
        </div>
      </div>
    </div>
  );
}
