import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, ListPlus, Heart, Play, Share2, Plus, Music, Download, PauseCircle, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';

export function SongActionMenu({ song }: { song: Song }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { playSong, addToQueue, playNextInQueue, toggleLikeSong, likedSongIds, downloadedSongIds, cloudDownloadedSongIds = [] } = usePlayerStore();
  const { playlists, addSongToPlaylist } = usePlaylistStore();
  const { tasks, pauseDownload, resumeDownload, cancelDownload, saveForOffline, removeDownload, exportSong } = useDownloadStore();

  const task = song ? tasks[song.id] : null;
  const isDownloaded = song ? downloadedSongIds.includes(song.id) : false;
  const isCloudRecorded = song ? cloudDownloadedSongIds.includes(song.id) : false;
  const isLiked = song ? likedSongIds.includes(song.id) : false;

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

  if (!song) return null;

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${song.title} - ${song.artist}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
          setShowPlaylists(false);
        }}
        className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        aria-label="Track actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-2 w-64 bg-[#14151a]/95 border border-white/10 rounded-2xl shadow-2xl p-2 z-50 text-sm backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 divide-y divide-white/5"
        >
          {/* Song Header Preview Banner */}
          <div className="flex items-center gap-3 p-2.5 mb-1 rounded-xl bg-white/5 border border-white/5">
            <img 
              src={song.coverUrl || '/app-icon.png'} 
              alt={song.title} 
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0 shadow-md"
            />
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-white truncate text-xs leading-snug">{song.title}</h4>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
            </div>
          </div>

          {!showPlaylists ? (
            <>
              {/* Play Next */}
              <button 
                onClick={() => handleAction(() => playNextInQueue(song))}
                className="w-full text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                  <Play className="w-4 h-4 ml-0.5" />
                </div>
                <span className="font-medium text-slate-200 group-hover:text-white flex-1 ml-3.5 text-sm">Play Next</span>
              </button>

              {/* Add to Queue */}
              <button 
                onClick={() => handleAction(() => addToQueue(song))}
                className="w-full text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                  <ListPlus className="w-4 h-4" />
                </div>
                <span className="font-medium text-slate-200 group-hover:text-white flex-1 ml-3.5 text-sm">Add to Queue</span>
              </button>

              {/* Add to Playlist */}
              <button 
                onClick={() => setShowPlaylists(true)}
                className="w-full text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center justify-between transition-all group cursor-pointer"
              >
                <div className="flex items-center">
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-slate-200 group-hover:text-white ml-3.5 text-sm">Add to Playlist</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </button>

              {/* Like / Unlike */}
              <button 
                onClick={() => handleAction(() => toggleLikeSong(song.id))}
                className="w-full text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-xl border border-white/5 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isLiked ? 'bg-[#EF233C]/20 border-[#EF233C]/30 text-[#EF233C]' : 'bg-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white'
                }`}>
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#EF233C]' : ''}`} />
                </div>
                <span className="font-medium text-slate-200 group-hover:text-white flex-1 ml-3.5 text-sm">
                  {isLiked ? 'Unlike' : 'Like'}
                </span>
              </button>

              {/* 3-State Download for Offline:
                  1. Download (Cloud ❌, Local ❌)
                  2. Downloaded ✓ (Cloud ✅, Local ✅)
                  3. Download Again ↓ (Cloud ✅, Local ❌)
              */}
              {isDownloaded ? (
                /* State 2: Cloud ✅, Local ✅ */
                <button 
                  onClick={() => handleAction(async () => {
                    await removeDownload(song.id);
                  })}
                  className="w-full text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 ml-3.5">
                    <span className="font-medium text-emerald-400 group-hover:text-emerald-300 block text-sm">Downloaded ✓</span>
                    <span className="text-[10px] text-slate-400 block">Tap to remove from device</span>
                  </div>
                </button>
              ) : task ? (
                task.status === 'downloading' || task.status === 'queued' || task.status === 'verifying' ? (
                  <button 
                    onClick={() => handleAction(() => pauseDownload(song.id))}
                    className="w-full text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0">
                      <PauseCircle className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-amber-400 flex-1 ml-3.5 text-sm">
                      {task.status === 'verifying' ? 'Verifying...' : `Pause (${task.progress}%)`}
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center w-full gap-1 p-1">
                    <button 
                      onClick={() => handleAction(() => resumeDownload(song.id))}
                      className="flex-1 text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center group cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                      <span className="font-medium text-slate-200 group-hover:text-white flex-1 ml-3.5 text-sm">Resume</span>
                    </button>
                    <button 
                      onClick={() => handleAction(() => cancelDownload(song.id))}
                      className="p-2 text-red-400 hover:bg-white/10 rounded-xl cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )
              ) : isCloudRecorded ? (
                /* State 3: Cloud ✅, Local ❌ (After reinstall / new device) */
                <button 
                  onClick={() => handleAction(async () => {
                    await saveForOffline(song);
                  })}
                  className="w-full text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 group-hover:bg-sky-500 group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 ml-3.5">
                    <span className="font-medium text-sky-400 group-hover:text-sky-300 block text-sm">Download Again ↓</span>
                    <span className="text-[10px] text-slate-400 block">Saved in cloud • Download locally</span>
                  </div>
                </button>
              ) : (
                /* State 1: Cloud ❌, Local ❌ */
                <button 
                  onClick={() => handleAction(async () => {
                    await saveForOffline(song);
                  })}
                  className="w-full text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 ml-3.5">
                    <span className="font-medium text-slate-200 group-hover:text-white block text-sm">Save for Offline</span>
                    <span className="text-[10px] text-slate-400 block">App-sandboxed listening</span>
                  </div>
                </button>
              )}

              {/* Export MP3 to Device (Mode B) */}
              <button 
                onClick={() => handleAction(() => {
                  exportSong(song);
                })}
                className="w-full text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 text-sky-400 group-hover:bg-sky-500 group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                  <Download className="w-4 h-4 rotate-[-45deg]" />
                </div>
                <div className="flex-1 min-w-0 ml-3.5">
                  <span className="font-medium text-slate-200 group-hover:text-white block text-sm">Export MP3</span>
                  <span className="text-[10px] text-slate-400 block">Save to Device Music / Downloads</span>
                </div>
              </button>

              {/* Share Track */}
              <button 
                onClick={handleShare}
                className="w-full text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                  <Share2 className="w-4 h-4" />
                </div>
                <span className="font-medium text-slate-200 group-hover:text-white flex-1 ml-3.5 text-sm">
                  {copied ? 'Copied Link!' : 'Share'}
                </span>
              </button>
            </>
          ) : (
            // Playlists Submenu
            <div className="max-h-64 overflow-y-auto no-scrollbar space-y-1 p-1">
              <button 
                onClick={() => setShowPlaylists(false)}
                className="w-full text-left px-3 py-2 text-slate-400 hover:text-white border-b border-white/10 flex items-center gap-2 font-medium mb-1"
              >
                ← Back
              </button>
              
              <button 
                onClick={() => {
                  handleAction(() => {
                    usePlayerStore.getState().setCreatePlaylistModalOpen(true);
                  });
                }}
                className="w-full text-left px-3 py-2.5 text-[#EF233C] hover:bg-white/10 rounded-xl flex items-center gap-3 font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create New Playlist
              </button>

              {playlists.map(pl => (
                <button 
                  key={pl.id}
                  onClick={() => handleAction(() => addSongToPlaylist(pl.id, song))}
                  className="w-full text-left px-3 py-2.5 text-slate-200 hover:bg-white/10 hover:text-white rounded-xl truncate font-medium transition-colors cursor-pointer"
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
