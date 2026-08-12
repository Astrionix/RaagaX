'use client';

import React, { useState } from 'react';
import { Heart, Play, User, Disc, Music, Radio } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';

export function FavoritesView() {
  const [activeSubTab, setActiveSubTab] = useState<'songs' | 'artists' | 'albums'>('songs');
  const { queue, likedSongIds, likedSongs = [], favoriteArtistIds, favoriteAlbumIds, playSong, toggleLikeSong, setSelectedArtistId } = usePlayerStore();

  const favoriteArtists = POPULAR_ARTISTS.filter((a) => favoriteArtistIds.includes(a.id));

  return (
    <div className="space-y-6 pb-8 text-white select-none">
      <div className="flex items-center gap-3 pt-1">
        <div className="w-10 h-10 rounded-2xl bg-[#EF233C]/20 border border-[#EF233C]/40 flex items-center justify-center text-[#EF233C]">
          <Heart className="w-5 h-5 fill-current" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Your Favorites</h1>
          <p className="text-xs text-slate-400 font-semibold">{likedSongs.length} Liked Songs</p>
        </div>
      </div>

      {/* Sub Tabs and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'songs', label: `Songs (${likedSongs.length})`, icon: Music },
            { id: 'artists', label: `Artists (${favoriteArtists.length})`, icon: User },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveSubTab(t.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                  isActive ? 'bg-[#EF233C] text-white shadow-lg shadow-red-500/20' : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {activeSubTab === 'songs' && likedSongs.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                usePlayerStore.getState().setRemoteState({ shuffleMode: 'OFF' });
                playSong(likedSongs[0], likedSongs);
              }}
              className="px-4 py-2 rounded-xl bg-[#fa233b] hover:bg-[#d91e32] text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Play All</span>
            </button>
            <button
              onClick={() => {
                usePlayerStore.getState().shufflePlay(likedSongs, {
                  contextType: 'PLAYLIST',
                  contextUri: 'raagax:playlist:favorites',
                  title: 'Liked Songs',
                });
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-white/10"
            >
              <Radio className="w-3.5 h-3.5 text-slate-300" />
              <span>Shuffle</span>
            </button>
          </div>
        )}
      </div>

      {/* Content View */}
      {activeSubTab === 'songs' && (
        <div className="space-y-3">
          {likedSongs.length > 0 ? (
            <div className="divide-y divide-white/5 bg-[#161618] rounded-2xl border border-white/10 overflow-hidden">
              {likedSongs.map((song) => (
                <div key={song.id} className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3.5 cursor-pointer min-w-0" onClick={() => playSong(song, likedSongs)}>
                    <img src={song.coverUrl} alt={song.title} className="w-12 h-12 rounded-xl object-cover shadow-sm flex-shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{song.title}</h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => toggleLikeSong(song.id)}>
                      <Heart className="w-4 h-4 text-[#EF233C] fill-[#EF233C]" />
                    </button>
                    <button
                      onClick={() => playSong(song, likedSongs)}
                      className="p-2 rounded-xl bg-[#EF233C] text-white shadow-md hover:scale-105 transition-transform"
                    >
                      <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 space-y-2 bg-[#161618] rounded-2xl border border-white/10">
              <Heart className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-bold">No liked songs yet. Tap the heart on any track!</p>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'artists' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {(favoriteArtists.length > 0 ? favoriteArtists : POPULAR_ARTISTS.slice(0, 6)).map((artist) => (
            <div
              key={artist.id}
              onClick={() => setSelectedArtistId(artist.id)}
              className="p-4 rounded-2xl bg-[#161618] border border-white/10 text-center space-y-3 cursor-pointer group hover:scale-102 transition-all"
            >
              <img src={artist.image} alt={artist.name} className="w-20 h-20 rounded-full mx-auto object-cover shadow-md group-hover:scale-105 transition-transform" />
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-[#EF233C]">{artist.name}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">{artist.genres.join(' • ')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

