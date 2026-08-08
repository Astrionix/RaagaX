'use client';

import React, { useEffect, useRef } from 'react';
import { X, Mic2, Music } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function LyricsPanel() {
  const { isLyricsOpen, toggleLyrics, currentSong, currentTime, setCurrentTime } = usePlayerStore();
  const activeLineRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTime]);

  if (!isLyricsOpen || !currentSong) return null;

  const lyrics = currentSong.lyrics || [
    { time: 0, text: `[Instrumental intro for ${currentSong.title}]` },
    { time: 15, text: `Soulful lyrics performed by ${currentSong.artist}` },
    { time: 30, text: `Composer: ${currentSong.credits?.composer || 'RaagaX Studios'}` },
    { time: 45, text: `Singers: ${currentSong.credits?.singers.join(', ') || currentSong.artist}` },
    { time: 60, text: `Enjoy spatial lossless audio stream` },
  ];

  // Find index of current lyric line based on time
  const currentLineIndex = lyrics.reduce((acc, line, idx) => {
    if (currentTime >= line.time) return idx;
    return acc;
  }, 0);

  const handleLineClick = (time: number) => {
    setCurrentTime(time);
    const audioEl = document.querySelector('audio');
    if (audioEl) {
      audioEl.currentTime = time;
    }
  };

  return (
    <div className="fixed right-6 top-20 bottom-28 z-40 w-96 glass-panel rounded-3xl p-6 border border-white/90 shadow-2xl flex flex-col justify-between animate-in fade-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/60 pb-3">
        <div className="flex items-center gap-2">
          <Mic2 className="w-5 h-5 text-red-500" />
          <h3 className="text-sm font-extrabold text-slate-900">Synced Lyrics</h3>
        </div>
        <button
          onClick={toggleLyrics}
          className="p-1 rounded-full text-slate-400 hover:text-slate-800 hover:bg-white/80"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Song Header Details */}
      <div className="flex items-center gap-3 my-3 p-2 rounded-2xl bg-white/60">
        <img
          src={currentSong.coverUrl}
          alt={currentSong.title}
          className="w-12 h-12 rounded-xl object-cover"
        />
        <div>
          <h4 className="text-xs font-bold text-slate-900">{currentSong.title}</h4>
          <p className="text-[10px] text-slate-500">{currentSong.artist}</p>
        </div>
      </div>

      {/* Synchronized Lyrics Container */}
      <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2 no-scrollbar">
        {lyrics.map((line, index) => {
          const isActive = index === currentLineIndex;
          return (
            <p
              key={index}
              ref={isActive ? activeLineRef : null}
              onClick={() => handleLineClick(line.time)}
              className={`text-sm font-semibold transition-all duration-300 cursor-pointer ${
                isActive
                  ? 'text-red-600 scale-105 font-bold pl-2 border-l-2 border-red-500'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              {line.text}
            </p>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-white/60 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
        <Music className="w-3 h-3 text-red-500" /> Powered by RaagaX Synchronized LRC Engine
      </div>
    </div>
  );
}
