/**
 * RealMusicEngine — client-side music search.
 * Routes through the local Next.js API proxy (/api/search/songs).
 * The proxy in turn calls the configured JioSaavn provider server-side.
 * Never calls external APIs directly from the browser.
 */

import { Song } from '@/types/music';

const LOCAL_API_BASE =
  typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:3001/api';

function decode(s: string): string {
  return (s || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export class RealMusicEngine {
  private static instance: RealMusicEngine;

  private constructor() {}

  public static getInstance(): RealMusicEngine {
    if (!RealMusicEngine.instance) {
      RealMusicEngine.instance = new RealMusicEngine();
    }
    return RealMusicEngine.instance;
  }

  public async getRealTrendingSongs(limit = 15, language = 'Telugu'): Promise<Song[]> {
    return this.searchRealSongs(`Trending ${language} Songs`, limit);
  }

  /**
   * Search real songs via the local API proxy.
   * Each request gets its own AbortController — cleanup of one
   * does NOT cancel other in-flight requests.
   */
  public async searchRealSongs(query: string, limit = 15): Promise<Song[]> {
    const q = query.trim() || 'Trending Telugu Songs';
    const url = `${LOCAL_API_BASE}/search/songs?query=${encodeURIComponent(q)}&limit=${limit}`;

    // Fresh controller per request
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 7000);

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return [];
      const data = await res.json();
      const results = data.data?.results || data.results || [];
      return results.length > 0 ? this.mapResults(results) : [];
    } catch (err: any) {
      clearTimeout(tid);
      // AbortError from timeout is expected — log quietly, don't propagate
      if (err?.name === 'AbortError') {
        console.warn(`[RealMusicEngine] Request timeout for query: "${q}"`);
      } else {
        console.warn(`[RealMusicEngine] Fetch error for query: "${q}"`, err?.message);
      }
      return [];
    }
  }

  private mapResults(results: any[]): Song[] {
    const raw = results.map((track, idx) => {
      const pa = track.artists?.primary || track.artists?.all || [];
      const artist =
        pa.length > 0
          ? pa.map((a: any) => decode(a.name)).join(', ')
          : decode(track.artist || track.subtitle || 'Unknown Artist');

      let coverUrl =
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80';
      if (Array.isArray(track.image)) {
        const hi =
          track.image.find((i: any) => i.quality === '500x500') ||
          track.image[track.image.length - 1];
        if (hi?.url) coverUrl = hi.url.replace('http://', 'https://');
      } else if (typeof track.image === 'string' && track.image) {
        coverUrl = track.image.replace('http://', 'https://');
      }

      let audioUrl =
        'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
      if (Array.isArray(track.downloadUrl)) {
        const best =
          track.downloadUrl.find((a: any) => a.quality === '320kbps') ||
          track.downloadUrl.find((a: any) => a.quality === '160kbps') ||
          track.downloadUrl[track.downloadUrl.length - 1];
        if (best?.url) audioUrl = best.url;
      } else if (typeof track.downloadUrl === 'string' && track.downloadUrl) {
        audioUrl = track.downloadUrl;
      }

      const albumName = decode(track.album?.name || 'JioSaavn Single');
      const playCount =
        typeof track.playCount === 'number' ? track.playCount : parseInt(track.playCount) || 125000;
      const duration =
        typeof track.duration === 'number' ? track.duration : parseInt(track.duration) || 210;
      const title = decode(track.name || track.title || 'Untitled Track');

      return {
        id: track.id || `saavn-${idx}`,
        title,
        artist,
        artistId: pa[0]?.id || `art-${idx}`,
        album: albumName,
        albumId: track.album?.id || `alb-${idx}`,
        duration,
        coverUrl,
        audioUrl,
        genre: track.language ? `${track.language.toUpperCase()} HITS` : 'MELODY HITS',
        category: 'latest_telugu' as const,
        releaseYear: parseInt(track.year) || 2024,
        plays: playCount,
        likes: Math.floor(playCount * 0.15),
        downloads: Math.floor(playCount * 0.08),
        audioQuality: '24-bit FLAC' as const,
        bitrate: '320 kbps',
        sampleRate: '48 kHz',
        codec: 'AAC HQ Stream',
        lyrics: [
          { time: 0, text: `${title} - Audio Stream` },
          { time: 10, text: `Performed by ${artist}` },
          { time: 25, text: `Album: ${albumName}` },
        ],
        credits: {
          composer: artist,
          lyricist: 'RaagaX Catalog',
          singers: pa.map((a: any) => decode(a.name)),
          label: track.label || 'Sony / Aditya Music',
        },
      };
    });

    return this.deduplicate(raw);
  }

  private deduplicate(songs: Song[]): Song[] {
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const unique: Song[] = [];
    for (const song of songs) {
      if (!song.id || seenIds.has(song.id)) continue;
      const clean = song.title
        .toLowerCase()
        .replace(/\(from[^)]*\)/gi, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\b(lofi|remix|slowed|reverb|flip|mix|instrumental|version|feat)\b/gi, '')
        .replace(/[^a-z0-9]/gi, '')
        .trim();
      const key = clean.length >= 3 ? clean : song.title.toLowerCase().trim();
      if (seenTitles.has(key)) continue;
      seenIds.add(song.id);
      seenTitles.add(key);
      unique.push(song);
    }
    return unique;
  }
}
