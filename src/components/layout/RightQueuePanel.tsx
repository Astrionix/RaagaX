'use client';

import React from 'react';
import { Trash2, Heart } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function RightQueuePanel() {
  const [autoplay, setAutoplay] = React.useState(true);

  const {
    currentSong,
    queue,
    queueIndex,
    playSong,
    removeFromQueue,
    likedSongIds,
    toggleLikeSong,
  } = usePlayerStore();

  const upNextQueue = queue.slice(queueIndex + 1);

  return (
    <aside className="flex-1 flex flex-col justify-between text-white text-xs select-none p-4 h-full">
      <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-black text-sm text-white">Up Next</h3>
          <button className="text-[11px] font-bold text-[#EF233C] hover:underline">
            Clear
          </button>
        </div>

        {/* Currently Playing */}
        {currentSong && (
          <div className="p-3 rounded-2xl bg-[#EF233C]/10 border border-[#EF233C]/30 flex items-center justify-between flex-shrink-0 min-w-0 w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
              <img
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="w-10 h-10 rounded-xl object-cover shadow-sm flex-shrink-0"
              />
              <div className="min-w-0">
                <h4 className="font-black text-xs text-white truncate leading-tight">{currentSong.title}</h4>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{currentSong.artist}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button 
                onClick={() => toggleLikeSong(currentSong.id)}
                className="p-1 hover:bg-[#EF233C]/20 rounded-full transition-colors"
              >
                <Heart className={`w-3.5 h-3.5 ${likedSongIds.includes(currentSong.id) ? 'fill-[#EF233C] text-[#EF233C]' : 'text-slate-400'}`} />
              </button>
              <span className="text-[10px] font-mono text-[#EF233C] font-bold">Playing</span>
            </div>
          </div>
        )}

        {/* Queue List */}
        <div className="space-y-1.5 overflow-y-auto no-scrollbar pr-1 flex-1">
          {upNextQueue.map((song, idx) => (
            <div
              key={`${song.id}-${idx}`}
              className="p-2 rounded-xl hover:bg-[#26262A] flex items-center justify-between group cursor-pointer transition-colors min-w-0 w-full"
            >
              <div
                onClick={() => playSong(song)}
                className="flex items-center gap-3 min-w-0 flex-1 pr-2"
              >
                <img
                  src={song.coverUrl}
                  alt={song.title}
                  className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-white truncate leading-tight group-hover:text-[#EF233C]">
                    {song.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">{song.artist}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                  onClick={() => toggleLikeSong(song.id)}
                  className={`p-1 transition-colors ${likedSongIds.includes(song.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <Heart className={`w-3.5 h-3.5 ${likedSongIds.includes(song.id) ? 'fill-[#EF233C] text-[#EF233C]' : 'text-slate-400 hover:text-white'}`} />
                </button>
                <span className="text-[10px] font-mono text-slate-500">
                  {song.duration ? `${Math.floor(Number(song.duration) / 60)}:${Math.floor(Number(song.duration) % 60).toString().padStart(2, '0')}` : '3:45'}
                </span>
                <button
                  onClick={() => removeFromQueue(song.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Autoplay Toggle */}
      <div className="pt-3 border-t border-white/10 flex items-center justify-between flex-shrink-0">
        <div>
          <h4 className="font-bold text-xs text-white">Autoplay</h4>
          <p className="text-[9px] text-slate-400">Similar music will continue.</p>
        </div>
        <button
          onClick={() => setAutoplay(!autoplay)}
          className={`w-9 h-5 rounded-full p-0.5 transition-colors ${autoplay ? 'bg-[#EF233C]' : 'bg-slate-700'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoplay ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>
    </aside>
  );
}
