'use client';

import React, { useEffect, useState } from 'react';
import { Play, Heart, Download, Music, ArrowLeft, Shuffle, Trash2 } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { Song } from '@/types/music';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { BulkDownloadConfirmModal } from '@/components/modals/BulkDownloadConfirmModal';

export function PlaylistDetailView() {
  const { 
    selectedPlaylistId, 
    setSelectedPlaylistId, 
    setActiveTab, 
    playSong, 
    setRemoteState,
    likedSongIds, 
    toggleLikeSong, 
    downloadedSongIds, 
    toggleDownloadSong
  } = usePlayerStore();

  const [playlist, setPlaylist] = useState<{ id: string; title: string; coverUrl: string; songs: Song[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  useEffect(() => {
    if (!selectedPlaylistId) return;
    
    let isMounted = true;
    setIsLoading(true);
    
    const fetchPlaylist = async () => {
      // Check if it's a UUID (User Playlist)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selectedPlaylistId);

      if (isUUID) {
        const { supabase } = await import('@/lib/supabase');
        
        // Fetch playlist details
        const { data: plData } = await supabase.from('playlists').select('*').eq('id', selectedPlaylistId).single();
        if (!plData) {
          if (isMounted) { setPlaylist(null); setIsLoading(false); }
          return;
        }

        // Fetch songs with resilient join & store fallback
        const { data: mappings } = await supabase
          .from('playlist_songs')
          .select('song_id, position')
          .eq('playlist_id', selectedPlaylistId)
          .order('position', { ascending: true });

        const songIds = (mappings || []).map((m: any) => m.song_id).filter(Boolean);

        // Check local store songs first to provide instantaneous updates
        const localStorePlaylists = usePlaylistStore.getState().playlists;
        const currentPlInStore = localStorePlaylists.find(p => p.id === selectedPlaylistId);
        const storeSongsMap = new Map((currentPlInStore?.songs || []).map(s => [s.id, s]));

        let mappedSongs: Song[] = [];
        if (songIds.length > 0) {
          const { SongResolver } = await import('@/lib/discovery/SongResolver');
          const resolved = await SongResolver.resolveSongs(songIds);
          const resolvedMap = new Map(resolved.map(s => [s.id, s]));

          mappedSongs = songIds.map(id => {
            if (resolvedMap.has(id)) return resolvedMap.get(id)!;
            if (storeSongsMap.has(id)) return storeSongsMap.get(id)!;
            return {
              id,
              title: 'Track ' + id.slice(0, 6),
              artist: 'RaagaX Artist',
              album: '',
              duration: 210,
              coverUrl: '/app-icon.png',
              audioUrl: '',
              genre: 'Telugu',
              category: 'latest_telugu',
              releaseYear: 2026,
              plays: 0,
              likes: 0
            } as Song;
          });
        } else if (currentPlInStore && currentPlInStore.songs && currentPlInStore.songs.length > 0) {
          mappedSongs = currentPlInStore.songs;
        }

        if (isMounted) {
          setPlaylist({
            id: plData.id,
            title: plData.name || plData.title || 'Untitled Playlist',
            description: plData.description || '',
            coverUrl: plData.cover_url || mappedSongs[0]?.coverUrl || '/app-icon.png',
            songs: mappedSongs,
            isUserOwned: true,
            ownerId: plData.owner_id
          } as any);
          setIsLoading(false);
        }
      } else if (selectedPlaylistId.startsWith('album:')) {
        // Direct Album Loader — never routes to /api/playlist/details
        try {
          const albumData = await RealMusicEngine.getInstance().getPlaylistDetails(selectedPlaylistId);
          if (albumData && isMounted) {
            setPlaylist(albumData);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Failed to load album:', e);
        }
        if (isMounted) setIsLoading(false);
      } else {
        const prefLang = usePlayerStore.getState().preferredLanguage || 'Telugu';
        try {
          const res = await fetch(`/api/playlist/details?playlistId=${encodeURIComponent(selectedPlaylistId)}&lang=${encodeURIComponent(prefLang)}`);
          const json = await res.json();
          if (json && json.success && json.playlist && isMounted) {
            setPlaylist(json.playlist);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Playlist detail endpoint fallback:', e);
        }

        // JioSaavn / Engine Fallback
        RealMusicEngine.getInstance().getPlaylistDetails(selectedPlaylistId)
          .then((data) => {
            if (isMounted) {
              setPlaylist(data);
              setIsLoading(false);
            }
          });
      }
    };

    fetchPlaylist();
      
    return () => { isMounted = false; };
  }, [selectedPlaylistId, usePlaylistStore(state => state.playlists)]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-white">
        <div className="w-10 h-10 border-4 border-[#fa233b] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="text-center text-white mt-20">
        <h2 className="text-2xl font-bold">Playlist Not Found</h2>
        <button 
          onClick={() => setActiveTab('home')}
          className="mt-4 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20"
        >
          Go Home
        </button>
      </div>
    );
  }

  const handlePlayAll = () => {
    if (playlist.songs.length === 0) return;
    setRemoteState({ shuffleMode: 'OFF' });
    playSong(playlist.songs[0], playlist.songs);
  };

  const handleShufflePlay = () => {
    if (playlist.songs.length === 0) return;
    usePlayerStore.getState().shufflePlay(playlist.songs, {
      contextType: 'PLAYLIST',
      contextUri: `raagax:playlist:${playlist.id}`,
      title: playlist.title,
    });
  };

  return (
    <div className="space-y-8 pb-6 text-white select-none">
      {/* Back Button */}
      <button
        onClick={() => {
          setSelectedPlaylistId(null);
          setActiveTab('home');
        }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-300 hover:text-white transition-all"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </button>

      {/* Playlist Hero Banner */}
      <section className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-[#1a1423] to-slate-950 p-6 sm:p-10 overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-6 z-10 text-center md:text-left">
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-xl overflow-hidden shadow-2xl border border-white/20 flex-shrink-0">
            <img src={playlist.coverUrl} alt={playlist.title} className="w-full h-full object-cover" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-800/40 text-[10px] font-bold uppercase text-emerald-400">
              Playlist
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">{playlist.title}</h1>
            <p className="text-xs text-slate-300 font-medium">
              <Music className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
              {playlist.songs.length} Tracks • Curated by RaagaX
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-4">
              <button
                onClick={handlePlayAll}
                className="px-6 py-2.5 rounded-full bg-[#EF233C] text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-transform shadow-lg shadow-red-500/30"
              >
                <Play className="w-4 h-4 fill-white" /> Play
              </button>
              <button
                onClick={handleShufflePlay}
                className="px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all hover:scale-105"
              >
                <Shuffle className="w-3.5 h-3.5 text-slate-300" /> Shuffle
              </button>
              <button
                onClick={() => setShowDownloadModal(true)}
                className="px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all hover:scale-105"
              >
                <Download className="w-3.5 h-3.5 text-slate-300" /> Download
              </button>
              {(playlist as any).isUserOwned && (
                <button
                  onClick={async () => {
                    const confirm = window.confirm("Are you sure you want to delete this playlist?");
                    if (confirm) {
                      const store = (await import('@/context/usePlaylistStore')).usePlaylistStore.getState();
                      await store.deletePlaylist(playlist.id);
                      setActiveTab('home');
                      setSelectedPlaylistId(null);
                    }
                  }}
                  className="px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all hover:scale-105 ml-auto md:ml-4"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Download Playlist Modal */}
      {playlist && showDownloadModal && (
        <BulkDownloadConfirmModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          title={playlist.title}
          subtitle={`${playlist.songs.length} songs`}
          coverUrl={playlist.coverUrl}
          songs={playlist.songs}
        />
      )}


      {/* Song List */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {playlist.songs.map((song) => {
            const isLiked = likedSongIds.includes(song.id);
            const isDownloaded = downloadedSongIds.includes(song.id);

            return (
              <div
                key={song.id}
                className="p-3.5 rounded-2xl surface-card surface-card-hover flex items-center justify-between group"
              >
                <div className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0" onClick={() => playSong(song, playlist.songs)}>
                  <img src={song.coverUrl} alt={song.title} className="w-12 h-12 rounded-xl object-cover shadow-sm flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white group-hover:text-[#EF233C] transition-colors truncate">
                      {song.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">{song.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <SongActionMenu song={song} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

