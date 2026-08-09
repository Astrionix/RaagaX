'use client';

import React from 'react';
import { X, ListMusic, Trash2, Play, Music } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function QueueModal() {
  const { isQueueOpen, toggleQueue, queue, queueIndex, currentSong, playSong, removeFromQueue, isAutoplayEnabled, toggleAutoplay } = usePlayerStore();

  if (!isQueueOpen) return null;

  return (
    <div className="fixed right-6 top-20 bottom-28 z-40 w-96 glass-panel rounded-3xl p-6 border border-white/90 shadow-2xl flex flex-col justify-between animate-in fade-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/60 pb-3">
        <div className="flex items-center gap-2">
          <ListMusic className="w-5 h-5 text-red-500" />
          <h3 className="text-sm font-extrabold text-slate-900">Play Queue ({queue.length})</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAutoplay}
            className={`px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider font-extrabold transition-all border ${
              isAutoplayEnabled 
                ? 'bg-red-500/10 text-red-600 border-red-200' 
                : 'bg-slate-100 text-slate-400 border-slate-200'
            }`}
          >
            Autoplay {isAutoplayEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={toggleQueue}
            className="p-1 rounded-full text-slate-400 hover:text-slate-800 hover:bg-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Now Playing Highlight */}
      {currentSong && (
        <div className="my-3 p-3 rounded-2xl crimson-gradient text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <img
              src={currentSong.coverUrl}
              alt={currentSong.title}
              className="w-10 h-10 rounded-xl object-cover border border-white/40"
            />
            <div>
              <span className="text-[9px] uppercase tracking-wider font-bold text-white/80">Now Playing</span>
              <h4 className="text-xs font-bold truncate max-w-[170px]">{currentSong.title}</h4>
              <p className="text-[10px] text-white/90 truncate">{currentSong.artist}</p>
            </div>
          </div>
          <Music className="w-5 h-5 text-white animate-pulse" />
        </div>
      )}

      {/* Up Next List */}
      <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1 no-scrollbar">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">Next Up</p>
        {queue.slice(queueIndex + 1).map((song, idx) => (
          <div
            key={`${song.id}-${idx}`}
            className="flex items-center justify-between p-2 rounded-xl bg-white/60 hover:bg-white transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-3" onClick={() => playSong(song)}>
              <img src={song.coverUrl} alt={song.title} className="w-9 h-9 rounded-lg object-cover" />
              <div>
                <h5 className="text-xs font-bold text-slate-900 group-hover:text-red-600 truncate max-w-[160px]">
                  {song.title}
                </h5>
                <p className="text-[10px] text-slate-500 truncate">{song.artist}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => playSong(song)}
                className="p-1 rounded-full text-slate-400 hover:text-red-600"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
              <button
                onClick={() => removeFromQueue(song.id)}
                className="p-1 rounded-full text-slate-400 hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {queue.length <= queueIndex + 1 && (
          <p className="text-xs text-slate-400 text-center py-6">Queue ends here. RaagaX AI will auto-fill next tracks!</p>
        )}
      </div>
    </div>
  );
}
