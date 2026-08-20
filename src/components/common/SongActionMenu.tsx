'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  MoreVertical, MoreHorizontal, ListPlus, FastForward, Heart, Play, Share2, Plus, 
  Download, PauseCircle, XCircle, ChevronRight, ChevronLeft, Info, Trash2, 
  Check, User, Disc, Ban, Bookmark, Flag
} from 'lucide-react';
import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { SongDetailsModal } from '@/components/modals/SongDetailsModal';

interface SongActionMenuProps {
  song: Song;
  playlistId?: string;
  onRemoveFromPlaylist?: () => void;
  onNotInterested?: () => void;
}

export function SongActionMenu({ song, playlistId, onRemoveFromPlaylist, onNotInterested }: SongActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'main' | 'playlist' | 'more'>('main');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const { 
    playSong, 
    addToQueue, 
    playNextInQueue, 
    toggleLikeSong, 
    likedSongIds, 
    downloadedSongIds, 
    setToastMessage,
    setSelectedArtistId,
    setSelectedAlbumId,
    setActiveTab
  } = usePlayerStore();
  
  const { playlists, addSongToPlaylist, removeSongFromPlaylist } = usePlaylistStore();
  const { tasks, pauseDownload, cancelDownload, saveForOffline, removeDownload, shareSongFile } = useDownloadStore();

  const task = song ? tasks[song.id] : null;
  const isDownloaded = song ? downloadedSongIds.includes(song.id) : false;
  const isLiked = song ? likedSongIds.includes(song.id) : false;
  const isDownloading = task && (task.status === 'DOWNLOADING' || task.status === 'QUEUED' || task.status === 'VERIFYING');
  const isInPlaylistContext = Boolean(playlistId || onRemoveFromPlaylist);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setCurrentView('main');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!song) return null;

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
    setCurrentView('main');
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

  const handleRemoveFromThisPlaylist = () => {
    if (onRemoveFromPlaylist) {
      onRemoveFromPlaylist();
    } else if (playlistId) {
      removeSongFromPlaylist(playlistId, song.id);
      setToastMessage(`Removed "${song.title}" from playlist`);
    }
    setIsOpen(false);
    setCurrentView('main');
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
            setCurrentView('main');
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

            {currentView === 'main' && (
              <div className="space-y-0.5 pt-1">
                {/* 1. Play */}
                <button 
                  onClick={() => handleAction(() => playSong(song))}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </div>
                  <span className="font-medium text-slate-200 group-hover:text-white flex-1 ml-3 text-xs">Play</span>
                </button>

                {/* 2. Play Next */}
                <button 
                  onClick={() => handleAction(() => playNextInQueue(song))}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-300 group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <FastForward className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-slate-200 group-hover:text-white flex-1 ml-3 text-xs">Play Next</span>
                </button>

                {/* 3. Add to Queue */}
                <button 
                  onClick={() => handleAction(() => addToQueue(song))}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-300 group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <ListPlus className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-slate-200 group-hover:text-white flex-1 ml-3 text-xs">Add to Queue</span>
                </button>

                {/* 4. Add to Playlist / Remove from Playlist (contextual) */}
                {isInPlaylistContext ? (
                  <button 
                    onClick={handleRemoveFromThisPlaylist}
                    className="w-full text-left px-2.5 py-2 hover:bg-red-500/15 text-red-400 rounded-xl flex items-center transition-all group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium flex-1 ml-3 text-xs">Remove from Playlist</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => setCurrentView('playlist')}
                    className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center justify-between transition-all group cursor-pointer"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-300 group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium text-slate-200 group-hover:text-white ml-3 text-xs">Add to Playlist</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                  </button>
                )}

                {/* 5. Like / Liked (dynamic reflection) */}
                <button 
                  onClick={() => handleAction(() => toggleLikeSong(song.id))}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className={`w-8 h-8 rounded-lg border border-white/5 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isLiked ? 'bg-[#EF233C]/20 border-[#EF233C]/30 text-[#EF233C]' : 'bg-white/5 text-slate-300 group-hover:bg-[#EF233C] group-hover:text-white'
                  }`}>
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-[#EF233C] text-[#EF233C]' : ''}`} />
                  </div>
                  <span className={`font-medium flex-1 ml-3 text-xs ${isLiked ? 'text-[#EF233C]' : 'text-slate-200 group-hover:text-white'}`}>
                    {isLiked ? 'Liked' : 'Like'}
                  </span>
                </button>

                {/* 6. Go to Artist */}
                {(song.artistId || song.artist) && (
                  <button 
                    onClick={() => handleAction(() => {
                      setSelectedArtistId(song.artistId || song.artist);
                      setActiveTab('artist');
                    })}
                    className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-blue-400 group-hover:bg-blue-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium text-slate-300 group-hover:text-white flex-1 ml-3 text-xs">Go to Artist</span>
                  </button>
                )}

                {/* 7. Go to Album */}
                {(song.albumId || song.album) && (
                  <button 
                    onClick={() => handleAction(() => {
                      setSelectedAlbumId(song.albumId || song.album);
                      setActiveTab('album');
                    })}
                    className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-rose-400 group-hover:bg-rose-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Disc className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium text-slate-300 group-hover:text-white flex-1 ml-3 text-xs">Go to Album</span>
                  </button>
                )}

                {/* 8. Song Details */}
                <button 
                  onClick={() => handleAction(() => setShowDetailsModal(true))}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-300 group-hover:bg-white/10 group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-slate-300 group-hover:text-white flex-1 ml-3 text-xs">Song Details</span>
                </button>

                {/* 9. Share */}
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

                {/* 10. More */}
                <button 
                  onClick={() => setCurrentView('more')}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center justify-between transition-all group cursor-pointer"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium text-slate-300 group-hover:text-white ml-3 text-xs">More</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                </button>
              </div>
            )}

            {/* Playlist Submenu */}
            {currentView === 'playlist' && (
              <div className="max-h-64 overflow-y-auto no-scrollbar space-y-1 p-1">
                <button 
                  onClick={() => setCurrentView('main')}
                  className="w-full text-left px-2.5 py-1.5 text-slate-400 hover:text-white border-b border-white/10 flex items-center gap-1.5 font-semibold mb-1 text-xs cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
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

                {playlists.map(pl => {
                  const isAlreadyIn = pl.songIds.includes(song.id);
                  return (
                    <button 
                      key={pl.id}
                      disabled={isAlreadyIn}
                      onClick={() => handleAction(() => {
                        addSongToPlaylist(pl.id, song);
                      })}
                      className={`w-full text-left px-3 py-2.5 rounded-xl truncate font-medium transition-colors flex items-center justify-between text-xs cursor-pointer ${
                        isAlreadyIn
                          ? 'text-emerald-400 bg-emerald-500/10 cursor-not-allowed opacity-80'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{pl.title}</span>
                      {isAlreadyIn && (
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 shrink-0 ml-2">
                          <Check className="w-3 h-3 stroke-[3]" /> Added
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* More Submenu */}
            {currentView === 'more' && (
              <div className="space-y-0.5 pt-1">
                <button 
                  onClick={() => setCurrentView('main')}
                  className="w-full text-left px-2.5 py-1.5 text-slate-400 hover:text-white border-b border-white/10 flex items-center gap-1.5 font-semibold mb-1 text-xs cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </button>

                {/* Dynamic Add to Library / In Library */}
                <button 
                  onClick={() => handleAction(() => {
                    toggleLikeSong(song.id);
                    setToastMessage(isLiked ? `Removed "${song.title}" from Library` : `Added "${song.title}" to Library`);
                  })}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className={`w-8 h-8 rounded-lg border border-white/5 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isLiked ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-white/5 text-slate-300 group-hover:bg-emerald-500/20 group-hover:text-emerald-400'
                  }`}>
                    {isLiked ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : <Bookmark className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`font-medium flex-1 ml-3 text-xs ${isLiked ? 'text-emerald-400' : 'text-slate-300 group-hover:text-white'}`}>
                    {isLiked ? '✓ In Library' : 'Add to Library'}
                  </span>
                </button>

                {/* Download / Remove Download */}
                <div>
                  {isDownloaded ? (
                    <button
                      onClick={() => handleAction(async () => {
                        await removeDownload(song.id);
                        setToastMessage(`Removed "${song.title}" from local storage`);
                      })}
                      className="w-full text-left px-2.5 py-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl flex items-center transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 group-hover:border-red-500/30 group-hover:bg-red-500/20 group-hover:text-red-400 flex items-center justify-center flex-shrink-0 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 ml-3">
                        <span className="font-medium block text-xs">Remove Download</span>
                        <span className="text-[10px] text-slate-500 block">Deletes local MP3</span>
                      </div>
                    </button>
                  ) : isDownloading ? (
                    <div className="flex items-center w-full gap-1 p-1">
                      <button 
                        onClick={() => handleAction(() => pauseDownload(song.id))}
                        className="flex-1 text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center group cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0">
                          <PauseCircle className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0 ml-3">
                          <span className="font-bold text-amber-400 block text-xs">
                            Pause ({task?.progress || 0}%)
                          </span>
                          <span className="text-[10px] text-slate-400 block">Downloading...</span>
                        </div>
                      </button>
                      <button 
                        onClick={() => handleAction(() => cancelDownload(song.id))}
                        className="p-2 text-red-400 hover:bg-white/10 rounded-xl cursor-pointer"
                        title="Cancel"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleAction(async () => {
                        await saveForOffline(song);
                        setToastMessage(`Downloading "${song.title}"...`);
                      })}
                      className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-emerald-400 group-hover:bg-emerald-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                        <Download className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 ml-3">
                        <span className="font-medium text-slate-200 group-hover:text-white block text-xs">Download</span>
                        <span className="text-[10px] text-slate-400 block font-mono">Offline 320kbps</span>
                      </div>
                    </button>
                  )}
                </div>

                {/* Not Interested */}
                <button 
                  onClick={() => {
                    handleAction(() => {
                      import('@/lib/recommendation/RecommendationEngine').then(({ RecommendationEngine }) => {
                        RecommendationEngine.getInstance().markNotInterested(song.id, 'user_action');
                      });
                      setToastMessage(`We'll recommend fewer songs like "${song.title}"`);
                      onNotInterested?.();
                    });
                  }}
                  className="w-full text-left px-2.5 py-2 hover:bg-red-500/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-400 group-hover:text-red-400 group-hover:bg-red-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Ban className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-slate-300 group-hover:text-red-300 flex-1 ml-3 text-xs">Not Interested</span>
                </button>

                {/* Remove from Playlist (if rendered in playlist view) */}
                {isInPlaylistContext && (
                  <button 
                    onClick={handleRemoveFromThisPlaylist}
                    className="w-full text-left px-2.5 py-2 hover:bg-red-500/15 text-red-400 rounded-xl flex items-center transition-all group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium flex-1 ml-3 text-xs">Remove from Playlist</span>
                  </button>
                )}

                {/* Report */}
                <button 
                  onClick={() => handleAction(() => {
                    setToastMessage('Thanks for your feedback! Audio issue reported.');
                  })}
                  className="w-full text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-400 group-hover:text-amber-400 group-hover:bg-amber-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Flag className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-slate-300 group-hover:text-white flex-1 ml-3 text-xs">Report</span>
                </button>
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
