'use client';

import React, { useState, useEffect } from 'react';
import { 
  Heart, Download, Clock, ListMusic, Play, ChevronRight, 
  User, Disc, Sparkles, Laptop, ChevronLeft, Music, Library, Shuffle 
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { LocalDatabase } from '@/lib/offline/LocalDatabase';
import { useAuthStore } from '@/context/useAuthStore';
import { Song } from '@/types/music';

export function LibraryView() {
  const [tab, setTab] = useState<string>('menu');
  const [offlineTrackList, setOfflineTrackList] = useState<Song[]>([]);
  const { user } = useAuthStore();

  const {
    queue,
    likedSongIds,
    likedSongs: storeLikedSongs = [],
    cloudDownloadRecords = [],
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

  const [resolvedSongsMap, setResolvedSongsMap] = useState<Record<string, Song>>({});

  useEffect(() => {
    // Load offline tracks from catalog
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
          language: 'Mixed'
        }));
        setOfflineTrackList(mapped);
      }
    });
  }, [downloadedSongIds.length]);

  // Combine queue songs, store liked songs, offline tracks, resolved map, and cloud records into known map
  const knownSongsMap = new Map<string, Song>();
  storeLikedSongs.forEach((s) => { if (s?.id) knownSongsMap.set(s.id, s); });
  queue.forEach((s) => { if (s?.id) knownSongsMap.set(s.id, s); });
  offlineTrackList.forEach((s) => { if (s?.id) knownSongsMap.set(s.id, s); });
  Object.values(resolvedSongsMap).forEach((s) => { if (s?.id) knownSongsMap.set(s.id, s); });
  cloudDownloadRecords.forEach((r) => {
    if (r?.song_id && !knownSongsMap.has(r.song_id)) {
      knownSongsMap.set(r.song_id, {
        id: r.song_id,
        title: r.song_title || 'Unknown Title',
        artist: r.song_artist || 'Unknown Artist',
        artistId: `art-${r.song_id}`,
        album: 'Liked Songs',
        albumId: `alb-${r.song_id}`,
        coverUrl: r.song_cover || '/app-icon.png',
        duration: r.song_duration || 180,
        audioUrl: '',
        genre: 'Various',
        category: 'global_trending',
        releaseYear: new Date().getFullYear(),
        plays: 0,
        likes: 1,
      });
    }
  });

  // Automatically fetch metadata for any liked song IDs not yet in memory
  useEffect(() => {
    if (likedSongIds.length === 0) return;
    const missingIds = likedSongIds.filter((id) => !knownSongsMap.has(id));
    if (missingIds.length === 0) return;

    import('@/lib/discovery/SongResolver').then(({ SongResolver }) => {
      SongResolver.resolveSongs(missingIds).then((resolved) => {
        if (resolved && resolved.length > 0) {
          setResolvedSongsMap((prev) => {
            const updated = { ...prev };
            resolved.forEach((song) => {
              if (song?.id) updated[song.id] = song;
            });
            return updated;
          });
        }
      }).catch((e) => console.warn('[LibraryView] SongResolver error:', e));
    });
  }, [likedSongIds]);

  const likedSongs = likedSongIds
    .map((id) => knownSongsMap.get(id) || {
      id,
      title: 'Liked Track',
      artist: 'Unknown Artist',
      album: 'Liked Songs',
      coverUrl: '/app-icon.png',
      duration: 210,
      audioUrl: '',
      artistId: 'unknown',
      albumId: 'unknown',
      genre: 'Various',
      category: 'global_trending' as const,
      releaseYear: new Date().getFullYear(),
      plays: 0,
      likes: 1
    });

  const downloadedSongs = downloadedSongIds
    .map((id) => knownSongsMap.get(id))
    .filter((s): s is Song => Boolean(s));

  const historySongs = historySongIds
    .map((id) => knownSongsMap.get(id))
    .filter((s): s is Song => Boolean(s));

  const libraryNavItems = [
    { id: 'liked', label: 'Liked Songs', icon: Heart, count: likedSongIds.length, color: 'text-[#F51B3D]', bg: 'bg-[#F51B3D]/10' },
    { id: 'downloads', label: 'Downloaded', icon: Download, count: downloadedSongIds.length, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'playlists', label: 'Playlists', icon: ListMusic, count: 0, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { id: 'history', label: 'Recently Played', icon: Clock, count: historySongIds.length, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { id: 'artists', label: 'Artists', icon: User, count: favoriteArtistIds.length, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'albums', label: 'Albums', icon: Disc, count: favoriteAlbumIds.length, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ];

  const handlePlayAll = (songs: Song[], shuffle = false) => {
    if (songs.length === 0) return;
    const tracklist = shuffle ? [...songs].sort(() => Math.random() - 0.5) : songs;
    playSong(tracklist[0], tracklist);
  };

  const renderSongList = (songs: Song[], title: string) => {
    if (songs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-[#8E92A4]">
          <Music className="w-12 h-12 mb-4 opacity-40 text-slate-500" />
          <p className="text-sm font-semibold text-white">No songs found in {title} yet.</p>
          <p className="text-xs text-[#8E92A4] mt-1">Songs added or liked will appear here.</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {/* Play & Shuffle Header Actions */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto pt-2 pb-1">
          <button
            onClick={() => handlePlayAll(songs, false)}
            className="h-11 sm:h-10 px-5 rounded-full bg-[#FA233B] hover:bg-[#D90429] active:scale-95 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#FA233B]/25 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            Play All
          </button>
          <button
            onClick={() => handlePlayAll(songs, true)}
            className="h-11 sm:h-10 px-4 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border border-white/15 shadow-md transition-all cursor-pointer"
          >
            <Shuffle className="w-4 h-4 text-slate-200" />
            Shuffle
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {songs.map((song, index) => (
            <div
              key={`${song.id}-${index}`}
              className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all flex items-center justify-between group"
            >
              <div
                className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0"
                onClick={() => playSong(song, songs)}
              >
                <img
                  src={song.coverUrl || '/app-icon.png'}
                  alt={song.title}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                  }}
                  className="w-11 h-11 rounded-xl object-cover shadow-sm flex-shrink-0 bg-slate-800"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white group-hover:text-[#F51B3D] transition-colors truncate">
                    {song.title}
                  </h4>
                  <p className="text-[11px] text-[#8E92A4] truncate mt-0.5">{song.artist}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <SongActionMenu song={song} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (tab !== 'menu') {
    const activeItem = libraryNavItems.find((i) => i.id === tab);
    let content: React.ReactNode = null;
    switch (tab) {
      case 'liked':
        content = renderSongList(likedSongs, 'Liked Songs');
        break;
      case 'history':
        content = renderSongList(historySongs, 'Recently Played');
        break;
      case 'downloads':
        content = renderSongList(downloadedSongs, 'Downloads');
        break;
      default:
        content = (
          <div className="flex flex-col items-center justify-center py-20 text-[#8E92A4]">
            <Library className="w-12 h-12 mb-4 opacity-40 text-slate-500" />
            <p className="text-sm font-semibold text-white">This collection will populate as you save items.</p>
          </div>
        );
    }

    return (
      <div className="space-y-6 pb-6 text-white select-none animate-in fade-in duration-200">
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => setTab('menu')}
            className="p-2 -ml-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">{activeItem?.label}</h1>
            <p className="text-xs text-[#8E92A4]">{activeItem?.count} tracks in your cloud library</p>
          </div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 text-white select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Your Library</h1>
          <p className="text-xs text-[#8E92A4] mt-0.5">Authoritative collection synchronized with your cloud account</p>
        </div>
      </div>

      {/* Cross-Device Remote Listening Banner */}
      {!isActiveDevice && currentSong && remoteDeviceName && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#F51B3D]/15 to-transparent border border-[#F51B3D]/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#F51B3D]/20 flex items-center justify-center text-[#F51B3D] flex-shrink-0">
              <Laptop className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#F51B3D]">Connected Playback</span>
              <h4 className="text-xs font-bold text-white truncate">Playing on {remoteDeviceName}</h4>
              <p className="text-[11px] text-[#8E92A4] truncate">{currentSong.title} • {currentSong.artist}</p>
            </div>
          </div>

          <button
            onClick={() => transferPlayback(deviceId)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#F51B3D] hover:bg-[#D91533] text-white flex-shrink-0 shadow-md shadow-[#F51B3D]/25 transition-all"
          >
            Play Here
          </button>
        </div>
      )}

      {/* Library Categories List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {libraryNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.05] transition-all flex items-center justify-between group text-left"
            >
              <div className="flex items-center gap-3.5">
                <div className={`w-11 h-11 rounded-xl ${item.bg} flex items-center justify-center ${item.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-[#F51B3D] transition-colors">
                    {item.label}
                  </h3>
                  <p className="text-xs text-[#8E92A4] mt-0.5">{item.count} items</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
