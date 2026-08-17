'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  Play, Heart, Download, Music, ArrowLeft, Shuffle, Trash2, ListPlus, 
  Users, UserPlus, Share2, Copy, Check, Lock, Globe, Sparkles, Plus,
  ArrowUpDown, CheckSquare, Square, X, CheckCheck
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { Song } from '@/types/music';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { usePlaylistStore, UserPlaylist } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { BulkDownloadConfirmModal } from '@/components/modals/BulkDownloadConfirmModal';
import { useAuthStore } from '@/context/useAuthStore';

type SortOption = 'default' | 'title' | 'artist' | 'album' | 'duration' | 'recently_added';

export function PlaylistDetailView() {
  const { 
    selectedPlaylistId, 
    setSelectedPlaylistId, 
    setActiveTab, 
    playSong, 
    playNextSequence,
    setToastMessage,
    setRemoteState,
    likedSongIds, 
    toggleLikeSong, 
    downloadedSongIds, 
  } = usePlayerStore();

  const { user } = useAuthStore();
  const activeUserId = user?.id || 'guest';

  const { 
    playlists, 
    generateInviteLink, 
    clonePlaylistToLibrary,
    removeSongFromPlaylist,
    deletePlaylist
  } = usePlaylistStore();

  const [playlist, setPlaylist] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sorting & Multi-select states
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedPlaylistId) return;
    
    let isMounted = true;
    setIsLoading(true);
    
    const fetchPlaylist = async () => {
      // 1. Check local store first
      const localPl = playlists.find(p => p.id === selectedPlaylistId);
      if (localPl) {
        if (isMounted) {
          setPlaylist({
            ...localPl,
            isUserOwned: localPl.ownerId === activeUserId || localPl.creator === 'You',
          });
          setIsLoading(false);
        }
        return;
      }

      // 2. Check if UUID or remote
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selectedPlaylistId);

      if (isUUID) {
        const { supabase } = await import('@/lib/supabase');
        const { data: plData } = await supabase.from('playlists').select('*').eq('id', selectedPlaylistId).single();
        if (!plData) {
          if (isMounted) { setPlaylist(null); setIsLoading(false); }
          return;
        }

        const { data: mappings } = await supabase
          .from('playlist_songs')
          .select('song_id, position')
          .eq('playlist_id', selectedPlaylistId)
          .order('position', { ascending: true });

        const songIds = (mappings || []).map((m: any) => m.song_id).filter(Boolean);

        let mappedSongs: Song[] = [];
        if (songIds.length > 0) {
          const { SongResolver } = await import('@/lib/discovery/SongResolver');
          mappedSongs = await SongResolver.resolveSongs(songIds);
        }

        if (isMounted) {
          setPlaylist({
            id: plData.id,
            title: plData.name || plData.title || 'Untitled Playlist',
            description: plData.description || '',
            coverUrl: plData.cover_url || mappedSongs[0]?.coverUrl || '/app-icon.png',
            songs: mappedSongs,
            ownerId: plData.owner_id,
            ownerName: plData.owner_name || 'Friend',
            isCollaborative: Boolean(plData.is_collaborative),
            isUserOwned: plData.owner_id === activeUserId,
            collaborators: [
              {
                userId: plData.owner_id,
                name: plData.owner_name || 'Owner',
                role: 'owner',
                joinedAt: Date.now(),
              }
            ]
          });
          setIsLoading(false);
        }
      } else {
        // Fallback for curated editorial playlists
        const { getCuratedPlaylists } = await import('@/constants/playlists');
        const curated = getCuratedPlaylists('Telugu').find(p => p.id === selectedPlaylistId);
        if (curated) {
          const realEngine = RealMusicEngine.getInstance();
          const songs = await realEngine.searchRealSongs(`${curated.name} Telugu`, 25).catch(() => []);
          if (isMounted) {
            setPlaylist({
              id: curated.id,
              title: curated.name,
              description: curated.desc,
              coverUrl: curated.coverUrl,
              songs,
              isUserOwned: false,
              isCollaborative: false,
            });
            setIsLoading(false);
          }
        } else {
          if (isMounted) { setPlaylist(null); setIsLoading(false); }
        }
      }
    };

    fetchPlaylist();
    return () => { isMounted = false; };
  }, [selectedPlaylistId, playlists, activeUserId]);

  // Sorted Songs calculation
  const sortedSongs: Song[] = useMemo(() => {
    if (!playlist?.songs) return [];
    const copy = [...playlist.songs];

    switch (sortBy) {
      case 'title':
        return copy.sort((a, b) => a.title.localeCompare(b.title));
      case 'artist':
        return copy.sort((a, b) => a.artist.localeCompare(b.artist));
      case 'album':
        return copy.sort((a, b) => (a.album || '').localeCompare(b.album || ''));
      case 'duration':
        return copy.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      case 'recently_added':
        return copy.reverse();
      default:
        return copy;
    }
  }, [playlist?.songs, sortBy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-white">
        <div className="w-10 h-10 border-4 border-[#fa233b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center text-white px-4">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-[#EF233C]">
          <Music className="w-8 h-8 opacity-70" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight">Playlist Not Available</h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-sm mt-1 mb-6">
          This playlist is currently unavailable or has been removed.
        </p>
        <button 
          onClick={() => {
            setSelectedPlaylistId(null);
            setActiveTab('home');
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#EF233C] hover:bg-[#ff3b53] text-white rounded-full font-bold text-xs shadow-lg transition-transform active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>
      </div>
    );
  }

  const handlePlayAll = () => {
    if (sortedSongs.length === 0) return;
    setRemoteState({ shuffleMode: 'OFF' });
    playSong(sortedSongs[0], sortedSongs);
  };

  const handleShufflePlay = () => {
    if (sortedSongs.length === 0) return;
    usePlayerStore.getState().shufflePlay(sortedSongs, {
      contextType: 'PLAYLIST',
      contextUri: `raagax:playlist:${playlist.id}`,
      title: playlist.title,
    });
  };

  const handleShareOrInvite = async () => {
    const link = generateInviteLink(playlist.id);
    if (navigator.share) {
      try {
        await navigator.share({
          title: playlist.title,
          text: `Join my collaborative playlist "${playlist.title}" on RaagaX!`,
          url: link,
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setToastMessage('Invite link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setToastMessage(link);
    }
  };

  const handleClonePlaylist = async () => {
    const cloned = await clonePlaylistToLibrary(playlist.id);
    if (cloned) {
      setToastMessage(`Saved a copy of "${playlist.title}" to your Library`);
      setSelectedPlaylistId(cloned.id);
    }
  };

  // Multi-Selection helpers
  const toggleSelectSong = (songId: string) => {
    setSelectedSongIds(prev => 
      prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedSongIds.length === sortedSongs.length) {
      setSelectedSongIds([]);
    } else {
      setSelectedSongIds(sortedSongs.map(s => s.id));
    }
  };

  const getSelectedSongs = () => {
    return sortedSongs.filter(s => selectedSongIds.includes(s.id));
  };

  // Bulk Actions
  const handleBulkDownload = () => {
    const selected = getSelectedSongs();
    if (selected.length === 0) return;
    useDownloadStore.getState().downloadPlaylist(selected);
    setToastMessage(`Queued ${selected.length} songs for offline download`);
    setIsSelectionMode(false);
    setSelectedSongIds([]);
  };

  const handleBulkQueue = () => {
    const selected = getSelectedSongs();
    if (selected.length === 0) return;
    playNextSequence(selected);
    setToastMessage(`Queued ${selected.length} songs to play next`);
    setIsSelectionMode(false);
    setSelectedSongIds([]);
  };

  const handleBulkFavorite = () => {
    const selected = getSelectedSongs();
    selected.forEach(s => {
      if (!likedSongIds.includes(s.id)) {
        toggleLikeSong(s.id);
      }
    });
    setToastMessage(`Added ${selected.length} songs to Liked Songs`);
    setIsSelectionMode(false);
    setSelectedSongIds([]);
  };

  const handleBulkRemove = async () => {
    if (!playlist.isUserOwned) return;
    const confirm = window.confirm(`Remove ${selectedSongIds.length} songs from "${playlist.title}"?`);
    if (confirm) {
      for (const songId of selectedSongIds) {
        await removeSongFromPlaylist(playlist.id, songId);
      }
      setToastMessage(`Removed ${selectedSongIds.length} songs`);
      setIsSelectionMode(false);
      setSelectedSongIds([]);
    }
  };

  return (
    <div className="space-y-8 pb-24 md:pb-12 text-white select-none relative">
      {/* Back Button */}
      <button
        onClick={() => {
          setSelectedPlaylistId(null);
          setActiveTab('home');
        }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </button>

      {/* Playlist Hero Banner */}
      <section className="relative rounded-3xl bg-gradient-to-r from-slate-900 via-[#1a1423] to-slate-950 p-6 sm:p-8 overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-6 z-10 text-center md:text-left">
          <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-2xl border border-white/20 flex-shrink-0 bg-black/50">
            <img 
              src={playlist.coverUrl || '/app-icon.png'} 
              alt={playlist.title} 
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
              className="w-full h-full object-cover" 
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-800/40 text-[10px] font-bold uppercase text-emerald-400">
                Playlist
              </span>

              {playlist.isCollaborative && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-[10px] font-bold uppercase text-purple-300">
                  <Users className="w-3 h-3" /> Collaborative
                </span>
              )}

              {playlist.visibility === 'public' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-[10px] font-bold uppercase text-blue-300">
                  <Globe className="w-3 h-3" /> Public
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-500/20 border border-slate-500/40 text-[10px] font-bold uppercase text-slate-300">
                  <Lock className="w-3 h-3" /> Private
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">{playlist.title}</h1>
            
            <p className="text-xs text-slate-300 font-medium">
              <Music className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
              {playlist.songs?.length || 0} Tracks • By {playlist.creator || playlist.ownerName || 'You'}
            </p>

            {/* Collaborators Avatar Stack */}
            {playlist.collaborators && playlist.collaborators.length > 0 && (
              <div className="flex items-center justify-center md:justify-start gap-2 pt-1">
                <div className="flex -space-x-2">
                  {playlist.collaborators.map((c: any, i: number) => (
                    <div
                      key={c.userId || i}
                      title={`${c.name} (${c.role})`}
                      className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#FA233B] to-purple-600 border-2 border-slate-900 flex items-center justify-center text-[10px] font-black text-white"
                    >
                      {c.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  ))}
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {playlist.collaborators.length} collaborator{playlist.collaborators.length > 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-3">
              <button
                onClick={handlePlayAll}
                className="px-5 py-2.5 rounded-full bg-[#EF233C] text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-transform shadow-lg shadow-red-500/30 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" /> Play
              </button>

              <button
                onClick={() => {
                  if (playlist && playlist.songs?.length > 0) {
                    playNextSequence(sortedSongs);
                    setToastMessage(`Queued ${sortedSongs.length} songs from "${playlist.title}" to play next`);
                  }
                }}
                className="px-4 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all hover:scale-105 cursor-pointer"
              >
                <ListPlus className="w-3.5 h-3.5 text-slate-300" /> Play Next
              </button>

              <button
                onClick={handleShufflePlay}
                className="px-4 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all hover:scale-105 cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5 text-slate-300" /> Shuffle
              </button>

              <button
                onClick={() => setShowDownloadModal(true)}
                className="px-4 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all hover:scale-105 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-300" /> Download
              </button>

              {/* Share / Invite Collaborators */}
              <button
                onClick={handleShareOrInvite}
                className="px-4 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition-all hover:scale-105 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Invite'}</span>
              </button>

              {/* Clone to Library if shared */}
              {!playlist.isUserOwned && (
                <button
                  onClick={handleClonePlaylist}
                  className="px-4 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all hover:scale-105 cursor-pointer"
                  title="Copy this playlist into your personal library"
                >
                  <Copy className="w-3.5 h-3.5" /> Save to Library
                </button>
              )}

              {playlist.isUserOwned && (
                <button
                  onClick={async () => {
                    const confirm = window.confirm("Are you sure you want to delete this playlist?");
                    if (confirm) {
                      await deletePlaylist(playlist.id);
                      setActiveTab('home');
                      setSelectedPlaylistId(null);
                    }
                  }}
                  className="px-4 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all hover:scale-105 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Playlist Songs Table Header with Sort & Select Controls */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Tracks</h3>
            <span className="text-xs text-slate-400 font-mono">{sortedSongs.length} songs</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
              >
                <option value="default" className="bg-[#12131a]">Default Order</option>
                <option value="title" className="bg-[#12131a]">Title (A-Z)</option>
                <option value="artist" className="bg-[#12131a]">Artist</option>
                <option value="album" className="bg-[#12131a]">Album</option>
                <option value="duration" className="bg-[#12131a]">Duration</option>
                <option value="recently_added" className="bg-[#12131a]">Recently Added</option>
              </select>
            </div>

            {/* Multi-Select Toggle */}
            <button
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                setSelectedSongIds([]);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelectionMode 
                  ? 'bg-[#FA233B] text-white shadow' 
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
              }`}
            >
              {isSelectionMode ? <X className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
              <span>{isSelectionMode ? 'Cancel' : 'Select'}</span>
            </button>
          </div>
        </div>

        {/* Multi-Select Bulk Actions Bar */}
        {isSelectionMode && (
          <div className="p-3 rounded-2xl bg-white/[0.06] border border-white/15 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shadow-xl animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="text-xs font-bold text-white hover:text-[#FA233B] flex items-center gap-1.5 cursor-pointer"
              >
                {selectedSongIds.length === sortedSongs.length ? (
                  <CheckSquare className="w-4 h-4 text-[#FA233B]" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Select All</span>
              </button>
              <span className="text-xs text-slate-400 font-mono">
                {selectedSongIds.length} of {sortedSongs.length} selected
              </span>
            </div>

            {selectedSongIds.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkDownload}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                  title="Download selected"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>

                <button
                  onClick={handleBulkQueue}
                  className="px-3 py-1.5 rounded-xl bg-white/10 text-white border border-white/15 text-xs font-bold flex items-center gap-1.5 hover:bg-white/20 transition-colors cursor-pointer"
                  title="Queue selected"
                >
                  <ListPlus className="w-3.5 h-3.5" /> Play Next
                </button>

                <button
                  onClick={handleBulkFavorite}
                  className="px-3 py-1.5 rounded-xl bg-[#FA233B]/20 text-[#FA233B] border border-[#FA233B]/30 text-xs font-bold flex items-center gap-1.5 hover:bg-[#FA233B]/30 transition-colors cursor-pointer"
                  title="Favorite selected"
                >
                  <Heart className="w-3.5 h-3.5" /> Like
                </button>

                {playlist.isUserOwned && (
                  <button
                    onClick={handleBulkRemove}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 hover:bg-rose-500/30 transition-colors cursor-pointer"
                    title="Remove selected from playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tracks List */}
        {sortedSongs.length > 0 ? (
          <div className="space-y-1.5">
            {sortedSongs.map((song: Song, index: number) => {
              const isSongLiked = likedSongIds.includes(song.id);
              const isSongDownloaded = downloadedSongIds.includes(song.id);
              const isSelected = selectedSongIds.includes(song.id);

              return (
                <div
                  key={song.id || index}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleSelectSong(song.id);
                    } else {
                      playSong(song, sortedSongs);
                    }
                  }}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3.5 group cursor-pointer ${
                    isSelected
                      ? 'bg-[#FA233B]/10 border-[#FA233B]/40 shadow-sm'
                      : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {isSelectionMode ? (
                      <div className="w-5 flex items-center justify-center flex-shrink-0">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#FA233B]" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                    ) : (
                      <>
                        <span className="w-5 text-center text-xs text-slate-500 font-mono font-bold flex-shrink-0 group-hover:hidden">
                          {index + 1}
                        </span>
                        <button className="w-5 text-center text-[#FA233B] hidden group-hover:flex items-center justify-center flex-shrink-0">
                          <Play className="w-3.5 h-3.5 fill-[#FA233B]" />
                        </button>
                      </>
                    )}

                    <img
                      src={song.coverUrl || '/app-icon.png'}
                      alt={song.title}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                      className="w-10 h-10 rounded-xl object-cover shadow flex-shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isSongDownloaded && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase">
                        Offline
                      </span>
                    )}

                    {!isSelectionMode && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLikeSong(song.id);
                          }}
                          className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors"
                          title={isSongLiked ? "Remove from Liked" : "Add to Liked"}
                        >
                          <Heart className={`w-4 h-4 ${isSongLiked ? 'fill-[#FA233B] text-[#FA233B]' : ''}`} />
                        </button>

                        {playlist.isUserOwned && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await removeSongFromPlaylist(playlist.id, song.id);
                              setToastMessage(`Removed "${song.title}" from playlist`);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-rose-400 rounded-lg transition-opacity"
                            title="Remove track"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <SongActionMenu song={song} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 rounded-3xl bg-white/[0.02] border border-white/5">
            <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-bold text-slate-300">Playlist is empty</p>
            <p className="text-[11px] text-slate-500 mt-1">Add tracks from search or your library</p>
          </div>
        )}
      </section>

      {/* Bulk Download Modal */}
      {showDownloadModal && (
        <BulkDownloadConfirmModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          songs={playlist.songs || []}
          title={playlist.title || 'Playlist'}
          subtitle={`${playlist.songs?.length || 0} tracks • By ${playlist.creator || playlist.ownerName || 'You'}`}
          coverUrl={playlist.coverUrl || '/app-icon.png'}
        />
      )}
    </div>
  );
}
