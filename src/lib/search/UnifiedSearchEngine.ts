/**
 * UnifiedSearchEngine — Single Source of Truth for Universal Search & Discovery.
 * 
 * Supports:
 * - Instant local results (Downloaded songs, Liked songs, User playlists)
 * - Remote multi-provider search (Songs, Albums, Artists, Playlists)
 * - Language-prioritized ranking (Telugu, Hindi, Tamil, etc.)
 * - Transliteration & regional phonetics support
 * - Search history persistence & clearing
 * - Offline mode fallback
 */

import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { getApiBaseUrl } from '@/lib/config/apiConfig';

export interface UnifiedArtistResult {
  id: string;
  name: string;
  coverUrl: string;
  role?: string;
}

export interface UnifiedAlbumResult {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  releaseYear?: number;
  songCount?: number;
}

export interface UnifiedPlaylistResult {
  id: string;
  title: string;
  coverUrl: string;
  songCount?: number;
  source?: string;
  isUserOwned?: boolean;
}

export interface UnifiedSearchResults {
  query: string;
  topResult: {
    type: 'artist' | 'album' | 'playlist' | 'song';
    title: string;
    subtitle: string;
    coverUrl: string;
    item: any;
  } | null;
  songs: Song[];
  albums: UnifiedAlbumResult[];
  artists: UnifiedArtistResult[];
  playlists: UnifiedPlaylistResult[];
  localMatches: {
    downloadedSongs: Song[];
    userPlaylists: UnifiedPlaylistResult[];
  };
  isOffline: boolean;
  timestamp: number;
}

const RECENT_SEARCHES_STORAGE_KEY = 'raagax_recent_searches';
const MAX_RECENT_SEARCHES = 15;

