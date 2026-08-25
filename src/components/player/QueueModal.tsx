'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, ListMusic, Trash2, Play, Music, Sparkles, ChevronUp, ChevronDown, 
  GripVertical, Heart, Plus, FolderPlus, MoreVertical, Disc3, Radio
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { Song } from '@/types/music';
import { SongFormatter } from '@/lib/music/SongFormatter';

export function QueueModal() {
  const { 
    isQueueOpen, 
    toggleQueue, 
    queue, 
    queueIndex, 
    currentSong, 
    playSong, 
    removeFromQueue, 
    clearQueue,
    moveQueueItem,
    deduplicateQueue,
    saveQueueAsPlaylist,
    isAutoplayEnabled, 
    toggleAutoplay,
    likedSongIds,
    toggleLikeSong,
    currentTime,
    duration,
    setActiveTab,
    setCreatePlaylistModalOpen,
    setToastMessage
  } = usePlayerStore();

  const { playlists, addSongToPlaylist } = usePlaylistStore();
  const [activeMenuSongId, setActiveMenuSongId] = useState<string | null>(null);
  const [showPlaylistsForSong, setShowPlaylistsForSong] = useState<string | null>(null);

  // Close context dropdowns when clicking outside
  useEffect(() => {
    if (!activeMenuSongId) return;
    const handleGlobalClick = () => {
      setActiveMenuSongId(null);
      setShowPlaylistsForSong(null);
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [activeMenuSongId]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isQueueOpen) return null;

  const upNextTracks = queue.slice(queueIndex + 1);
  const isCurrentLiked = currentSong ? likedSongIds.includes(currentSong.id) : false;

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-end md:p-6 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        onClick={toggleQueue} 
        className="absolute inset-0 bg-black/65 backdrop-blur-md transition-opacity" 
      />

      {/* Queue Drawer Container */}
      <div 
        className="relative z-10 w-full md:w-[440px] max-h-[86vh] md:max-h-[85vh] h-[86vh] md:h-auto bg-[#0d0e14]/98 border-t md:border border-white/15 rounded-t-[28px] md:rounded-3xl shadow-[0_-20px_60px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden text-white animate-in slide-in-from-bottom-6 md:slide-in-from-right-6 duration-250 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        {/* Mobile Drag Handle Pill */}
        <div className="md:hidden w-full flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 sm:py-3 border-b border-white/10 flex-shrink-0">
          {/* Left: Icon & Title */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-[#fa233b]/15 text-[#fa233b] border border-[#fa233b]/30 shadow-[0_0_12px_rgba(250,35,59,0.15)] flex-shrink-0">
              <ListMusic className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white leading-none">
                  Queue
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/5 whitespace-nowrap">
                  {upNextTracks.length}
                </span>
              </div>
              <p className="text-[11px] font-medium text-white/45 truncate mt-0.5 hidden xs:block">
                {upNextTracks.length === 0 ? 'No upcoming tracks' : `${upNextTracks.length} upcoming ${upNextTracks.length === 1 ? 'track' : 'tracks'}`}
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {queue.length > 0 && (
              <button
                onClick={async () => {
                  const success = await saveQueueAsPlaylist();
                  setToastMessage(success ? 'Saved active queue as new playlist' : 'Failed to save playlist');
                }}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer border border-white/10 whitespace-nowrap flex items-center gap-1.5"
                title="Save active queue as a new playlist"
              >
                <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Save</span>
              </button>
            )}

            {upNextTracks.length > 0 && (
              <button
                onClick={() => {
                  clearQueue();
                  setToastMessage('Cleared upcoming tracks from queue');
                }}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer border border-white/10 whitespace-nowrap"
                title="Clear upcoming songs from queue"
              >
                Clear
              </button>
            )}

            <button
              onClick={toggleAutoplay}
              className={`whitespace-nowrap flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95 ${
                isAutoplayEnabled 
                  ? 'bg-[#fa233b]/15 text-[#fa233b] border-[#fa233b]/35 shadow-[0_0_12px_rgba(250,35,59,0.2)]' 
                  : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
              title="Toggle AI Autoplay when queue finishes"
            >
              <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 ${isAutoplayEnabled ? 'text-[#fa233b] animate-pulse' : 'text-white/40'}`} />
              <span className="hidden sm:inline">Autoplay</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded leading-none ${
                isAutoplayEnabled ? 'bg-[#fa233b] text-white' : 'bg-white/10 text-white/50'
              }`}>
                {isAutoplayEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              onClick={toggleQueue}
              className="p-1.5 sm:p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
              title="Close Queue"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Queue Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent">
          
          {/* NOW PLAYING HERO SECTION */}
          {currentSong && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#fa233b] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#fa233b] animate-ping inline-block" />
                  NOW PLAYING
                </span>
                <span className="text-[10px] font-mono text-white/50 font-bold">
                  {formatTime(currentTime)} / {formatTime(Number.isFinite(duration) && duration > 0 ? duration : (Number.isFinite(currentSong?.duration) && currentSong.duration > 0 ? currentSong.duration : 0))}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-gradient-to-r from-white/[0.08] to-white/[0.03] border border-[#fa233b]/40 shadow-lg flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md flex-shrink-0 border border-white/15">
                    <img
                      src={currentSong.coverUrl || '/app-icon.png'}
                      alt={currentSong.title}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Music className="w-5 h-5 text-[#fa233b] animate-pulse" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-black text-white truncate leading-tight">
                      {currentSong.title}
                    </h4>
                    <p className="text-xs font-semibold text-white/60 truncate mt-0.5">
                      {currentSong.artist}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleLikeSong(currentSong.id)}
                    className="p-2 rounded-full hover:bg-white/10 transition-transform active:scale-125"
                    title={isCurrentLiked ? "Liked" : "Like song"}
                  >
                    <Heart className={`w-5 h-5 ${isCurrentLiked ? 'fill-[#fa233b] text-[#fa233b]' : 'text-white/60 hover:text-white'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* UP NEXT SECTION */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black uppercase tracking-widest text-white/60">
                UP NEXT {upNextTracks.length > 0 ? `(${upNextTracks.length})` : ''}
              </span>
              {currentSong?.album && (
                <span className="text-[10px] text-white/40 truncate max-w-[200px]">
                  Playing from {SongFormatter.cleanAlbumTitle(currentSong.album)}
                </span>
              )}
            </div>

            {upNextTracks.length === 0 ? (
              /* EMPTY QUEUE STATE */
              <div className="py-12 px-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                  <Disc3 className="w-6 h-6 animate-spin" style={{ animationDuration: '12s' }} />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-white">No upcoming tracks</h5>
                  <p className="text-xs text-white/50 mt-1 max-w-xs mx-auto">
                    {isAutoplayEnabled 
                      ? 'RaagaX AI Autoplay will continuously queue matching Telugu tracks.' 
                      : 'Add songs from Search, Playlists, or Albums to keep the queue rolling.'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('home');
                    toggleQueue();
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all active:scale-95"
                >
                  Explore Trending Hits on Home ↗
                </button>
              </div>
            ) : (
              /* UP NEXT REORDERABLE LIST */
              <div className="space-y-1.5">
                {upNextTracks.map((song: Song, idx: number) => {
                  const isTrackLiked = likedSongIds.includes(song.id);
                  const isMenuOpen = activeMenuSongId === `${song.id}-${idx}`;

                  return (
                    <div
                      key={`${song.id}-${idx}`}
                      className="group relative p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-2.5"
                    >
                      {/* Left: Reorder Arrows & Track Info */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Move Up/Down Controls */}
                        <div className="flex flex-col items-center justify-center gap-0.5 text-white/30 group-hover:text-white/60">
                          <button
                            disabled={idx === 0}
                            onClick={() => moveQueueItem(idx, idx - 1)}
                            className="p-0.5 hover:text-white disabled:opacity-20 disabled:hover:text-white/30 transition-colors"
                            title="Move track up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={idx === upNextTracks.length - 1}
                            onClick={() => moveQueueItem(idx, idx + 1)}
                            className="p-0.5 hover:text-white disabled:opacity-20 disabled:hover:text-white/30 transition-colors"
                            title="Move track down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Thumbnail */}
                        <div 
                          onClick={() => playSong(song)}
                          className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800 cursor-pointer shadow-sm group/thumb"
                        >
                          <img 
                            src={song.coverUrl || '/app-icon.png'} 
                            alt={song.title} 
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                          </div>
                        </div>

                        {/* Song Details */}
                        <div 
                          onClick={() => playSong(song)}
                          className="min-w-0 flex-1 cursor-pointer"
                        >
                          <h5 className="text-xs font-bold text-white group-hover:text-[#fa233b] truncate transition-colors leading-tight">
                            {song.title}
                          </h5>
                          <p className="text-[11px] font-medium text-white/50 truncate mt-0.5">
                            {song.artist}
                          </p>
                        </div>
                      </div>

                      {/* Right Actions: Remove & Context Menu */}
                      <div className="flex items-center gap-1 flex-shrink-0 relative">
                        {/* 1-Tap Remove from Queue */}
                        <button
                          onClick={() => {
                            removeFromQueue(song.id);
                            setToastMessage(`Removed "${song.title}" from queue`);
                          }}
                          className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {/* More Options Trigger */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuSongId(isMenuOpen ? null : `${song.id}-${idx}`);
                            }}
                            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Song options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Context Dropdown Popover */}
                          {isMenuOpen && (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-52 bg-[#12131a]/98 backdrop-blur-2xl border border-white/15 rounded-2xl p-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.9)] z-[130] text-xs text-white animate-in fade-in zoom-in-95 duration-150"
                            >
                              <button
                                onClick={() => {
                                  playSong(song);
                                  setActiveMenuSongId(null);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/10 font-bold"
                              >
                                <Play className="w-3.5 h-3.5 fill-current text-[#fa233b]" />
                                Play this song
                              </button>

                              <button
                                onClick={() => {
                                  toggleLikeSong(song.id);
                                  setToastMessage(isTrackLiked ? 'Removed from Liked Songs' : 'Saved to Liked Songs');
                                  setActiveMenuSongId(null);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/10 font-medium"
                              >
                                <Heart className={`w-3.5 h-3.5 ${isTrackLiked ? 'fill-[#fa233b] text-[#fa233b]' : 'text-white/60'}`} />
                                {isTrackLiked ? 'Remove from Liked' : 'Save to Liked Songs'}
                              </button>

                              <button
                                onClick={() => {
                                  setShowPlaylistsForSong(showPlaylistsForSong === song.id ? null : song.id);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between hover:bg-white/10 font-medium"
                              >
                                <div className="flex items-center gap-2.5">
                                  <FolderPlus className="w-3.5 h-3.5 text-white/60" />
                                  Add to playlist
                                </div>
                                <span className="text-white/40 text-[10px]">▸</span>
                              </button>

                              {showPlaylistsForSong === song.id && (
                                <div className="my-1 ml-3 pl-2 border-l border-white/10 space-y-1 max-h-32 overflow-y-auto">
                                  <button
                                    onClick={() => {
                                      setCreatePlaylistModalOpen(true);
                                      setActiveMenuSongId(null);
                                    }}
                                    className="w-full text-left py-1 px-2 rounded-lg text-[11px] text-[#fa233b] hover:bg-white/5 font-bold flex items-center gap-1.5"
                                  >
                                    <Plus className="w-3 h-3" /> New playlist
                                  </button>
                                  {playlists && playlists.length > 0 ? (
                                    playlists.map((pl) => (
                                      <button
                                        key={pl.id}
                                        onClick={async () => {
                                          await addSongToPlaylist(pl.id, song);
                                          setToastMessage(`Added "${song.title}" to ${pl.title}`);
                                          setActiveMenuSongId(null);
                                        }}
                                        className="w-full text-left py-1 px-2 rounded-lg text-[11px] text-white/80 hover:text-white hover:bg-white/5 truncate block font-medium"
                                      >
                                        {pl.title}
                                      </button>
                                    ))
                                  ) : (
                                    <p className="text-[10px] text-white/40 py-1 px-2 italic">No playlists</p>
                                  )}
                                </div>
                              )}

                              <div className="h-px bg-white/10 my-1" />

                              <button
                                onClick={() => {
                                  removeFromQueue(song.id);
                                  setToastMessage(`Removed "${song.title}" from queue`);
                                  setActiveMenuSongId(null);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2.5 hover:bg-red-500/20 text-red-400 font-bold"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                Remove from queue
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
