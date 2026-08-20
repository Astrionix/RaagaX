'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Play, Pause, Heart, ArrowLeft, Shuffle, Music, Clock, Disc,
  Download, Check, MoreVertical, ArrowUpDown, Sparkles, User, Share2, ListPlus, Loader2
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { AlbumCatalogEngine, AlbumItem } from '@/lib/albumCatalog';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';
import { Song } from '@/types/music';
import { haptics } from '@/lib/haptics/HapticEngine';

type SortOption = 'default' | 'az' | 'za' | 'popular';

export function AlbumDetailView() {
  const {
    selectedAlbumId,
    setSelectedAlbumId,
    setSelectedArtistId,
    setActiveTab,
    playSong,
    currentSong,
    isPlaying,
    togglePlayPause,
    setToastMessage,
    setRemoteState,
    likedSongIds,
    toggleLikeSong,
    favoriteAlbumIds,
    toggleFavoriteAlbum,
    downloadedSongIds,
    preferredLanguage
  } = usePlayerStore();

  const {
    tasks,
    saveForOffline,
    removeDownload,
  } = useDownloadStore();

  const [album, setAlbum] = useState<AlbumItem | null>(() => {
    if (!selectedAlbumId) return null;
    return AlbumCatalogEngine.getAlbumById(selectedAlbumId, preferredLanguage) || null;
  });

  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showAlbumMenu, setShowAlbumMenu] = useState(false);
  const isLikedAlbum = selectedAlbumId ? favoriteAlbumIds.includes(selectedAlbumId) : false;

  useEffect(() => {
    if (!selectedAlbumId) return;

    let isMounted = true;
    const baseAlbum = AlbumCatalogEngine.getAlbumById(selectedAlbumId, preferredLanguage);
    if (baseAlbum) setAlbum(prev => prev || baseAlbum);

    setIsLoadingTracks(true);

    const loadRealTracks = async () => {
      try {
        const { RealMusicEngine } = await import('@/lib/realMusicEngine');
        const details = await RealMusicEngine.getInstance().getPlaylistDetails(`album:${selectedAlbumId}`);

        if (details && isMounted) {
          setAlbum(prev => ({
            id: details.id || selectedAlbumId,
            title: details.title || prev?.title || 'Album Details',
            artist: prev?.artist || 'Various Artists',
            coverUrl: details.coverUrl || prev?.coverUrl || '',
            releaseDate: prev?.releaseDate || '2024-01-01',
            releaseYear: prev?.releaseYear || 2024,
            trackCount: details.songs.length || prev?.trackCount || 0,
            durationSec: details.songs.reduce((s, t) => s + (t.duration || 210), 0),
            language: preferredLanguage,
            albumType: details.songs.length > 6 ? 'album' : 'ep',
            freshnessScore: prev?.freshnessScore || 90,
            trendingScore: prev?.trendingScore || 90,
            topScore: prev?.topScore || 90,
            tracks: details.songs
          }));
        }
      } catch (err) {
        console.error('Failed to load real album tracks:', err);
      } finally {
        if (isMounted) setIsLoadingTracks(false);
      }
    };

    loadRealTracks();

    return () => {
      isMounted = false;
    };
  }, [selectedAlbumId, preferredLanguage]);

  // Derived sorted tracks (non-destructive)
  const sortedTracks = useMemo(() => {
    if (!album?.tracks) return [];
    const list = [...album.tracks];

    if (sortOption === 'az') {
      return list.sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortOption === 'za') {
      return list.sort((a, b) => b.title.localeCompare(a.title));
    }
    if (sortOption === 'popular') {
      return list.sort((a, b) => (b.plays || 0) - (a.plays || 0));
    }
    return list;
  }, [album?.tracks, sortOption]);

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center p-8 select-none">
        <Disc className="w-16 h-16 text-[#fa233b] mb-4 animate-spin" />
        <h2 className="text-xl font-bold text-white mb-2">Loading Album...</h2>
        <button
          onClick={() => setActiveTab('album')}
          className="px-5 py-2.5 rounded-full bg-[#fa233b] text-white text-xs font-bold hover:scale-105 transition-transform mt-4"
        >
          Browse Albums
        </button>
      </div>
    );
  }

  const tracks = album.tracks || [];
  const downloadedCount = tracks.filter(t => downloadedSongIds.includes(t.id)).length;
  const isAllDownloaded = tracks.length > 0 && downloadedCount === tracks.length;
  const isPartialDownloaded = downloadedCount > 0 && !isAllDownloaded;
  const downloadingCount = tracks.filter(t => {
    const task = tasks[t.id];
    return task && (task.status === 'DOWNLOADING' || task.status === 'QUEUED');
  }).length;
  const isDownloadingAlbum = downloadingCount > 0;

  const isCurrentAlbumPlaying = tracks.some(t => t.id === currentSong?.id) && isPlaying;

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    haptics.mediumImpact();
    if (isCurrentAlbumPlaying) {
      togglePlayPause();
    } else {
      setRemoteState({ shuffleMode: 'OFF' });
      playSong(tracks[0], tracks);
    }
  };

  const handleShufflePlay = () => {
    if (tracks.length === 0) return;
    haptics.mediumImpact();
    usePlayerStore.getState().shufflePlay(tracks, {
      contextType: 'ALBUM',
      contextUri: `raagax:album:${album.id}`,
      title: album.title,
    });
  };

  const handleDownloadAll = () => {
    haptics.lightImpact();
    const toDownload = tracks.filter(t => !downloadedSongIds.includes(t.id));
    if (toDownload.length === 0) {
      setToastMessage('All songs in this album are already downloaded!');
      return;
    }
    toDownload.forEach(track => saveForOffline(track));
    setToastMessage(`Downloading ${toDownload.length} songs from ${album.title}...`);
  };

  const handleRemoveAllDownloads = () => {
    haptics.lightImpact();
    tracks.forEach(track => {
      if (downloadedSongIds.includes(track.id)) {
        removeDownload(track.id);
      }
    });
    setToastMessage(`Removed album downloads from local storage`);
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${mins}:${remainingSec.toString().padStart(2, '0')}`;
  };

  const totalMin = Math.round((album.durationSec || 0) / 60);

  const coverUrl = album.coverUrl && !album.coverUrl.includes('/null/')
    ? album.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  return (
    <div className="relative min-h-screen text-white pb-36 select-none animate-in fade-in duration-300">
      {/* ── ATMOSPHERIC DYNAMIC BACKGROUND ────────────────────────────────── */}
      <div
        className="absolute top-0 inset-x-0 h-[480px] pointer-events-none blur-[140px] opacity-35 scale-[1.25] transition-all duration-1000 -z-10"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 25%, var(--chameleon-primary, #fa233b) 0%, var(--chameleon-secondary, #8b5cf6) 40%, transparent 75%)`,
        }}
      />
      <div
        className="absolute top-0 inset-x-0 h-[420px] pointer-events-none blur-[100px] opacity-25 -z-10"
        style={{
          backgroundImage: `url(${coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* ── TOP NAVIGATION BAR ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 py-4 backdrop-blur-xl bg-[#08090d]/80 border-b border-white/5">
        <button
          onClick={() => setActiveTab('album')}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Albums</span>
        </button>

        <h2 className="text-sm font-bold text-white/90 truncate max-w-[240px] sm:max-w-[400px]">
          {album.title}
        </h2>

        <div className="relative">
          <button
            onClick={() => setShowAlbumMenu(!showAlbumMenu)}
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Album Context Popover */}
          {showAlbumMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-2 w-56 bg-[#12131c]/98 backdrop-blur-2xl border border-white/15 rounded-2xl p-2 shadow-2xl z-50 text-xs animate-in zoom-in-95 duration-150"
            >
              <button
                onClick={() => {
                  handlePlayAll();
                  setShowAlbumMenu(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 font-bold"
              >
                <Play className="w-4 h-4 text-[#fa233b] fill-current" /> Play Album
              </button>
              <button
                onClick={() => {
                  handleShufflePlay();
                  setShowAlbumMenu(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 font-bold"
              >
                <Shuffle className="w-4 h-4 text-white/70" /> Shuffle Play
              </button>
              <button
                onClick={() => {
                  if (isAllDownloaded) handleRemoveAllDownloads();
                  else handleDownloadAll();
                  setShowAlbumMenu(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 font-bold"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                {isAllDownloaded ? 'Remove All Downloads' : 'Download Album'}
              </button>
              <div className="h-px bg-white/10 my-1" />
              <button
                onClick={() => {
                  if (album.artist) {
                    setSelectedArtistId(album.artist);
                    setActiveTab('artist');
                  }
                  setShowAlbumMenu(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/70 hover:text-white"
              >
                <User className="w-4 h-4" /> Go to Artist
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: album.title, text: `Listen to "${album.title}" on RaagaX!`, url: window.location.href });
                  } else {
                    setToastMessage('Album link copied to clipboard');
                  }
                  setShowAlbumMenu(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/70 hover:text-white"
              >
                <Share2 className="w-4 h-4" /> Share Album
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── ALBUM HERO SECTION ────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-8">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 text-center md:text-left">
          {/* 3D Elevated Album Artwork */}
          <div className="relative w-52 h-52 sm:w-64 sm:h-64 rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-white/15 flex-shrink-0 group">
            <img
              src={coverUrl}
              alt={album.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-3xl pointer-events-none" />
          </div>

          {/* Album Information */}
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold uppercase tracking-wider text-slate-300">
              <Disc className="w-3.5 h-3.5 text-[#fa233b]" />
              <span>{album.albumType === 'ep' ? 'EP' : 'Album'}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              {album.title}
            </h1>

            <p
              onClick={() => {
                if (album.artist) {
                  setSelectedArtistId(album.artist);
                  setActiveTab('artist');
                }
              }}
              className="text-base sm:text-lg font-bold text-slate-300 hover:text-white transition-colors cursor-pointer inline-block"
            >
              {album.artist}
            </p>

            {/* Metadata Line */}
            <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-slate-400 font-medium pt-1">
              <span>{album.releaseYear || '2024'}</span>
              <span>•</span>
              <span className="capitalize">{album.language || preferredLanguage}</span>
              <span>•</span>
              <span>{tracks.length} Songs</span>
              {totalMin > 0 && (
                <>
                  <span>•</span>
                  <span>{totalMin} min</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── ACTION BUTTONS ROW ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3.5 mt-8 pt-6 border-t border-white/10">
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#fa233b] hover:bg-[#d91e32] text-white font-black text-sm shadow-xl shadow-red-500/25 active:scale-95 transition-all cursor-pointer"
          >
            {isCurrentAlbumPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-white" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white ml-0.5" /> Play
              </>
            )}
          </button>

          <button
            onClick={handleShufflePlay}
            className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <Shuffle className="w-4 h-4" /> Shuffle
          </button>

          {/* Smart Download All Button */}
          <button
            onClick={isAllDownloaded ? handleRemoveAllDownloads : handleDownloadAll}
            className={`flex items-center gap-2 px-5 py-3.5 rounded-full font-bold text-sm border transition-all active:scale-95 cursor-pointer ${
              isAllDownloaded
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : isDownloadingAlbum
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/90'
            }`}
          >
            {isDownloadingAlbum ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Downloading ({downloadingCount})</span>
              </>
            ) : isAllDownloaded ? (
              <>
                <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                <span>Downloaded</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>{isPartialDownloaded ? `Download (${tracks.length - downloadedCount} left)` : 'Download All'}</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (selectedAlbumId) {
                toggleFavoriteAlbum(selectedAlbumId);
                setToastMessage(isLikedAlbum ? 'Removed album from Favorites' : 'Saved album to Favorites');
              }
            }}
            className={`p-3.5 rounded-full border transition-all active:scale-95 cursor-pointer ${
              isLikedAlbum
                ? 'bg-red-500/15 border-red-500/30 text-[#fa233b]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
            }`}
            title={isLikedAlbum ? 'Remove from Favorites' : 'Favorite Album'}
          >
            <Heart className={`w-5 h-5 ${isLikedAlbum ? 'fill-current text-[#fa233b]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── TRACK LIST SECTION ────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8">
        {/* Track List Header & Sort Option */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Songs ({tracks.length})
          </h3>

          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>
                {sortOption === 'default' ? 'Track Order' : sortOption === 'az' ? 'A → Z' : sortOption === 'za' ? 'Z → A' : 'Most Popular'}
              </span>
            </button>

            {showSortMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 w-44 bg-[#141520] border border-white/15 rounded-xl p-1.5 shadow-2xl z-30 text-xs"
              >
                {(['default', 'az', 'za', 'popular'] as SortOption[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setSortOption(opt);
                      setShowSortMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg transition-colors font-medium ${
                      sortOption === opt ? 'bg-[#fa233b] text-white font-bold' : 'hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    {opt === 'default' ? 'Track Order' : opt === 'az' ? 'A → Z' : opt === 'za' ? 'Z → A' : 'Most Popular'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Track List Rows */}
        {isLoadingTracks ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : sortedTracks.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-sm font-semibold">No songs available in this album.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedTracks.map((track: Song, idx: number) => {
              const isPlayingCurrent = currentSong?.id === track.id;
              const trackNum = (idx + 1).toString().padStart(2, '0');

              return (
                <div
                  key={track.id}
                  onClick={() => playSong(track, sortedTracks)}
                  className={`group flex items-center justify-between gap-3 p-3 rounded-2xl transition-all cursor-pointer select-none ${
                    isPlayingCurrent
                      ? 'bg-red-500/15 border border-red-500/30 text-white shadow-lg shadow-red-500/10'
                      : 'hover:bg-white/5 text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  {/* Left: Track Number / Waveform */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-7 text-center flex-shrink-0 flex items-center justify-center">
                      {isPlayingCurrent ? (
                        <div className="flex items-end gap-[2px] h-4">
                          <span className={`w-1 bg-[#fa233b] rounded-full ${isPlaying ? 'animate-pulse' : ''} h-4`} />
                          <span className={`w-1 bg-[#fa233b] rounded-full ${isPlaying ? 'animate-pulse' : ''} h-2.5`} style={{ animationDelay: '150ms' }} />
                          <span className={`w-1 bg-[#fa233b] rounded-full ${isPlaying ? 'animate-pulse' : ''} h-3.5`} style={{ animationDelay: '300ms' }} />
                        </div>
                      ) : (
                        <span className="text-xs font-mono font-bold text-slate-500 group-hover:text-slate-300">
                          {trackNum}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className={`text-sm font-bold truncate leading-snug ${isPlayingCurrent ? 'text-[#fa233b]' : 'text-white'}`}>
                        {track.title}
                      </h4>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {track.artist}
                      </p>
                    </div>
                  </div>

                  {/* Right: Duration + Download Status + Actions Menu */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-mono text-slate-500 hidden sm:inline">
                      {formatDuration(track.duration || 210)}
                    </span>

                    <DownloadStatusIndicator song={track} size="sm" />

                    <SongActionMenu song={track} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
