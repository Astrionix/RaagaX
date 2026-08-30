'use client';

import React from 'react';
import { Trash2, Heart, X, ListMusic, Music2, Radio, Plus, Users } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useJamStore } from '@/context/useJamStore';
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
    toggleQueue
  } = usePlayerStore();

  const {
    session: jamSession,
    isInJam,
    toggleJamModal,
    toggleAddToJamModal,
    sendRemoveTrack,
  } = useJamStore();

  const upNextQueue = mounted
    ? isInJam && jamSession
      ? jamSession.queue
      : queue.slice(queueIndex + 1)
    : [];

  const handleClearQueue = () => {
    if (currentSong) {
      reorderQueue([currentSong]);
    } else {
      reorderQueue([]);
    }
  };

  return (
    <aside className="flex-1 flex flex-col text-white text-xs select-none p-4 h-full overflow-hidden">
      {/* Header with Up Next, Autoplay Toggle, Clear and Close */}
      <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/[0.08] flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-1.5 rounded-lg border flex-shrink-0 ${
            isInJam ? 'bg-[#FA233B]/20 text-[#FA233B] border-[#FA233B]/40' : 'bg-[#fa233b]/15 text-[#fa233b] border-[#fa233b]/25'
          }`}>
            {isInJam ? <Radio className="w-4 h-4 animate-pulse" /> : <ListMusic className="w-4 h-4" />}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-black text-sm text-white tracking-tight">
              {isInJam ? 'Jam Queue' : 'Queue'}
            </h3>
            {upNextQueue.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono">
                {upNextQueue.length}
              </span>
            )}
          </div>
          
          {isInJam ? (
            <button
              onClick={() => toggleJamModal(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FA233B]/15 text-[#FA233B] border border-[#FA233B]/30 text-[10px] font-bold hover:bg-[#FA233B]/25 transition-colors cursor-pointer"
            >
              <Users className="w-3 h-3" />
              <span>{Object.keys(jamSession?.participants || {}).length}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 pl-2.5 border-l border-white/10">
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
          )}
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-white/10">
              <OptimizedImage
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="w-full h-full object-cover"
                fallbackSrc="/app-icon.png"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-black text-xs text-white truncate leading-tight">
                {SongFormatter.cleanSongTitle(currentSong.title)}
              </h4>
              <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
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
              <Heart className={`w-3.5 h-3.5 ${likedSongIds.includes(currentSong.id) ? 'fill-[#fa233b] text-[#fa233b]' : 'text-slate-400'}`} />
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
            const queueItemId = item.queueItemId;

            return (
              <div
                key={`${song.id}-${idx}`}
                className="p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 flex items-center justify-between group cursor-pointer transition-all min-w-0 w-full"
              >
                <div
                  onClick={() => playSong(song)}
                  className="flex items-center gap-3 min-w-0 flex-1 pr-2"
                >
                  <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-white/5">
                    <OptimizedImage
                      src={song.coverUrl}
                      alt={song.title}
                      className="w-full h-full object-cover"
                      fallbackSrc="/app-icon.png"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-xs text-white truncate leading-tight group-hover:text-[#fa233b] transition-colors">
                      {SongFormatter.cleanSongTitle(song.title)}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[10px] text-slate-400 truncate leading-tight font-medium">
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
                    <Heart className={`w-3.5 h-3.5 ${likedSongIds.includes(song.id) ? 'fill-[#fa233b] text-[#fa233b]' : 'text-slate-400 hover:text-white'}`} />
                  </button>
                  <span className="text-[10px] font-mono text-slate-500 font-medium">
                    {song.duration ? `${Math.floor(Number(song.duration) / 60)}:${Math.floor(Number(song.duration) % 60).toString().padStart(2, '0')}` : '3:45'}
                  </span>
                  <button
                    onClick={() => {
                      if (isInJam && queueItemId) {
                        sendRemoveTrack(queueItemId);
                      } else {
                        removeFromQueue(song.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 transition-opacity cursor-pointer"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 text-xs font-semibold gap-2">
            <Music2 className="w-8 h-8 text-slate-600/60" />
            <p>Queue is empty</p>
            <p className="text-[10px] text-slate-600 font-normal">Play a track or add songs to queue</p>
          </div>
        )}
      </div>
    </aside>
  );
}
