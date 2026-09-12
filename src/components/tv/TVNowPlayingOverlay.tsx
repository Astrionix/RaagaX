'use client';

import React, { useEffect, useState, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Heart, 
  Repeat, Shuffle, Music, Mic2, X, Tv
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useLyricsStore } from '@/context/useLyricsStore';

export function TVNowPlayingOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { 
    currentSong, isPlaying, togglePlayPause, playNext, playPrev, 
    toggleLikeSong, likedSongIds, shuffleMode, toggleShuffle, repeatMode, cycleRepeatMode,
    currentTime, duration, seek
  } = usePlayerStore();

  const { lines, status: lyricsStatus } = useLyricsStore();

  const [activeLyricIndex, setActiveLyricIndex] = useState<number>(0);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const isShuffleActive = shuffleMode !== 'OFF';

  // Sync active lyric line with currentTime
  useEffect(() => {
    if (!lines || lines.length === 0) return;
    const currentTimeMs = currentTime * 1000;
    const index = lines.findIndex((l, i) => {
      const next = lines[i + 1];
      return currentTimeMs >= l.startMs && (!next || currentTimeMs < next.startMs);
    });
    if (index !== -1 && index !== activeLyricIndex) {
      setActiveLyricIndex(index);
      const lyricEl = document.getElementById(`tv-lyric-line-${index}`);
      if (lyricEl) {
        lyricEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTime, lines, activeLyricIndex]);

  if (!isOpen || !currentSong) return null;

  const isLiked = likedSongIds.includes(currentSong.id);
  const coverUrl = currentSong.coverUrl || '/default-playlist-cover.png';
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-[10010] bg-black flex flex-col justify-between p-8 sm:p-12 overflow-hidden select-none animate-in fade-in duration-300">
      {/* 1. APPLE TV DYNAMIC AMBIENT BACKDROP LIGHTING */}
      <div 
        className="absolute inset-0 pointer-events-none scale-125 blur-3xl opacity-50 transition-all duration-1000"
        style={{
          backgroundImage: `url(${coverUrl})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60 backdrop-blur-3xl" />

      {/* 2. HEADER BAR */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-2xl px-5 py-2.5 rounded-full border border-white/15 shadow-xl">
          <Tv className="w-5 h-5 text-[#fa233b] animate-pulse" />
          <span className="text-xs font-black tracking-wider uppercase text-white/90">RaagaX Apple TV Experience</span>
        </div>

        <button
          data-tv-focusable="true"
          onClick={onClose}
          className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-2xl rounded-full border border-white/15 text-white transition-all cursor-pointer"
          aria-label="Close TV Player"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* 3. MAIN CONTENT SPLIT VIEW (ARTWORK + LIVE LYRICS / METADATA) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 my-auto items-center">
        {/* LEFT COLUMN: 4K ARTWORK DISPLAY */}
        <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
          <div className="relative group">
            <div 
              className={`w-72 h-72 sm:w-96 sm:h-96 rounded-3xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.8)] border border-white/20 transition-all duration-500 ${
                isPlaying ? 'scale-105 shadow-[0_40px_100px_rgba(250,35,59,0.3)]' : 'scale-95 opacity-90'
              }`}
            >
              <img 
                src={coverUrl} 
                alt={currentSong.title} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).setAttribute('src', '/default-playlist-cover.png');
                }}
              />
            </div>
            {/* Pulsing Aura Ring */}
            {isPlaying && (
              <div className="absolute -inset-4 rounded-3xl bg-[#fa233b]/20 blur-2xl -z-10 animate-pulse" />
            )}
          </div>

          <div className="max-w-md">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight line-clamp-1">
              {currentSong.title}
            </h1>
            <p className="text-lg sm:text-xl font-medium text-white/70 mt-2 line-clamp-1">
              {currentSong.artist}
            </p>
            {currentSong.album && (
              <p className="text-xs font-semibold uppercase tracking-widest text-[#fa233b] mt-3">
                {currentSong.album}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SYNCHRONIZED SCROLLING LYRICS */}
        <div className="lg:col-span-7 h-[360px] sm:h-[440px] flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Mic2 className="w-5 h-5 text-[#fa233b]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/90">Live Synced Lyrics</h3>
            </div>
            {lyricsStatus === 'loading' && <span className="text-xs text-white/50 animate-pulse">Syncing lyrics...</span>}
          </div>

          <div 
            ref={lyricsContainerRef}
            className="flex-1 overflow-y-auto space-y-6 pr-4 tv-scroll-hide scroll-smooth"
          >
            {lines && lines.length > 0 ? (
              lines.map((line, idx) => {
                const isActive = idx === activeLyricIndex;
                const displayText = line.romanizedText || line.nativeText || line.text;
                return (
                  <p
                    id={`tv-lyric-line-${idx}`}
                    key={idx}
                    onClick={() => seek(line.startMs / 1000)}
                    className={`text-2xl sm:text-3xl font-extrabold transition-all duration-300 cursor-pointer ${
                      isActive 
                        ? 'text-white scale-105 opacity-100 drop-shadow-[0_10px_20px_rgba(255,255,255,0.4)]' 
                        : 'text-white/30 hover:text-white/60 scale-95'
                    }`}
                  >
                    {displayText}
                  </p>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-white/40 space-y-3">
                <Music className="w-12 h-12 stroke-1" />
                <p className="text-lg font-semibold">Instrumental or Lyrics Unavailable</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. APPLE TV REMOTE CONTROL BAR */}
      <div className="relative z-10 bg-white/10 backdrop-blur-3xl rounded-3xl p-6 border border-white/15 shadow-2xl space-y-4">
        {/* PROGRESS BAR */}
        <div className="space-y-1.5">
          <div className="relative h-2 w-full bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#fa233b] to-red-400 rounded-full transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs font-mono font-medium text-white/60">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* BUTTON CONTROLS */}
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          <button
            data-tv-focusable="true"
            onClick={toggleShuffle}
            className={`p-4 rounded-2xl transition-all cursor-pointer ${
              isShuffleActive ? 'bg-[#fa233b] text-white shadow-lg shadow-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white/70'
            }`}
            aria-label="Shuffle"
          >
            <Shuffle className="w-6 h-6" />
          </button>

          <button
            data-tv-focusable="true"
            onClick={() => playPrev()}
            className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all cursor-pointer"
            aria-label="Previous Track"
          >
            <SkipBack className="w-7 h-7" />
          </button>

          <button
            data-tv-focusable="true"
            onClick={togglePlayPause}
            className="p-6 bg-[#fa233b] hover:bg-[#d91e32] rounded-3xl text-white shadow-2xl shadow-red-500/40 transition-all scale-110 cursor-pointer"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-9 h-9 fill-current" /> : <Play className="w-9 h-9 fill-current ml-1" />}
          </button>

          <button
            data-tv-focusable="true"
            onClick={() => playNext()}
            className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all cursor-pointer"
            aria-label="Next Track"
          >
            <SkipForward className="w-7 h-7" />
          </button>

          <button
            data-tv-focusable="true"
            onClick={() => toggleLikeSong(currentSong.id)}
            className={`p-4 rounded-2xl transition-all cursor-pointer ${
              isLiked ? 'bg-[#fa233b] text-white shadow-lg shadow-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white/70'
            }`}
            aria-label="Like Song"
          >
            <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
