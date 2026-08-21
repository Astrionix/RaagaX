'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  Play, Heart, Download, Music, ArrowLeft, Shuffle, Trash2, ListPlus, 
  Share2, Copy, Check, Lock, Globe, Sparkles, Plus,
  ArrowUpDown, CheckSquare, Square, X, CheckCheck, Pause, Loader2,
  MoreVertical, Edit3, MoveUp, MoveDown, CheckCircle2, PauseCircle,
  Clock, HardDrive, RefreshCw
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';
import { usePlaylistStore, UserPlaylist } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { useAuthStore } from '@/context/useAuthStore';
import { AddSongsModal } from '@/components/modals/AddSongsModal';
import { DynamicArtworkAtmosphere } from '@/components/common/DynamicArtworkAtmosphere';
import { NavigationStack } from '@/lib/navigation/NavigationStack';
import { haptics } from '@/lib/haptics/HapticEngine';

type SortOption = 'newest' | 'oldest' | 'az' | 'za' | 'duration';

export function PlaylistDetailView() {
  const { 
    selectedPlaylistId, 
    setSelectedPlaylistId, 
    setSelectedAlbumId,
    setActiveTab, 
    playSong, 
    isPlaying,
    setToastMessage,
    setRemoteState,
    likedSongIds, 
    toggleLikeSong, 
    downloadedSongIds,
    preferredLanguage,
  } = usePlayerStore();

  const { user } = useAuthStore();
  const activeUserId = user?.id || 'guest';

  const { 
    playlists, 
    removeSongFromPlaylist,
    reorderSongs,
    savePlaylistOrder,
    updatePlaylist,
    clearPlaylist,
    deletePlaylist,
    clonePlaylistToLibrary,
    generateInviteLink
  } = usePlaylistStore();

  const {
    tasks,
    saveForOffline,
    removeDownload,
    downloadAlbum,
    pauseAll,
    resumeAll,
    cancelAll,
    isOfflineMode
  } = useDownloadStore();

  const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());

  const [playlist, setPlaylist] = useState<UserPlaylist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddSongsModal, setShowAddSongsModal] = useState(false);
  const [showDownloadConfirmModal, setShowDownloadConfirmModal] = useState(false);
  const [showEditMetadataModal, setShowEditMetadataModal] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  
  // Sort and Edit Order modes
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [isEditOrderMode, setIsEditOrderMode] = useState(false);

  // Edit metadata form state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('private');
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  // Fetch / Sync playlist from store OR resolve curated / editorial playlist
  useEffect(() => {
    if (!selectedPlaylistId) return;

    // 1. If it's an album ID, redirect to Album View
    if (selectedPlaylistId.startsWith('album:')) {
      setSelectedAlbumId(selectedPlaylistId.replace('album:', ''));
      setActiveTab('album');
      return;
    }
    
    let isMounted = true;
    setIsLoading(true);

    // 2. Check if it is a user playlist
    const target = playlists.find(p => p.id === selectedPlaylistId);
    if (target) {
      setPlaylist(target);
      setEditTitle(target.title);
      setEditDescription(target.description || '');
      setEditCoverUrl(target.coverUrl || '');
      setEditVisibility((target.visibility || 'private') as any);
      setIsLoading(false);
      return;
    }

    // 3. Resolve curated / editorial / external playlist from catalog
    import('@/lib/playlist/PlaylistDetailResolver').then(async ({ PlaylistDetailResolver }) => {
      try {
        const resolved = await PlaylistDetailResolver.getInstance().resolve(selectedPlaylistId, preferredLanguage);
        if (isMounted && resolved) {
          setPlaylist({
            id: resolved.id,
            title: resolved.title,
            description: resolved.description || '',
            coverUrl: resolved.coverUrl || '',
            visibility: 'public',
            ownerId: 'curated',
            ownerName: resolved.ownerName || 'RaagaX Curators',
            creator: 'RaagaX Curators',
            songIds: resolved.songs.map(s => s.id),
            songs: resolved.songs,
          });
          setEditTitle(resolved.title);
          setEditDescription(resolved.description || '');
          setEditCoverUrl(resolved.coverUrl || '');
          setEditVisibility('public');
        } else if (isMounted) {
          setPlaylist(null);
        }
      } catch (err) {
        console.error('[PlaylistDetailView] Failed to resolve curated playlist:', err);
        if (isMounted) setPlaylist(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedPlaylistId, playlists, preferredLanguage, setSelectedAlbumId, setActiveTab]);

  // Total duration calculation
  const totalDurationSeconds = useMemo(() => {
    if (!playlist || !playlist.songs) return 0;
    return playlist.songs.reduce((sum, s) => sum + (s.duration || 180), 0);
  }, [playlist]);

  const formattedDuration = useMemo(() => {
    const hours = Math.floor(totalDurationSeconds / 3600);
    const minutes = Math.floor((totalDurationSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, [totalDurationSeconds]);

  // Download counts and sizes
  const downloadedSongsInPlaylist = useMemo(() => {
    if (!playlist || !playlist.songs) return [];
    return playlist.songs.filter(s => downloadedSongIds.includes(s.id));
  }, [playlist, downloadedSongIds]);

  const pendingDownloadsCount = useMemo(() => {
    if (!playlist || !playlist.songs) return 0;
    return playlist.songs.length - downloadedSongsInPlaylist.length;
  }, [playlist, downloadedSongsInPlaylist]);

  const isAllDownloaded = useMemo(() => {
    if (!playlist || !playlist.songs || playlist.songs.length === 0) return false;
    return downloadedSongsInPlaylist.length === playlist.songs.length;
  }, [playlist, downloadedSongsInPlaylist]);

  const downloadingCount = useMemo(() => {
    if (!playlist || !playlist.songs) return 0;
    return playlist.songs.filter(s => {
      const task = tasks[s.id];
      return task && (task.status === 'DOWNLOADING' || task.status === 'QUEUED' || task.status === 'VERIFYING');
    }).length;
  }, [playlist, tasks]);

  const isDownloading = downloadingCount > 0;

  const isUserOwned = useMemo(() => {
    if (!playlist) return false;
    return playlist.ownerId !== 'curated' && (playlist.ownerId === activeUserId || playlist.ownerId === 'guest' || !playlist.ownerId);
  }, [playlist, activeUserId]);

  const handleSaveToLibrary = async () => {
    if (!playlist) return;
    const cloned = await clonePlaylistToLibrary(playlist.id);
    if (cloned) {
      setToastMessage(`Saved "${playlist.title}" to Your Playlists!`);
      setSelectedPlaylistId(cloned.id);
    }
  };

  const displaySongs = useMemo(() => {
    if (!playlist || !playlist.songs) return [];
    if (isEditOrderMode) return playlist.songs;

    const list = [...playlist.songs];
    switch (sortBy) {
      case 'newest':
        // Default insertion order / newest first
        return list;
      case 'oldest':
        return list.reverse();
      case 'az':
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case 'za':
        return list.sort((a, b) => b.title.localeCompare(a.title));
      case 'duration':
        return list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      default:
        return list;
    }
  }, [playlist, sortBy, isEditOrderMode]);

  // Play All & Shuffle Play
  const handlePlay = (shuffle = false) => {
    if (!playlist || !playlist.songs || playlist.songs.length === 0) {
      setToastMessage('Playlist is empty. Add songs first!');
      return;
    }
    const tracklist = shuffle ? [...playlist.songs].sort(() => Math.random() - 0.5) : playlist.songs;
    setRemoteState({ shuffleMode: shuffle ? 'STANDARD' : 'OFF' });
    playSong(tracklist[0], tracklist, {
      type: 'playlist',
      id: playlist.id,
      title: playlist.title,
    });
  };

  // Intelligent Bulk Download
  const handleDownloadAll = async () => {
    if (!playlist || !playlist.songs || playlist.songs.length === 0) return;
    
    if (pendingDownloadsCount === 0) {
      setToastMessage('All songs in this playlist are already available offline! ✓');
      return;
    }

    setShowDownloadConfirmModal(true);
  };

  const executeBulkDownload = async () => {
    if (!playlist || !playlist.songs) return;
    setShowDownloadConfirmModal(false);
    // Use the concurrency-controlled downloadAlbum engine (playlist reuses same logic)
    downloadAlbum(playlist.id, playlist.songs);
    setToastMessage(`Queuing ${pendingDownloadsCount} tracks for offline listening...`);
  };

  const handleRemoveAllDownloads = async () => {
    if (!playlist || !playlist.songs) return;
    setShowPlaylistMenu(false);
    
    const confirm = window.confirm(`Remove local downloads for ${downloadedSongsInPlaylist.length} songs in "${playlist.title}"? Songs will remain in your playlist.`);
    if (confirm) {
      for (const s of downloadedSongsInPlaylist) {
        await removeDownload(s.id);
      }
      setToastMessage(`Removed ${downloadedSongsInPlaylist.length} downloads from local storage`);
    }
  };

  // Reordering controls
  const handleMoveSong = async (index: number, direction: 'up' | 'down') => {
    if (!playlist) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= playlist.songs.length) return;
    await reorderSongs(playlist.id, index, targetIndex);
  };

  // Save metadata
  const handleSaveMetadata = async () => {
    if (!playlist || !editTitle.trim()) return;
    setIsSavingMetadata(true);

    try {
      await updatePlaylist(playlist.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        coverUrl: editCoverUrl.trim(),
        visibility: editVisibility,
      });
      setToastMessage('Playlist updated');
      setShowEditMetadataModal(false);
    } catch (e) {
      console.error('[PlaylistDetailView] Failed to update playlist metadata:', e);
    } finally {
      setIsSavingMetadata(false);
    }
  };

  // Delete playlist
  const handleDeletePlaylist = async () => {
    if (!playlist) return;
    setShowPlaylistMenu(false);
    const confirm = window.confirm(`Are you sure you want to delete "${playlist.title}"? (Underlying songs & downloads will NOT be deleted).`);
    if (confirm) {
      await deletePlaylist(playlist.id);
      setToastMessage(`Deleted playlist "${playlist.title}"`);
      setActiveTab('library');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#fa233b] mb-3" />
        <p className="text-xs font-medium">Loading playlist...</p>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 text-slate-400">
        <Music className="w-12 h-12 mb-3 opacity-40 text-slate-500" />
        <h3 className="text-base font-bold text-white">Playlist Not Found</h3>
        <p className="text-xs text-slate-400 mt-1 mb-4">This playlist may have been deleted or is unavailable.</p>
        <button
          onClick={() => setActiveTab('library')}
          className="px-4 py-2 rounded-xl bg-[#fa233b] text-white text-xs font-bold shadow-md hover:bg-[#d91e32]"
        >
          Return to Library
        </button>
      </div>
    );
  }

  return (
    <DynamicArtworkAtmosphere artworkUrl={playlist.coverUrl} isPlaying={isPlaying}>
      <div className="space-y-6 pb-12 text-white select-none animate-in fade-in duration-200">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => {
              haptics.lightImpact();
              const handled = NavigationStack.getInstance().goBack((target) => {
                usePlayerStore.setState({
                  activeTab: target.activeTab,
                  selectedAlbumId: target.selectedAlbumId,
                  selectedArtistId: target.selectedArtistId,
                  selectedPlaylistId: target.selectedPlaylistId,
                  isPlayerExpanded: target.isPlayerExpanded,
                });
              });
              if (!handled) {
                setSelectedPlaylistId(null);
                setActiveTab('library');
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-bold cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {/* 3-Dot Playlist Action Menu */}
          <div className="relative">
            <button
              onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Playlist Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showPlaylistMenu && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-2 w-56 bg-[#14151a]/95 border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 text-xs backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 space-y-0.5"
              >
                <button
                  onClick={() => { setShowPlaylistMenu(false); handlePlay(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-[#fa233b]" /> Play
                </button>

                <button
                  onClick={() => { setShowPlaylistMenu(false); handlePlay(true); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
                >
                  <Shuffle className="w-3.5 h-3.5 text-slate-300" /> Shuffle Play
                </button>

                <button
                  onClick={() => { setShowPlaylistMenu(false); setShowAddSongsModal(true); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-purple-400" /> Add Songs
                </button>

                {isNative && (
                  <>
                    <button
                      onClick={() => { setShowPlaylistMenu(false); handleDownloadAll(); }}
                      className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" /> Download All
                    </button>

                    {downloadedSongsInPlaylist.length > 0 && (
                      <button
                        onClick={handleRemoveAllDownloads}
                        className="w-full text-left px-3 py-2 hover:bg-red-500/10 rounded-xl flex items-center gap-2.5 text-slate-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove All Downloads
                      </button>
                    )}
                  </>
                )}

                <div className="border-t border-white/5 my-1" />

                {!isUserOwned ? (
                  <button
                    onClick={() => { setShowPlaylistMenu(false); handleSaveToLibrary(); }}
                    className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-purple-400" /> Save to Your Library
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => { setShowPlaylistMenu(false); setIsEditOrderMode(!isEditOrderMode); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition-colors ${
                        isEditOrderMode ? 'bg-[#fa233b]/20 text-[#fa233b] font-bold' : 'hover:bg-white/10 text-slate-200 hover:text-white'
                      }`}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" /> {isEditOrderMode ? 'Done Reordering' : 'Edit Order'}
                    </button>

                    <button
                      onClick={() => { setShowPlaylistMenu(false); setShowEditMetadataModal(true); }}
                      className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" /> Edit Playlist Details
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setShowPlaylistMenu(false);
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(generateInviteLink(playlist.id));
                      setToastMessage('Playlist link copied to clipboard');
                    }
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-xl flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 text-cyan-400" /> Share Playlist
                </button>

                {isUserOwned && (
                  <>
                    <div className="border-t border-white/5 my-1" />

                    <button
                      onClick={() => {
                        setShowPlaylistMenu(false);
                        const confirm = window.confirm(`Clear all ${playlist.songs.length} songs from "${playlist.title}"?`);
                        if (confirm) clearPlaylist(playlist.id);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl flex items-center gap-2.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear All Songs
                    </button>

                    <button
                      onClick={handleDeletePlaylist}
                      className="w-full text-left px-3 py-2 hover:bg-red-500/15 text-red-400 font-bold rounded-xl flex items-center gap-2.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Playlist
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cinematic Hero Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 p-5 sm:p-6 rounded-3xl bg-white/[0.03] border border-white/10 relative overflow-hidden shadow-2xl backdrop-blur-xl">
          {/* Large Sharp Cover Art (220-260dp on mobile) */}
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-60 md:h-60 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] bg-slate-900 border border-white/15 flex-shrink-0 group">
            {playlist.coverUrl ? (
              <img 
                src={playlist.coverUrl} 
                alt={playlist.title}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/40 to-slate-900 text-purple-400">
                <Music className="w-12 h-12 mb-1 opacity-60" />
                <span className="text-[10px] font-mono text-purple-300">RaagaX Playlist</span>
              </div>
            )}

            <button
              onClick={() => setShowEditMetadataModal(true)}
              className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              title="Change Artwork"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Playlist Info & Metadata */}
          <div className="min-w-0 flex-1 text-center sm:text-left space-y-2 relative z-10">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                {playlist.visibility === 'public' ? 'Public Playlist' : 'Private Playlist'}
              </span>
              {isNative && downloadedSongsInPlaylist.length === playlist.songs.length && playlist.songs.length > 0 && (
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3 stroke-[3]" /> Downloaded
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight break-words">
              {playlist.title}
            </h1>

            {playlist.description && (
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-2 max-w-xl">
                {playlist.description}
              </p>
            )}

            {/* Useful Metadata Summary */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-[var(--text-secondary)] font-medium pt-1">
              <span>{playlist.songs?.length || 0} {playlist.songs?.length === 1 ? 'song' : 'songs'}</span>
              <span>•</span>
              <span>{formattedDuration}</span>
              {isNative && downloadedSongsInPlaylist.length > 0 && (
                <>
                  <span>•</span>
                  <span className="text-emerald-400 font-mono">
                    {downloadedSongsInPlaylist.length} downloaded
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

      {/* Action Toolbar */}
      <div className="space-y-4 pt-1">
        {/* Main Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handlePlay(false)}
            className="h-11 px-6 rounded-full bg-[#fa233b] hover:bg-[#d91e32] active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 transition-all cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-white" />
            Play
          </button>

          <button
            onClick={() => handlePlay(true)}
            className="h-11 px-5 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-white/10 shadow-md transition-all cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Shuffle className="w-4 h-4 text-slate-300" />
            Shuffle
          </button>

          {isUserOwned ? (
            <button
              onClick={() => setShowAddSongsModal(true)}
              className="h-11 px-5 rounded-full bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-white border border-purple-500/30 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Songs
            </button>
          ) : (
            <button
              onClick={handleSaveToLibrary}
              className="h-11 px-5 rounded-full bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-white border border-purple-500/30 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Save to Library
            </button>
          )}
        </div>

        {/* Secondary Toolbar: Sort & Compact Download All (Android Mobile Only) */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
          {!isEditOrderMode ? (
            <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-full text-xs shadow-sm">
              <span className="text-slate-400 font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-[var(--text-primary)] text-xs font-bold outline-none cursor-pointer"
              >
                <option value="newest" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Newest Added</option>
                <option value="oldest" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Oldest Added</option>
                <option value="az" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">A → Z</option>
                <option value="za" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Z → A</option>
                <option value="duration" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Duration</option>
              </select>
            </div>
          ) : (
            <button
              onClick={() => setIsEditOrderMode(false)}
              className="px-4 py-1.5 rounded-full bg-[#fa233b] text-white text-xs font-bold shadow transition-all cursor-pointer"
            >
              Done Reordering
            </button>
          )}

          {/* Compact Download All Button (Android Mobile Only) */}
          {isNative && (
            <button
              onClick={isAllDownloaded ? handleRemoveAllDownloads : handleDownloadAll}
              className={`md:hidden flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                isAllDownloaded
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : isDownloading
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
              }`}
              title={isAllDownloaded ? "All songs downloaded (Click to manage)" : "Download All Songs"}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span className="font-mono">{downloadedSongsInPlaylist.length}/{playlist.songs.length}</span>
                </>
              ) : isAllDownloaded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                  <span className="hidden sm:inline">Downloaded</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{downloadedSongsInPlaylist.length > 0 ? `${downloadedSongsInPlaylist.length}/${playlist.songs.length}` : 'Download All'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tracklist Table / Items */}
      {displaySongs.length > 0 ? (
        <div className="space-y-2 pt-2">
          {displaySongs.map((song, index) => {
            const isDownloaded = downloadedSongIds.includes(song.id);
            const task = tasks[song.id];
            const isDownloading = task && (task.status === 'DOWNLOADING' || task.status === 'QUEUED' || task.status === 'VERIFYING');
            const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
            const isAppOffline = isOfflineMode || isBrowserOffline;
            const isSongOfflineUnavailable = isAppOffline && !isDownloaded;

            return (
              <div
                key={`${song.id}-${index}`}
                className={`p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-white/20 hover:bg-[var(--bg-surface)] transition-all flex items-center justify-between gap-3 group ${
                  isSongOfflineUnavailable ? 'opacity-40 pointer-events-none select-none' : ''
                }`}
              >
                {/* Track Number / Drag handles in edit order mode */}
                <div className="w-8 text-center flex-shrink-0">
                  {isEditOrderMode ? (
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => handleMoveSong(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveSong(index, 'down')}
                        disabled={index === displaySongs.length - 1}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-slate-500 font-bold group-hover:hidden">
                      {index + 1}
                    </span>
                  )}
                  {!isEditOrderMode && (
                    <button
                      onClick={() => playSong(song, playlist.songs, { type: 'playlist', id: playlist.id, title: playlist.title })}
                      className="hidden group-hover:inline-flex p-1 text-[#fa233b] hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                  )}
                </div>

                {/* Cover & Title */}
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => playSong(song, playlist.songs, { type: 'playlist', id: playlist.id, title: playlist.title })}
                >
                  <img
                    src={song.coverUrl || '/app-icon.png'}
                    alt={song.title}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                    className="w-11 h-11 rounded-xl object-cover bg-slate-800 flex-shrink-0 shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] group-hover:text-[#fa233b] transition-colors truncate">
                      {song.title}
                    </h4>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                      {song.artist}
                    </p>
                  </div>
                </div>

                {/* Fixed Download Action Column */}
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <DownloadStatusIndicator
                    song={song}
                    size="sm"
                    showCloudIcon
                    className=""
                  />
                </div>

                {/* Duration */}
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block w-10 text-right flex-shrink-0">
                  {Math.floor((song.duration || 180) / 60)}:{((song.duration || 180) % 60).toString().padStart(2, '0')}
                </span>

                {/* Song 3-dot Menu */}
                <div className="flex-shrink-0">
                  <SongActionMenu 
                    song={song} 
                    playlistId={playlist.id}
                    onRemoveFromPlaylist={() => removeSongFromPlaylist(playlist.id, song.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 rounded-3xl bg-[var(--bg-surface)] border border-dashed border-[var(--border-subtle)] text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto shadow-inner">
            <Music className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">This playlist is empty</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Add your favorite tracks to start listening.</p>
          </div>
          <button
            onClick={() => setShowAddSongsModal(true)}
            className="px-5 py-2.5 rounded-xl bg-[#fa233b] hover:bg-[#d91e32] text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-md shadow-red-500/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Songs to Playlist
          </button>
        </div>
      )}

      {/* Add Songs Searchable Modal */}
      {showAddSongsModal && (
        <AddSongsModal
          isOpen={showAddSongsModal}
          onClose={() => setShowAddSongsModal(false)}
          playlist={playlist}
        />
      )}

      {/* Intelligent Download All Confirmation Modal */}
      {showDownloadConfirmModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setShowDownloadConfirmModal(false)}
        >
          <div 
            className="bg-[#12131A] border border-white/12 rounded-3xl p-6 w-full max-w-md shadow-2xl text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Download className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Download All Songs</h3>
              <p className="text-xs text-slate-300 mt-1">
                {downloadedSongsInPlaylist.length > 0 && (
                  <span className="text-emerald-400 font-bold block mb-1">
                    ✓ {downloadedSongsInPlaylist.length} songs already available offline
                  </span>
                )}
                Download remaining <span className="text-white font-bold">{pendingDownloadsCount} songs</span> in "{playlist.title}" for offline playback?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDownloadConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkDownload}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 cursor-pointer"
              >
                Download {pendingDownloadsCount} Songs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Playlist Details Modal */}
      {showEditMetadataModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => !isSavingMetadata && setShowEditMetadataModal(false)}
        >
          <div 
            className="bg-[#12131A] border border-white/12 rounded-3xl p-6 w-full max-w-md shadow-2xl text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white">Edit Playlist Details</h3>
              <button 
                onClick={() => setShowEditMetadataModal(false)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">Name</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[#08090E] border border-white/15 focus:border-[#fa233b] rounded-2xl px-4 py-2.5 text-white text-xs font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-[#08090E] border border-white/15 focus:border-[#fa233b] rounded-2xl px-4 py-2 text-white text-xs font-medium focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">Artwork Image URL</label>
                <input
                  type="text"
                  value={editCoverUrl}
                  onChange={(e) => setEditCoverUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#08090E] border border-white/15 focus:border-[#fa233b] rounded-2xl px-4 py-2.5 text-white text-xs font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">Visibility</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditVisibility('private')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      editVisibility === 'private' ? 'bg-[#fa233b]/15 border-[#fa233b] text-white' : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    Private
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditVisibility('public')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      editVisibility === 'public' ? 'bg-[#fa233b]/15 border-[#fa233b] text-white' : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    Public
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                onClick={() => setShowEditMetadataModal(false)}
                disabled={isSavingMetadata}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMetadata}
                disabled={!editTitle.trim() || isSavingMetadata}
                className="px-5 py-2.5 rounded-xl bg-[#fa233b] hover:bg-[#d91e32] text-white font-bold text-xs shadow-md shadow-red-500/25 cursor-pointer disabled:opacity-40"
              >
                {isSavingMetadata ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </DynamicArtworkAtmosphere>
  );
}
