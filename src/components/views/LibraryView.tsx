'use client';

import React, { useState } from 'react';
import { Heart, Download, Clock, ListMusic, Play, ChevronRight, User, Disc, Sparkles, Laptop, ChevronLeft, Music, Library } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { Song } from '@/types/music';

export function LibraryView() {
  const [tab, setTab] = useState<string>('menu');
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

  const renderSongList = (songs: Song[]) => {
    if (songs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Music className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm font-semibold">No songs found here yet.</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {songs.map((song) => (
          <div
            key={song.id}
            className="p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0" onClick={() => playSong(song, songs)}>
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
        ))}
      </div>
    );
  };

  if (tab !== 'menu') {
    const activeItem = libraryNavItems.find(i => i.id === tab);
    let content: React.ReactNode = null;
    switch (tab) {
      case 'liked': content = renderSongList(likedSongs); break;
      case 'history': content = renderSongList(historySongs); break;
      case 'downloads': content = renderSongList(downloadedSongs); break;
      default: content = (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Library className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm font-semibold">This section is coming soon!</p>
        </div>
      );
    }

    return (
      <div className="space-y-6 pb-6 text-white select-none">
        <div className="flex items-center gap-3 pt-1">
          <button 
            onClick={() => setTab('menu')} 
            className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-black text-white tracking-tight">{activeItem?.label}</h1>
        </div>
        {content}
      </div>
    );
  }

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
              onClick={() => setTab(item.id)}
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
