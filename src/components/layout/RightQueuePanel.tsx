'use client';

import React from 'react';
import { Trash2, Heart, X, ListMusic, Music2 } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { SongFormatter } from '@/lib/music/SongFormatter';

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
    reorderQueue,
    toggleQueue,
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
    <aside className="flex-1 flex flex-col text-[var(--text-primary)] text-xs select-none p-4 h-full overflow-hidden">
      {/* Header with Up Next, Autoplay Toggle, Clear and Close */}
      <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-[var(--border-subtle)] flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg border flex-shrink-0 bg-[#fa233b]/15 text-[#fa233b] border-[#fa233b]/25">
            <ListMusic className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-black text-sm text-[var(--text-primary)] tracking-tight">Queue</h3>
            {upNextQueue.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-primary)] text-[var(--text-secondary)] font-mono border border-[var(--border-subtle)]">
                {upNextQueue.length}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 pl-2.5 border-l border-[var(--border-subtle)]">
            <span className="text-[10px] font-bold text-[var(--text-muted)]">Autoplay</span>
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

        <div className="flex items-center gap-2 flex-shrink-0">
          {upNextQueue.length > 0 && (
            <button 
              onClick={handleClearQueue} 
              className="text-[11px] font-bold text-[#fa233b] hover:underline px-1.5 py-0.5 rounded cursor-pointer transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={toggleQueue}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            title="Close Queue Panel"
            aria-label="Close Queue Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Currently Playing Card */}
      {mounted && currentSong && (
        <div className="p-3 rounded-2xl bg-gradient-to-r from-[#fa233b]/15 to-[#fa233b]/5 border border-[#fa233b]/30 flex items-center justify-between flex-shrink-0 min-w-0 w-full mb-3 shadow-md shadow-red-500/5">
          <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-white/10 bg-black/40 flex items-center justify-center">
              <OptimizedImage
                src={currentSong.coverUrl}
                alt={currentSong.title}
                imageFit="contain"
                className="w-full h-full object-contain"
                fallbackSrc="/app-icon.png"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-black text-xs text-[var(--text-primary)] truncate leading-tight">
                {SongFormatter.cleanSongTitle(currentSong.title)}
              </h4>
              <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5 font-medium">
                {SongFormatter.decodeHtml(currentSong.artist) || currentSong.artist || 'Unknown Artist'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button 
              onClick={() => toggleLikeSong(currentSong.id)}
              className="p-1.5 hover:bg-[#fa233b]/20 rounded-full transition-colors cursor-pointer"
              title={likedSongIds.includes(currentSong.id) ? 'Unlike' : 'Like'}
            >
              <Heart className={`w-3.5 h-3.5 ${likedSongIds.includes(currentSong.id) ? 'fill-[#fa233b] text-[#fa233b]' : 'text-[var(--text-muted)]'}`} />
            </button>
            <span className="text-[9px] font-mono text-[#fa233b] font-extrabold px-1.5 py-0.5 rounded-full bg-[#fa233b]/15 border border-[#fa233b]/25">
              Playing
            </span>
          </div>
        </div>
      )}

      {/* Up Next Queue List */}
      <div className="space-y-1 overflow-y-auto no-scrollbar flex-1 pr-0.5">
        {upNextQueue.length > 0 ? (
          upNextQueue.map((item: any, idx) => {
            const song = item.song || item;
            const addedByName = item.addedByName;

            return (
              <div
                key={`${song.id}-${idx}`}
                className="p-2 rounded-xl hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--border-subtle)] flex items-center justify-between group cursor-pointer transition-all min-w-0 w-full"
              >
                <div
                  onClick={() => playSong(song)}
                  className="flex items-center gap-3 min-w-0 flex-1 pr-2"
                >
                  <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-[var(--border-subtle)] bg-black/40 flex items-center justify-center">
                    <OptimizedImage
                      src={song.coverUrl}
                      alt={song.title}
                      imageFit="contain"
                      className="w-full h-full object-contain"
                      fallbackSrc="/app-icon.png"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-xs text-[var(--text-primary)] truncate leading-tight group-hover:text-[#fa233b] transition-colors">
                      {SongFormatter.cleanSongTitle(song.title)}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[10px] text-[var(--text-secondary)] truncate leading-tight font-medium">
                        {SongFormatter.decodeHtml(song.artist) || song.artist || 'Unknown Artist'}
                      </p>
                      {addedByName && (
                        <span className="text-[8px] px-1 py-0.1 rounded-full bg-[#FA233B]/10 text-[#FA233B] border border-[#FA233B]/20">
                          {addedByName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button 
                    onClick={() => toggleLikeSong(song.id)}
                    className={`p-1 transition-colors cursor-pointer ${likedSongIds.includes(song.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    title={likedSongIds.includes(song.id) ? 'Unlike' : 'Like'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${likedSongIds.includes(song.id) ? 'fill-[#fa233b] text-[#fa233b]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`} />
                  </button>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] font-medium">
                    {song.duration ? `${Math.floor(Number(song.duration) / 60)}:${Math.floor(Number(song.duration) % 60).toString().padStart(2, '0')}` : '3:45'}
                  </span>
                  <button
                    onClick={() => removeFromQueue(song.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-red-400 transition-opacity cursor-pointer"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center text-[var(--text-muted)] text-xs font-semibold gap-2">
            <Music2 className="w-8 h-8 opacity-60" />
            <p>Queue is empty</p>
            <p className="text-[10px] opacity-70 font-normal">Play a track or add songs to queue</p>
          </div>
        )}
      </div>
    </aside>
  );
}
