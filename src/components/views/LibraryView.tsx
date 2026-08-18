'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Heart, Download, Clock, ListMusic, Play, ChevronRight, 
  User, Disc, Sparkles, Laptop, ChevronLeft, Music, Library, Shuffle,
  HardDrive, Trash2, CheckCircle2, Layers, WifiOff, RefreshCw, ShieldCheck,
  Globe, ArrowUpDown
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { DownloadStorage } from '@/lib/offline/DownloadStorage';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { Song } from '@/types/music';
import { getCuratedPlaylists, LANGUAGE_PLAYLIST_MAP } from '@/constants/playlists';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';

export function LibraryView() {
  const [tab, setTab] = useState<string>('menu');
  const [downloadSubTab, setDownloadSubTab] = useState<'songs' | 'albums' | 'playlists' | 'storage'>('songs');
  const [offlineTrackList, setOfflineTrackList] = useState<Song[]>([]);
  const [selectedPlaylistLang, setSelectedPlaylistLang] = useState<string | null>(null);
  const [resolvedSongsMap, setResolvedSongsMap] = useState<Record<string, Song>>({});
  const [playlistSortBy, setPlaylistSortBy] = useState<'updated' | 'name' | 'count'>('updated');
  const [activeFilterChip, setActiveFilterChip] = useState<string>('all');
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
    // Cross-device sync state
    isActiveDevice,
    currentSong,
    remoteDeviceName,
    deviceId,
    transferPlayback,
    preferredLanguage,
    selectedLanguages = [],
    setSelectedLanguages,
    setPreferredLanguage,
    setSelectedArtistId,
    setSelectedPlaylistId,
    setActiveTab,
    setCreatePlaylistModalOpen,
  } = usePlayerStore();

  const {
    storageInfo,
    fetchStorageInfo,
    isOfflineMode,
    setOfflineMode,
    offlineSettings,
    setOfflineSettings,
    purgeOfflineDownloads,
    removeDownload,
  } = useDownloadStore();

  useEffect(() => {
    fetchStorageInfo();
  }, [downloadedSongIds.length, fetchStorageInfo]);

  useEffect(() => {
    // Load verified offline tracks from native Android or web catalog
    const loadOfflineTracks = async () => {
      try {
        const { RaagaXNativeDownload } = await import('@/lib/playback/native/RaagaXNativeDownload');
        if (RaagaXNativeDownload.isNative()) {
          const nativeTracks = await RaagaXNativeDownload.getDownloadedTracks();
          if (nativeTracks && nativeTracks.length > 0) {
            const mapped: Song[] = nativeTracks.map((t) => ({
              id: t.songId || t.id,
              title: t.title,
              artist: t.artist,
              album: t.album || 'RaagaX Music',
              coverUrl: t.artworkUrl || t.coverUrl || '/app-icon.png',
              duration: 180,
              audioUrl: t.localPath || '',
              artistId: 'offline',
              albumId: 'offline',
              genre: 'Various',
              category: 'global_trending',
              year: new Date(t.completedAt || Date.now()).getFullYear().toString(),
              releaseYear: new Date(t.completedAt || Date.now()).getFullYear(),
              plays: 0,
              likes: 0,
              quality: t.quality || '320 kbps',
              language: 'Mixed'
            }));
            setOfflineTrackList(mapped);
            return;
          }
        }

        const tracks = await OfflineCatalog.getInstance().getAllTracks();
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
        } else {
          setOfflineTrackList([]);
        }
      } catch (e) {
        console.warn('Failed to load offline tracks:', e);
      }
    };

    loadOfflineTracks();
  }, [downloadedSongIds.length]);

  // Combine queue songs, store liked songs, offline tracks, resolved map, and cloud records into known map
  const knownSongsMap = useMemo(() => {
    const map = new Map<string, Song>();
    storeLikedSongs.forEach((s) => { if (s?.id) map.set(s.id, s); });
    queue.forEach((s) => { if (s?.id) map.set(s.id, s); });
    offlineTrackList.forEach((s) => { if (s?.id) map.set(s.id, s); });
    Object.values(resolvedSongsMap).forEach((s) => { if (s?.id) map.set(s.id, s); });
    cloudDownloadRecords.forEach((r) => {
      if (r?.song_id && !map.has(r.song_id)) {
        map.set(r.song_id, {
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
    return map;
  }, [storeLikedSongs, queue, offlineTrackList, resolvedSongsMap, cloudDownloadRecords]);

  const { playlists: userPlaylists = [], fetchPlaylists } = usePlaylistStore();

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  // Automatically fetch metadata for any liked or history song IDs not yet in memory
  useEffect(() => {
    const allNeededIds = Array.from(new Set([...likedSongIds, ...historySongIds]));
    if (allNeededIds.length === 0) return;
    const missingIds = allNeededIds.filter((id) => !knownSongsMap.has(id));
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
  }, [likedSongIds, historySongIds, knownSongsMap]);

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return (val >= 10 ? val.toFixed(0) : val.toFixed(1)) + ' ' + sizes[i];
  };

  const likedSongs = useMemo(() => {
    return likedSongIds.map((id) => knownSongsMap.get(id) || {
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
  }, [likedSongIds, knownSongsMap]);

  const downloadedSongs = useMemo(() => {
    return downloadedSongIds
      .map((id) => knownSongsMap.get(id))
      .filter((s): s is Song => Boolean(s));
  }, [downloadedSongIds, knownSongsMap]);

  // Group downloaded songs by Album
  const downloadedAlbums = useMemo(() => {
    const albumMap = new Map<string, { album: string; artist: string; coverUrl: string; tracks: Song[] }>();
    downloadedSongs.forEach((song) => {
      const key = song.album || 'Unknown Album';
      if (!albumMap.has(key)) {
        albumMap.set(key, {
          album: song.album || 'Unknown Album',
          artist: song.artist,
          coverUrl: song.coverUrl || '/app-icon.png',
          tracks: [],
        });
      }
      albumMap.get(key)!.tracks.push(song);
    });
    return Array.from(albumMap.values());
  }, [downloadedSongs]);

  // Filter user playlists containing downloaded songs
  const downloadedPlaylists = useMemo(() => {
    return userPlaylists.filter((pl) => {
      const pSongs = (pl as any).songs || [];
      return pSongs.some((s: any) => downloadedSongIds.includes(s.id));
    });
  }, [userPlaylists, downloadedSongIds]);

  const historySongs = useMemo(() => {
    return historySongIds.map((id) => knownSongsMap.get(id) || {
      id,
      title: 'Played Track',
      artist: 'Unknown Artist',
      album: 'Recent History',
      coverUrl: '/app-icon.png',
      duration: 210,
      audioUrl: '',
      artistId: 'unknown',
      albumId: 'unknown',
      genre: 'Various',
      category: 'global_trending' as const,
      releaseYear: new Date().getFullYear(),
      plays: 1,
      likes: 0
    });
  }, [historySongIds, knownSongsMap]);

  const currentCuratedPlaylists = getCuratedPlaylists(selectedPlaylistLang || preferredLanguage);

  const libraryNavItems = [
    { id: 'liked', label: 'Liked Songs', subtitle: 'Your favorite tracks', icon: Heart, color: 'text-[#F51B3D]', bg: 'bg-[#F51B3D]/10' },
    { id: 'downloads', label: 'Downloaded', subtitle: 'Offline protected tracks', icon: Download, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'playlists', label: 'Playlists', subtitle: 'Custom & curated collections', icon: ListMusic, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { id: 'languages', label: 'Languages', subtitle: 'Preferred regional streams', icon: Globe, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { id: 'history', label: 'Recently Played', subtitle: 'Listening history', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { id: 'artists', label: 'Artists', subtitle: 'Followed artist catalog', icon: User, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'albums', label: 'Albums', subtitle: 'Saved audio releases', icon: Disc, color: 'text-rose-400', bg: 'bg-rose-500/10' },
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
          <p className="text-xs text-[#8E92A4] mt-1">Songs added or played will appear here.</p>
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

  // Render Apple Music Style Downloaded Section
  const renderDownloadedSection = () => {
    return (
      <div className="space-y-6">
        {/* Apple Music Style Sub-Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'songs', label: 'Downloaded Songs', icon: Music },
            { id: 'albums', label: 'Albums', icon: Disc },
            { id: 'playlists', label: 'Playlists', icon: ListMusic },
            { id: 'storage', label: 'Storage', icon: HardDrive },
          ].map((sub) => {
            const Icon = sub.icon;
            const isSelected = downloadSubTab === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setDownloadSubTab(sub.id as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {sub.label}
              </button>
            );
          })}
        </div>

        {/* 1. Downloaded Songs Tab */}
        {downloadSubTab === 'songs' && (
          <div className="space-y-4">
            {downloadedSongs.length > 0 && (
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto pt-1 pb-1">
                <button
                  onClick={() => handlePlayAll(downloadedSongs, false)}
                  className="h-11 sm:h-10 px-5 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Play Offline
                </button>
                <button
                  onClick={() => handlePlayAll(downloadedSongs, true)}
                  className="h-11 sm:h-10 px-4 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border border-white/15 shadow-md transition-all cursor-pointer"
                >
                  <Shuffle className="w-4 h-4 text-slate-200" />
                  Shuffle
                </button>
              </div>
            )}

            {downloadedSongs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#8E92A4] bg-white/[0.01] border border-dashed border-white/10 rounded-2xl">
                <Download className="w-12 h-12 mb-3 opacity-40 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">No Downloaded Music Yet</h3>
                <p className="text-xs text-[#8E92A4] mt-1 max-w-sm text-center">
                  Tap the three dots on any song, album, or playlist and choose "Download" to listen completely offline without internet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {downloadedSongs.map((song, idx) => (
                  <div
                    key={`${song.id}-${idx}`}
                    className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 hover:bg-white/5 transition-all flex items-center justify-between group"
                  >
                    <div
                      className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0"
                      onClick={() => playSong(song, downloadedSongs)}
                    >
                      <div className="relative w-11 h-11 rounded-xl overflow-hidden shadow-sm flex-shrink-0 bg-slate-800">
                        <img
                          src={song.coverUrl || '/app-icon.png'}
                          alt={song.title}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                          }}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0.5 right-0.5 bg-emerald-500 text-slate-950 rounded-full p-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5 fill-current" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                          {song.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-medium text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.2 rounded font-mono">
                            Offline FLAC
                          </span>
                          <span className="text-[11px] text-[#8E92A4] truncate">{song.artist}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <DownloadStatusIndicator song={song} size="sm" showPercentage />
                      <SongActionMenu song={song} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. Downloaded Albums Tab */}
        {downloadSubTab === 'albums' && (
          <div className="space-y-4">
            {downloadedAlbums.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#8E92A4] bg-white/[0.01] border border-dashed border-white/10 rounded-2xl">
                <Disc className="w-12 h-12 mb-3 opacity-40 text-rose-400" />
                <h3 className="text-sm font-bold text-white">No Downloaded Albums</h3>
                <p className="text-xs text-[#8E92A4] mt-1 text-center">
                  When you download an entire album, it will appear organized here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {downloadedAlbums.map((alb) => (
                  <div
                    key={alb.album}
                    onClick={() => handlePlayAll(alb.tracks)}
                    className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 hover:bg-white/5 transition-all cursor-pointer group"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-slate-800 mb-2.5 relative shadow-md">
                      <img src={alb.coverUrl} alt={alb.album} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute top-2 right-2 bg-emerald-500/90 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow">
                        {alb.tracks.length} Tracks
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                      {alb.album}
                    </h4>
                    <p className="text-[11px] text-[#8E92A4] truncate mt-0.5">{alb.artist}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Downloaded Playlists Tab */}
        {downloadSubTab === 'playlists' && (
          <div className="space-y-4">
            {downloadedPlaylists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#8E92A4] bg-white/[0.01] border border-dashed border-white/10 rounded-2xl">
                <ListMusic className="w-12 h-12 mb-3 opacity-40 text-purple-400" />
                <h3 className="text-sm font-bold text-white">No Downloaded Playlists</h3>
                <p className="text-xs text-[#8E92A4] mt-1 text-center">
                  Use "Download All" on any playlist to save it for offline listening.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {downloadedPlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => {
                      setSelectedPlaylistId(pl.id);
                      setActiveTab('playlist');
                    }}
                    className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 hover:bg-white/5 transition-all flex items-center gap-3.5 cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#fa233b]/15 text-[#fa233b] flex items-center justify-center flex-shrink-0">
                      <Music className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                        {pl.title}
                      </h4>
                      <p className="text-[11px] text-emerald-400 font-mono mt-0.5">Available Offline</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Storage & Offline Management Tab */}
        {downloadSubTab === 'storage' && (
          <div className="space-y-5">
            {/* Storage Meter Card */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">App Private Sandbox Storage</h3>
                    <p className="text-xs text-[#8E92A4]">
                      {formatBytes(storageInfo?.raagaXUsed || 0)} used of {formatBytes(storageInfo?.quota || 64 * 1024 * 1024 * 1024)} available
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await fetchStorageInfo();
                  }}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                  title="Refresh Storage Info"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden flex">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(2, storageInfo?.percentUsed || (downloadedSongs.length > 0 ? 5 : 0)))}%` }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">Offline Songs</span>
                  <span className="text-base font-black text-white mt-0.5 block">{downloadedSongIds.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">Audio Quality</span>
                  <span className="text-base font-black text-emerald-400 mt-0.5 block">24-Bit FLAC</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">Storage Type</span>
                  <span className="text-base font-black text-white mt-0.5 block">Private Sandbox</span>
                </div>
              </div>
            </div>

            {/* Smart Downloads & Offline Switches */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" /> Smart Downloads
                  </h4>
                  <p className="text-xs text-[#8E92A4] mt-0.5 max-w-md">
                    Automatically saves your favorite tracks and frequently played mixes in the background so you never lose music when traveling.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offlineSettings.smartDownloads}
                    onChange={(e) => setOfflineSettings({ smartDownloads: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                </label>
              </div>

              <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <WifiOff className="w-4 h-4 text-amber-400" /> Offline Only Mode
                  </h4>
                  <p className="text-xs text-[#8E92A4] mt-0.5 max-w-md">
                    Disables external streaming and only plays local high-definition audio stored on this device.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOfflineMode}
                    onChange={(e) => setOfflineMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                </label>
              </div>
            </div>

            {/* Clear All Downloads Action */}
            {downloadedSongIds.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={async () => {
                    const confirm = window.confirm("Are you sure you want to remove all downloaded songs from this device? You can re-download anytime.");
                    if (confirm) {
                      await purgeOfflineDownloads();
                      await fetchStorageInfo();
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove All Downloaded Tracks ({downloadedSongIds.length})
                </button>
              </div>
            )}
          </div>
        )}
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
        content = renderDownloadedSection();
        break;
      case 'playlists':
        content = (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#8E92A4]">
                {userPlaylists.length + currentCuratedPlaylists.length} Total Playlists
              </span>
              <button
                onClick={() => setCreatePlaylistModalOpen(true)}
                className="px-3.5 py-1.5 rounded-full bg-[#FA233B] text-white text-xs font-bold shadow-md shadow-[#FA233B]/20 hover:scale-105 active:scale-95 transition-all"
              >
                + New Playlist
              </button>
            </div>

            {/* Curated Studio Mixes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#FA233B]" />
                  RaagaX Curated Studio Mixes
                </h3>
              </div>

              {/* Language Selector Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {['Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam', 'English'].map((lang) => {
                  const isSelected = (selectedPlaylistLang || preferredLanguage || 'Telugu').toLowerCase() === lang.toLowerCase();
                  return (
                    <button
                      key={lang}
                      onClick={() => setSelectedPlaylistLang(lang)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-[#FA233B] text-white shadow-sm shadow-[#FA233B]/30'
                          : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
                      }`}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentCuratedPlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => {
                      setSelectedPlaylistId(pl.id);
                      setActiveTab('playlist');
                    }}
                    className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-red-500/30 hover:bg-white/5 transition-all flex items-center gap-3.5 cursor-pointer group shadow-sm"
                  >
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 shadow">
                      <img
                        src={pl.coverUrl}
                        alt={pl.name}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white group-hover:text-[#FA233B] transition-colors truncate">
                          {pl.name}
                        </h4>
                        {pl.badge && (
                          <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-red-500/20 text-[#FA233B] border border-red-500/30">
                            {pl.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8E92A4] truncate mt-0.5">
                        {pl.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* User Custom Playlists */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ListMusic className="w-3.5 h-3.5 text-purple-400" />
                  Your Playlists ({userPlaylists.length})
                </h3>

                {/* Playlist Sort Dropdown */}
                {userPlaylists.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl text-xs">
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    <select
                      value={playlistSortBy}
                      onChange={(e) => setPlaylistSortBy(e.target.value as any)}
                      className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="updated" className="bg-[#12131a]">Recently Updated</option>
                      <option value="name" className="bg-[#12131a]">Name (A-Z)</option>
                      <option value="count" className="bg-[#12131a]">Song Count</option>
                    </select>
                  </div>
                )}
              </div>

              {userPlaylists.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...userPlaylists].sort((a, b) => {
                    if (playlistSortBy === 'name') return a.title.localeCompare(b.title);
                    if (playlistSortBy === 'count') return (b.songs?.length || 0) - (a.songs?.length || 0);
                    return 0;
                  }).map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() => {
                        setSelectedPlaylistId(pl.id);
                        setActiveTab('playlist');
                      }}
                      className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all flex items-center gap-3.5 cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center flex-shrink-0">
                        <ListMusic className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors truncate">
                          {pl.title}
                        </h4>
                        <p className="text-[11px] text-[#8E92A4] truncate mt-0.5">
                          {pl.songs?.length || 0} tracks
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-white/[0.01] border border-dashed border-white/10 text-center space-y-2">
                  <p className="text-xs text-slate-400">You haven't created any playlists yet.</p>
                  <button
                    onClick={() => setCreatePlaylistModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5"
                  >
                    + Create First Playlist
                  </button>
                </div>
              )}
            </div>
          </div>
        );
        break;
      case 'artists':
        content = (
          <div className="space-y-4">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Top Featured Artists</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {POPULAR_ARTISTS.map((artist) => (
                <div
                  key={artist.id}
                  onClick={() => {
                    setSelectedArtistId(artist.id);
                    setActiveTab('artist');
                  }}
                  className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/5 transition-all text-center space-y-2 cursor-pointer group"
                >
                  <img
                    src={artist.image}
                    alt={artist.name}
                    className="w-18 h-18 rounded-full mx-auto object-cover shadow-md group-hover:scale-105 transition-transform bg-slate-800"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-[#FA233B] transition-colors truncate">
                      {artist.name}
                    </h4>
                    <p className="text-[10px] text-[#8E92A4] mt-0.5 truncate">{artist.genres.join(' • ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
        break;
      case 'languages':
        content = (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" /> Active Music Languages
              </h3>
              <p className="text-xs text-slate-400">
                Manage your music languages or tap any regional hub to explore curated playlists and downloads.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {['Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam', 'Bengali', 'Marathi', 'Punjabi', 'English'].map((lang) => {
                const isSelected = selectedLanguages.includes(lang);
                const isPrimary = preferredLanguage.toLowerCase() === lang.toLowerCase();
                const curated = getCuratedPlaylists(lang);

                return (
                  <div
                    key={lang}
                    className={`p-4 rounded-2xl border transition-all ${
                      isPrimary 
                        ? 'bg-[#FA233B]/10 border-[#FA233B]/40 shadow-lg' 
                        : isSelected 
                        ? 'bg-white/[0.04] border-white/15 hover:border-white/25' 
                        : 'bg-white/[0.02] border-white/5 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                          isPrimary ? 'bg-[#FA233B] text-white' : 'bg-white/10 text-slate-300'
                        }`}>
                          {lang.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{lang}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {isPrimary ? 'Primary Language' : isSelected ? 'Active Language' : 'Available'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setPreferredLanguage(lang);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          isPrimary
                            ? 'bg-[#FA233B] text-white shadow'
                            : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                      >
                        {isPrimary ? 'Active' : 'Switch'}
                      </button>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-white/10">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                        Top Playlists ({curated.length})
                      </span>
                      {curated.slice(0, 3).map((pl) => (
                        <div
                          key={pl.id}
                          onClick={() => {
                            setSelectedPlaylistId(pl.id);
                            setActiveTab('playlist');
                          }}
                          className="py-1 px-1.5 rounded-lg hover:bg-white/5 flex items-center justify-between text-xs text-slate-300 hover:text-white cursor-pointer"
                        >
                          <span className="truncate">{pl.name}</span>
                          <span className="text-[10px] text-slate-500">▸</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
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
            className="p-2 -ml-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">{activeItem?.label}</h1>
            <p className="text-xs text-[#8E92A4]">
              {activeItem?.subtitle || 'In your cloud library'}
            </p>
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

      {/* Smart Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {['all', 'downloads', 'favorites', 'playlists', 'telugu', 'hindi', 'tamil', 'english'].map(chip => (
          <button
            key={chip}
            onClick={() => {
              setActiveFilterChip(chip);
              if (chip === 'downloads') setTab('downloads');
              else if (chip === 'favorites') setTab('liked');
              else if (chip === 'playlists') setTab('playlists');
              else if (chip !== 'all') {
                setPreferredLanguage(chip.charAt(0).toUpperCase() + chip.slice(1));
                setTab('languages');
              }
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold capitalize transition-all cursor-pointer flex-shrink-0 ${
              activeFilterChip === chip
                ? 'bg-[#FA233B] text-white shadow'
                : 'bg-white/5 hover:bg-white/15 text-slate-300 border border-white/10'
            }`}
          >
            {chip}
          </button>
        ))}
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
              onClick={() => {
                setTab(item.id);
              }}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.05] transition-all flex items-center justify-between group text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className={`w-11 h-11 rounded-xl ${item.bg} flex items-center justify-center ${item.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-[#F51B3D] transition-colors">
                    {item.label}
                  </h3>
                  <p className="text-xs text-[#8E92A4] mt-0.5">{item.subtitle}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </button>
          );
        })}
      </div>

      {/* Recently Downloaded Tracks Shelf */}
      {downloadedSongs.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Recently Downloaded
            </h3>
            <button
              onClick={() => setTab('downloads')}
              className="text-xs text-emerald-400 hover:underline font-bold cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
            {downloadedSongs.slice(0, 8).map(s => (
              <div
                key={s.id}
                onClick={() => playSong(s, downloadedSongs)}
                className="w-32 flex-shrink-0 p-2.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 hover:bg-white/5 transition-all cursor-pointer group"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden mb-2 bg-slate-800 relative shadow">
                  <img src={s.coverUrl} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute bottom-1 right-1 bg-emerald-500 text-slate-950 p-0.5 rounded-full">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                  </div>
                </div>
                <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">{s.title}</h4>
                <p className="text-[10px] text-[#8E92A4] truncate">{s.artist}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