function decodeHtml(s: string): string {
  return (s || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractCoverUrl(image: any): string {
  if (!image) return '/app-icon.png';
  let url = '';
  if (typeof image === 'string') {
    url = image.replace('http://', 'https://');
  } else if (Array.isArray(image)) {
    const hi = image.find((i: any) => i?.quality === '500x500' || i?.quality === '500X500') || image[image.length - 1];
    if (hi) {
      if (typeof hi === 'string') url = hi.replace('http://', 'https://');
      else if (hi.url) url = hi.url.replace('http://', 'https://');
      else if (hi.link) url = hi.link.replace('http://', 'https://');
    }
  } else if (image?.url) {
    url = image.url.replace('http://', 'https://');
  } else if (image?.link) {
    url = image.link.replace('http://', 'https://');
  }

  if (!url || url.includes('/null/') || url.includes('null/null') || url.endsWith('/null')) {
    return '/app-icon.png';
  }
  return url.replace(/150x150|50x50|300x300/g, '500x500');
}

export class UnifiedSearchEngine {
  private static instance: UnifiedSearchEngine;
  private currentAbortCtrl: AbortController | null = null;

  private constructor() {}

  public static getInstance(): UnifiedSearchEngine {
    if (!UnifiedSearchEngine.instance) {
      UnifiedSearchEngine.instance = new UnifiedSearchEngine();
    }
    return UnifiedSearchEngine.instance;
  }

  /**
   * Search Recent History Management
   */
  public getRecentSearches(): string[] {
    try {
      if (typeof window === 'undefined') return [];
      const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public addRecentSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed || typeof window === 'undefined') return;

    try {
      const current = this.getRecentSearches();
      const filtered = current.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  public removeRecentSearch(query: string): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getRecentSearches();
      const updated = current.filter((q) => q.toLowerCase() !== query.trim().toLowerCase());
      localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  public clearRecentSearches(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch {}
  }

  /**
   * Search Local Catalog (Downloaded songs & User playlists) immediately
   */
  public async searchLocalOnly(query: string): Promise<{
    downloadedSongs: Song[];
    userPlaylists: UnifiedPlaylistResult[];
  }> {
    const q = query.trim().toLowerCase();
    if (!q) return { downloadedSongs: [], userPlaylists: [] };

    let downloadedSongs: Song[] = [];
    try {
      const { OfflineCatalog } = await import('@/lib/offline/OfflineCatalog');
      const offlineTracks = await OfflineCatalog.getInstance().searchOfflineTracks(q);
      downloadedSongs = offlineTracks.map((t) => ({
        id: t.trackId,
        title: t.title,
        artist: t.artist,
        artistId: `art-${t.trackId}`,
        album: t.album || 'Offline',
        albumId: `alb-${t.trackId}`,
        coverUrl: t.artworkUrl || '/app-icon.png',
        duration: t.duration || Math.round(t.durationMs / 1000) || 180,
        audioUrl: '',
        genre: 'OFFLINE',
        category: 'melody',
        releaseYear: new Date().getFullYear(),
        plays: t.playCount || 1,
        likes: 1,
      }));
    } catch (e) {
      console.warn('[UnifiedSearchEngine] Error searching offline catalog:', e);
    }

    let userPlaylists: UnifiedPlaylistResult[] = [];
    try {
      const allPlaylists = usePlaylistStore.getState().playlists;
      userPlaylists = allPlaylists
        .filter((p) => (p.title || '').toLowerCase().includes(q))
        .map((p) => ({
          id: p.id,
          title: p.title || 'Untitled Playlist',
          coverUrl: p.coverUrl || '/app-icon.png',
          songCount: p.songs?.length || 0,
          source: 'User Library',
          isUserOwned: true,
        }));
    } catch (e) {
      console.warn('[UnifiedSearchEngine] Error searching user playlists:', e);
    }

    return { downloadedSongs, userPlaylists };
  }

  /**
   * Complete Unified Search across Local + Remote Provider with Language Prioritization
   */
  public async search(query: string, language?: string): Promise<UnifiedSearchResults> {
    const q = query.trim();
    if (!q) {
      return {
        query: '',
        topResult: null,
        songs: [],
        albums: [],
        artists: [],
        playlists: [],
        localMatches: { downloadedSongs: [], userPlaylists: [] },
        isOffline: false,
        timestamp: Date.now(),
      };
    }

    // Cancel previous in-flight request
    if (this.currentAbortCtrl) {
      this.currentAbortCtrl.abort();
    }
    this.currentAbortCtrl = new AbortController();
    const { signal } = this.currentAbortCtrl;

    const store = usePlayerStore.getState();
    const activeLang = language || store.preferredLanguage || 'Telugu';
    const isOffline =
      store.networkMode === 'offline' ||
      store.networkMode === 'offline_forced' ||
      (typeof navigator !== 'undefined' && !navigator.onLine);

    // 1. Instant local search
    const localMatches = await this.searchLocalOnly(q);

    if (isOffline) {
      const topSong = localMatches.downloadedSongs[0];
      return {
        query: q,
        topResult: topSong
          ? {
              type: 'song',
              title: topSong.title,
              subtitle: `Song • ${topSong.artist}`,
              coverUrl: topSong.coverUrl,
              item: topSong,
            }
          : null,
        songs: localMatches.downloadedSongs,
        albums: [],
        artists: [],
        playlists: localMatches.userPlaylists,
        localMatches,
        isOffline: true,
        timestamp: Date.now(),
      };
    }

    // 2. Fetch Remote Provider Results
    const apiBase = `${getApiBaseUrl().replace(/\/+$/, '')}/api`;
    let songs: Song[] = [];
    let albums: UnifiedAlbumResult[] = [];
    let artists: UnifiedArtistResult[] = [];
    let playlists: UnifiedPlaylistResult[] = [];
    let topQueryMatch: any = null;

    try {
      const globalSearchUrl = `${apiBase}/search?query=${encodeURIComponent(q)}`;
      const res = await fetch(globalSearchUrl, { signal });
      if (res.ok) {
        const json = await res.json();
        const data = json.data;

        if (data) {
          // Parse Songs
          if (Array.isArray(data.songs?.results)) {
            songs = data.songs.results.map((item: any) => this.mapSong(item));
          }

          // Parse Albums
          if (Array.isArray(data.albums?.results)) {
            albums = data.albums.results.map((item: any) => ({
              id: item.id,
              title: decodeHtml(item.title || item.name || 'Unknown Album'),
              artist: decodeHtml(item.artist || item.primaryArtists || 'Various Artists'),
              coverUrl: extractCoverUrl(item.image || item.coverUrl),
              releaseYear: parseInt(item.year) || 2024,
              songCount: item.songCount ? parseInt(item.songCount) : undefined,
            }));
          }

          // Parse Artists
          if (Array.isArray(data.artists?.results)) {
            artists = data.artists.results.map((item: any) => ({
              id: item.id,
              name: decodeHtml(item.title || item.name || 'Artist'),
              coverUrl: extractCoverUrl(item.image),
              role: item.role || 'Artist',
            }));
          }

          // Parse Playlists
          if (Array.isArray(data.playlists?.results)) {
            playlists = data.playlists.results.map((item: any) => ({
              id: item.id,
              title: decodeHtml(item.title || item.name || 'Playlist'),
              coverUrl: extractCoverUrl(item.image),
              songCount: item.songCount ? parseInt(item.songCount) : undefined,
              source: 'RaagaX Global',
            }));
          }

          if (data.topQuery?.results && data.topQuery.results.length > 0) {
            topQueryMatch = data.topQuery.results[0];
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('[UnifiedSearchEngine] Global search error, attempting fallback song search:', err?.message);
      }
    }

    // Fallback: If global search returned empty songs, fetch from dedicated /search/songs endpoint
    if (songs.length === 0 && !signal.aborted) {
      try {
        const songSearchUrl = `${apiBase}/search/songs?query=${encodeURIComponent(q)}&limit=20`;
        const res = await fetch(songSearchUrl, { signal });
        if (res.ok) {
          const json = await res.json();
          const results = json.data?.results || json.results || [];
          if (Array.isArray(results) && results.length > 0) {
            songs = results.map((item: any) => this.mapSong(item));
          }
        }
      } catch {}
    }

    // 3. Deduplicate and Merge Local Download Matches
    const seenSongIds = new Set<string>();
    const unifiedSongs: Song[] = [];

    // Prioritize locally downloaded matching tracks
    for (const localSong of localMatches.downloadedSongs) {
      seenSongIds.add(localSong.id);
      unifiedSongs.push(localSong);
    }

    for (const song of songs) {
      if (!seenSongIds.has(song.id)) {
        seenSongIds.add(song.id);
        unifiedSongs.push(song);
      }
    }

    // Merge User Playlists with Provider Playlists
    const mergedPlaylists = [...localMatches.userPlaylists, ...playlists];

    // 4. Language-Priority Ranking
    const rankedSongs = this.rankByLanguage(unifiedSongs, activeLang, q);
    const rankedAlbums = this.rankAlbumsByLanguage(albums, activeLang, q);

    // 5. Determine Top Result
    let topResult: UnifiedSearchResults['topResult'] = null;

    if (topQueryMatch) {
      const type = (topQueryMatch.type || 'song').toLowerCase();
      if (type === 'artist') {
        topResult = {
          type: 'artist',
          title: decodeHtml(topQueryMatch.title || topQueryMatch.name),
          subtitle: 'Artist',
          coverUrl: extractCoverUrl(topQueryMatch.image),
          item: { id: topQueryMatch.id, name: topQueryMatch.title || topQueryMatch.name },
        };
      } else if (type === 'album') {
        topResult = {
          type: 'album',
          title: decodeHtml(topQueryMatch.title || topQueryMatch.name),
          subtitle: `Album • ${decodeHtml(topQueryMatch.artist || topQueryMatch.primaryArtists || 'Various Artists')}`,
          coverUrl: extractCoverUrl(topQueryMatch.image),
          item: { id: topQueryMatch.id, title: topQueryMatch.title },
        };
      } else if (type === 'playlist') {
        topResult = {
          type: 'playlist',
          title: decodeHtml(topQueryMatch.title || topQueryMatch.name),
          subtitle: 'Playlist',
          coverUrl: extractCoverUrl(topQueryMatch.image),
          item: { id: topQueryMatch.id, title: topQueryMatch.title },
        };
      }
    }

    // Default top result fallback if topQuery not provided
    if (!topResult) {
      const artistExact = artists.find((a) => a.name.toLowerCase() === q.toLowerCase());
      if (artistExact) {
        topResult = {
          type: 'artist',
          title: artistExact.name,
          subtitle: 'Artist',
          coverUrl: artistExact.coverUrl,
          item: artistExact,
        };
      } else if (rankedSongs.length > 0) {
        const topSong = rankedSongs[0];
        topResult = {
          type: 'song',
          title: topSong.title,
          subtitle: `Song • ${topSong.artist}`,
          coverUrl: topSong.coverUrl,
          item: topSong,
        };
      } else if (rankedAlbums.length > 0) {
        const topAlbum = rankedAlbums[0];
        topResult = {
          type: 'album',
          title: topAlbum.title,
          subtitle: `Album • ${topAlbum.artist}`,
          coverUrl: topAlbum.coverUrl,
          item: topAlbum,
        };
      }
    }

    // Record search in history
    this.addRecentSearch(q);

    return {
      query: q,
      topResult,
      songs: rankedSongs,
      albums: rankedAlbums,
      artists,
      playlists: mergedPlaylists,
      localMatches,
      isOffline: false,
      timestamp: Date.now(),
    };
  }

  private mapSong(item: any): Song {
    const rawTitle = decodeHtml(item.name || item.title || 'Unknown Song');
    const rawArtist = decodeHtml(
      item.primaryArtists ||
      item.singers ||
      (Array.isArray(item.artists?.primary) ? item.artists.primary.map((a: any) => a.name).join(', ') : '') ||
      item.artist ||
      'Unknown Artist'
    );
    const rawAlbum = decodeHtml(item.album?.name || item.album || item.albumName || 'Single');
    const songId = item.id || `song-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const duration = parseInt(item.duration) || 210;

    let audioUrl = '';
    if (Array.isArray(item.downloadUrl)) {
      const best = item.downloadUrl.find((u: any) => u?.quality === '320kbps') || item.downloadUrl[item.downloadUrl.length - 1];
      audioUrl = best?.url || best?.link || '';
    } else if (typeof item.downloadUrl === 'string') {
      audioUrl = item.downloadUrl;
    }

    return {
      id: songId,
      title: rawTitle,
      artist: rawArtist,
      artistId: item.primaryArtistsId || item.artistId || `art-${songId}`,
      album: rawAlbum,
      albumId: item.album?.id || item.albumId || `alb-${songId}`,
      coverUrl: extractCoverUrl(item.image || item.coverUrl),
      duration,
      audioUrl,
      genre: item.language || 'Telugu',
      category: 'melody',
      releaseYear: parseInt(item.year) || 2024,
      plays: parseInt(item.playCount) || 1000,
      likes: 1,
    };
  }

  private rankByLanguage(songs: Song[], preferredLang: string, query: string): Song[] {
    const lowerQuery = query.toLowerCase();
    const lowerLang = preferredLang.toLowerCase();

    return [...songs].sort((a, b) => {
      // 1. Exact query match in title
      const aExact = a.title.toLowerCase() === lowerQuery ? 100 : 0;
      const bExact = b.title.toLowerCase() === lowerQuery ? 100 : 0;

      // 2. Starts with query
      const aStarts = a.title.toLowerCase().startsWith(lowerQuery) ? 50 : 0;
      const bStarts = b.title.toLowerCase().startsWith(lowerQuery) ? 50 : 0;

      // 3. Language priority matching
      const aLang = (a.genre || '').toLowerCase() === lowerLang ? 30 : 0;
      const bLang = (b.genre || '').toLowerCase() === lowerLang ? 30 : 0;

      const scoreA = aExact + aStarts + aLang;
      const scoreB = bExact + bStarts + bLang;

      return scoreB - scoreA;
    });
  }

  private rankAlbumsByLanguage(albums: UnifiedAlbumResult[], preferredLang: string, query: string): UnifiedAlbumResult[] {
    const lowerQuery = query.toLowerCase();

    return [...albums].sort((a, b) => {
      const aExact = a.title.toLowerCase() === lowerQuery ? 100 : 0;
      const bExact = b.title.toLowerCase() === lowerQuery ? 100 : 0;

      const aStarts = a.title.toLowerCase().startsWith(lowerQuery) ? 50 : 0;
      const bStarts = b.title.toLowerCase().startsWith(lowerQuery) ? 50 : 0;

      return (bExact + bStarts) - (aExact + aStarts);
    });
  }
}
