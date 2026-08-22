'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Play, Pause, Heart, ArrowLeft, Shuffle, Music, Clock, Disc,
  Download, Check, MoreVertical, ArrowUpDown, Sparkles, User, Share2, ListPlus, Loader2, Plus
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { AlbumCatalogEngine, AlbumItem } from '@/lib/albumCatalog';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';
import { Song } from '@/types/music';
import { haptics } from '@/lib/haptics/HapticEngine';
import { DynamicArtworkAtmosphere } from '@/components/common/DynamicArtworkAtmosphere';
import { NavigationStack } from '@/lib/navigation/NavigationStack';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';

import { getApiUrl } from '@/lib/config/apiConfig';

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
    nativeDownloadedTracks,
    saveForOffline,
    removeDownload,
    downloadAlbum,
    getAlbumDownloadStatus,
  } = useDownloadStore();

  const [album, setAlbum] = useState<AlbumItem | null>(() => {
    if (!selectedAlbumId || selectedAlbumId === 'offline') return null;
    return AlbumCatalogEngine.getAlbumById(selectedAlbumId, preferredLanguage) || null;
  });

  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showAlbumMenu, setShowAlbumMenu] = useState(false);
  const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
  const isLikedAlbum = selectedAlbumId ? favoriteAlbumIds.includes(selectedAlbumId) : false;

  useEffect(() => {
    if (!selectedAlbumId || selectedAlbumId === 'offline') {
      setIsLoadingTracks(false);
      return;
    }

    let isMounted = true;
    const baseAlbum = AlbumCatalogEngine.getAlbumById(selectedAlbumId, preferredLanguage);
    if (baseAlbum) setAlbum(prev => prev || baseAlbum);

    setIsLoadingTracks(true);

    const loadRealTracks = async () => {
      try {
        if (selectedAlbumId === 'offline' || selectedAlbumId.startsWith('alb-') || selectedAlbumId === 'unknown') {
          console.log(`[LIBRARY_ALBUM_ID_MISSING]\ntrackId=\nalbumName=${baseAlbum?.title || ''}\nartist=${baseAlbum?.artist || ''}`);
        }

        let mappedTracks: Song[] = [];
        let albName = (baseAlbum?.title || album?.title || '').trim();
        if (albName.toLowerCase() === 'offline') albName = '';
        let primaryArtist = baseAlbum?.artist || album?.artist || 'Various Artists';
        let albCover = baseAlbum?.coverUrl || album?.coverUrl || '/app-icon.png';
        let albYear = baseAlbum?.releaseYear || album?.releaseYear || 2024;
        let albReleaseDate = baseAlbum?.releaseDate || album?.releaseDate || `${albYear}-01-01`;

        // ── Tier 1: Fetch via local/hosted API endpoint with getApiUrl & direct upstream fallback ──
        if (selectedAlbumId && selectedAlbumId !== 'offline' && !selectedAlbumId.startsWith('alb-')) {
          const endpoints = [
            getApiUrl(`/api/albums?id=${encodeURIComponent(selectedAlbumId)}`),
            `https://saavn.dev/api/albums?id=${encodeURIComponent(selectedAlbumId)}`,
          ];

          for (const ep of endpoints) {
            if (mappedTracks.length > 0) break;
            try {
              const apiRes = await fetch(ep, { signal: AbortSignal.timeout(6000) }).catch(() => null);
              if (apiRes && apiRes.ok) {
                const apiJson = await apiRes.json();
                const albData = apiJson?.data || apiJson;
                if (albData && Array.isArray(albData.songs) && albData.songs.length > 0) {
                  primaryArtist =
                    albData.artists?.primary?.map((a: any) => a.name).join(', ') ||
                    albData.primaryArtists ||
                    albData.artist ||
                    primaryArtist;
                  albCover =
                    albData.image?.find?.((i: any) => i.quality === '500x500')?.url ||
                    albData.image?.[albData.image?.length - 1]?.url ||
                    albCover;
                  albYear = Number(albData.year) || albYear;
                  albReleaseDate = albData.releaseDate || (albYear ? `${albYear}-01-01` : albReleaseDate);
                  albName = albData.name || albData.title || albName;

                  mappedTracks = albData.songs.map((s: any) => ({
                    id: s.id,
                    title: s.name || s.title || 'Unknown Title',
                    artist: s.artists?.primary?.map((a: any) => a.name).join(', ') || s.primaryArtists || primaryArtist,
                    artistId: s.artists?.primary?.[0]?.id || '',
                    album: albData.name || albData.title || albName,
                    albumId: albData.id || selectedAlbumId,
                    duration: Number(s.duration) || 210,
                    coverUrl:
                      s.image?.find?.((i: any) => i.quality === '500x500')?.url ||
                      s.image?.[s.image?.length - 1]?.url ||
                      albCover,
                    audioUrl:
                      s.downloadUrl?.find?.((d: any) => d.quality === '320kbps')?.url ||
                      s.downloadUrl?.[s.downloadUrl?.length - 1]?.url ||
                      '',
                    genre: s.language || albData.language || 'Music',
                    category: 'global_trending' as const,
                    releaseYear: albYear,
                    plays: Number(s.playCount) || 0,
                    likes: 0,
                  }));
                  break;
                }
              }
            } catch {}
          }
        }

        // ── Tier 2: RealMusicEngine playlist / album resolver ──
        if (mappedTracks.length === 0 && selectedAlbumId && selectedAlbumId !== 'offline' && !selectedAlbumId.startsWith('alb-')) {
          try {
            const { RealMusicEngine } = await import('@/lib/realMusicEngine');
            const details = await RealMusicEngine.getInstance().getPlaylistDetails(`album:${selectedAlbumId}`);
            if (details && details.songs && details.songs.length > 0) {
              mappedTracks = details.songs;
              albName = details.title || albName;
              albCover = details.coverUrl || albCover;
            }
          } catch {}
        }

        // ── Tier 3: Search by Real Album Name on JioSaavn (e.g. Chirutha, Court) ──
        const searchCandidate = (albName || baseAlbum?.title || (selectedAlbumId !== 'offline' && !selectedAlbumId.startsWith('alb-') ? selectedAlbumId : '') || '').trim();
        if (mappedTracks.length === 0 && searchCandidate && searchCandidate.toLowerCase() !== 'offline') {
          try {
            const { RealMusicEngine } = await import('@/lib/realMusicEngine');
            const searchAlbums = await RealMusicEngine.getInstance().searchRealAlbums(searchCandidate, 5);
            const match = searchAlbums.find(a => 
              a.title?.toLowerCase() === searchCandidate.toLowerCase() ||
              searchCandidate.toLowerCase().includes(a.title?.toLowerCase())
            ) || searchAlbums[0];

            if (match?.id) {
              const details = await RealMusicEngine.getInstance().getPlaylistDetails(`album:${match.id}`);
              if (details && details.songs && details.songs.length > 0) {
                mappedTracks = details.songs;
                albName = details.title || match.title || albName;
                albCover = details.coverUrl || match.coverUrl || albCover;
                primaryArtist = details.songs[0]?.artist || match.artist || primaryArtist;
                albYear = details.songs[0]?.releaseYear || match.releaseYear || albYear;
              }
            }
          } catch {}
        }

        // ── Tier 4: Search by Songs by Movie Name ──
        if (mappedTracks.length === 0 && searchCandidate && searchCandidate.toLowerCase() !== 'offline') {
          const searchUrls = [
            `https://saavn.dev/api/search/songs?query=${encodeURIComponent(searchCandidate)}&limit=30`,
            getApiUrl(`/api/search/songs?query=${encodeURIComponent(searchCandidate)}&limit=30`),
          ];

          for (const sUrl of searchUrls) {
            if (mappedTracks.length > 0) break;
            try {
              const sRes = await fetch(sUrl, { signal: AbortSignal.timeout(6000) }).catch(() => null);
              if (sRes && sRes.ok) {
                const sJson = await sRes.json();
                const results = sJson.data?.results || sJson.results || [];
                if (Array.isArray(results) && results.length > 0) {
                  mappedTracks = results.map((s: any) => ({
                    id: s.id,
                    title: s.name || s.title || 'Unknown Title',
                    artist: s.artists?.primary?.map((a: any) => a.name).join(', ') || s.primaryArtists || primaryArtist,
                    artistId: s.artists?.primary?.[0]?.id || '',
                    album: s.album?.name || s.album || searchCandidate,
                    albumId: s.album?.id || selectedAlbumId,
                    duration: Number(s.duration) || 210,
                    coverUrl:
                      s.image?.find?.((i: any) => i.quality === '500x500')?.url ||
                      s.image?.[s.image?.length - 1]?.url ||
                      albCover,
                    audioUrl:
                      s.downloadUrl?.find?.((d: any) => d.quality === '320kbps')?.url ||
                      s.downloadUrl?.[s.downloadUrl?.length - 1]?.url ||
                      '',
                    genre: s.language || 'Music',
                    category: 'global_trending' as const,
                    releaseYear: Number(s.year) || albYear,
                    plays: Number(s.playCount) || 0,
                    likes: 0,
                  }));
                  break;
                }
              }
            } catch {}
          }
        }

        // ── Tier 5: Fallback to RealMusicEngine.searchRealSongs ──
        if (mappedTracks.length === 0 && searchCandidate && searchCandidate.toLowerCase() !== 'offline') {
          try {
            const { RealMusicEngine } = await import('@/lib/realMusicEngine');
            const searchSongs = await RealMusicEngine.getInstance().searchRealSongs(searchCandidate, 30);
            if (searchSongs && searchSongs.length > 0) {
              mappedTracks = searchSongs;
            }
          } catch {}
        }

        if (isMounted && mappedTracks.length > 0) {
          const finalTitle = albName || baseAlbum?.title || searchCandidate || 'Album Details';
          console.log(`[LIBRARY_ALBUM_RESOLVED]\nalbumId=${selectedAlbumId}\nalbumName=${finalTitle}\nartist=${primaryArtist}\nreleaseYear=${albYear}\ntrackCount=${mappedTracks.length}`);

          setAlbum({
            id: selectedAlbumId,
            title: finalTitle,
            artist: primaryArtist,
            artistId: primaryArtist,
            coverUrl: albCover,
            releaseDate: albReleaseDate,
            releaseYear: albYear,
            trackCount: mappedTracks.length,
            durationSec: mappedTracks.reduce((s, t) => s + (t.duration || 210), 0),
            language: preferredLanguage,
            albumType: mappedTracks.length > 6 ? 'album' : 'ep',
            freshnessScore: 95,
            trendingScore: 95,
            topScore: 95,
            tracks: mappedTracks,
          });
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
          onClick={() => {
            setSelectedAlbumId(null);
            setActiveTab('album');
          }}
          className="px-5 py-2.5 rounded-full bg-[#fa233b] text-white text-xs font-bold hover:scale-105 transition-transform mt-4 cursor-pointer"
        >
          Browse Albums
        </button>
      </div>
    );
  }

  const tracks = album.tracks || [];
  const downloadedCount = tracks.filter(t => {
    const isDownloaded = downloadedSongIds.includes(t.id) || !!nativeDownloadedTracks?.[t.id];
    const isTaskCompleted = tasks[t.id]?.status === 'COMPLETED';
    return isDownloaded || isTaskCompleted;
  }).length;
  const isAllDownloaded = tracks.length > 0 && downloadedCount === tracks.length;
  const isPartialDownloaded = downloadedCount > 0 && !isAllDownloaded;
  const downloadingCount = tracks.filter(t => {
    const task = tasks[t.id];
    return task && (task.status === 'DOWNLOADING' || task.status === 'QUEUED' || task.status === 'VERIFYING');
  }).length;
  const isDownloadingAlbum = downloadingCount > 0 && !isAllDownloaded;

  const isCurrentAlbumPlaying = tracks.some(t => t.id === currentSong?.id) && isPlaying;

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    haptics.mediumImpact();
    setRemoteState({ shuffleMode: 'OFF' });
    playSong(tracks[0], tracks, {
      type: 'album',
      id: album.id,
      title: album.title,
      name: album.title,
    });
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
    if (!album?.id) return;
    haptics.lightImpact();
    downloadAlbum(album.id, tracks);
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
    <DynamicArtworkAtmosphere artworkUrl={coverUrl} isPlaying={isPlaying}>
      <div className="relative min-h-screen text-white pb-36 select-none animate-in fade-in duration-300">
        {/* ── TOP NAVIGATION BAR ────────────────────────────────────────────── */}
        <div className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 py-4 backdrop-blur-xl bg-[#08090d]/80 border-b border-white/5">
        <button
          onClick={() => {
            haptics.lightImpact();
            const handled = NavigationStack.getInstance().goBack((target) => {
              usePlayerStore.setState({
                activeTab: target.activeTab,
                selectedAlbumId: target.selectedAlbumId,
                selectedArtistId: target.selectedArtistId,
                selectedPlaylistId: target.selectedPlaylistId,
                isPlayerExpanded: target.isPlayerExpanded,
              });
            });
            if (!handled) {
              setSelectedAlbumId(null);
              setActiveTab('album');
            }
          }}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
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
              {isNative && (
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
              )}
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
                const targetArtistId =
                  album.artistId ||
                  POPULAR_ARTISTS.find((a) => a.name.toLowerCase() === album.artist.toLowerCase())?.id;
                if (targetArtistId) {
                  setSelectedArtistId(targetArtistId);
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

        {/* ── ACTION BUTTONS ROW (4 side-by-side) ─────────────────────────── */}
        <div className="flex flex-nowrap items-center justify-center md:justify-start gap-2 sm:gap-3 mt-8 pt-6 border-t border-white/10 w-full overflow-x-auto no-scrollbar py-1">
          <button
            onClick={handlePlayAll}
            className="h-10 sm:h-11 px-4 sm:px-6 rounded-full bg-[#fa233b] hover:bg-[#d91e32] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-xl shadow-red-500/25 active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
            title="Play Album from Track 1"
          >
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white ml-0.5" /> Play
          </button>

          <button
            onClick={handleShufflePlay}
            className="h-10 sm:h-11 px-3.5 sm:px-5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 border border-white/10 active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Shuffle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Shuffle
          </button>

          {/* ＋ Add to Library / ✓ In Library Button */}
          <button
            onClick={() => {
              if (selectedAlbumId) {
                haptics.mediumImpact();
                toggleFavoriteAlbum(selectedAlbumId);
                setToastMessage(isLikedAlbum ? 'Removed album from Library' : 'Added album to Library (Albums)');
              }
            }}
            className={`h-10 sm:h-11 px-3.5 sm:px-5 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 border transition-all active:scale-95 cursor-pointer shrink-0 whitespace-nowrap ${
              isLikedAlbum
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-lg shadow-purple-500/20'
                : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
            }`}
            title={isLikedAlbum ? 'Remove from Library' : 'Add to Library'}
          >
            {isLikedAlbum ? (
              <>
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 stroke-[3]" />
                <span>In Library</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Save</span>
              </>
            )}
          </button>

          {/* ♡ Like Button */}
          <button
            onClick={() => {
              if (selectedAlbumId) {
                haptics.lightImpact();
                toggleFavoriteAlbum(selectedAlbumId);
                setToastMessage(isLikedAlbum ? 'Removed from Favorites' : 'Liked album');
              }
            }}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer shrink-0 ${
              isLikedAlbum
                ? 'bg-red-500/15 border-red-500/30 text-[#fa233b]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
            }`}
            title={isLikedAlbum ? 'Unlike Album' : 'Like Album'}
          >
            <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLikedAlbum ? 'fill-current text-[#fa233b]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── TRACK LIST SECTION ────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8">
        {/* Track List Header & Sort Option + Compact Download All Button (Mobile Only) */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10 gap-2">
          {/* Left: Sort Menu */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>
                Sort: {sortOption === 'default' ? 'Track Order' : sortOption === 'az' ? 'A → Z' : sortOption === 'za' ? 'Z → A' : 'Most Popular'}
              </span>
            </button>

            {showSortMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 top-full mt-1 w-44 bg-[#141520] border border-white/15 rounded-xl p-1.5 shadow-2xl z-30 text-xs"
              >
                {(['default', 'az', 'za', 'popular'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setSortOption(opt);
                      setShowSortMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors ${
                      sortOption === opt ? 'bg-[#fa233b]/20 text-[#fa233b] font-bold' : 'hover:bg-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    {opt === 'default' ? 'Track Order' : opt === 'az' ? 'A → Z' : opt === 'za' ? 'Z → A' : 'Most Popular'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Compact Download All Button (Android Mobile Only) */}
          {isNative && (
            <button
              onClick={isAllDownloaded ? handleRemoveAllDownloads : handleDownloadAll}
              className={`md:hidden flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                isAllDownloaded
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : isDownloadingAlbum
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
              }`}
              title={isAllDownloaded ? "All songs downloaded (Click to manage)" : "Download All Songs"}
            >
              {isDownloadingAlbum ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span className="font-mono">{downloadedCount}/{tracks.length}</span>
                </>
              ) : isAllDownloaded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                  <span className="hidden sm:inline">Downloaded</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{downloadedCount > 0 ? `${downloadedCount}/${tracks.length}` : 'Download All'}</span>
                </>
              )}
            </button>
          )}
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
                  onClick={() => playSong(track, sortedTracks, { type: 'album', id: album.id, title: album.title, name: album.title })}
                  className={`group flex items-center justify-between gap-3 p-3 rounded-2xl transition-all cursor-pointer select-none ${
                    isPlayingCurrent
                      ? 'bg-white/[0.08] border border-white/15 text-white'
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
                      <h4 className="text-sm font-bold truncate leading-snug text-white">
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

                    <DownloadStatusIndicator song={track} size="sm" showCloudIcon />

                    <SongActionMenu song={track} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </DynamicArtworkAtmosphere>
  );
}
