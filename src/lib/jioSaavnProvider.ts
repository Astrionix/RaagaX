/**
 * JioSaavn Provider — single server-side gateway for all JioSaavn API calls.
 * Base URL is read from JIOSAAVN_API_BASE_URL env var.
 * Falls back to the local Next.js API proxy, then to saavn.sumit.co.
 */

import { Song } from '@/types/music';
import { SongUniquenessEngine } from '@/lib/music/SongUniquenessEngine';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { RequestDeduplicator } from '@/lib/network/RequestDeduplicator';
import { QualityManager } from '@/lib/playback/QualityManager';

// Language code mapping used for filtering
export const LANGUAGE_CODES: Record<string, string> = {
  Telugu: 'telugu',
  Kannada: 'kannada',
  Tamil: 'tamil',
  Hindi: 'hindi',
  Malayalam: 'malayalam',
  Punjabi: 'punjabi',
  Marathi: 'marathi',
  Bengali: 'bengali',
  English: 'english',
};

export function mapTrackToSong(track: any, idx: number = 0): Song {
  const pa = track.artists?.primary || track.artists?.all || [];
  const rawArtist =
    pa.length > 0
      ? pa.map((a: any) => SongFormatter.decodeHtml(a.name)).join(', ')
      : SongFormatter.decodeHtml(track.artist || track.subtitle || 'Unknown Artist');

  let coverUrl = '/app-icon.png';
  const rawImage = track.image || track.images || track.artwork || track.cover || track.album?.image || track.album?.images;
  if (Array.isArray(rawImage) && rawImage.length > 0) {
    const hi =
      rawImage.find((i: any) => i?.quality === '500x500' || i?.quality === '500X500') ||
      rawImage[rawImage.length - 1] ||
      rawImage[0];
    const rawUrl = hi?.url || hi?.link || (typeof hi === 'string' ? hi : '');
    if (rawUrl) coverUrl = rawUrl.replace('http://', 'https://').replace(/150x150|50x50|300x300/g, '500x500');
  } else if (typeof rawImage === 'string' && rawImage) {
    coverUrl = rawImage.replace('http://', 'https://').replace(/150x150|50x50|300x300/g, '500x500');
  }
  if (!coverUrl || coverUrl.includes('/null/') || coverUrl.endsWith('/null')) coverUrl = '/app-icon.png';

  let audioUrl = '';
  if (Array.isArray(track.downloadUrl) && track.downloadUrl.length > 0) {
    const selected = QualityManager.selectHighestQuality(track.downloadUrl);
    if (selected) {
      audioUrl = selected;
    }
  } else if (typeof track.downloadUrl === 'string' && track.downloadUrl) {
    audioUrl = track.downloadUrl.replace('http://', 'https://');
  } else if (track.media_preview_url) {
    audioUrl = track.media_preview_url.replace('http://', 'https://').replace('_preview.mp3', '_320.mp4');
  }

  const duration =
    typeof track.duration === 'number' ? track.duration : parseInt(track.duration) || 210;
  const playCount =
    typeof track.playCount === 'number' ? track.playCount : parseInt(track.playCount) || 0;
  const trackLanguage = track.language || '';
  const genre = trackLanguage ? `${trackLanguage.toUpperCase()} HITS` : 'MELODY HITS';

  const rawTitle = track.name || track.title || 'Untitled Track';
  const rawAlbum = track.album?.name || track.album || track.more_info?.album || '';
  const cleanTitle = SongFormatter.cleanSongTitle(rawTitle);
  const cleanAlbum = SongFormatter.cleanAlbumTitle(rawAlbum, rawTitle) || cleanTitle;
  const artist = SongFormatter.decodeHtml(rawArtist);

  return {
    id: track.id || `saavn-${idx}`,
    title: cleanTitle,
    artist,
    artistId: pa[0]?.id || `art-${idx}`,
    album: cleanAlbum,
    albumId: track.album?.id || `alb-${idx}`,
    duration,
    coverUrl,
    audioUrl,
    genre,
    category: 'latest_telugu' as const,
    releaseYear: parseInt(track.year) || new Date().getFullYear(),
    plays: playCount,
    likes: Math.floor(playCount * 0.15),
    downloads: Math.floor(playCount * 0.08),
    audioQuality: '24-bit FLAC' as const,
    bitrate: '320 kbps',
    sampleRate: '48 kHz',
    codec: 'AAC HQ Stream',
    lyrics: [
      { time: 0, text: `${cleanTitle} — Audio Stream` },
    ],
    credits: {
      composer: artist,
      lyricist: 'RaagaX Catalog',
      singers: pa.map((a: any) => SongFormatter.decodeHtml(a.name)),
      label: track.label || 'Sony / Aditya Music',
    },
  };
}

