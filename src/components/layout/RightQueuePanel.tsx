'use client';

import React from 'react';
import { Trash2, Heart } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function RightQueuePanel() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const {
    currentSong,
    queue,
    queueIndex,
    playSong,
    removeFromQueue,
    likedSongIds,
    toggleLikeSong,
    isAutoplayEnabled,
    toggleAutoplay,
    reorderQueue
  } = usePlayerStore();

  const upNextQueue = mounted ? queue.slice(queueIndex + 1) : [];

  const handleClearQueue = () => {
    if (currentSong) {
      reorderQueue([currentSong]);
    } else {
      reorderQueue([]);
    }
  };

  return (
    <aside className="flex-1 flex flex-col text-white text-xs select-none p-4 h-full overflow-hidden">
      {/* Header with Up Next and Autoplay Toggle */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-black text-sm text-white tracking-tight">Up Next</h3>
          
          <div className="flex items-center gap-1.5 pl-3 border-l border-white/10">
            <span className="text-[10px] font-bold text-slate-400">Autoplay</span>
            <button
              onClick={() => toggleAutoplay()}
              className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${
                isAutoplayEnabled ? 'bg-[#fa233b]' : 'bg-slate-700'
              }`}
              title="Toggle Autoplay for similar songs"
            >
              <div 
                className={`w-3 h-3 rounded-full bg-white transition-transform ${
                  isAutoplayEnabled ? 'translate-x-3' : 'translate-x-0'
                }`} 
              />
            </button>
          </div>
        </div>

        {upNextQueue.length > 0 && (
          <button 
            onClick={handleClearQueue} 
            className="text-[11px] font-bold text-[#fa233b] hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Currently Playing Card */}
      {mounted && currentSong && (
        <div className="p-3 rounded-2xl bg-[#fa233b]/10 border border-[#fa233b]/30 flex items-center justify-between flex-shrink-0 min-w-0 w-full mb-3 shadow-md">
          <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
            <img
              src={currentSong.coverUrl}
              alt={currentSong.title}
              onError={(e) => {
                e.currentTarget.src = "/app-icon.png";
              }}
              className="w-10 h-10 rounded-xl object-cover shadow-sm flex-shrink-0"
            />
            <div className="min-w-0">
              <h4 className="font-black text-xs text-white truncate leading-tight">{currentSong.title}</h4>
              <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">{currentSong.artist}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button 
              onClick={() => toggleLikeSong(currentSong.id)}
              className="p-1 hover:bg-[#fa233b]/20 rounded-full transition-colors"
            >
              <Heart className={`w-3.5 h-3.5 ${likedSongIds.includes(currentSong.id) ? 'fill-[#fa233b] text-[#fa233b]' : 'text-slate-400'}`} />
            </button>
            <span className="text-[10px] font-mono text-[#fa233b] font-bold px-1.5 py-0.5 rounded bg-[#fa233b]/10">Playing</span>
          </div>
        </div>
      )}

      {/* Up Next Queue List */}
      <div className="space-y-1 overflow-y-auto no-scrollbar flex-1 pr-0.5">
        {upNextQueue.length > 0 ? (
          upNextQueue.map((song, idx) => (
            <div
              key={`${song.id}-${idx}`}
              className="p-2 rounded-xl hover:bg-white/5 flex items-center justify-between group cursor-pointer transition-colors min-w-0 w-full"
            >
              <div
                onClick={() => playSong(song)}
                className="flex items-center gap-3 min-w-0 flex-1 pr-2"
              >
                <img
                  src={song.coverUrl}
                  alt={song.title}
                  onError={(e) => {
                    e.currentTarget.src = "/app-icon.png";
                  }}
                  className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-white truncate leading-tight group-hover:text-[#fa233b] transition-colors">
                    {song.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5 font-medium">{song.artist}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                  onClick={() => toggleLikeSong(song.id)}
                  className={`p-1 transition-colors ${likedSongIds.includes(song.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <Heart className={`w-3.5 h-3.5 ${likedSongIds.includes(song.id) ? 'fill-[#fa233b] text-[#fa233b]' : 'text-slate-400 hover:text-white'}`} />
                </button>
                <span className="text-[10px] font-mono text-slate-500 font-medium">
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
          ))
        ) : (
          <div className="py-12 text-center text-slate-500 text-xs font-semibold">
            Queue is empty
          </div>
        )}
      </div>
    </aside>
  );
}
