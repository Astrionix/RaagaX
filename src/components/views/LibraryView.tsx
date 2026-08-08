'use client';

import React, { useState } from 'react';
import { Heart, Download, Clock, ListMusic, Play, Library, ChevronRight, User, Disc, Sparkles, Music, Link2, ShieldCheck } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function LibraryView() {
  const [tab, setTab] = useState<'liked' | 'downloads' | 'artists' | 'albums' | 'playlists' | 'history'>('liked');
  const {
    queue,
    likedSongIds,
    downloadedSongIds,
    historySongIds,
    favoriteArtistIds,
    favoriteAlbumIds,
    playSong,
    toggleLikeSong,
    toggleImporterModal,
    toggleBackupModal,
  } = usePlayerStore();

  const likedSongs = queue.filter((s) => likedSongIds.includes(s.id));
  const downloadedSongs = queue.filter((s) => downloadedSongIds.includes(s.id));
  const historySongs = queue.filter((s) => historySongIds.includes(s.id));

  const libraryNavItems = [
    { id: 'playlists', label: 'Playlists', icon: ListMusic, count: 4 },
    { id: 'artists', label: 'Artists', icon: User, count: favoriteArtistIds.length },
    { id: 'albums', label: 'Albums', icon: Disc, count: favoriteAlbumIds.length },
    { id: 'liked', label: 'Songs & Favorites', icon: Music, count: likedSongs.length },
    { id: 'history', label: 'Made For You', icon: Sparkles, count: 8 },
    { id: 'downloads', label: 'Downloaded', icon: Download, count: downloadedSongs.length },
    { id: 'history', label: 'Recently Added', icon: Clock, count: historySongs.length },
  ];

  return (
    <div className="space-y-6 pb-6 text-white select-none">
      {/* iOS Library Header */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-3xl font-black text-white tracking-tight">Library</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleImporterModal}
            className="text-xs font-extrabold text-[#EF233C] px-3 py-1.5 rounded-xl bg-[#EF233C]/10 border border-[#EF233C]/30"
          >
            Import
          </button>
          <button
            onClick={toggleBackupModal}
            className="text-xs font-extrabold text-emerald-400 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40"
          >
            Backup
          </button>
        </div>
      </div>

      {/* iOS Red Icon List Items */}
      <div className="divide-y divide-white/5 bg-[#1C1C1E] rounded-2xl border border-white/10 overflow-hidden">
        {libraryNavItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={`${item.id}-${index}`}
              onClick={() => setTab(item.id as any)}
              className="w-full py-3.5 px-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
            >
              <div className="flex items-center gap-3.5">
                <Icon className="w-5 h-5 text-[#EF233C]" />
                <span className="text-sm font-bold text-white">{item.label}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-xs font-semibold">{item.count}</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Recently Played Horizontal Carousel */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-white">Recently Played</h3>
          <span className="text-xs font-bold text-[#EF233C] cursor-pointer">See All</span>
        </div>

        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {(historySongs.length > 0 ? historySongs : queue.slice(0, 6)).map((song) => (
            <div
              key={song.id}
              onClick={() => playSong(song)}
              className="min-w-[120px] max-w-[120px] space-y-2 cursor-pointer group flex-shrink-0"
            >
              <img
                src={song.coverUrl}
                alt={song.title}
                className="w-[120px] h-[120px] rounded-2xl object-cover shadow-md group-hover:scale-105 transition-transform"
              />
              <h4 className="text-xs font-bold text-white truncate leading-tight group-hover:text-[#EF233C]">
                {song.title}
              </h4>
              <p className="text-[10px] text-slate-400 truncate leading-tight">{song.artist}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