const KIDS_KEYWORDS = [
  'wowkidz', 'nursery', 'rhymes', 'chitti chilakamma', 'bujji meka',
  'akesi pappesi', 'burru pitta', 'bava bava', 'chuku chuku railu',
  'infobells', 'chuchu tv', 'cocomelon', 'lullaby', 'kindergarten',
  'baby shark', 'kids rhymes', 'rhyme', 'kids song'
];

export function isKidsOrNurseryTrack(track: { title?: string; artist?: string; album?: string; name?: string }): boolean {
  if (!track) return true;
  const title = track.title || track.name || '';
  const artist = track.artist || '';
  const album = track.album || '';
  const combined = `${title} ${artist} ${album}`.toLowerCase();
  return KIDS_KEYWORDS.some(kw => combined.includes(kw));
}

function deduplicateSongs(songs: Song[]): Song[] {
  const filtered = songs.filter((s) => !isKidsOrNurseryTrack(s));
  return SongUniquenessEngine.deduplicate(filtered);
}

/**
 * Attempt a fetch against a single URL with timeout.
 * Returns null on any failure — never throws.
 */
async function safeFetch(url: string, timeoutMs = 5000): Promise<any[] | null> {
  return RequestDeduplicator.getInstance().dedupe(url, async () => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return null;
      const data = await res.json();
      const results = data.data?.results || data.results || [];
      return results.length > 0 ? results : null;
    } catch {
      clearTimeout(tid);
      return null;
    }
  });
}

export class JioSaavnProvider {
  private static instance: JioSaavnProvider;

  // Server-side base URL — read from env, never exposed to browser
  private readonly externalBase: string;
  // Local Next.js API proxy base (same origin)
  private readonly localBase: string;

  // High-Speed In-Memory Cache with TTL
  private cache: Map<string, { data: any; expiresAt: number }> = new Map();

  private constructor(localBase: string) {
    this.localBase = localBase;
    // Priority: env var → saavn.sumit.co
    this.externalBase =
      process.env.JIOSAAVN_API_BASE_URL || 'https://saavn.sumit.co';
  }

