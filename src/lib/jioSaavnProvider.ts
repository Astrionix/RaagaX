/**
 * JioSaavn Provider — single server-side gateway for all JioSaavn API calls.
 * Base URL is read from JIOSAAVN_API_BASE_URL env var.
 * Falls back to the local Next.js API proxy, then to saavn.sumit.co.
 */

import { Song } from '@/types/music';

// Language code mapping used for filtering
export const LANGUAGE_CODES: Record<string, string> = {
  Telugu: 'telugu',
  Kannada: 'kannada',
  Tamil: 'tamil',
  Hindi: 'hindi',
  Malayalam: 'malayalam',
  English: 'english',
};

function decode(s: string): string {
  return (s || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function mapTrackToSong(track: any, idx: number = 0): Song {
  const pa = track.artists?.primary || track.artists?.all || [];
  const artist =
    pa.length > 0
      ? pa.map((a: any) => decode(a.name)).join(', ')
      : decode(track.artist || track.subtitle || 'Unknown Artist');

  let coverUrl = '/app-icon.png';
  if (Array.isArray(track.image) && track.image.length > 0) {
    const hi =
      track.image.find((i: any) => i?.quality === '500x500' || i?.quality === '500X500') ||
      track.image[track.image.length - 1] ||
      track.image[0];
    const rawUrl = hi?.url || hi?.link || (typeof hi === 'string' ? hi : '');
    if (rawUrl) coverUrl = rawUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500');
  } else if (typeof track.image === 'string' && track.image) {
    coverUrl = track.image.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500');
  }
  if (!coverUrl) coverUrl = '/app-icon.png';

  let audioUrl = '';
  if (Array.isArray(track.downloadUrl) && track.downloadUrl.length > 0) {
    const best =
      track.downloadUrl.find((a: any) => a?.quality === '320kbps') ||
      track.downloadUrl.find((a: any) => a?.quality === '160kbps') ||
      track.downloadUrl[track.downloadUrl.length - 1];
    const rawAudio = best?.url || best?.link || (typeof best === 'string' ? best : '');
    if (rawAudio) audioUrl = rawAudio.replace('http://', 'https://');
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

  return {
    id: track.id || `saavn-${idx}`,
    title: decode(track.name || track.title || 'Untitled Track'),
    artist,
    artistId: pa[0]?.id || `art-${idx}`,
    album: decode(track.album?.name || 'Single'),
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
      { time: 0, text: `${decode(track.name || track.title || '')} — Audio Stream` },
    ],
    credits: {
      composer: artist,
      lyricist: 'RaagaX Catalog',
      singers: pa.map((a: any) => decode(a.name)),
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
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const unique: Song[] = [];
  for (const song of songs) {
    if (!song.id || seenIds.has(song.id)) continue;
    if (isKidsOrNurseryTrack(song)) continue;
    const clean = song.title
      .toLowerCase()
      .replace(/\(from[^)]*\)/gi, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\b(remix|lofi|slowed|reverb|cover|instrumental|version|feat)\b/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    const key = clean.length >= 3 ? clean : song.title.toLowerCase().trim();
    if (seenTitles.has(key)) continue;
    seenIds.add(song.id);
    seenTitles.add(key);
    unique.push(song);
  }
  return unique;
}

/**
 * Attempt a fetch against a single URL with timeout.
 * Returns null on any failure — never throws.
 */
async function safeFetch(url: string, timeoutMs = 5000): Promise<any[] | null> {
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
}

export class JioSaavnProvider {
  private static instance: JioSaavnProvider;

  // Server-side base URL — read from env, never exposed to browser
  private readonly externalBase: string;
  // Local Next.js API proxy base (same origin)
  private readonly localBase: string;

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

  /**
   * Search songs. Tries local proxy first, then external provider.
   * Never throws — returns [] on all failures.
   */
  async searchSongs(query: string, limit = 10): Promise<Song[]> {
    const encoded = encodeURIComponent(query.trim() || 'popular songs');
    const urls = [
      `${this.localBase}/api/search/songs?query=${encoded}&limit=${limit}`,
      `${this.externalBase}/api/search/songs?query=${encoded}&limit=${limit}`,
    ];

    for (const url of urls) {
      const results = await safeFetch(url, 6000);
      if (results) {
        console.log(`[PROVIDER] searchSongs OK query="${query}" url=${url}`);
        return deduplicateSongs(results.map(mapTrackToSong));
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
    const urls = [
      `${this.localBase}/api/songs/${songId}/suggestions?limit=${limit}`,
      `${this.externalBase}/api/songs/${songId}/suggestions?limit=${limit}`,
    ];

    for (const url of urls) {
      const results = await safeFetch(url, 6000);
      if (results) {
        console.log(`[PROVIDER] getRecommendations OK songId="${songId}" url=${url}`);
        return deduplicateSongs(results.map(mapTrackToSong));
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
    const encoded = encodeURIComponent(query.trim() || 'latest albums');
    const urls = [
      `${this.localBase}/api/search/albums?query=${encoded}&limit=${limit}`,
      `${this.externalBase}/api/search/albums?query=${encoded}&limit=${limit}`,
    ];
    for (const url of urls) {
      const results = await safeFetch(url, 6000);
      if (results) return results;
    }
    return [];
  }

  async searchPlaylists(query: string, limit = 10): Promise<any[]> {
    const encoded = encodeURIComponent(query.trim() || 'top playlists');
    const urls = [
      `${this.localBase}/api/search/playlists?query=${encoded}&limit=${limit}`,
      `${this.externalBase}/api/search/playlists?query=${encoded}&limit=${limit}`,
    ];
    for (const url of urls) {
      const results = await safeFetch(url, 6000);
      if (results) return results;
    }
    return [];
  }

  async getPlaylistSongs(playlistId: string): Promise<Song[]> {
    if (!playlistId) return [];
    const urls = [
      `${this.localBase}/api/playlists?id=${playlistId}`,
      `${this.externalBase}/api/playlists?id=${playlistId}`,
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
            return deduplicateSongs(songs.map(mapTrackToSong));
          }
        }
      } catch {
        clearTimeout(tid);
      }
    }
    return [];
  }

  async searchArtists(query: string, limit = 10): Promise<any[]> {
    const encoded = encodeURIComponent(query.trim() || 'top artists');
    const urls = [
      `${this.localBase}/api/search/artists?query=${encoded}&limit=${limit}`,
      `${this.externalBase}/api/search/artists?query=${encoded}&limit=${limit}`,
    ];
    for (const url of urls) {
      const results = await safeFetch(url, 6000);
      if (results) return results;
    }
    return [];
  }

  async getArtistDetails(artistId: string, songCount = 20, albumCount = 20): Promise<any | null> {
    if (!artistId) return null;
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
