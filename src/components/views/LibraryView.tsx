'use client';

import React, { useState } from 'react';
import { Heart, Download, Clock, ListMusic, Play, ChevronRight, User, Disc, Sparkles, Laptop } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function LibraryView() {
  const [tab, setTab] = useState<'liked' | 'downloads' | 'artists' | 'albums' | 'playlists' | 'history'>('playlists');
  const {
    queue,
    likedSongIds,
    downloadedSongIds,
    historySongIds,
    favoriteArtistIds,
    favoriteAlbumIds,
    playSong,
    toggleImporterModal,
    toggleBackupModal,
    // Cross-device sync state
    isActiveDevice,
    currentSong,
    currentTime,
    duration,
    remoteDeviceName,
    deviceId,
    transferPlayback,
  } = usePlayerStore();

  const likedSongs = queue.filter((s) => likedSongIds.includes(s.id));
  const downloadedSongs = queue.filter((s) => downloadedSongIds.includes(s.id));
  const historySongs = queue.filter((s) => historySongIds.includes(s.id));

  const libraryNavItems = [
    { id: 'playlists', label: 'Playlists', icon: ListMusic, count: 0 },
    { id: 'liked', label: 'Liked Songs', icon: Heart, count: likedSongs.length },
    { id: 'history', label: 'Recently Played', icon: Clock, count: historySongs.length },
    { id: 'artists', label: 'Artists', icon: User, count: favoriteArtistIds.length },
    { id: 'albums', label: 'Albums', icon: Disc, count: favoriteAlbumIds.length },
    { id: 'added', label: 'Recently Added', icon: Sparkles, count: 0 },
    { id: 'downloads', label: 'Downloaded', icon: Download, count: downloadedSongs.length },
  ];

  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

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

      {/* Continue Listening (Cross-device) */}
      {!isActiveDevice && currentSong && remoteDeviceName && (
        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-white">Continue Listening</h3>
          <div 
            onClick={() => transferPlayback(deviceId)}
            className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors group"
          >
            <div className="relative flex-shrink-0">
              <img 
                src={currentSong.coverUrl} 
                alt={currentSong.title} 
                className="w-14 h-14 rounded-xl object-cover shadow-lg group-hover:scale-105 transition-transform" 
              />
              <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-6 h-6 text-white fill-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white truncate">{currentSong.title}</h4>
              <p className="text-xs font-semibold text-slate-400 truncate">{formatTime(currentTime)} / {formatTime(duration)}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                  Playing on {remoteDeviceName}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <span className="text-xs font-semibold">{item.count > 0 ? item.count : ''}</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