  public static getInstance(localBase = 'http://localhost:3001'): JioSaavnProvider {
    if (!JioSaavnProvider.instance) {
      JioSaavnProvider.instance = new JioSaavnProvider(localBase);
    }
    return JioSaavnProvider.instance;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setInCache(key: string, data: any, ttlMs: number): void {
    // Keep max 500 items in memory to prevent memory leaks
    if (this.cache.size > 500) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Search songs. Tries memory cache, then local proxy, then external provider.
   * Never throws — returns [] on all failures.
   */
  async searchSongs(query: string, limit = 10, language?: string): Promise<Song[]> {
    const cacheKey = `search_songs_${query.trim().toLowerCase()}_${limit}_${language || 'all'}`;
    const cached = this.getFromCache<Song[]>(cacheKey);
    if (cached) return cached;

    const encoded = encodeURIComponent(query.trim() || 'popular songs');
    const langCode = language ? (LANGUAGE_CODES[language] || language.toLowerCase()) : '';
    const langParam = langCode ? `&language=${encodeURIComponent(langCode)}` : '';
    const urls = [
      `${this.localBase}/api/search/songs?query=${encoded}&limit=${limit}${langParam}`,
      `${this.externalBase}/api/search/songs?query=${encoded}&limit=${limit}${langParam}`,
    ];

    for (const url of urls) {
      const results = await safeFetch(url, 6000);
      if (results) {
        console.log(`[PROVIDER] searchSongs OK query="${query}" lang="${language || 'all'}" url=${url}`);
        const mapped = deduplicateSongs(results.map(mapTrackToSong));
        const finalSongs = language ? this.filterByLanguage(mapped, language) : mapped;
        // Cache search results for 15 minutes
        this.setInCache(cacheKey, finalSongs, 15 * 60 * 1000);
        return finalSongs;
      }
    }

    console.warn(`[PROVIDER] searchSongs FAILED all endpoints query="${query}"`);
    return [];
  }

  /**
   * Get song recommendations (suggestions) based on a seed song ID.
   * Never throws — returns [] on all failures.
   */
  async getRecommendations(songId: string, limit = 10): Promise<Song[]> {
    if (!songId) return [];
    const cacheKey = `rec_${songId}_${limit}`;
    const cached = this.getFromCache<Song[]>(cacheKey);
    if (cached) return cached;

    const urls = [
      `${this.localBase}/api/songs/${songId}/suggestions?limit=${limit}`,
      `${this.externalBase}/api/songs/${songId}/suggestions?limit=${limit}`,
    ];

    for (const url of urls) {
      const results = await safeFetch(url, 6000);
      if (results) {
        console.log(`[PROVIDER] getRecommendations OK songId="${songId}" url=${url}`);
        const songs = deduplicateSongs(results.map(mapTrackToSong));
        // Cache recommendations for 30 minutes
        this.setInCache(cacheKey, songs, 30 * 60 * 1000);
        return songs;
      }
    }

    console.warn(`[PROVIDER] getRecommendations FAILED all endpoints songId="${songId}"`);
    return [];
  }

  /**
   * Filter songs by language code (best-effort, non-blocking).
   * JioSaavn returns a `language` field on each track.
   */
  filterByLanguage(songs: Song[], language: string): Song[] {
    const code = LANGUAGE_CODES[language]?.toLowerCase();
    if (!code) return songs;
    const filtered = songs.filter(
      (s) => s.genre.toLowerCase().includes(code)
    );
    // If filtering leaves nothing (language metadata missing), return original
    return filtered.length > 0 ? filtered : songs;
  }

  async searchAlbums(query: string, limit = 10): Promise<any[]> {
    const cacheKey = `search_albums_${query.trim().toLowerCase()}_${limit}`;
    const cached = this.getFromCache<any[]>(cacheKey);
    if (cached) return cached;

    const encoded = encodeURIComponent(query.trim() || 'latest albums');
    const urls = [
      `${this.localBase}/api/search/albums?query=${encoded}&limit=${limit}`,
      `${this.externalBase}/api/search/albums?query=${encoded}&limit=${limit}`,
    ];
    for (const url of urls) {
      const results = await safeFetch(url, 6000);
      if (results) {
        this.setInCache(cacheKey, results, 30 * 60 * 1000);
        return results;
      }
    }
    return [];
  }

  async searchPlaylists(query: string, limit = 10): Promise<any[]> {
    const cacheKey = `search_playlists_${query.trim().toLowerCase()}_${limit}`;
    const cached = this.getFromCache<any[]>(cacheKey);
    if (cached) return cached;

    const encoded = encodeURIComponent(query.trim() || 'top playlists');
    const urls = [
      `${this.localBase}/api/search/playlists?query=${encoded}&limit=${limit}`,
      `${this.externalBase}/api/search/playlists?query=${encoded}&limit=${limit}`,
    ];
    for (const url of urls) {
      const results = await safeFetch(url, 6000);
      if (results) {
        this.setInCache(cacheKey, results, 30 * 60 * 1000);
        return results;
      }
    }
    return [];
  }

  async getPlaylistSongs(playlistId: string, limit = 100): Promise<Song[]> {
    if (!playlistId) return [];
    const cacheKey = `playlist_songs_${playlistId}_${limit}`;
    const cached = this.getFromCache<Song[]>(cacheKey);
    if (cached) return cached;

    const urls = [
      `${this.localBase}/api/playlists?id=${playlistId}&limit=${limit}`,
      `${this.externalBase}/api/playlists?id=${playlistId}&limit=${limit}`,
    ];

    for (const url of urls) {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 6000);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (res.ok) {
          const data = await res.json();
          const songs = data.data?.songs || data.songs || [];
          if (songs.length > 0) {
            const mapped = deduplicateSongs(songs.map(mapTrackToSong));
            // Cache playlist songs for 2 hours
            this.setInCache(cacheKey, mapped, 2 * 60 * 60 * 1000);
            return mapped;
          }
        }
      } catch {
        clearTimeout(tid);
      }
    }
    return [];
  }

  async searchArtists(query: string, limit = 10): Promise<any[]> {
    const cacheKey = `search_artists_${query.trim().toLowerCase()}_${limit}`;
    const cached = this.getFromCache<any[]>(cacheKey);
    if (cached) return cached;

    const encoded = encodeURIComponent(query.trim() || 'top artists');
    const urls = [
      `${this.localBase}/api/search/artists?query=${encoded}&limit=${limit}`,
      `${this.externalBase}/api/search/artists?query=${encoded}&limit=${limit}`,
    ];
    for (const url of urls) {
      const results = await safeFetch(url, 6000);
      if (results) {
        this.setInCache(cacheKey, results, 30 * 60 * 1000);
        return results;
      }
    }
    return [];
  }

  async getArtistDetails(artistId: string, songCount = 20, albumCount = 20): Promise<any | null> {
    if (!artistId) return null;
    const cacheKey = `artist_details_${artistId}_${songCount}_${albumCount}`;
    const cached = this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    const urls = [
      `${this.localBase}/api/artists?id=${artistId}&page=0&songCount=${songCount}&albumCount=${albumCount}`,
      `${this.externalBase}/api/artists?id=${artistId}&page=0&songCount=${songCount}&albumCount=${albumCount}`,
    ];

    for (const url of urls) {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 60000); // Wait up to 60s for Saavn
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            // Cache artist details for 2 hours
            this.setInCache(cacheKey, data.data, 2 * 60 * 60 * 1000);
            return data.data;
          }
        }
      } catch {
        clearTimeout(tid);
      }
    }
    return null;
  }
}
