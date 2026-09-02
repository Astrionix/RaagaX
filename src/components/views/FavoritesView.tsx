'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Heart, Play, Shuffle, Loader2, Disc, Download, Check,
  ArrowUpDown, Search, X, Clock
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { SongResolver } from '@/lib/discovery/SongResolver';
import { Song } from '@/types/music';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { SwipeableSongRow } from '@/components/common/SwipeableSongRow';
import { haptics } from '@/lib/haptics/HapticEngine';
import { QueueHistory } from '@/lib/queue/QueueHistory';
import { SongFormatter } from '@/lib/music/SongFormatter';

export type LikedSongSortOption =
  | 'recently_added'
  | 'oldest_added'
  | 'az'
  | 'artist'
  | 'album'
  | 'recently_played'
  | 'duration';

const SORT_OPTIONS: { value: LikedSongSortOption; label: string }[] = [
  { value: 'recently_added', label: 'Recently Added' },
  { value: 'oldest_added', label: 'Oldest Added' },
  { value: 'az', label: 'Song Name' },
  { value: 'artist', label: 'Artist' },
  { value: 'album', label: 'Album' },
  { value: 'recently_played', label: 'Recently Played' },
  { value: 'duration', label: 'Duration' },
];

const formatDuration = (sec: number | undefined | null): string => {
  if (!sec || isNaN(sec) || sec <= 0) return '3:30';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export function FavoritesView() {
  const {
    queue,
    likedSongIds = [],
    likedSongs = [],
    cloudDownloadRecords = [],
    isPlaying,
    currentSong,
    toggleLikeSong,
    downloadedSongIds = [],
    setActiveTab,
    setSelectedArtistId,
    setSelectedAlbumId,
  } = usePlayerStore();

  const { downloadAlbum, tasks, isOfflineMode, nativeDownloadedTracks } = useDownloadStore();

  const [offlineTracks, setOfflineTracks] = useState<Song[]>([]);
  const [resolvedSongsMap, setResolvedSongsMap] = useState<Record<string, Song>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const attemptedRef = useRef<Set<string>>(new Set());

  // Sorting & Filtering state
  const [sortBy, setSortBy] = useState<LikedSongSortOption>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('liked_songs_sort');
      if (saved) return saved as LikedSongSortOption;
    }
    return 'recently_added';
  });
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [historyEntries, setHistoryEntries] = useState<any[]>([]);

  useEffect(() => {
    QueueHistory.getInstance().ensureLoaded().then((entries) => {
      setHistoryEntries(entries);
    });
  }, []);

  // Instant local cache hydration if likedSongIds is empty on initial view mount
  useEffect(() => {
    if (likedSongIds.length === 0) {
      import('@/lib/auth/AccountIsolationGuard').then(({ AccountIsolationGuard }) => {
        const activeUserId = AccountIsolationGuard.getInstance().getActiveUserId();
        if (activeUserId) {
          import('@/lib/offline/LocalDatabase').then(({ LocalDatabase }) => {
            LocalDatabase.getInstance().getUserStore<string[]>(activeUserId, 'liked_songs').then((cached) => {
              if (cached && cached.length > 0 && usePlayerStore.getState().likedSongIds.length === 0) {
                usePlayerStore.setState({ likedSongIds: cached });
              }
            });
          });
          import('@/lib/sync/AccountSyncEngine').then(({ AccountSyncEngine }) => {
            AccountSyncEngine.getInstance().reconcile(activeUserId);
          }).catch(() => {});
        }
      });
    }
  }, [likedSongIds.length]);

  const handleSortChange = (opt: LikedSongSortOption) => {
    setSortBy(opt);
    if (typeof window !== 'undefined') {
      localStorage.setItem('liked_songs_sort', opt);
    }
  };

  useEffect(() => {
    const loadOffline = async () => {
      try {
        const { RaagaXNativeDownload } = await import('@/lib/playback/native/RaagaXNativeDownload');
        if (RaagaXNativeDownload.isNative()) {
          const tracks = await RaagaXNativeDownload.getDownloadedTracks();
          if (tracks && tracks.length > 0) {
            const mapped: Song[] = tracks.map((t) => ({
              id: t.songId || t.id,
              title: t.title,
              artist: t.artist,
              album: t.album || 'Downloaded',
              coverUrl: t.artworkUrl || t.coverUrl || '/app-icon.png',
              duration: 180,
              audioUrl: t.localPath || '',
              artistId: (t as any).artistId || '',
              albumId: (t as any).albumId || '',
              genre: 'Various',
              category: 'global_trending',
              releaseYear: new Date(t.completedAt || Date.now()).getFullYear(),
              plays: 0,
              likes: 1,
            }));
            setOfflineTracks(mapped);
            return;
          }
        }
      } catch (e) {
        console.warn('Native offline fetch error:', e);
      }

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
            artistId: (t as any).artistId || '',
            albumId: (t as any).albumId || '',
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
    };

    loadOffline();
  }, [likedSongIds.length]);

  // Combine known store songs, queue, and offline tracks into seed map
  const knownMap = new Map<string, Song>();
  likedSongs.forEach((s) => { if (s?.id) knownMap.set(s.id, s); });
  queue.forEach((s) => { if (s?.id) knownMap.set(s.id, s); });
  offlineTracks.forEach((s) => { if (s?.id) knownMap.set(s.id, s); });
  Object.values(resolvedSongsMap).forEach((s) => { if (s?.id) knownMap.set(s.id, s); });
  cloudDownloadRecords.forEach((r) => {
    if (r?.song_id && !knownMap.has(r.song_id)) {
      knownMap.set(r.song_id, {
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
    const missingIds = likedSongIds.filter((id) => !knownMap.has(id) && !attemptedRef.current.has(id));
    if (missingIds.length === 0) return;

    missingIds.forEach((id) => attemptedRef.current.add(id));

    setIsLoading(true);
    SongResolver.resolveSongs(missingIds)
      .then((songs) => {
        if (songs && songs.length > 0) {
          const newEntries: Record<string, Song> = {};
          songs.forEach((s) => {
            if (s && s.id) {
              newEntries[s.id] = s;
            }
          });
          setResolvedSongsMap((prev) => ({ ...prev, ...newEntries }));
        }
      })
      .catch((err) => {
        console.error('[FavoritesView] Error resolving songs:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [likedSongIds, resolvedSongsMap, likedSongs, offlineTracks]);

  // Construct resolved liked songs list in exact reverse chronological order
  const resolvedLikedSongs: Song[] = useMemo(() => {
    const seen = new Set<string>();
    const list: Song[] = [];

    likedSongIds.forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);

      const song = knownMap.get(id);
      if (song) {
        const cover = song.coverUrl && !song.coverUrl.includes('/null/') ? song.coverUrl : '/app-icon.png';
        list.push({
          ...song,
          coverUrl: cover.replace('http://', 'https://'),
        });
      } else {
        list.push({
          id,
          title: 'Unknown Track',
          artist: 'Unknown Artist',
          artistId: '',
          album: 'Liked Songs',
          albumId: '',
          coverUrl: '/app-icon.png',
          audioUrl: '',
          duration: 180,
          genre: 'Unknown',
          category: 'global_trending',
          releaseYear: new Date().getFullYear(),
          plays: 0,
          likes: 1,
        } as Song);
      }
    });

    return list;
  }, [likedSongIds, resolvedSongsMap, offlineTracks, likedSongs]);

  // Generate play history metadata map for Liked Songs sorting
  const { lastPlayedMap } = useMemo(() => {
    const lastPlayed = new Map<string, number>();
    historyEntries.forEach((entry) => {
      if (entry.trackId) {
        lastPlayed.set(entry.trackId, entry.startedAt);
      }
    });
    return { lastPlayedMap: lastPlayed };
  }, [historyEntries]);

  // Apply active sort order locally across 100% of collection
  const sortedSongs: Song[] = useMemo(() => {
    if (!resolvedLikedSongs.length) return [];
    const list = [...resolvedLikedSongs];
    switch (sortBy) {
      case 'recently_added':
        return list;
      case 'oldest_added':
        return [...list].reverse();
      case 'az':
        return list.sort((a, b) => {
          const tA = SongFormatter.cleanSongTitle(a.title || '').toLowerCase();
          const tB = SongFormatter.cleanSongTitle(b.title || '').toLowerCase();
          const diff = tA.localeCompare(tB);
          return diff !== 0 ? diff : a.id.localeCompare(b.id);
        });
      case 'artist':
        return list.sort((a, b) => {
          const artistDiff = (a.artist || '').toLowerCase().localeCompare((b.artist || '').toLowerCase());
          if (artistDiff !== 0) return artistDiff;
          const titleDiff = (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
          return titleDiff !== 0 ? titleDiff : a.id.localeCompare(b.id);
        });
      case 'album':
        return list.sort((a, b) => {
          const albumDiff = (a.album || '').toLowerCase().localeCompare((b.album || '').toLowerCase());
          if (albumDiff !== 0) return albumDiff;
          const titleDiff = (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
          return titleDiff !== 0 ? titleDiff : a.id.localeCompare(b.id);
        });
      case 'recently_played':
        return list.sort((a, b) => {
          const timeA = lastPlayedMap.get(a.id) || 0;
          const timeB = lastPlayedMap.get(b.id) || 0;
          const diff = timeB - timeA;
          return diff !== 0 ? diff : a.id.localeCompare(b.id);
        });
      case 'duration':
        return list.sort((a, b) => {
          const diff = (b.duration || 0) - (a.duration || 0);
          return diff !== 0 ? diff : a.id.localeCompare(b.id);
        });
      default:
        return list;
    }
  }, [resolvedLikedSongs, sortBy, lastPlayedMap]);

  // Apply search query filter if entered
  const displaySongs: Song[] = useMemo(() => {
    if (!searchQuery.trim()) return sortedSongs;
    const q = searchQuery.toLowerCase().trim();
    return sortedSongs.filter((s) =>
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.artist && s.artist.toLowerCase().includes(q)) ||
      (s.album && s.album.toLowerCase().includes(q))
    );
  }, [sortedSongs, searchQuery]);

  const downloadedSongsInFavorites = useMemo(() => {
    return displaySongs.filter((s) => {
      const isDownloaded = downloadedSongIds.includes(s.id) || !!nativeDownloadedTracks?.[s.id];
      const isTaskCompleted = tasks[s.id]?.status === 'COMPLETED';
      return isDownloaded || isTaskCompleted;
    });
  }, [displaySongs, downloadedSongIds, nativeDownloadedTracks, tasks]);

  const pendingDownloadsCount = useMemo(() => {
    return displaySongs.length - downloadedSongsInFavorites.length;
  }, [displaySongs, downloadedSongsInFavorites]);

  const handlePlayAll = (shuffle = false) => {
    if (displaySongs.length === 0) return;
    haptics.mediumImpact();
    const tracklist = shuffle ? [...displaySongs].sort(() => Math.random() - 0.5) : displaySongs;
    usePlayerStore.getState().playSong(tracklist[0], tracklist, {
      contextType: 'LIKED_SONGS',
      contextUri: 'raagax:liked-songs',
      title: 'Liked Songs',
    });
  };

  const handleDownloadAll = async () => {
    if (displaySongs.length === 0) return;
    const pending = displaySongs.filter((s) => !downloadedSongIds.includes(s.id));
    if (pending.length === 0) return;
    downloadAlbum('liked-songs', pending);
  };

  const formattedTotalDuration = useMemo(() => {
    const totalDurationSec = displaySongs.reduce((acc, s) => acc + (s.duration || 210), 0);
    const totalMins = Math.round(totalDurationSec / 60);
    if (totalMins <= 0) return '';
    const hours = Math.floor(totalMins / 60);
    const minutes = totalMins % 60;
    if (hours > 0) {
      return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
    }
    return `${minutes} min`;
  }, [displaySongs]);

  return (
    <div className="space-y-4 pb-4 text-white select-none animate-in fade-in duration-200 max-w-7xl mx-auto px-4 sm:px-8 md:px-10 lg:px-12 pt-5 sm:pt-7">
      {/* ── HEADER AREA (Apple Music Style Density) ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
            Liked Songs
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {displaySongs.length} {displaySongs.length === 1 ? 'song' : 'songs'}
            {searchQuery.trim() && resolvedLikedSongs.length !== displaySongs.length && (
              <span className="text-slate-500 ml-1"> (filtered from {resolvedLikedSongs.length})</span>
            )}
            {formattedTotalDuration && ` • ${formattedTotalDuration}`}
          </p>
        </div>

        {/* Action Controls: Play, Shuffle, Sort, Search */}
        {displaySongs.length > 0 && (
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Play Button */}
            <button
              onClick={() => handlePlayAll(false)}
              className="h-9 px-4 rounded-full bg-[#FA233B] hover:bg-[#D90429] active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#FA233B]/25 transition-all cursor-pointer"
              title="Play all liked songs"
            >
              <Play className="w-3.5 h-3.5 fill-white flex-shrink-0" />
              <span>Play</span>
            </button>

            {/* Shuffle Button */}
            <button
              onClick={() => handlePlayAll(true)}
              className="h-9 px-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all cursor-pointer"
              title="Shuffle liked songs"
            >
              <Shuffle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              <span>Shuffle</span>
            </button>

            {/* Sort Selector Dropdown */}
            <div className="relative z-20">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="h-9 px-3.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#FA233B]" />
                <span>
                  Sort: {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Recently Added'} ▾
                </span>
              </button>

              {showSortMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowSortMenu(false)}
                  />
                  <div className="absolute right-0 sm:left-0 top-full mt-1.5 w-52 bg-[#161722] border border-white/15 rounded-2xl p-1.5 shadow-2xl z-30 text-xs animate-in zoom-in-95 duration-100 divide-y divide-white/5">
                    <div className="p-1 space-y-0.5">
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            haptics.lightImpact();
                            handleSortChange(opt.value);
                            setShowSortMenu(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl transition-colors flex items-center justify-between cursor-pointer ${
                            sortBy === opt.value
                              ? 'bg-[#FA233B]/20 text-red-400 font-bold'
                              : 'hover:bg-white/10 text-slate-300 hover:text-white'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {sortBy === opt.value && <Check className="w-3.5 h-3.5 text-[#FA233B] stroke-[3]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Quick Search Bar */}
            <div className="relative min-w-[140px] sm:w-48">
              <Search className="w-3 h-3 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                autoComplete="off"
                spellCheck={false}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter songs..."
                className="w-full bg-white/[0.05] border border-white/10 text-xs text-white placeholder-slate-500 rounded-full pl-8 pr-7 py-2 outline-none focus:border-[#FA233B]/60 focus:bg-black/40 transition-all font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white cursor-pointer"
                  title="Clear filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── LIKED SONGS LIST / TABLE ─────────────────────────────────────────── */}
      <div>
        {isLoading && resolvedLikedSongs.length === 0 ? (
          <div className="py-20 text-center text-slate-500 space-y-3 bg-white/[0.02] rounded-2xl border border-white/5 flex flex-col items-center justify-center">
            <Loader2 className="w-7 h-7 text-[#FA233B] animate-spin" />
            <p className="text-xs font-bold text-slate-300">Loading your liked songs...</p>
          </div>
        ) : displaySongs.length > 0 ? (
          <div>
            {/* ── DESKTOP MUSIC TABLE (Apple Music Density) ─────────────────── */}
            <div className="hidden md:block">
              {/* Table Header (Sticky) */}
              <div className="sticky top-0 z-10 bg-[#0a0b10]/90 backdrop-blur-md border-b border-white/[0.06] py-2 px-3 grid grid-cols-[40px_minmax(220px,2fr)_minmax(140px,1.2fr)_minmax(140px,1.2fr)_70px_60px] items-center gap-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none mb-1">
                <div className="text-center">#</div>
                <div>Song</div>
                <div>Artist</div>
                <div>Album</div>
                <div className="text-right flex items-center justify-end gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>Time</span>
                </div>
                <div className="text-right"></div>
              </div>

              {/* Table Rows */}
              <div className="space-y-0.5">
                {displaySongs.map((song, idx) => {
                  const isCurrent = currentSong?.id === song.id;
                  const displayTitle = SongFormatter.cleanSongTitle(song.title);
                  const displayArtist = SongFormatter.decodeHtml(song.artist);
                  const displayAlbum = SongFormatter.decodeHtml(song.album);
                  const isDownloaded = downloadedSongIds.includes(song.id);
                  const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
                  const isAppOffline = isOfflineMode || isBrowserOffline;
                  const isSongOfflineUnavailable = isAppOffline && !isDownloaded;

                  return (
                    <div
                      key={`desktop-liked-${song.id}-${idx}`}
                      onClick={() => {
                        if (isSongOfflineUnavailable) return;
                        haptics.lightImpact();
                        usePlayerStore.getState().playSong(song, displaySongs, {
                          contextType: 'LIKED_SONGS',
                          contextUri: 'raagax:liked-songs',
                          title: 'Liked Songs',
                        });
                      }}
                      className={`grid grid-cols-[40px_minmax(220px,2fr)_minmax(140px,1.2fr)_minmax(140px,1.2fr)_70px_60px] items-center gap-3 py-1.5 px-3 rounded-xl transition-all cursor-pointer group select-none border border-transparent ${
                        isCurrent
                          ? 'bg-white/[0.08] border-[#FA233B]/30'
                          : 'hover:bg-white/[0.04]'
                      } ${isSongOfflineUnavailable ? 'opacity-40 pointer-events-none' : ''}`}
                    >
                      {/* 1. Track Number / Play Icon */}
                      <div className="flex items-center justify-center text-center">
                        {isCurrent && isPlaying ? (
                          <Disc className="w-4 h-4 text-[#FA233B] animate-spin" />
                        ) : (
                          <>
                            <span className={`text-xs font-mono font-medium ${isCurrent ? 'text-[#FA233B] font-bold' : 'text-slate-400'} group-hover:hidden`}>
                              {idx + 1}
                            </span>
                            <Play className="w-3.5 h-3.5 fill-white text-white group-hover:block hidden" />
                          </>
                        )}
                      </div>

                      {/* 2. Song Name + Artwork */}
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-900 shadow-sm border border-white/5 relative">
                          <OptimizedImage
                            src={song.coverUrl}
                            alt={displayTitle}
                            size="thumb"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className={`text-xs sm:text-sm font-semibold truncate transition-colors ${
                            isCurrent ? 'text-[#FA233B] font-black' : 'text-white group-hover:text-[#FA233B]'
                          }`}>
                            {displayTitle}
                          </h4>
                        </div>
                      </div>

                      {/* 3. Artist */}
                      <div
                        onClick={(e) => {
                          if (song.artistId) {
                            e.stopPropagation();
                            setSelectedArtistId(song.artistId);
                            setActiveTab('artist');
                          }
                        }}
                        className="text-xs text-slate-400 truncate hover:text-white hover:underline transition-colors"
                      >
                        {displayArtist || 'Unknown Artist'}
                      </div>

                      {/* 4. Album */}
                      <div
                        onClick={(e) => {
                          if (song.albumId || song.album) {
                            e.stopPropagation();
                            const targetAlbum = song.albumId || song.album;
                            setSelectedAlbumId(targetAlbum);
                            setActiveTab('album');
                          }
                        }}
                        className="text-xs text-slate-400 truncate hover:text-white hover:underline transition-colors"
                      >
                        {displayAlbum || 'Unknown Album'}
                      </div>

                      {/* 5. Time (Duration) */}
                      <div className="text-xs font-mono text-slate-400 text-right pr-1">
                        {formatDuration(song.duration)}
                      </div>

                      {/* 6. Actions */}
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            haptics.lightImpact();
                            toggleLikeSong(song.id);
                          }}
                          aria-label="Unlike song"
                          className="w-7 h-7 flex items-center justify-center text-[#FA233B] hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                          title="Remove from Liked Songs"
                        >
                          <Heart className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <SongActionMenu song={song} horizontal={true} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── MOBILE LIST (Compact Rows) ─────────────────────────────────── */}
            <div className="md:hidden space-y-1">
              {displaySongs.map((song, idx) => {
                const isCurrent = currentSong?.id === song.id;
                const displayTitle = SongFormatter.cleanSongTitle(song.title);
                const displayArtist = SongFormatter.decodeHtml(song.artist);
                const displayAlbum = SongFormatter.decodeHtml(song.album);
                const isDownloaded = downloadedSongIds.includes(song.id);
                const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
                const isAppOffline = isOfflineMode || isBrowserOffline;
                const isSongOfflineUnavailable = isAppOffline && !isDownloaded;

                return (
                  <SwipeableSongRow
                    key={`mobile-liked-${song.id}-${idx}`}
                    song={song}
                    actionType="unlike"
                    actionLabel="Remove"
                    onSwipeAction={() => toggleLikeSong(song.id)}
                  >
                    <div
                      onClick={() => {
                        if (isSongOfflineUnavailable) return;
                        haptics.lightImpact();
                        usePlayerStore.getState().playSong(song, displaySongs, {
                          contextType: 'LIKED_SONGS',
                          contextUri: 'raagax:liked-songs',
                          title: 'Liked Songs',
                        });
                      }}
                      className={`py-2 px-3 rounded-xl transition-colors flex items-center justify-between group min-h-[56px] border border-transparent ${
                        isCurrent ? 'bg-white/[0.08] border-[#FA233B]/30' : 'hover:bg-white/[0.04]'
                      } ${isSongOfflineUnavailable ? 'opacity-40 pointer-events-none select-none' : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-slate-900 relative shadow-sm border border-white/5">
                          <OptimizedImage
                            src={song.coverUrl}
                            alt={displayTitle}
                            size="thumb"
                            className="w-full h-full object-cover"
                          />
                          {isCurrent && isPlaying && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Disc className="w-4 h-4 text-[#FA233B] animate-spin" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className={`text-xs sm:text-sm font-semibold truncate ${
                            isCurrent ? 'text-[#FA233B] font-bold' : 'text-white'
                          }`}>
                            {displayTitle}
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {displayArtist}{displayAlbum ? ` • ${displayAlbum}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] font-mono text-slate-400 pr-1">
                          {formatDuration(song.duration)}
                        </span>
                        <button
                          onClick={() => {
                            haptics.lightImpact();
                            toggleLikeSong(song.id);
                          }}
                          aria-label="Unlike song"
                          className="w-7 h-7 flex items-center justify-center text-[#FA233B] hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                          title="Remove from Liked Songs"
                        >
                          <Heart className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <SongActionMenu song={song} horizontal={true} />
                      </div>
                    </div>
                  </SwipeableSongRow>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-24 text-center text-slate-500 space-y-4 bg-white/[0.01] rounded-3xl border border-dashed border-white/10 p-8 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-full bg-[#FA233B]/10 border border-[#FA233B]/20 flex items-center justify-center text-[#FA233B] mx-auto shadow-lg shadow-red-500/10">
              <Heart className="w-7 h-7 fill-current" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">Liked Songs</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Your liked songs will appear here. Tap the heart icon on any track to add it to your library.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('new')}
              className="px-6 py-2 rounded-full bg-[#FA233B] hover:bg-[#d91c2e] text-white font-bold text-xs shadow-lg shadow-red-500/25 active:scale-95 transition-all cursor-pointer"
            >
              Discover Music
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
