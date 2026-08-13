'use client';

import React, { useState, useEffect } from 'react';
import { Heart, Play, User, Music, Shuffle } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { Song } from '@/types/music';

export function FavoritesView() {
  const [activeSubTab, setActiveSubTab] = useState<'songs' | 'artists'>('songs');
  const {
    queue,
    likedSongIds,
    favoriteArtistIds,
    playSong,
    toggleLikeSong,
    setSelectedArtistId,
  } = usePlayerStore();

  const [offlineTracks, setOfflineTracks] = useState<Song[]>([]);

  useEffect(() => {
    OfflineCatalog.getInstance().getAllTracks().then((tracks) => {
      if (tracks && tracks.length > 0) {
        const mapped: Song[] = tracks.map((t) => ({
          id: t.trackId,
          title: t.title,
          artist: t.artist,
          album: t.album || 'Downloaded',
          coverUrl: t.artworkUrl || '/app-icon.png',
          duration: t.duration || Math.round(t.durationMs / 1000),
          audioUrl: '',
          artistId: 'offline',
          albumId: 'offline',
          genre: 'Various',
          category: 'global_trending',
          year: new Date(t.downloadedAt).getFullYear().toString(),
          releaseYear: new Date(t.downloadedAt).getFullYear(),
          plays: 0,
          likes: 0,
          quality: 'HIGH',
          language: 'Mixed',
        }));
        setOfflineTracks(mapped);
      }
    });
  }, [likedSongIds.length]);

  // Combine queue and offline tracks to resolve full liked songs list
  const songMap = new Map<string, Song>();
  queue.forEach((s) => { if (s?.id) songMap.set(s.id, s); });
  offlineTracks.forEach((s) => { if (s?.id) songMap.set(s.id, s); });

  const resolvedLikedSongs = likedSongIds
    .map((id) => songMap.get(id))
    .filter((s): s is Song => Boolean(s));

  const favoriteArtists = POPULAR_ARTISTS.filter((a) => favoriteArtistIds.includes(a.id));

  const handlePlayAll = (shuffle = false) => {
    if (resolvedLikedSongs.length === 0) return;
    const tracklist = shuffle ? [...resolvedLikedSongs].sort(() => Math.random() - 0.5) : resolvedLikedSongs;
    playSong(tracklist[0], tracklist);
  };

  return (
    <div className="space-y-6 pb-8 text-white select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3.5 pt-1">
        <div className="w-12 h-12 rounded-2xl bg-[#F51B3D]/15 border border-[#F51B3D]/30 flex items-center justify-center text-[#F51B3D] shadow-lg shadow-[#F51B3D]/10">
          <Heart className="w-6 h-6 fill-current" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Your Favorites</h1>
          <p className="text-xs text-[#8E92A4] mt-0.5">{likedSongIds.length} Liked Songs in your Cloud Library</p>
        </div>
      </div>

      {/* Sub Tabs and Play Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          {[
            { id: 'songs', label: `Songs (${likedSongIds.length})`, icon: Music },
            { id: 'artists', label: `Artists (${favoriteArtists.length})`, icon: User },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveSubTab(t.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#F51B3D] text-white shadow-md shadow-[#F51B3D]/25'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {activeSubTab === 'songs' && resolvedLikedSongs.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePlayAll(false)}
              className="px-4 py-2 rounded-xl bg-[#F51B3D] hover:bg-[#D91533] text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#F51B3D]/25 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Play All</span>
            </button>
            <button
              onClick={() => handlePlayAll(true)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-white/10"
            >
              <Shuffle className="w-3.5 h-3.5 text-slate-300" />
              <span>Shuffle</span>
            </button>
          </div>
        )}
      </div>

      {/* Content View */}
      {activeSubTab === 'songs' && (
        <div className="space-y-3">
          {resolvedLikedSongs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {resolvedLikedSongs.map((song, idx) => (
                <div
                  key={`${song.id}-${idx}`}
                  className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all flex items-center justify-between group"
                >
                  <div
                    className="flex items-center gap-3.5 cursor-pointer min-w-0 flex-1"
                    onClick={() => playSong(song, resolvedLikedSongs)}
                  >
                    <img
                      src={song.coverUrl || '/app-icon.png'}
                      alt={song.title}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                      }}
                      className="w-11 h-11 rounded-xl object-cover shadow-sm flex-shrink-0 bg-slate-800"
                    />
                    <div className="min-w-0 flex-1 pr-2">
                      <h4 className="text-xs font-bold text-white group-hover:text-[#F51B3D] transition-colors truncate">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-[#8E92A4] truncate mt-0.5">{song.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <button
                      onClick={() => toggleLikeSong(song.id)}
                      aria-label="Unlike song"
                      className="p-2 text-[#F51B3D] hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </button>
                    <SongActionMenu song={song} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500 space-y-2 bg-white/[0.02] rounded-2xl border border-white/5">
              <Heart className="w-8 h-8 text-[#8E92A4] mx-auto opacity-50" />
              <p className="text-xs font-bold text-white">No liked songs yet.</p>
              <p className="text-[11px] text-[#8E92A4]">Tap the heart icon on any track to save it here.</p>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'artists' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {(favoriteArtists.length > 0 ? favoriteArtists : POPULAR_ARTISTS.slice(0, 6)).map((artist) => (
            <div
              key={artist.id}
              onClick={() => setSelectedArtistId(artist.id)}
              className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/5 text-center space-y-2.5 cursor-pointer group transition-all"
            >
              <img
                src={artist.image}
                alt={artist.name}
                className="w-18 h-18 rounded-full mx-auto object-cover shadow-md group-hover:scale-105 transition-transform bg-slate-800"
              />
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-[#F51B3D] transition-colors truncate">
                  {artist.name}
                </h4>
                <p className="text-[10px] text-[#8E92A4] mt-0.5 truncate">{artist.genres.join(' • ')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
