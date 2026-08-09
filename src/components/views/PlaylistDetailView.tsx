'use client';

import React, { useEffect, useState } from 'react';
import { Play, Heart, Download, Music, ArrowLeft, Shuffle } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { Song } from '@/types/music';

export function PlaylistDetailView() {
  const { 
    selectedPlaylistId, 
    setSelectedPlaylistId, 
    setActiveTab, 
    playSong, 
    setQueue,
    setRemoteState,
    likedSongIds, 
    toggleLikeSong, 
    downloadedSongIds, 
    toggleDownloadSong
  } = usePlayerStore();

  const [playlist, setPlaylist] = useState<{ id: string; title: string; coverUrl: string; songs: Song[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!selectedPlaylistId) return;
    
    let isMounted = true;
    setIsLoading(true);
    
    RealMusicEngine.getInstance().getPlaylistDetails(selectedPlaylistId)
      .then((data) => {
        if (isMounted) {
          setPlaylist(data);
          setIsLoading(false);
        }
      });
      
    return () => { isMounted = false; };
  }, [selectedPlaylistId]);

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
    setRemoteState({ isShuffle: false });
    playSong(playlist.songs[0], playlist.songs);
  };

  const handleShufflePlay = () => {
    if (playlist.songs.length === 0) return;
    setRemoteState({ isShuffle: true });
    const randomIndex = Math.floor(Math.random() * playlist.songs.length);
    playSong(playlist.songs[randomIndex], playlist.songs);
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

            <div className="flex items-center justify-center md:justify-start gap-3 pt-4">
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
            </div>
          </div>
        </div>
      </section>

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
                  <button onClick={() => toggleLikeSong(song.id)} title="Like Song">
                    <Heart className={`w-4 h-4 ${isLiked ? 'text-[#EF233C] fill-[#EF233C]' : 'text-slate-400 hover:text-[#EF233C]'}`} />
                  </button>
                  <button onClick={() => toggleDownloadSong(song.id)} title="Download Offline">
                    <Download className={`w-4 h-4 ${isDownloaded ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`} />
                  </button>
                  <button
                    onClick={() => playSong(song, playlist.songs)}
                    className="p-2 rounded-xl bg-[#EF233C] text-white shadow-md hover:scale-105 transition-transform"
                  >
                    <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
