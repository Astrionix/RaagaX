'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Heart, Play, Music, Shuffle, Loader2, Disc, Download, Check } from 'lucide-react';
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

export function FavoritesView() {
  const {
    queue,
    likedSongIds = [],
    likedSongs = [],
    cloudDownloadRecords = [],
    playSong,
    togglePlayPause,
    isPlaying,
    currentSong,
    toggleLikeSong,
    downloadedSongIds = [],
  } = usePlayerStore();

  const { downloadAlbum, removeDownload, tasks, isOfflineMode, nativeDownloadedTracks } = useDownloadStore();

  const [offlineTracks, setOfflineTracks] = useState<Song[]>([]);
  const [resolvedSongsMap, setResolvedSongsMap] = useState<Record<string, Song>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const resolvingRef = useRef<boolean>(false);

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
    const missingIds = likedSongIds.filter((id) => !knownMap.has(id));
    if (missingIds.length === 0 || resolvingRef.current) return;

    resolvingRef.current = true;
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
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
        resolvingRef.current = false;
      });
  }, [likedSongIds]);

  // Construct resolved liked songs list in exact reverse chronological order
  const resolvedLikedSongs: Song[] = likedSongIds
    .map((id) => knownMap.get(id))
    .filter((s): s is Song => Boolean(s))
    .map((song) => {
      const cover = song.coverUrl && !song.coverUrl.includes('/null/') ? song.coverUrl : '/app-icon.png';
      return {
        ...song,
        coverUrl: cover.replace('http://', 'https://'),
      };
    });

  const isLikedListPlaying = isPlaying && currentSong && resolvedLikedSongs.some((s) => s.id === currentSong.id);

  const downloadedSongsInFavorites = useMemo(() => {
    return resolvedLikedSongs.filter(s => {
      const isDownloaded = downloadedSongIds.includes(s.id) || !!nativeDownloadedTracks?.[s.id];
      const isTaskCompleted = tasks[s.id]?.status === 'COMPLETED';
      return isDownloaded || isTaskCompleted;
    });
  }, [resolvedLikedSongs, downloadedSongIds, nativeDownloadedTracks, tasks]);

  const pendingDownloadsCount = useMemo(() => {
    return resolvedLikedSongs.length - downloadedSongsInFavorites.length;
  }, [resolvedLikedSongs, downloadedSongsInFavorites]);

  const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());

  const handlePlayAll = (shuffle = false) => {
    if (resolvedLikedSongs.length === 0) return;
    haptics.mediumImpact();
    const tracklist = shuffle ? [...resolvedLikedSongs].sort(() => Math.random() - 0.5) : resolvedLikedSongs;
    usePlayerStore.getState().playSong(tracklist[0], tracklist, {
      contextType: 'LIKED_SONGS',
      contextUri: 'raagax:liked-songs',
      title: 'Liked Songs',
    });
  };

  const handleDownloadAll = async () => {
    if (resolvedLikedSongs.length === 0) return;
    const pending = resolvedLikedSongs.filter(s => !downloadedSongIds.includes(s.id));
    if (pending.length === 0) return;
    downloadAlbum('liked-songs', pending);
  };

  const totalDurationSec = resolvedLikedSongs.reduce((acc, s) => acc + (s.duration || 180), 0);
  const totalMins = Math.round(totalDurationSec / 60);

  return (
    <div className="space-y-6 pb-28 text-white select-none animate-in fade-in duration-200 max-w-7xl mx-auto">
      {/* ── HEADER BANNER: ♡ LIKED SONGS ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FA233B] to-[#b01020] flex items-center justify-center text-white shadow-xl shadow-red-500/25 flex-shrink-0">
            <Heart className="w-7 h-7 fill-current" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">Liked Songs</h1>
            <p className="text-xs sm:text-sm text-[#8E92A4] mt-0.5 font-medium">
              {resolvedLikedSongs.length} {resolvedLikedSongs.length === 1 ? 'track' : 'tracks'}
              {totalMins > 0 && ` • ~${totalMins} min`}
            </p>
          </div>
        </div>

        {/* Play All, Shuffle & Download All Buttons */}
        {resolvedLikedSongs.length > 0 && (
          <div className="grid grid-cols-3 gap-2 w-full max-w-md">
            <button
              onClick={() => handlePlayAll(false)}
              className="h-10 px-2 sm:px-4 rounded-full bg-[#FA233B] hover:bg-[#D90429] active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-[#FA233B]/25 transition-all cursor-pointer min-w-0"
              aria-label="Play all liked songs"
              title="Play Liked Songs from Track 1"
            >
              <Play className="w-3.5 h-3.5 fill-white flex-shrink-0" />
              <span className="truncate">Play All</span>
            </button>
            <button
              onClick={() => handlePlayAll(true)}
              className="h-10 px-2 sm:px-4 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-white/15 shadow-md transition-all cursor-pointer min-w-0"
              aria-label="Shuffle liked songs"
            >
              <Shuffle className="w-3.5 h-3.5 text-slate-200 flex-shrink-0" />
              <span className="truncate">Shuffle</span>
            </button>
            {isNative && pendingDownloadsCount > 0 && (
              <button
                onClick={handleDownloadAll}
                className="h-10 px-1.5 sm:px-3 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 transition-all cursor-pointer min-w-0"
                title="Download all liked songs for offline listening"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5] flex-shrink-0" />
                <span className="truncate">Download ({pendingDownloadsCount})</span>
              </button>
            )}
            {isNative && pendingDownloadsCount === 0 && (
              <div className="h-10 px-1.5 sm:px-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 min-w-0">
                <Check className="w-3.5 h-3.5 stroke-[2.5] flex-shrink-0" />
                <span className="truncate">Downloaded</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── LIKED SONGS LIST ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {isLoading && resolvedLikedSongs.length === 0 ? (
          <div className="py-20 text-center text-slate-500 space-y-3 bg-white/[0.02] rounded-3xl border border-white/5 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#FA233B] animate-spin" />
            <p className="text-xs font-bold text-white">Loading your liked songs...</p>
          </div>
        ) : resolvedLikedSongs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {resolvedLikedSongs.map((song, idx) => {
              const isCurrent = currentSong?.id === song.id;
              const isDownloaded = downloadedSongIds.includes(song.id);
              const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
              const isAppOffline = isOfflineMode || isBrowserOffline;
              const isSongOfflineUnavailable = isAppOffline && !isDownloaded;

              return (
                <SwipeableSongRow
                  key={`${song.id}-${idx}`}
                  song={song}
                  actionType="unlike"
                  actionLabel="Remove"
                  onSwipeAction={() => toggleLikeSong(song.id)}
                >
                  <div
                    className={`py-2.5 px-3 sm:px-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-all flex items-center justify-between group shadow-sm min-h-[64px] sm:min-h-[68px] ${
                      isCurrent ? 'border-red-500/40 ring-1 ring-red-500/20' : ''
                    } ${isSongOfflineUnavailable ? 'opacity-40 pointer-events-none select-none' : ''}`}
                  >
                    <div
                      className="flex items-center gap-3.5 cursor-pointer min-w-0 flex-1"
                      onClick={() => {
                        if (isSongOfflineUnavailable) return;
                        haptics.lightImpact();
                        usePlayerStore.getState().playSong(song, resolvedLikedSongs, {
                          contextType: 'LIKED_SONGS',
                          contextUri: 'raagax:liked-songs',
                          title: 'Liked Songs',
                        });
                      }}
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm flex-shrink-0 bg-slate-800 relative">
                        <OptimizedImage
                          src={song.coverUrl}
                          alt={song.title}
                          size="thumb"
                          className="w-full h-full object-cover"
                        />
                        {isCurrent && isPlaying && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Disc className="w-5 h-5 text-red-500 animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className={`text-xs sm:text-sm font-bold truncate group-hover:text-[#FA233B] transition-colors ${
                          isCurrent ? 'text-red-400 font-black' : 'text-[var(--text-primary)]'
                        }`}>
                          {song.title}
                        </h4>
                        <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                          {song.artist}
                        </p>
                      </div>
                    </div>

                    {/* Fixed Right-Side Action Column */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <DownloadStatusIndicator song={song} size="sm" />
                      </div>
                      <button
                        onClick={() => {
                          haptics.lightImpact();
                          toggleLikeSong(song.id);
                        }}
                        aria-label="Unlike song"
                        className="w-8 h-8 flex items-center justify-center text-[#FA233B] hover:scale-110 active:scale-95 transition-transform cursor-pointer flex-shrink-0"
                        title="Remove from Liked Songs"
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>
                      <SongActionMenu song={song} />
                    </div>
                  </div>
                </SwipeableSongRow>
              );
            })}
          </div>
        ) : (
          <div className="py-24 text-center text-slate-500 space-y-3 bg-white/[0.02] rounded-3xl border border-white/5 p-8">
            <Heart className="w-12 h-12 text-slate-600 mx-auto" />
            <h4 className="text-base font-bold text-white">No Liked Songs Yet</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Tap the heart icon on any song while listening to add it to your Liked Songs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
