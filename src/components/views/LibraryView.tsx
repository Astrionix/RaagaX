'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Heart, Download, Clock, ListMusic, Play, ChevronRight, 
  User, Disc, Sparkles, Laptop, ChevronLeft, Music, Library, Shuffle,
  HardDrive, Trash2, CheckCircle2, Layers, WifiOff, RefreshCw, ShieldCheck,
  Globe, ArrowUpDown, BarChart3, Wifi, CloudDownload, Heart as HeartFill
} from 'lucide-react';
import { InsightsView } from '@/components/views/InsightsView';
import { ArtistsView } from '@/components/views/ArtistsView';
import { AlbumsView } from '@/components/views/AlbumsView';
import { GenresView } from '@/components/views/GenresView';
import { usePlayerStore, isOfflineMode } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { DownloadStorage } from '@/lib/offline/DownloadStorage';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { AlbumCatalogEngine } from '@/lib/albumCatalog';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { Song } from '@/types/music';
import { getCuratedPlaylists, LANGUAGE_PLAYLIST_MAP } from '@/constants/playlists';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';
import { SwipeableSongRow } from '@/components/common/SwipeableSongRow';
import { haptics } from '@/lib/haptics/HapticEngine';

export function LibraryView() {
  const [tab, setTab] = useState<string>('menu');
  const [downloadSubTab, setDownloadSubTab] = useState<'menu' | 'songs' | 'albums' | 'artists' | 'playlists' | 'made_for_you' | 'genres' | 'storage'>('menu');
  const [offlineTrackList, setOfflineTrackList] = useState<Song[]>([]);
  const [selectedPlaylistLang, setSelectedPlaylistLang] = useState<string | null>(null);
  const [resolvedSongsMap, setResolvedSongsMap] = useState<Record<string, Song>>({});
  const [playlistSortBy, setPlaylistSortBy] = useState<'updated' | 'name' | 'count'>('updated');
  const [activeFilterChip, setActiveFilterChip] = useState<string>('all');
  const attemptedMissingIdsRef = useRef<Set<string>>(new Set());
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
    setSelectedAlbumId,
    setSelectedPlaylistId,
    setActiveTab,
    setCreatePlaylistModalOpen,
    toggleLikeSong,
  } = usePlayerStore();

  const {
    storageInfo,
    fetchStorageInfo,
    isOfflineMode,
    setOfflineMode,
    offlineSettings,
    setOfflineSettings,
    wifiOnly,
    setWifiOnly,
    purgeOfflineDownloads,
    removeDownload,
    nativeDownloadedTracks,
  } = useDownloadStore();

  const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());

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
              artistId: (t as any).artistId || '',
              albumId: (t as any).albumId || '',
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

            const trackMap: Record<string, any> = {};
            const verifiedIds: string[] = [];
            nativeTracks.forEach((t) => {
              const sid = t.songId || t.id;
              if (sid) {
                trackMap[sid] = t;
                verifiedIds.push(sid);
              }
            });
            useDownloadStore.setState({ nativeDownloadedTracks: trackMap });
            usePlayerStore.setState(s => ({
              downloadedSongIds: Array.from(new Set([...s.downloadedSongIds, ...verifiedIds]))
            }));
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
            artistId: (t as any).artistId || '',
            albumId: (t as any).albumId || '',
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
    Object.values(nativeDownloadedTracks).forEach((t) => {
      if (t && (t.songId || t.id)) {
        const id = t.songId || t.id;
        if (!map.has(id)) {
          map.set(id, {
            id,
            title: t.title || id,
            artist: t.artist || '',
            artistId: `art-${id}`,
            album: t.album || 'RaagaX Music',
            albumId: `alb-${id}`,
            duration: 180,
            coverUrl: t.artworkUrl || t.coverUrl || '/app-icon.png',
            audioUrl: t.localPath || '',
            genre: 'OFFLINE',
            category: 'global_trending',
            releaseYear: new Date(t.completedAt || Date.now()).getFullYear(),
            plays: 0,
            likes: 0,
          });
        }
      }
    });
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
  }, [storeLikedSongs, queue, offlineTrackList, nativeDownloadedTracks, resolvedSongsMap, cloudDownloadRecords]);

  const { playlists: userPlaylists = [], fetchPlaylists } = usePlaylistStore();

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  // Automatically fetch metadata for any liked or history song IDs not yet in memory
  useEffect(() => {
    if (isOfflineMode || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    const allNeededIds = Array.from(new Set([...likedSongIds, ...historySongIds]));
    if (allNeededIds.length === 0) return;
    const missingIds = allNeededIds.filter((id) => !knownSongsMap.has(id) && !attemptedMissingIdsRef.current.has(id));
    if (missingIds.length === 0) return;

    missingIds.forEach((id) => attemptedMissingIdsRef.current.add(id));

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
    const map = new Map<string, Song>();
    offlineTrackList.forEach((s) => {
      if (s?.id) map.set(s.id, s);
    });
    Object.values(nativeDownloadedTracks).forEach((t) => {
      if (t && (t.songId || t.id)) {
        const id = t.songId || t.id;
        if (!map.has(id)) {
          map.set(id, {
            id,
            title: t.title || id,
            artist: t.artist || '',
            artistId: `art-${id}`,
            album: t.album || 'RaagaX Music',
            albumId: `alb-${id}`,
            duration: 180,
            coverUrl: t.artworkUrl || t.coverUrl || '/app-icon.png',
            audioUrl: t.localPath || '',
            genre: 'OFFLINE',
            category: 'global_trending',
            releaseYear: new Date(t.completedAt || Date.now()).getFullYear(),
            plays: 0,
            likes: 0,
          });
        }
      }
    });
    downloadedSongIds.forEach((id) => {
      const s = knownSongsMap.get(id);
      if (s && !map.has(id)) {
        map.set(id, s);
      }
    });
    return Array.from(map.values());
  }, [downloadedSongIds, knownSongsMap, offlineTrackList, nativeDownloadedTracks]);

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

  // Group downloaded songs by Artist
  const downloadedArtists = useMemo(() => {
    const artistMap = new Map<string, { artist: string; artistId: string; coverUrl: string; tracks: Song[] }>();
    downloadedSongs.forEach((song) => {
      const key = song.artist || 'Various Artists';
      if (!artistMap.has(key)) {
        artistMap.set(key, {
          artist: key,
          artistId: song.artistId || `art-${song.id}`,
          coverUrl: song.coverUrl || '/app-icon.png',
          tracks: [],
        });
      }
      artistMap.get(key)!.tracks.push(song);
    });
    return Array.from(artistMap.values());
  }, [downloadedSongs]);

  // Filter user & curated playlists containing downloaded songs
  const downloadedPlaylists = useMemo(() => {
    return userPlaylists
      .map((pl) => {
        const pSongs = (pl as any).songs || [];
        const dlSongs = pSongs.filter((s: any) => downloadedSongIds.includes(s.id));
        return {
          id: pl.id,
          title: pl.title,
          coverUrl: pl.coverUrl,
          totalTracks: pSongs.length,
          downloadedTracks: dlSongs.length,
          songs: dlSongs,
        };
      })
      .filter((pl) => pl.downloadedTracks > 0);
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
    { id: 'playlists', label: 'Playlists', subtitle: 'Your personal & collaborative playlists', icon: ListMusic, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { id: 'albums', label: 'Albums', subtitle: 'Saved audio releases', icon: Disc, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { id: 'artists', label: 'Artists', subtitle: 'Followed artist catalog', icon: User, color: 'text-blue-400', bg: 'bg-blue-500/10' },
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

        <div className="space-y-2">
          {songs.map((song, index) => {
            const isSongDownloaded = downloadedSongIds.includes(song.id);
            const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
            const isAppOffline = isOfflineMode || isBrowserOffline;
            const isSongOfflineUnavailable = isAppOffline && !isSongDownloaded;

            return (
              <SwipeableSongRow
                key={`${song.id}-${index}`}
                song={song}
                actionType={tab === 'liked' ? 'unlike' : (tab === 'songs' ? 'remove_download' : 'remove')}
                actionLabel={tab === 'liked' ? 'Remove' : (tab === 'songs' ? 'Remove Download' : 'Remove')}
                onSwipeAction={() => {
                  if (tab === 'liked') {
                    toggleLikeSong(song.id);
                  } else if (tab === 'songs') {
                    removeDownload(song.id);
                  }
                }}
              >
                <div
                  className={`p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all flex items-center justify-between group ${
                    isSongOfflineUnavailable ? 'opacity-40 pointer-events-none select-none' : ''
                  }`}
                >
                  <div
                    className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0 pr-3"
                    onClick={() => { if (!isSongOfflineUnavailable) playSong(song, songs); }}
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
                      <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#F51B3D] transition-colors truncate">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-[#8E92A4] truncate mt-0.5">{song.artist}</p>
                    </div>
                  </div>

                  {/* Fixed Right-Side Action Column */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <DownloadStatusIndicator song={song} size="sm" />
                    </div>
                    <SongActionMenu song={song} />
                  </div>
                </div>
              </SwipeableSongRow>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Apple Music Style Downloaded Section
  const renderDownloadedSection = () => {
    if (downloadSubTab === 'menu') {
      return (
        <div className="space-y-6">
          {/* Top Actions: Play All & Shuffle Offline */}
          {downloadedSongs.length > 0 && (
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto pt-1 pb-1">
              <button
                onClick={() => handlePlayAll(downloadedSongs, false)}
                className="h-11 sm:h-10 px-5 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Play All
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

          {/* Apple Music Style vertical sub-navigation */}
          <div className="rounded-2xl glass-deep border border-white/10 overflow-hidden divide-y divide-white/5 select-none shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            {[
              { id: 'playlists', label: 'Playlists', icon: ListMusic, color: 'text-purple-400', count: downloadedPlaylists.length },
              { id: 'artists', label: 'Artists', icon: User, color: 'text-blue-400', count: downloadedArtists.length },
              { id: 'albums', label: 'Albums', icon: Disc, color: 'text-rose-400', count: downloadedAlbums.length },
              { id: 'songs', label: 'Songs', icon: Music, color: 'text-cyan-400', count: downloadedSongs.length },
              { id: 'made_for_you', label: 'Made for You', icon: Sparkles, color: 'text-amber-400', count: null },
              { id: 'genres', label: 'Genres', icon: Layers, color: 'text-indigo-400', count: null },
              { id: 'storage', label: 'Storage & Settings', icon: HardDrive, color: 'text-emerald-400', count: null }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setDownloadSubTab(item.id as any)}
                  className="w-full py-3.5 px-4 flex items-center justify-between hover:bg-white/5 active:bg-white/10 transition-colors text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
                      <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white group-hover:text-white transition-colors">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    {item.count !== null && (
                      <span className="text-[11px] font-mono text-slate-500 font-semibold">{item.count}</span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Recently Downloaded Shelf (Apple Music Style) */}
          {downloadedAlbums.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black text-white tracking-tight uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Recently Downloaded
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
                {downloadedAlbums.slice(0, 8).map((alb) => (
                  <div
                    key={`recent-${alb.album}`}
                    onClick={() => handlePlayAll(alb.tracks)}
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 hover:bg-white/5 transition-all cursor-pointer group flex flex-col"
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-800 mb-2 relative shadow-sm">
                      <img
                        src={alb.coverUrl}
                        alt={alb.album}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md">
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </div>
                      </div>
                      <div className="absolute bottom-1 right-1 bg-emerald-500/90 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full shadow">
                        {alb.tracks.length}
                      </div>
                    </div>
                    <h4 className="text-[11px] font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                      {alb.album}
                    </h4>
                    <p className="text-[10px] text-[#8E92A4] truncate">{alb.artist}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">

        {/* 1. Downloaded Songs Tab */}
        {downloadSubTab === 'songs' && (
          <div className="space-y-4">
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
                  <SwipeableSongRow
                    key={`${song.id}-${idx}`}
                    song={song}
                    actionType="remove_download"
                    actionLabel="Remove Download"
                    onSwipeAction={() => removeDownload(song.id)}
                  >
                    <div
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
                  </SwipeableSongRow>
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
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-9 h-9 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
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

        {/* 3. Downloaded Artists Tab (Apple Music Style) */}
        {downloadSubTab === 'artists' && (
          <div className="space-y-4">
            {downloadedArtists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#8E92A4] bg-white/[0.01] border border-dashed border-white/10 rounded-2xl">
                <User className="w-12 h-12 mb-3 opacity-40 text-blue-400" />
                <h3 className="text-sm font-bold text-white">No Downloaded Artists</h3>
                <p className="text-xs text-[#8E92A4] mt-1 text-center">
                  Artists of downloaded songs will appear grouped here for offline playback.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {downloadedArtists.map((art) => (
                  <div
                    key={art.artist}
                    onClick={() => handlePlayAll(art.tracks)}
                    className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 hover:bg-white/5 transition-all flex flex-col items-center text-center cursor-pointer group"
                  >
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-slate-800 mb-2.5 relative shadow-md border border-white/10">
                      <img
                        src={art.coverUrl || '/app-icon.png'}
                        alt={art.artist}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow">
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors truncate w-full">
                      {art.artist}
                    </h4>
                    <p className="text-[10px] font-mono text-emerald-400 font-semibold mt-0.5">
                      {art.tracks.length} {art.tracks.length === 1 ? 'song' : 'songs'} offline
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Downloaded Playlists Tab */}
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
                    <div className="w-12 h-12 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0 relative shadow-sm border border-white/5">
                      <img
                        src={pl.coverUrl || '/app-icon.png'}
                        alt={pl.title}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute bottom-0.5 right-0.5 bg-emerald-500 text-slate-950 rounded-full p-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 fill-current" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                        {pl.title}
                      </h4>
                      <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
                        {pl.downloadedTracks} of {pl.totalTracks} downloaded
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4b. Downloaded Made for You Tab */}
        {downloadSubTab === 'made_for_you' && (
          <div className="flex flex-col items-center justify-center py-20 text-[#8E92A4] bg-white/[0.01] border border-dashed border-white/10 rounded-2xl">
            <Sparkles className="w-12 h-12 mb-3 opacity-40 text-amber-400" />
            <h3 className="text-sm font-bold text-white">No Offline Mixes</h3>
            <p className="text-xs text-[#8E92A4] mt-1 text-center max-w-xs px-4">
              Your personalized Made for You mixes will automatically be cached for offline playback when you listen to them.
            </p>
          </div>
        )}

        {/* 4c. Downloaded Genres Tab */}
        {downloadSubTab === 'genres' && (
          <div className="flex flex-col items-center justify-center py-20 text-[#8E92A4] bg-white/[0.01] border border-dashed border-white/10 rounded-2xl">
            <Layers className="w-12 h-12 mb-3 opacity-40 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">No Offline Genres</h3>
            <p className="text-xs text-[#8E92A4] mt-1 text-center max-w-xs px-4">
              Downloaded tracks will group by genre automatically once saved locally.
            </p>
          </div>
        )}

        {/* 5. Storage & Offline Management Tab */}
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

            {/* ── Download Settings Card (Apple Music-style) ──────────────── */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CloudDownload className="w-4 h-4 text-emerald-400" />
                Download Settings
              </h3>

              {/* Audio Quality */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Audio Quality</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Quality used when saving tracks for offline</p>
                </div>
                <select
                  value={offlineSettings.audioQuality}
                  onChange={(e) => setOfflineSettings({ audioQuality: e.target.value as any })}
                  className="bg-white/5 border border-white/10 rounded-xl text-white text-xs font-bold px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="128 kbps">128 kbps</option>
                  <option value="192 kbps">192 kbps</option>
                  <option value="320 kbps">320 kbps (High)</option>
                </select>
              </div>

              {/* Wi-Fi Only */}
              <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Wifi className="w-3.5 h-3.5 text-blue-400" /> Wi-Fi Only Downloads
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Only download music when connected to Wi-Fi</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wifiOnly}
                    onChange={(e) => setWifiOnly(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500" />
                </label>
              </div>

              {/* Auto-download Liked Songs */}
              <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <HeartFill className="w-3.5 h-3.5 text-[#fa233b]" /> Auto-Download Liked Songs
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Automatically download songs you like</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offlineSettings.autoDownloadFavorites}
                    onChange={(e) => setOfflineSettings({ autoDownloadFavorites: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#fa233b]" />
                </label>
              </div>

              {/* Force Offline Mode */}
              <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" /> Force Offline Mode
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Simulate zero network and play exclusively from local storage</p>
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

  const allSavedSongs = useMemo(() => {
    return Array.from(knownSongsMap.values());
  }, [knownSongsMap]);

  if (tab !== 'menu') {
    let activeLabel = 'Collection';
    let activeSubtitle = 'In your cloud library';
    let content: React.ReactNode = null;

    switch (tab) {
      case 'liked':
        activeLabel = 'Liked Songs';
        activeSubtitle = `${likedSongs.length} songs saved`;
        content = renderSongList(likedSongs, 'Liked Songs');
        break;
      case 'songs':
        activeLabel = 'Songs';
        activeSubtitle = `${downloadedSongs.length} downloaded songs`;
        content = renderSongList(downloadedSongs, 'Songs');
        break;
      case 'history':
        activeLabel = 'Listening History';
        activeSubtitle = `${historySongs.length} recently played tracks`;
        content = renderSongList(historySongs, 'Listening History');
        break;
      case 'downloads':
        activeLabel = downloadSubTab === 'menu' ? 'Downloaded' : (
          downloadSubTab === 'songs' ? 'Songs' :
          downloadSubTab === 'albums' ? 'Albums' :
          downloadSubTab === 'artists' ? 'Artists' :
          downloadSubTab === 'playlists' ? 'Playlists' :
          downloadSubTab === 'made_for_you' ? 'Made for You' :
          downloadSubTab === 'genres' ? 'Genres' : 'Storage'
        );
        activeSubtitle = downloadSubTab === 'menu' ? 'Offline verified audio files' : (
          downloadSubTab === 'songs' ? `${downloadedSongs.length} downloaded songs` :
          downloadSubTab === 'albums' ? `${downloadedAlbums.length} downloaded albums` :
          downloadSubTab === 'artists' ? `${downloadedArtists.length} downloaded artists` :
          downloadSubTab === 'playlists' ? `${downloadedPlaylists.length} downloaded playlists` :
          downloadSubTab === 'made_for_you' ? 'Offline mixes' :
          downloadSubTab === 'genres' ? 'Offline genres' : 'Storage options'
        );
        content = renderDownloadedSection();
        break;
      case 'insights':
        activeLabel = 'Music Insights';
        activeSubtitle = 'Listening activity and top charts';
        content = <InsightsView />;
        break;
      case 'artists':
        activeLabel = 'Artists';
        activeSubtitle = 'Followed artists and releases';
        content = <ArtistsView />;
        break;
      case 'albums':
        activeLabel = 'Albums';
        activeSubtitle = 'Saved album catalog';
        content = <AlbumsView />;
        break;
      case 'made_for_you':
        activeLabel = 'Made For You';
        activeSubtitle = 'Personalized playlists curated for your taste';
        content = (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentCuratedPlaylists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => {
                  setSelectedPlaylistId(pl.id);
                  setActiveTab('playlist');
                }}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 hover:bg-white/5 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-[#FA233B] flex items-center justify-center text-white font-bold flex-shrink-0 shadow">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white group-hover:text-[#FA233B] transition-colors truncate">
                      {pl.name}
                    </h4>
                    <p className="text-[11px] text-[#8E92A4] truncate mt-0.5">{(pl as any).description || (pl as any).subtitle || 'Curated Mix'}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </div>
            ))}
          </div>
        );
        break;
      case 'genres':
        return (
          <div className="space-y-4 pb-6 text-white select-none animate-in fade-in duration-200">
            <button
              onClick={() => setTab('menu')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-bold cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Library</span>
            </button>
            <GenresView />
          </div>
        );
      case 'languages':
        activeLabel = 'Regional Streams & Languages';
        activeSubtitle = 'Preferred audio streaming languages';
        content = (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {['Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam', 'English', 'Punjabi', 'Bhojpuri'].map((lang) => {
                const isSelected = selectedLanguages.includes(lang);
                const isPrimary = preferredLanguage.toLowerCase() === lang.toLowerCase();

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
                            {isPrimary ? 'Primary' : isSelected ? 'Active' : 'Available'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
        break;
      case 'playlists':
        activeLabel = 'Playlists';
        activeSubtitle = 'Your personal & collaborative playlists';
        content = (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-1">
              <span className="text-xs font-bold text-[var(--text-secondary)] font-mono">
                {userPlaylists.length} {userPlaylists.length === 1 ? 'Playlist' : 'Playlists'}
              </span>

              <div className="flex items-center gap-2">
                {userPlaylists.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-xl text-xs shadow-sm">
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={playlistSortBy}
                      onChange={(e) => setPlaylistSortBy(e.target.value as any)}
                      className="bg-transparent text-[var(--text-primary)] text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="updated" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Recently Updated</option>
                      <option value="name" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Name (A-Z)</option>
                      <option value="count" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Song Count</option>
                    </select>
                  </div>
                )}

                <button
                  onClick={() => setCreatePlaylistModalOpen(true)}
                  className="px-4 py-2 rounded-full bg-[#FA233B] hover:bg-[#D90429] text-white text-xs font-bold shadow-md shadow-[#FA233B]/25 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  + New Playlist
                </button>
              </div>
            </div>

            {userPlaylists.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...userPlaylists].sort((a, b) => {
                  if (playlistSortBy === 'name') return a.title.localeCompare(b.title);
                  if (playlistSortBy === 'count') return (b.songs?.length || 0) - (a.songs?.length || 0);
                  return 0;
                }).map((pl) => {
                  const songCount = pl.songs?.length || 0;
                  return (
                    <div
                      key={pl.id}
                      onClick={() => {
                        setSelectedPlaylistId(pl.id);
                        setActiveTab('playlist');
                      }}
                      className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 hover:bg-white/5 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0 relative shadow-sm border border-white/5">
                          <img
                            src={pl.coverUrl || '/app-icon.png'}
                            alt={pl.title}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white group-hover:text-[#FA233B] transition-colors truncate">
                            {pl.title}
                          </h4>
                          <p className="text-[11px] text-[#8E92A4] truncate mt-0.5">
                            {songCount} {songCount === 1 ? 'song' : 'songs'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-[#8E92A4]">
                <ListMusic className="w-12 h-12 mb-4 opacity-40 text-slate-500" />
                <p className="text-sm font-semibold text-white">No playlists created yet.</p>
                <p className="text-xs text-[#8E92A4] mt-1">Create your first playlist using the button above.</p>
              </div>
            )}
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
            onClick={() => {
              if (tab === 'downloads' && downloadSubTab !== 'menu') {
                setDownloadSubTab('menu');
              } else {
                setTab('menu');
              }
            }}
            className="p-2 -ml-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">{activeLabel}</h1>
            <p className="text-xs text-[#8E92A4]">{activeSubtitle}</p>
          </div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="space-y-3.5 pb-2 text-white select-none animate-in fade-in duration-200 max-w-5xl mx-auto">
      {/* Library Header */}
      <div className="pt-0.5 pb-0.5">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Library</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">Your personal music collection</p>
      </div>

      {/* ── ♡ LIKED SONGS HERO CARD ── */}
      <div
        onClick={() => setTab('liked')}
        className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#FA233B]/25 via-white/[0.04] to-purple-600/20 border border-white/12 shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:border-[#FA233B]/40 transition-all cursor-pointer group relative overflow-hidden flex items-center justify-between gap-3 select-none"
      >
        <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-[#FA233B]/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />
        
        <div className="flex items-center gap-3 min-w-0 z-10">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#FA233B] to-[#D90429] flex items-center justify-center text-white shadow-lg shadow-red-500/30 flex-shrink-0 group-hover:scale-105 transition-transform">
            <Heart className="w-5 h-5 fill-white stroke-none" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-white tracking-tight group-hover:text-[#FA233B] transition-colors truncate">
              Liked Songs
            </h2>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-300">
              {likedSongs.length} {likedSongs.length === 1 ? 'song' : 'songs'} • Auto-synchronized
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 z-10 flex-shrink-0">
          {likedSongs.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                haptics.mediumImpact();
                usePlayerStore.getState().playSong(likedSongs[0], likedSongs, {
                  contextType: 'LIKED_SONGS',
                  contextUri: 'raagax:liked-songs',
                  title: 'Liked Songs',
                });
              }}
              className="w-9 h-9 rounded-full bg-[#FA233B] hover:bg-[#D90429] active:scale-95 text-white flex items-center justify-center shadow-md shadow-red-500/35 transition-all cursor-pointer"
              title="Play Liked Songs from Track 1"
            >
              <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
        </div>
      </div>

      {/* ── 📥 DOWNLOADED HERO CARD (APPLE MUSIC STYLE) ── */}
      <div
        onClick={() => setTab('downloads')}
        className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-white/[0.04] to-teal-600/15 border border-white/12 shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:border-emerald-500/40 transition-all cursor-pointer group relative overflow-hidden flex items-center justify-between gap-3 select-none"
      >
        <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />
        
        <div className="flex items-center gap-3 min-w-0 z-10">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/30 flex-shrink-0 group-hover:scale-105 transition-transform">
            <Download className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight group-hover:text-emerald-400 transition-colors truncate">
                Downloaded
              </h2>
              <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Offline
              </span>
            </div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-300">
              {downloadedSongs.length} {downloadedSongs.length === 1 ? 'song' : 'songs'} • {formatBytes(storageInfo?.raagaXUsed || 0)} available offline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 z-10 flex-shrink-0">
          {downloadedSongs.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                haptics.mediumImpact();
                handlePlayAll(downloadedSongs, false);
              }}
              className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 flex items-center justify-center shadow-md shadow-emerald-500/35 transition-all cursor-pointer"
              title="Play All Downloaded Songs"
            >
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
        </div>
      </div>

      {/* ── GROUP 1: CORE COLLECTIONS ── */}
      <div className="rounded-2xl glass-deep border border-white/10 overflow-hidden divide-y divide-white/5">
        {[
          { id: 'playlists', label: 'Playlists', icon: ListMusic, color: 'text-purple-400', count: `${userPlaylists.length}` },
          { id: 'songs', label: 'Songs', icon: Music, color: 'text-cyan-400', count: `${downloadedSongs.length}` },
          { id: 'albums', label: 'Albums', icon: Disc, color: 'text-rose-400', count: `${downloadedAlbums.length || favoriteAlbumIds.length}` },
          { id: 'artists', label: 'Artists', icon: User, color: 'text-blue-400', count: `${favoriteArtistIds.length || POPULAR_ARTISTS.length}` },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className="w-full py-2.5 px-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
                  <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                </div>
                <span className="text-xs sm:text-sm font-bold text-white group-hover:text-white transition-colors">
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="text-[11px] font-mono text-slate-500 font-semibold">{item.count}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
              </div>
            </button>
          );
        })}
      </div>

      {/* ── GROUP 2: MADE FOR YOU, GENRES, HISTORY, INSIGHTS ── */}
      <div className="rounded-2xl glass-deep border border-white/10 overflow-hidden divide-y divide-white/5">
        {[
          { id: 'made_for_you', label: 'Made For You', icon: Sparkles, color: 'text-amber-400', subtitle: 'Personalized mixes' },
          { id: 'genres', label: 'Genres', icon: Layers, color: 'text-indigo-400', subtitle: '50 Indian & Global genres' },
          { id: 'history', label: 'Listening History', icon: Clock, color: 'text-orange-400', subtitle: `${historySongs.length} tracks` },
          { id: 'insights', label: 'Music Insights', icon: BarChart3, color: 'text-pink-400', subtitle: 'Analytics' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className="w-full py-2.5 px-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
                  <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-bold text-white block group-hover:text-white transition-colors">
                    {item.label}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">{item.subtitle}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
