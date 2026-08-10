import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, ListPlus, Heart, Play, Share2, Plus, Music, Download, PauseCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';

export function SongActionMenu({ song }: { song: Song }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { playSong, addToQueue, toggleLikeSong, likedSongIds, downloadedSongIds } = usePlayerStore();
  const { playlists, addSongToPlaylist } = usePlaylistStore();

  if (!song) return null;

  const isLiked = likedSongIds.includes(song.id);
  const { tasks, pauseDownload, resumeDownload, cancelDownload } = require('@/context/useDownloadStore').useDownloadStore();
  const task = tasks[song.id];
  const isDownloaded = downloadedSongIds.includes(song.id);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowPlaylists(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
          setShowPlaylists(false);
        }}
        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-[#1E1E22] border border-white/10 rounded-xl shadow-2xl py-1 z-50 text-xs">
          
          {!showPlaylists ? (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); handleAction(() => playSong(song, [song])); }}
                className="w-full text-left px-3 py-2 text-slate-200 hover:bg-white/5 hover:text-white flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5" /> Play
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); handleAction(() => addToQueue(song)); }}
                className="w-full text-left px-3 py-2 text-slate-200 hover:bg-white/5 hover:text-white flex items-center gap-2"
              >
                <ListPlus className="w-3.5 h-3.5" /> Add to Queue
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); setShowPlaylists(true); }}
                className="w-full text-left px-3 py-2 text-slate-200 hover:bg-white/5 hover:text-white flex items-center gap-2 justify-between"
              >
                <div className="flex items-center gap-2"><Music className="w-3.5 h-3.5" /> Add to Playlist</div>
                <span>→</span>
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); handleAction(() => toggleLikeSong(song.id)); }}
                className="w-full text-left px-3 py-2 text-slate-200 hover:bg-white/5 hover:text-white flex items-center gap-2"
              >
                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'text-[#fa233b] fill-[#fa233b]' : ''}`} /> 
                {isLiked ? 'Unlike' : 'Like'}
              </button>

              <div className="h-px bg-white/10 my-1 mx-2" />

              {isDownloaded ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleAction(() => usePlayerStore.getState().toggleDownloadSong(song.id)); }}
                  className="w-full text-left px-3 py-2 text-emerald-400 hover:bg-white/5 hover:text-emerald-300 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Downloaded (Remove)
                </button>
              ) : task ? (
                task.status === 'downloading' || task.status === 'queued' ? (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleAction(() => pauseDownload(song.id)); }}
                    className="w-full text-left px-3 py-2 text-amber-400 hover:bg-white/5 flex items-center gap-2"
                  >
                    <PauseCircle className="w-3.5 h-3.5" /> Pause ({task.progress}%)
                  </button>
                ) : (
                  <div className="flex items-center w-full">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAction(() => resumeDownload(song.id)); }}
                      className="flex-1 text-left px-3 py-2 text-slate-200 hover:bg-white/5 flex items-center gap-2"
                    >
                      <Play className="w-3.5 h-3.5" /> Resume
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAction(() => cancelDownload(song.id)); }}
                      className="px-3 py-2 text-red-400 hover:bg-white/5 hover:text-red-300"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              ) : (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleAction(() => usePlayerStore.getState().toggleDownloadSong(song.id)); }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-white/5 hover:text-white flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              )}
            </>
          ) : (
            // Playlists Submenu
            <div className="max-h-60 overflow-y-auto no-scrollbar">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPlaylists(false);
                }}
                className="w-full text-left px-3 py-2 text-slate-400 hover:text-white border-b border-white/5 flex items-center gap-2"
              >
                ← Back
              </button>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction(() => {
                    usePlayerStore.getState().setCreatePlaylistModalOpen(true);
                  });
                }}
                className="w-full text-left px-3 py-2 text-[#fa233b] hover:bg-white/5 flex items-center gap-2 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> New Playlist
              </button>

              {playlists.map(pl => (
                <button 
                  key={pl.id}
                  onClick={(e) => { e.stopPropagation(); handleAction(() => addSongToPlaylist(pl.id, song)); }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-white/5 hover:text-white truncate"
                >
                  {pl.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
