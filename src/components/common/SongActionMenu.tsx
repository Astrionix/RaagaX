import React, { useState, useRef, useEffect } from 'react';
import { 
  MoreVertical, ListPlus, Heart, Play, Share2, Plus, Music, Download, 
  PauseCircle, CheckCircle2, XCircle, ChevronRight, Info, Trash2, FileAudio 
} from 'lucide-react';
import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { SongDetailsModal } from '@/components/modals/SongDetailsModal';

export function SongActionMenu({ song }: { song: Song }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const { playSong, addToQueue, playNextInQueue, toggleLikeSong, likedSongIds, downloadedSongIds, cloudDownloadedSongIds = [], setToastMessage } = usePlayerStore();
  const { playlists, addSongToPlaylist } = usePlaylistStore();
  const { tasks, pauseDownload, resumeDownload, cancelDownload, saveForOffline, removeDownload, shareSongFile } = useDownloadStore();

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

  const handleShare = async () => {
    if (isDownloaded) {
      const shared = await shareSongFile(song.id);
      if (shared) {
        setIsOpen(false);
        return;
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: song.title,
          text: `Listen to "${song.title}" by ${song.artist} on RaagaX!`,
          url: window.location.href,
        });
        setIsOpen(false);
        return;
      } catch {}
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${song.title} - ${song.artist}`);
      setCopied(true);
      setToastMessage('Song name copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
      setIsOpen(false);
    }
  };

  return (
    <>
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
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0 shadow-md bg-slate-800"
              />
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-white truncate text-xs leading-snug">{song.title}</h4>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
              </div>
            </div>

            {!showPlaylists ? (
              <div className="space-y-0.5 pt-1">
                {/* Play Next */}
                <button 
                  onClick={() => handleAction(() => playNextInQueue(song))}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  </div>
                  <span className="font-medium text-slate-200 group-hover:text-white flex-1 ml-3 text-xs">Play Next</span>
                </button>

                {/* Add to Queue */}
                <button 
                  onClick={() => handleAction(() => addToQueue(song))}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <ListPlus className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-slate-200 group-hover:text-white flex-1 ml-3 text-xs">Add to Queue</span>
                </button>

                {/* Add to Playlist */}
                <button 
                  onClick={() => setShowPlaylists(true)}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center justify-between transition-all group cursor-pointer"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium text-slate-200 group-hover:text-white ml-3 text-xs">Add to Playlist</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                </button>

                {/* Like / Unlike */}
                <button 
                  onClick={() => handleAction(() => toggleLikeSong(song.id))}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className={`w-8 h-8 rounded-lg border border-white/5 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isLiked ? 'bg-[#EF233C]/20 border-[#EF233C]/30 text-[#EF233C]' : 'bg-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white'
                  }`}>
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-[#EF233C]' : ''}`} />
                  </div>
                  <span className="font-medium text-slate-200 group-hover:text-white flex-1 ml-3 text-xs">
                    {isLiked ? 'Unlike' : 'Like'}
                  </span>
                </button>

                {/* Download State Handler */}
                {isDownloaded ? (
                  /* Downloaded ✓ State */
                  <div className="space-y-0.5">
                    <button 
                      onClick={() => handleAction(() => {
                        setShowDetailsModal(true);
                      })}
                      className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 ml-3">
                        <span className="font-bold text-emerald-400 group-hover:text-emerald-300 block text-xs">Downloaded ✓</span>
                        <span className="text-[10px] text-slate-400 block font-mono">Music/RaagaX • MP3</span>
                      </div>
                    </button>

                    {/* Remove Download (Requirement #14: Deletes physical MP3, keeps in playlist) */}
                    <button
                      onClick={() => handleAction(async () => {
                        await removeDownload(song.id);
                        setToastMessage(`Removed "${song.title}" from local storage`);
                      })}
                      className="w-full text-left px-2.5 py-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl flex items-center transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 group-hover:border-red-500/30 group-hover:bg-red-500/20 group-hover:text-red-400 flex items-center justify-center flex-shrink-0 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 ml-3">
                        <span className="font-medium block text-xs">Remove Download</span>
                        <span className="text-[10px] text-slate-500 block">Deletes local MP3 (keeps in playlist)</span>
                      </div>
                    </button>
                  </div>
                ) : task ? (
                  task.status === 'DOWNLOADING' || task.status === 'QUEUED' || task.status === 'VERIFYING' ? (
                    <button 
                      onClick={() => handleAction(() => pauseDownload(song.id))}
                      className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0">
                        <PauseCircle className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 ml-3">
                        <span className="font-bold text-amber-400 flex-1 block text-xs">
                          {task.status === 'VERIFYING' ? 'Verifying tags...' : `Downloading... ${task.progress}%`}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">Tap to pause</span>
                      </div>
                    </button>
                  ) : (
                    <div className="flex items-center w-full gap-1 p-1">
                      <button 
                        onClick={() => handleAction(() => resumeDownload(song.id))}
                        className="flex-1 text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center group cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0">
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </div>
                        <span className="font-medium text-slate-200 group-hover:text-white flex-1 ml-3 text-xs">Resume Download</span>
                      </button>
                      <button 
                        onClick={() => handleAction(() => cancelDownload(song.id))}
                        className="p-2 text-red-400 hover:bg-white/10 rounded-xl cursor-pointer"
                        title="Cancel"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )
                ) : isCloudRecorded ? (
                  /* Download Again */
                  <button 
                    onClick={() => handleAction(async () => {
                      await saveForOffline(song);
                    })}
                    className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 group-hover:bg-sky-500 group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 ml-3">
                      <span className="font-medium text-sky-400 group-hover:text-sky-300 block text-xs">Download Again ↓</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Music/RaagaX</span>
                    </div>
                  </button>
                ) : (
                  /* Download Action (Requirement #3) */
                  <button 
                    onClick={() => handleAction(async () => {
                      await saveForOffline(song);
                    })}
                    className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 ml-3">
                      <span className="font-medium text-slate-200 group-hover:text-white block text-xs">Download</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Save to Music/RaagaX</span>
                    </div>
                  </button>
                )}

                {/* View Details (Requirement #14) */}
                <button 
                  onClick={() => handleAction(() => setShowDetailsModal(true))}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-slate-300 group-hover:text-white flex-1 ml-3 text-xs">View Details</span>
                </button>

                {/* Share Track (Requirement #14) */}
                <button 
                  onClick={handleShare}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <Share2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-slate-200 group-hover:text-white flex-1 ml-3 text-xs">
                    {copied ? 'Copied Link!' : isDownloaded ? 'Share MP3 File' : 'Share'}
                  </span>
                </button>
              </div>
            ) : (
              // Playlists Submenu
              <div className="max-h-64 overflow-y-auto no-scrollbar space-y-1 p-1">
                <button 
                  onClick={() => setShowPlaylists(false)}
                  className="w-full text-left px-3 py-2 text-slate-400 hover:text-white border-b border-white/10 flex items-center gap-2 font-medium mb-1 text-xs"
                >
                  ← Back
                </button>
                
                <button 
                  onClick={() => {
                    handleAction(() => {
                      usePlayerStore.getState().setCreatePlaylistModalOpen(true);
                    });
                  }}
                  className="w-full text-left px-3 py-2.5 text-[#EF233C] hover:bg-white/10 rounded-xl flex items-center gap-3 font-bold transition-colors cursor-pointer text-xs"
                >
                  <Plus className="w-4 h-4" /> Create New Playlist
                </button>

                {playlists.map(pl => (
                  <button 
                    key={pl.id}
                    onClick={() => handleAction(() => {
                      addSongToPlaylist(pl.id, song);
                      setToastMessage(`Added to "${pl.title}"`);
                    })}
                    className="w-full text-left px-3 py-2 text-slate-200 hover:bg-white/10 hover:text-white rounded-xl truncate font-medium transition-colors cursor-pointer text-xs"
                  >
                    {pl.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Song Details Modal */}
      {showDetailsModal && (
        <SongDetailsModal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          song={song}
        />
      )}
    </>
  );
}
