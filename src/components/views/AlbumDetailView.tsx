'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Play, Pause, Heart, ArrowLeft, Shuffle, Music, Clock, Disc,
  Download, Check, MoreVertical, ArrowUpDown, Sparkles, User, Share2, ListPlus, Loader2, Plus,
  ChevronRight, ChevronLeft, Music2
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { AlbumCatalogEngine, AlbumItem } from '@/lib/albumCatalog';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { Song } from '@/types/music';
import { haptics } from '@/lib/haptics/HapticEngine';
import { DynamicArtworkAtmosphere } from '@/components/common/DynamicArtworkAtmosphere';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';
import { NavigationStack } from '@/lib/navigation/NavigationStack';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { SongFormatter } from '@/lib/music/SongFormatter';

import { getApiUrl } from '@/lib/config/apiConfig';

type SortOption = 'default' | 'az' | 'za' | 'popular';

export function AlbumDetailView() {
  const {
    selectedAlbumId,
    setSelectedAlbumId,
    setSelectedArtistId,
    setSelectedPlaylistId,
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
    isOfflineMode,
    saveForOffline,
    removeDownload,
    downloadAlbum,
    getAlbumDownloadStatus,
  } = useDownloadStore();

  const [album, setAlbum] = useState<AlbumItem | null>(() => {
    if (!selectedAlbumId || selectedAlbumId === 'offline') return null;
    const cat = AlbumCatalogEngine.getAlbumById(selectedAlbumId, preferredLanguage);
    if (cat) return cat;

    // Check store queue or current song for matching album
    const store = usePlayerStore.getState();
    const effectiveId = selectedAlbumId.toLowerCase() === 'unknown' ? (store.currentSong?.albumId || store.currentSong?.album || '') : selectedAlbumId;
    if (!effectiveId || effectiveId.toLowerCase() === 'unknown' || effectiveId === 'offline') return null;

    const match = (store.queue || []).find(
      (s) => (s.albumId && s.albumId === effectiveId) || (s.album && s.album.toLowerCase() === effectiveId.toLowerCase())
    ) || (store.currentSong?.album?.toLowerCase() === effectiveId.toLowerCase() ? store.currentSong : null);

    if (match && match.album && match.album.toLowerCase() !== 'unknown') {
      return {
        id: effectiveId,
        title: match.album,
        artist: match.artist || 'Artist',
        artistId: match.artistId || match.artist || 'Artist',
        coverUrl: match.coverUrl || '/app-icon.png',
        releaseDate: `${match.releaseYear || 2024}-01-01`,
        releaseYear: match.releaseYear || 2024,
        trackCount: 1,
        durationSec: match.duration || 210,
        language: preferredLanguage,
        albumType: 'album',
        freshnessScore: 95,
        trendingScore: 95,
        topScore: 95,
        tracks: [match],
      };
    }

    if (effectiveId.toLowerCase() !== 'unknown' && effectiveId.toLowerCase() !== 'offline') {
      return {
        id: effectiveId,
        title: effectiveId,
        artist: '',
        artistId: effectiveId,
        coverUrl: '/app-icon.png',
        releaseDate: '2024-01-01',
        releaseYear: 2024,
        trackCount: 0,
        durationSec: 0,
        language: preferredLanguage,
        albumType: 'album',
        freshnessScore: 95,
        trendingScore: 95,
        topScore: 95,
        tracks: [],
      };
    }

    return null;
  });

  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showAlbumMenu, setShowAlbumMenu] = useState(false);
  const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
  const isLikedAlbum = selectedAlbumId ? favoriteAlbumIds.includes(selectedAlbumId) : false;

  const [palette, setPalette] = useState<ChameleonPalette | null>(null);
  const [moreByArtist, setMoreByArtist] = useState<any[]>([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<any[]>([]);
  const [similarAlbums, setSimilarAlbums] = useState<any[]>([]);

  const coverUrl = album?.coverUrl && !album.coverUrl.includes('/null/')
    ? album.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  useEffect(() => {
    let isMounted = true;
    if (coverUrl && coverUrl !== '/app-icon.png') {
      ArtworkColorExtractor.getInstance()
        .extractPalette(coverUrl)
        .then((p) => {
          if (isMounted) setPalette(p);
        });
    } else {
      setPalette(null);
    }
    return () => {
      isMounted = false;
    };
  }, [coverUrl]);

  // ── Load More by Artist, Featured Playlists & Similar Albums ──
  useEffect(() => {
    if (!album) return;

    let isMounted = true;
    const cleanPrimaryArtist = album.artist?.split(',')?.[0]?.split('&')?.[0]?.trim() || album.artist;

    // 1. More by Artist (Only for valid recognized artists)
    const loadMoreByArtist = async () => {
      if (
        !cleanPrimaryArtist ||
        cleanPrimaryArtist.toLowerCase() === 'unknown artist' ||
        cleanPrimaryArtist.toLowerCase() === 'various artists' ||
        cleanPrimaryArtist.toLowerCase() === 'record label' ||
        cleanPrimaryArtist.trim().length < 2
      ) {
        if (isMounted) setMoreByArtist([]);
        return;
      }

      try {
        const apiUrl = getApiUrl(`/api/search/albums?query=${encodeURIComponent(cleanPrimaryArtist)}&limit=20`);
        let results: any[] = [];
        try {
          const res = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            const json = await res.json();
            results = json.data?.results || json.results || [];
          }
        } catch { }

        if (results.length > 0 && isMounted) {
          const mapped = results
            .filter(
              (a: any) =>
                a.id !== album.id &&
                (a.name || a.title || '').toLowerCase() !== album.title.toLowerCase() &&
                (a.artist || a.primaryArtists || cleanPrimaryArtist).toLowerCase() !== 'unknown artist'
            )
            .map((a: any) => ({
              id: a.id,
              title: SongFormatter.cleanSongTitle(a.name || a.title),
              artist: a.artist || a.primaryArtists || cleanPrimaryArtist,
              coverUrl: a.image?.find?.((i: any) => i.quality === '500x500')?.url || a.image?.[a.image?.length - 1]?.url || a.coverUrl || '/app-icon.png',
              releaseYear: a.year || a.releaseYear || 'Album',
              type: (a.songCount === 1 || a.trackCount === 1 || (a.name || a.title || '').toLowerCase().includes('single')) ? 'Single' : 'Album',
            }));
          if (mapped.length > 0) {
            setMoreByArtist(mapped);
            return;
          }
        }
      } catch { }

      // Fallback: search in AlbumCatalogEngine
      const localMatches = AlbumCatalogEngine.getAllAlbums().filter(
        (a) =>
          a.id !== album.id &&
          cleanPrimaryArtist.toLowerCase() !== 'unknown artist' &&
          a.artist.toLowerCase().includes(cleanPrimaryArtist.toLowerCase())
      );
      if (localMatches.length > 0 && isMounted) {
        setMoreByArtist(localMatches.map(a => ({ ...a, type: a.albumType === 'ep' ? 'Single' : 'Album' })));
      }
    };

    // 2. Featured Playlists (Authentic playlists featuring this album or its tracks/artist)
    const loadFeaturedPlaylists = async () => {
      try {
        const queryTerms = [
          album.title,
          cleanPrimaryArtist && !['unknown artist', 'various artists', 'record label'].includes(cleanPrimaryArtist.toLowerCase()) ? cleanPrimaryArtist : null
        ].filter(Boolean) as string[];

        if (queryTerms.length === 0) {
          if (isMounted) setFeaturedPlaylists([]);
          return;
        }

        const playlistMap = new Map<string, any>();

        for (const term of queryTerms) {
          const ep = getApiUrl(`/api/search/playlists?query=${encodeURIComponent(term)}&limit=10`);
          try {
            const res = await fetch(ep, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
              const json = await res.json();
              const results = json.data?.results || json.results || [];
              if (Array.isArray(results)) {
                for (const p of results) {
                  if (p && p.id && (p.title || p.name) && !playlistMap.has(p.id)) {
                    const rawImg = p.image?.find?.((i: any) => i.quality === '500x500')?.url ||
                      p.image?.[p.image?.length - 1]?.url ||
                      (typeof p.image === 'string' ? p.image : null) ||
                      p.coverUrl;
                    const cover = rawImg ? rawImg.replace('http://', 'https://').replace(/150x150|50x50/, '500x500') : '/app-icon.png';
                    
                    const lang = p.language || album.language || preferredLanguage || 'Telugu';
                    const subtitle = p.subtitle
                      ? SongFormatter.decodeHtml(p.subtitle)
                      : p.songCount
                      ? `${p.songCount} Songs`
                      : `${lang} Playlist`;

                    playlistMap.set(p.id, {
                      id: p.id,
                      title: SongFormatter.decodeHtml(p.name || p.title),
                      subtitle,
                      coverUrl: cover,
                    });
                  }
                }
              }
            }
          } catch { }
        }

        if (isMounted) {
          const validPlaylists = Array.from(playlistMap.values())
            .filter((p) => p.coverUrl && !p.coverUrl.includes('app-icon.png') && p.coverUrl.startsWith('http'))
            .slice(0, 10);
          setFeaturedPlaylists(validPlaylists);
        }
      } catch { }
    };

    // 3. Similar / You Might Also Like Albums
    const loadSimilarAlbums = async () => {
      const lang = album.language || preferredLanguage || 'Telugu';
      const catalogAlbums = AlbumCatalogEngine.getAlbumsForLanguage(lang).filter((a) => a.id !== album.id);
      if (catalogAlbums.length > 0 && isMounted) {
        setSimilarAlbums(catalogAlbums.slice(0, 10));
      }
    };

    loadMoreByArtist();
    loadFeaturedPlaylists();
    loadSimilarAlbums();

    return () => {
      isMounted = false;
    };
  }, [album?.id, album?.artist, album?.language, preferredLanguage, coverUrl]);

  // Derive a single unified monochromatic shade for all album UI elements
  const themeColor = palette?.highlight || palette?.accent || palette?.primary || '#FA233B';
  const glowColor = palette?.glow || 'rgba(250, 35, 59, 0.35)';
  const bgTint = palette?.refractionRgba || 'rgba(250, 35, 59, 0.12)';
  const borderTint = palette?.primary
    ? palette.primary.replace('rgb', 'rgba').replace(')', ', 0.35)')
    : 'rgba(255,255,255,0.15)';

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
        const isOffline = (typeof navigator !== 'undefined' && !navigator.onLine) || isOfflineMode;

        // When offline: skip network requests and display local tracks
        if (isOffline) {
          const store = usePlayerStore.getState();
          const allKnown = Array.from(store.queue || []);
          const downloadedMatches = allKnown.filter(s =>
            (s.albumId === selectedAlbumId || s.album?.toLowerCase() === (baseAlbum?.title || selectedAlbumId).toLowerCase())
          );
          if (downloadedMatches.length > 0 && isMounted) {
            setAlbum({
              id: selectedAlbumId,
              title: baseAlbum?.title || downloadedMatches[0].album || 'Downloaded Album',
              artist: baseAlbum?.artist || downloadedMatches[0].artist || 'Various Artists',
              artistId: baseAlbum?.artistId || downloadedMatches[0].artistId || `art-${selectedAlbumId}`,
              coverUrl: baseAlbum?.coverUrl || downloadedMatches[0].coverUrl || '/app-icon.png',
              releaseDate: baseAlbum?.releaseDate || '2024-01-01',
              releaseYear: baseAlbum?.releaseYear || 2024,
              trackCount: downloadedMatches.length,
              durationSec: downloadedMatches.reduce((acc, t) => acc + (t.duration || 210), 0),
              language: preferredLanguage,
              albumType: 'album',
              freshnessScore: 90,
              trendingScore: 90,
              topScore: 90,
              tracks: downloadedMatches,
            });
            setIsLoadingTracks(false);
            return;
          }
        }

        const store = usePlayerStore.getState();
        const effectiveAlbumId = (selectedAlbumId && selectedAlbumId.toLowerCase() !== 'unknown')
          ? selectedAlbumId
          : (store.currentSong?.albumId && store.currentSong?.albumId !== 'unknown')
          ? store.currentSong.albumId
          : (store.currentSong?.album && store.currentSong?.album !== 'unknown')
          ? store.currentSong.album
          : '';

        let mappedTracks: Song[] = [];
        let albName = (baseAlbum?.title || album?.title || (effectiveAlbumId && !/^\d+$/.test(effectiveAlbumId) && !effectiveAlbumId.startsWith('alb-') ? effectiveAlbumId : '') || '').trim();
        if (albName.toLowerCase() === 'offline' || albName.toLowerCase() === 'unknown') albName = '';
        let primaryArtist = baseAlbum?.artist || album?.artist || (store.currentSong?.artist || 'Various Artists');
        let albCover = baseAlbum?.coverUrl || album?.coverUrl || (store.currentSong?.coverUrl || '/app-icon.png');
        let albYear = baseAlbum?.releaseYear || album?.releaseYear || (store.currentSong?.releaseYear || 2024);
        let albReleaseDate = baseAlbum?.releaseDate || album?.releaseDate || `${albYear}-01-01`;

        // ── Tier 1: Fetch via local/hosted API endpoint with getApiUrl & direct upstream fallback ──
        if (effectiveAlbumId && effectiveAlbumId !== 'offline' && !effectiveAlbumId.startsWith('alb-')) {
          const isNumericId = /^\d+$/.test(effectiveAlbumId);
          if (isNumericId) {
            const endpoint = getApiUrl(`/api/albums?id=${encodeURIComponent(effectiveAlbumId)}`);
            try {
              const apiRes = await fetch(endpoint, { signal: AbortSignal.timeout(6000) }).catch(() => null);
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

                  mappedTracks = albData.songs
                    .filter((s: any) => !/testing|sample trailer|dummy|test track|test audio|trailer - testing/i.test(s.name || s.title || '') && (Number(s.duration) || 0) <= 1800)
                    .map((s: any) => ({
                      id: s.id,
                      title: SongFormatter.cleanSongTitle(s.name || s.title || 'Unknown Title'),
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
                }
              }
            } catch { }
          }
        }

        // ── Tier 2: RealMusicEngine playlist / album resolver ──
        if (mappedTracks.length === 0 && effectiveAlbumId && effectiveAlbumId !== 'offline' && !effectiveAlbumId.startsWith('alb-') && /^\d+$/.test(effectiveAlbumId)) {
          try {
            const details = await RealMusicEngine.getInstance().getPlaylistDetails(`album:${effectiveAlbumId}`);
            if (details && details.songs && details.songs.length > 0) {
              mappedTracks = details.songs
                .filter(s => !/testing|sample trailer|dummy|test track|test audio|trailer - testing/i.test(s.title || '') && (s.duration || 0) <= 1800)
                .map(s => ({
                  ...s,
                  title: SongFormatter.cleanSongTitle(s.title),
                }));
              albName = details.title || albName;
              albCover = details.coverUrl || albCover;
            }
          } catch { }
        }

        // ── Tier 3: Search by Real Album Name on JioSaavn (e.g. Irumudi, Jailer 2, Toxic, Hi Nanna) ──
        const searchCandidate = (albName || baseAlbum?.title || (effectiveAlbumId !== 'offline' && !effectiveAlbumId.startsWith('alb-') ? effectiveAlbumId : '') || '').trim();
        if (mappedTracks.length === 0 && searchCandidate && searchCandidate.toLowerCase() !== 'offline' && searchCandidate.toLowerCase() !== 'unknown') {
          try {
            const searchAlbums = await RealMusicEngine.getInstance().searchRealAlbums(searchCandidate, 8);
            const match = searchAlbums.find(a => {
              const t = (a.title || a.name || '').toLowerCase();
              const q = searchCandidate.toLowerCase();
              return t === q || t.includes(q) || q.includes(t);
            }) || (searchAlbums.length > 0 && searchAlbums[0].title?.toLowerCase() !== 'unknown' ? searchAlbums[0] : null);

            if (match?.id) {
              const endpoint = getApiUrl(`/api/albums?id=${encodeURIComponent(match.id)}`);
              try {
                const apiRes = await fetch(endpoint, { signal: AbortSignal.timeout(6000) }).catch(() => null);
                if (apiRes && apiRes.ok) {
                  const apiJson = await apiRes.json();
                  const albData = apiJson?.data || apiJson;
                  if (albData && Array.isArray(albData.songs) && albData.songs.length > 0) {
                    albName = albData.name || albData.title || match.title || albName;
                    primaryArtist =
                      albData.artists?.primary?.map((a: any) => a.name).join(', ') ||
                      albData.primaryArtists ||
                      match.artist ||
                      primaryArtist;
                    albCover =
                      albData.image?.find?.((i: any) => i.quality === '500x500')?.url ||
                      albData.image?.[albData.image?.length - 1]?.url ||
                      match.coverUrl ||
                      albCover;
                    albYear = Number(albData.year) || match.releaseYear || albYear;
                    albReleaseDate = albData.releaseDate || `${albYear}-01-01`;

                    mappedTracks = albData.songs
                      .filter((s: any) => !/testing|sample trailer|dummy|test track|test audio|trailer - testing/i.test(s.name || s.title || '') && (Number(s.duration) || 0) <= 1800)
                      .map((s: any) => ({
                        id: s.id,
                        title: SongFormatter.cleanSongTitle(s.name || s.title || 'Unknown Title'),
                        artist: s.artists?.primary?.map((a: any) => a.name).join(', ') || s.primaryArtists || primaryArtist,
                        artistId: s.artists?.primary?.[0]?.id || '',
                        album: albName,
                        albumId: albData.id || match.id,
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
                  }
                }
              } catch { }
            }
          } catch { }
        }

        // ── Tier 4: Fallback to Catalog Mock Tracks ──
        if (mappedTracks.length === 0 && baseAlbum?.tracks && baseAlbum.tracks.length > 0) {
          mappedTracks = baseAlbum.tracks.map(s => ({
            ...s,
            title: SongFormatter.cleanSongTitle(s.title),
          }));
          albName = baseAlbum.title;
          albCover = baseAlbum.coverUrl;
          primaryArtist = baseAlbum.artist;
          albYear = baseAlbum.releaseYear;
        }

        // ── Tier 5: Search by Songs by Movie Name ──
        if (mappedTracks.length === 0 && searchCandidate && searchCandidate.toLowerCase() !== 'offline' && searchCandidate.toLowerCase() !== 'unknown') {
          const sUrl = getApiUrl(`/api/search/songs?query=${encodeURIComponent(searchCandidate)}&limit=30`);
          try {
            const sRes = await fetch(sUrl, { signal: AbortSignal.timeout(6000) }).catch(() => null);
            if (sRes && sRes.ok) {
              const sJson = await sRes.json();
              const results = sJson.data?.results || sJson.results || [];
              if (Array.isArray(results) && results.length > 0) {
                const filtered = results.filter((s: any) => !/testing|sample trailer|dummy|test track|test audio|trailer - testing/i.test(s.name || s.title || '') && (Number(s.duration) || 0) <= 1800);
                if (filtered.length > 0) {
                  albName = searchCandidate;
                  primaryArtist = filtered[0].artists?.primary?.map((a: any) => a.name).join(', ') || filtered[0].primaryArtists || primaryArtist;
                  albCover = filtered[0].image?.find?.((i: any) => i.quality === '500x500')?.url || filtered[0].image?.[filtered[0].image?.length - 1]?.url || albCover;
                  albYear = Number(filtered[0].year) || albYear;

                  mappedTracks = filtered.map((s: any) => ({
                    id: s.id,
                    title: SongFormatter.cleanSongTitle(s.name || s.title || 'Unknown Title'),
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
                }
              }
            }
          } catch { }
        }

        if (isMounted) {
          const finalTitle = (albName && albName.toLowerCase() !== 'unknown') ? albName : (searchCandidate && searchCandidate.toLowerCase() !== 'unknown') ? searchCandidate : (mappedTracks[0]?.album || 'Album Details');
          const finalArtist = (primaryArtist && !['various artists', 'unknown artist'].includes(primaryArtist.toLowerCase())) ? primaryArtist : (mappedTracks[0]?.artist || 'Artist');
          const finalCover = (albCover && albCover !== '/app-icon.png') ? albCover : (mappedTracks[0]?.coverUrl || '/app-icon.png');

          console.log(`[LIBRARY_ALBUM_RESOLVED]\nalbumId=${selectedAlbumId}\nalbumName=${finalTitle}\nartist=${finalArtist}\nreleaseYear=${albYear}\ntrackCount=${mappedTracks.length}`);

          setAlbum({
            id: selectedAlbumId,
            title: finalTitle,
            artist: finalArtist,
            artistId: finalArtist,
            coverUrl: finalCover,
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



  const tracks = album?.tracks || [];
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
    if (!album || tracks.length === 0) return;
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
    if (!album || tracks.length === 0) return;
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

  const formattedAlbumDuration = useMemo(() => {
    const totalMins = Math.round((album?.durationSec || 0) / 60);
    if (totalMins <= 0) return '';
    const hours = Math.floor(totalMins / 60);
    const minutes = totalMins % 60;
    if (hours > 0) {
      return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
    }
    return `${minutes} min`;
  }, [album?.durationSec]);

  if (!album) {
    return (
      <div className="relative text-white pb-0 select-none animate-in fade-in duration-300">
        <div className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 py-3.5 backdrop-blur-md bg-black/20 border-b border-white/[0.04]">
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
        </div>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#FA233B]" />
          <p className="text-sm font-semibold">Loading Album Details...</p>
        </div>
      </div>
    );
  }

  const primaryArtistDisplayName = album.artist?.split(',')?.[0]?.trim() || album.artist;

  return (
    <DynamicArtworkAtmosphere artworkUrl={coverUrl} isPlaying={isPlaying}>
      <div className="relative text-white pb-0 select-none animate-in fade-in duration-300">
        {/* ── TOP NAVIGATION BAR ────────────────────────────────────────────── */}
        <div className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 py-3.5 backdrop-blur-md bg-black/20 border-b border-white/[0.04]">
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
              className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="More options"
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
                  <Play className="w-4 h-4 fill-current" style={{ color: themeColor }} /> Play Album
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

        {/* ── ALBUM HERO SECTION (Apple Music Style) ────────────────────────── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-3 pb-5">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-5 md:gap-7 text-center md:text-left">
            {/* Elevated Album Artwork (Full Aspect Ratio Preserved Without Cropping) */}
            <div className="relative w-52 h-52 sm:w-64 sm:h-64 aspect-square rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-white/15 bg-black/50 flex-shrink-0 flex items-center justify-center group">
              <OptimizedImage
                src={coverUrl}
                alt={album.title}
                imageFit="contain"
                className="w-full h-full object-contain transition-transform duration-300"
                fallbackSrc="/app-icon.png"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/15 rounded-2xl pointer-events-none" />
            </div>

            {/* Album Information */}
            <div className="flex-1 min-w-0 space-y-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
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
                className="text-base sm:text-lg font-bold transition-colors cursor-pointer inline-block hover:underline"
                style={{ color: themeColor }}
              >
                {album.artist}
              </p>

              {/* Metadata Line */}
              <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-slate-400 font-medium pt-0.5">
                <span className="capitalize">{album.language || preferredLanguage}</span>
                <span>•</span>
                <span>{album.releaseYear || '2024'}</span>
                <span>•</span>
                <span>{tracks.length} Songs</span>
                {formattedAlbumDuration && (
                  <>
                    <span>•</span>
                    <span>{formattedAlbumDuration}</span>
                  </>
                )}
              </div>

              {/* ── ACTION BUTTONS ROW ─────────────────────────────────────── */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-4">
                <button
                  onClick={handleShufflePlay}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 active:scale-95 transition-all cursor-pointer shadow-md"
                  title="Shuffle Album"
                  aria-label="Shuffle"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  onClick={handlePlayAll}
                  className="h-10 px-6 rounded-full text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-xl"
                  style={{
                    backgroundColor: themeColor,
                    boxShadow: `0 8px 20px ${glowColor}`,
                  }}
                  title="Play Album"
                >
                  <Play className="w-4 h-4 fill-white ml-0.5" /> Play
                </button>

                <button
                  onClick={() => {
                    if (selectedAlbumId) {
                      haptics.mediumImpact();
                      toggleFavoriteAlbum(selectedAlbumId);
                      setToastMessage(isLikedAlbum ? 'Removed album from Library' : 'Added album to Library');
                    }
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer"
                  style={isLikedAlbum ? {
                    backgroundColor: bgTint,
                    borderColor: borderTint,
                    color: themeColor,
                  } : {
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderColor: 'rgba(255,255,255,0.15)',
                    color: '#ffffff',
                  }}
                  title={isLikedAlbum ? 'In Library' : 'Add to Library'}
                >
                  {isLikedAlbum ? (
                    <Check className="w-4 h-4 stroke-[3]" style={{ color: themeColor }} />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </button>

                <button
                  onClick={() => setShowAlbumMenu(!showAlbumMenu)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 active:scale-95 transition-all cursor-pointer"
                  title="More Options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── TRACK LIST SECTION ────────────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          {/* Track List Header & Sort Option */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10 gap-2">
            {/* Left: Sort Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
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
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors ${sortOption === opt ? 'font-bold' : 'hover:bg-white/10 text-slate-300 hover:text-white'
                        }`}
                      style={sortOption === opt ? {
                        backgroundColor: bgTint,
                        color: themeColor,
                      } : undefined}
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
                className={`md:hidden flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 cursor-pointer ${isAllDownloaded
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
                <div key={i} className="h-14 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : sortedTracks.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-sm font-semibold">No songs available in this album.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sortedTracks.map((track: Song, idx: number) => {
                const isPlayingCurrent = currentSong?.id === track.id;
                const isTrackLiked = likedSongIds.includes(track.id);
                const trackNum = (idx + 1).toString();
                const displayTitle = SongFormatter.cleanSongTitle(track.title);
                const displayArtist = SongFormatter.decodeHtml(track.artist) || track.artist || album.artist;

                return (
                  <div
                    key={track.id}
                    onClick={() => playSong(track, sortedTracks, { type: 'album', id: album.id, title: album.title, name: album.title })}
                    className={`group flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 rounded-xl sm:rounded-2xl transition-all cursor-pointer select-none border ${isPlayingCurrent
                        ? 'text-white'
                        : 'hover:bg-white/5 text-slate-300 hover:text-white border-transparent'
                      }`}
                    style={isPlayingCurrent ? {
                      backgroundColor: bgTint,
                      borderColor: borderTint,
                      boxShadow: `0 6px 20px ${glowColor.replace('0.35', '0.12')}`,
                    } : undefined}
                  >
                    {/* Left: Track Number / Waveform + Favorite + Title + Artist */}
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="w-5 sm:w-6 text-center flex-shrink-0 flex items-center justify-center">
                        {isPlayingCurrent ? (
                          <div className="flex items-end gap-[2px] h-3.5">
                            <span className={`w-1 rounded-full ${isPlaying ? 'animate-pulse' : ''} h-3.5`} style={{ backgroundColor: themeColor }} />
                            <span className={`w-1 rounded-full ${isPlaying ? 'animate-pulse' : ''} h-2`} style={{ backgroundColor: themeColor, animationDelay: '150ms' }} />
                            <span className={`w-1 rounded-full ${isPlaying ? 'animate-pulse' : ''} h-3`} style={{ backgroundColor: themeColor, animationDelay: '300ms' }} />
                          </div>
                        ) : (
                          <span className="text-xs font-mono font-medium text-slate-400 group-hover:text-white transition-colors">
                            {trackNum}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLikeSong(track.id);
                        }}
                        className={`p-1 transition-colors cursor-pointer ${isTrackLiked ? 'text-[#FA233B] opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-100 hover:text-white'
                          }`}
                        title={isTrackLiked ? 'Unlike track' : 'Like track'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isTrackLiked ? 'fill-current' : ''}`} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <h4
                          className="text-sm font-bold truncate leading-snug"
                          style={isPlayingCurrent ? { color: themeColor } : { color: '#ffffff' }}
                        >
                          {displayTitle}
                        </h4>
                        <p className="text-xs text-slate-400 truncate mt-0.5 font-medium leading-tight">
                          {displayArtist}
                        </p>
                      </div>
                    </div>

                    {/* Right: Duration + Download Status + Actions Menu */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-mono text-slate-400">
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

          {/* ── ALBUM FOOTER / COPYRIGHT METADATA ─────────────────────────── */}
          {!isLoadingTracks && tracks.length > 0 && (
            <div className="pt-4 pb-2 border-t border-white/10 mt-4 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">
                {album.releaseDate ? (
                  (() => {
                    try {
                      const d = new Date(album.releaseDate);
                      return isNaN(d.getTime()) ? `${album.releaseYear || 2024}` : d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
                    } catch {
                      return `${album.releaseYear || 2024}`;
                    }
                  })()
                ) : `${album.releaseYear || 2024}`}
              </p>
              <p className="font-medium">
                {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}, {formattedAlbumDuration || `${Math.round((album.durationSec || 0) / 60)} minutes`}
              </p>
              <p className="text-[11px] text-slate-500 pt-0.5">
                ℗ {album.releaseYear || '2024'} {album.title} • {album.artist || 'Record Label'}
              </p>
            </div>
          )}
        </div>

        {/* ── MORE BY [ARTIST] SECTION (Apple Music Style) ────────────────── */}
        {moreByArtist.length > 0 && (
          <div className="mt-8 max-w-6xl mx-auto px-4 sm:px-8">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => {
                  const targetArtistId =
                    album.artistId ||
                    POPULAR_ARTISTS.find((a) => a.name.toLowerCase() === album.artist.toLowerCase())?.id;
                  if (targetArtistId) {
                    setSelectedArtistId(targetArtistId);
                    setActiveTab('artist');
                  }
                }}
                className="group flex items-center gap-1.5 text-xl sm:text-2xl font-black text-white hover:text-[#FA233B] transition-colors cursor-pointer"
              >
                <span>More by {primaryArtistDisplayName}</span>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#FA233B] transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            {/* Horizontal Scrolling Shelf */}
            <div className="flex items-stretch gap-4 sm:gap-5 overflow-x-auto no-scrollbar pb-2 pt-1">
              {moreByArtist.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedAlbumId(item.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="group flex-shrink-0 w-36 sm:w-44 cursor-pointer space-y-2 select-none"
                >
                  <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-lg bg-white/5 border border-white/10">
                    <OptimizedImage
                      src={item.coverUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      fallbackSrc="/app-icon.png"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-[#FA233B] text-white flex items-center justify-center shadow-lg shadow-red-500/30 transform group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.releaseYear || item.year || 'Album'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FEATURED ON SECTION ─────────────────────────────────────────── */}
        {featuredPlaylists.length > 0 && (
          <div className="mt-8 max-w-6xl mx-auto px-4 sm:px-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl sm:text-2xl font-black text-white">Featured On</h3>
            </div>

            <div className="flex items-stretch gap-4 sm:gap-5 overflow-x-auto no-scrollbar pb-2 pt-1">
              {featuredPlaylists.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => {
                    setSelectedPlaylistId(pl.id);
                    setActiveTab('playlist');
                  }}
                  className="group flex-shrink-0 w-36 sm:w-44 cursor-pointer space-y-2 select-none"
                >
                  <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-lg bg-white/5 border border-white/10">
                    <OptimizedImage
                      src={pl.coverUrl || pl.image}
                      alt={pl.title || pl.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      fallbackSrc="/app-icon.png"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-[#FA233B] text-white flex items-center justify-center shadow-lg shadow-red-500/30 transform group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">
                      {pl.title || pl.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {pl.subtitle || `${album.language || preferredLanguage || 'Telugu'} Playlist`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── YOU MIGHT ALSO LIKE SECTION ───────────────────────────────────── */}
        {similarAlbums.length > 0 && (
          <div className="mt-8 mb-4 max-w-6xl mx-auto px-4 sm:px-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl sm:text-2xl font-black text-white">You Might Also Like</h3>
            </div>

            <div className="flex items-stretch gap-4 sm:gap-5 overflow-x-auto no-scrollbar pb-4 pt-1">
              {similarAlbums.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedAlbumId(item.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="group flex-shrink-0 w-36 sm:w-44 cursor-pointer space-y-2 select-none"
                >
                  <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-lg bg-white/5 border border-white/10">
                    <OptimizedImage
                      src={item.coverUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      fallbackSrc="/app-icon.png"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-[#FA233B] text-white flex items-center justify-center shadow-lg shadow-red-500/30 transform group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.artist}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DynamicArtworkAtmosphere>
  );
}
