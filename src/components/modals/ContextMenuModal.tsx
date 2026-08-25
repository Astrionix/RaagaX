'use client';

import React, { useState } from 'react';
import { 
  X, Play, FastForward, ListPlus, Heart, Download, Share2, User, Disc, 
  Plus, MoreHorizontal, ChevronRight, ChevronLeft, Info, Bookmark, Trash2, Ban, Flag, Check, Radio
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { SongDetailsModal } from '@/components/modals/SongDetailsModal';

export function ContextMenuModal() {
  const {
    contextMenuSong,
    closeContextMenu,
    playSong,
    playNextInQueue,
    addToQueue,
    likedSongIds,
    toggleLikeSong,
    downloadedSongIds,
    setSelectedArtistId,
    setSelectedAlbumId,
    setActiveTab,
    setToastMessage,
    setCreatePlaylistModalOpen
  } = usePlayerStore();

  const { playlists, addSongToPlaylist } = usePlaylistStore();
  const { tasks, pauseDownload, cancelDownload, saveForOffline, removeDownload, shareSongFile } = useDownloadStore();

  const [mounted, setMounted] = useState(false);
  const [currentView, setCurrentView] = useState<'main' | 'playlist' | 'more'>('main');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!contextMenuSong) {
      setCurrentView('main');
    }
  }, [contextMenuSong]);

  if (!mounted || !contextMenuSong) return null;

  const task = tasks[contextMenuSong.id];
  const isLiked = likedSongIds.includes(contextMenuSong.id);
  const isDownloaded = downloadedSongIds.includes(contextMenuSong.id);
  const isDownloading = task && (task.status === 'DOWNLOADING' || task.status === 'QUEUED' || task.status === 'VERIFYING');

  const handleAction = (action: () => void) => {
    action();
    closeContextMenu();
    setCurrentView('main');
  };

  const handleShare = async () => {
    if (isDownloaded) {
      const shared = await shareSongFile(contextMenuSong.id);
      if (shared) {
        closeContextMenu();
        return;
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: contextMenuSong.title,
          text: `Listen to "${contextMenuSong.title}" by ${contextMenuSong.artist} on RaagaX!`,
          url: window.location.href,
        });
        closeContextMenu();
        return;
      } catch {}
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${contextMenuSong.title} - ${contextMenuSong.artist}`);
      setToastMessage('Song name copied to clipboard');
      closeContextMenu();
    }
  };

  return (
    <>
      <div
        onClick={() => {
          closeContextMenu();
          setCurrentView('main');
        }}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 select-none"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-[#14151a]/95 border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 space-y-3 text-white shadow-2xl backdrop-blur-2xl animate-in slide-in-from-bottom duration-300 divide-y divide-white/5"
        >
          {/* Track Header Header */}
          <div className="flex items-center gap-3 pb-3">
            <img
              src={contextMenuSong.coverUrl || '/app-icon.png'}
              alt={contextMenuSong.title}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
              className="w-11 h-11 rounded-xl object-cover shadow-md bg-slate-800 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white truncate leading-snug">{contextMenuSong.title}</h3>
              <p className="text-xs text-slate-400 truncate mt-0.5">{contextMenuSong.artist}</p>
            </div>
            <button
              onClick={() => {
                closeContextMenu();
                setCurrentView('main');
              }}
              className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {currentView === 'main' && (
            <div className="space-y-0.5 pt-2 text-sm font-medium">
              {/* 1. Play */}
              <button
                onClick={() => handleAction(() => playSong(contextMenuSong))}
                className="w-full py-2.5 px-3 rounded-xl hover:bg-white/10 flex items-center transition-colors group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
                <span className="font-semibold text-slate-200 group-hover:text-white flex-1 ml-3 text-xs">Play</span>
              </button>

              {/* 2. Play Next */}
              <button
                onClick={() => handleAction(() => playNextInQueue(contextMenuSong))}
                className="w-full py-2.5 px-3 rounded-xl hover:bg-white/10 flex items-center transition-colors group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-300 group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                  <FastForward className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-200 group-hover:text-white flex-1 ml-3 text-xs">Play Next</span>
              </button>


              {/* 4. Add to Queue */}
              <button
                onClick={() => handleAction(() => addToQueue(contextMenuSong))}
                className="w-full py-2.5 px-3 rounded-xl hover:bg-white/10 flex items-center transition-colors group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-300 group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                  <ListPlus className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-200 group-hover:text-white flex-1 ml-3 text-xs">Add to Queue</span>
              </button>

              {/* 4. Add to Playlist */}
              <button
                onClick={() => setCurrentView('playlist')}
                className="w-full py-2.5 px-3 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors group cursor-pointer"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-300 group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-slate-200 group-hover:text-white ml-3 text-xs">Add to Playlist</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </button>

              {/* 5. Like / Liked */}
              <button
                onClick={() => handleAction(() => toggleLikeSong(contextMenuSong.id))}
                className="w-full py-2.5 px-3 rounded-xl hover:bg-white/10 flex items-center transition-colors group cursor-pointer"
              >
                <div className={`w-8 h-8 rounded-lg border border-white/5 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isLiked ? 'bg-[#EF233C]/20 border-[#EF233C]/30 text-[#EF233C]' : 'bg-white/5 text-slate-300 group-hover:bg-[#EF233C] group-hover:text-white'
                }`}>
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#EF233C] text-[#EF233C]' : ''}`} />
                </div>
                <span className={`font-semibold flex-1 ml-3 text-xs ${isLiked ? 'text-[#EF233C]' : 'text-slate-200 group-hover:text-white'}`}>
                  {isLiked ? 'Liked' : 'Like'}
                </span>
              </button>

              {/* 6. Go to Artist */}
              {(contextMenuSong.artistId || contextMenuSong.artist) && (
                <button
                  onClick={() => handleAction(() => {
                    setSelectedArtistId(contextMenuSong.artistId || contextMenuSong.artist);
                    setActiveTab('artist');
                  })}
                  className="w-full py-2.5 px-3 rounded-xl hover:bg-white/10 flex items-center transition-colors group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-blue-400 group-hover:bg-blue-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-slate-300 group-hover:text-white flex-1 ml-3 text-xs">Go to Artist</span>
                </button>
              )}

              {/* 7. Go to Album */}
              {(contextMenuSong.albumId || contextMenuSong.album) && (
                <button
                  onClick={() => handleAction(() => {
                    setSelectedAlbumId(contextMenuSong.albumId || contextMenuSong.album);
                    setActiveTab('album');
                  })}
                  className="w-full py-2.5 px-3 rounded-xl hover:bg-white/10 flex items-center transition-colors group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-rose-400 group-hover:bg-rose-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Disc className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-slate-300 group-hover:text-white flex-1 ml-3 text-xs">Go to Album</span>
                </button>
              )}

              {/* 8. Song Details */}
              <button
                onClick={() => {
                  closeContextMenu();
                  setShowDetailsModal(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl hover:bg-white/10 flex items-center transition-colors group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-300 group-hover:bg-white/10 group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                  <Info className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-300 group-hover:text-white flex-1 ml-3 text-xs">Song Details</span>
              </button>

              {/* 9. Share */}
              <button
                onClick={handleShare}
                className="w-full py-2.5 px-3 rounded-xl hover:bg-white/10 flex items-center transition-colors group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-[#EF233C] group-hover:bg-[#EF233C] group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                  <Share2 className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-200 group-hover:text-white flex-1 ml-3 text-xs">Share</span>
              </button>

              {/* 10. More */}
              <button
                onClick={() => setCurrentView('more')}
                className="w-full py-2.5 px-3 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors group cursor-pointer"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-slate-300 group-hover:text-white ml-3 text-xs">More</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </button>
            </div>
          )}

          {/* Playlist Submenu */}
          {currentView === 'playlist' && (
            <div className="max-h-64 overflow-y-auto no-scrollbar space-y-1 p-1 pt-2">
              <button 
                onClick={() => setCurrentView('main')}
                className="w-full text-left px-2.5 py-1.5 text-slate-400 hover:text-white border-b border-white/10 flex items-center gap-1.5 font-semibold mb-1 text-xs cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              
              <button 
                onClick={() => {
                  handleAction(() => {
                    setCreatePlaylistModalOpen(true);
                  });
                }}
                className="w-full text-left px-3 py-2.5 text-[#EF233C] hover:bg-white/10 rounded-xl flex items-center gap-3 font-bold transition-colors cursor-pointer text-xs"
              >
                <Plus className="w-4 h-4" /> Create New Playlist
              </button>

              {playlists.map(pl => {
                const isAlreadyIn = pl.songIds.includes(contextMenuSong.id);
                return (
                  <button 
                    key={pl.id}
                    disabled={isAlreadyIn}
                    onClick={() => handleAction(() => {
                      addSongToPlaylist(pl.id, contextMenuSong);
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
            <div className="space-y-0.5 pt-2 text-sm font-medium">
              <button 
                onClick={() => setCurrentView('main')}
                className="w-full text-left px-2.5 py-1.5 text-slate-400 hover:text-white border-b border-white/10 flex items-center gap-1.5 font-semibold mb-1 text-xs cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>

              {/* Dynamic Add to Library / In Library */}
              <button 
                onClick={() => handleAction(() => {
                  toggleLikeSong(contextMenuSong.id);
                  setToastMessage(isLiked ? `Removed "${contextMenuSong.title}" from Library` : `Added "${contextMenuSong.title}" to Library`);
                })}
                className="w-full text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
              >
                <div className={`w-8 h-8 rounded-lg border border-white/5 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isLiked ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-white/5 text-slate-300 group-hover:bg-emerald-500/20 group-hover:text-emerald-400'
                }`}>
                  {isLiked ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : <Bookmark className="w-3.5 h-3.5" />}
                </div>
                <span className={`font-semibold flex-1 ml-3 text-xs ${isLiked ? 'text-emerald-400' : 'text-slate-300 group-hover:text-white'}`}>
                  {isLiked ? '✓ In Library' : 'Add to Library'}
                </span>
              </button>

              {/* Download / Remove Download (Mobile only) */}
              {isNative && (
                <div>
                  {isDownloaded ? (
                    <button
                      onClick={() => handleAction(async () => {
                        await removeDownload(contextMenuSong.id);
                        setToastMessage(`Removed "${contextMenuSong.title}" from local storage`);
                      })}
                      className="w-full text-left px-2.5 py-2.5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl flex items-center transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 group-hover:border-red-500/30 group-hover:bg-red-500/20 group-hover:text-red-400 flex items-center justify-center flex-shrink-0 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 ml-3">
                        <span className="font-semibold block text-xs">Remove Download</span>
                        <span className="text-[10px] text-slate-500 block">Deletes local MP3</span>
                      </div>
                    </button>
                  ) : isDownloading ? (
                    <div className="flex items-center w-full gap-1 p-1">
                      <button 
                        onClick={() => handleAction(() => pauseDownload(contextMenuSong.id))}
                        className="flex-1 text-left px-2.5 py-2 hover:bg-white/10 rounded-xl flex items-center group cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0">
                          <Download className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0 ml-3">
                          <span className="font-bold text-amber-400 block text-xs">
                            Pause ({task?.progress || 0}%)
                          </span>
                          <span className="text-[10px] text-slate-400 block">Downloading...</span>
                        </div>
                      </button>
                      <button 
                        onClick={() => handleAction(() => cancelDownload(contextMenuSong.id))}
                        className="p-2 text-red-400 hover:bg-white/10 rounded-xl cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleAction(async () => {
                        await saveForOffline(contextMenuSong);
                        setToastMessage(`Downloading "${contextMenuSong.title}"...`);
                      })}
                      className="w-full text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-emerald-400 group-hover:bg-emerald-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                        <Download className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 ml-3">
                        <span className="font-semibold text-slate-200 group-hover:text-white block text-xs">Download</span>
                        <span className="text-[10px] text-slate-400 block font-mono">Offline 320kbps</span>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Not Interested */}
              <button 
                onClick={() => {
                  handleAction(() => {
                    import('@/lib/recommendation/PersonalizationEngine').then(({ PersonalizationEngine }) => {
                      PersonalizationEngine.getInstance().markNotInterested(contextMenuSong.id);
                    });
                    setToastMessage(`We'll recommend fewer songs like "${contextMenuSong.title}"`);
                  });
                }}
                className="w-full text-left px-2.5 py-2.5 hover:bg-red-500/10 rounded-xl flex items-center transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-400 group-hover:text-red-400 group-hover:bg-red-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                  <Ban className="w-3.5 h-3.5" />
                </div>
                <span className="font-semibold text-slate-300 group-hover:text-red-300 flex-1 ml-3 text-xs">Not Interested</span>
              </button>

              {/* Report */}
              <button 
                onClick={() => handleAction(() => {
                  setToastMessage('Thanks for your feedback! Audio issue reported.');
                })}
                className="w-full text-left px-2.5 py-2.5 hover:bg-white/10 rounded-xl flex items-center transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-400 group-hover:text-amber-400 group-hover:bg-amber-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                  <Flag className="w-3.5 h-3.5" />
                </div>
                <span className="font-semibold text-slate-300 group-hover:text-white flex-1 ml-3 text-xs">Report</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showDetailsModal && (
        <SongDetailsModal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          song={contextMenuSong}
        />
      )}
    </>
  );
}
