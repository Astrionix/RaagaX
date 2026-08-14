/**
 * RealMusicEngine — client-side music search.
 * Routes through the local Next.js API proxy (/api/search/songs).
 * The proxy in turn calls the configured JioSaavn provider server-side.
 * Never calls external APIs directly from the browser.
 */

import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';

const LOCAL_API_BASE =
  typeof window !== 'undefined' && window.location?.origin
    ? `${window.location.origin}/api`
    : 'http://localhost:3001/api';

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

  private constructor() { }

  public static getInstance(): RealMusicEngine {
    if (!RealMusicEngine.instance) {
      RealMusicEngine.instance = new RealMusicEngine();
    }
    return RealMusicEngine.instance;
  }

  public async getRealTrendingSongs(limit = 15, language = 'Telugu'): Promise<Song[]> {
    return this.searchRealSongs(`Trending ${language} Songs`, limit);
  }

  public async getNewReleases(limit = 15, language = 'Telugu'): Promise<Song[]> {
    return this.searchRealSongs(`New ${language} Songs`, limit);
  }

  public async getTop100(limit = 20, language = 'Telugu'): Promise<Song[]> {
    return this.searchRealSongs(`Top ${language} Hits`, limit);
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
    const tid = setTimeout(() => ctrl.abort(), 12000);

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return [];
      const data = await res.json();
      const results = data.data?.results || data.results || [];
      return results.length > 0 ? this.mapResults(results) : [];
    } catch (err: any) {
      clearTimeout(tid);
      if (err?.name !== 'AbortError') {
        console.warn(`[RealMusicEngine] Fetch error for query: "${q}"`, err?.message);
      }
      return [];
    }
  }

  private extractCoverUrl(image: any): string {
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
    return url;
  }

  public async searchRealAlbums(query: string, limit = 15): Promise<any[]> {
    const q = query.trim();
    if (!q) return [];
    const url = `${LOCAL_API_BASE}/search/albums?query=${encodeURIComponent(q)}&limit=${limit}`;

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 7000);

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return [];
      const data = await res.json();
      const results = data.data?.results || data.results || [];
      return results.map((album: any) => {
        const coverUrl = this.extractCoverUrl(album.image || album.coverUrl) || '/app-icon.png';
        return {
          id: album.id,
          title: decode(album.name || album.title || 'Unknown Album'),
          artist: decode(album.primaryArtists || 'Unknown Artist'),
          coverUrl,
          releaseYear: parseInt(album.year) || 2024
        };
      });
    } catch (err: any) {
      clearTimeout(tid);
      return [];
    }
  }

  public async getPlaylistDetails(id: string): Promise<{ id: string; title: string; coverUrl: string; songs: Song[] } | null> {
    let isAlbum = false;
    let fetchId = id;

    if (id.startsWith('album:')) {
      isAlbum = true;
      fetchId = id.replace('album:', '');
    }

    let url = isAlbum ? `${LOCAL_API_BASE}/albums?id=${fetchId}` : `${LOCAL_API_BASE}/playlists?id=${fetchId}`;

    try {
      let res = await fetch(url);
      let data = res.ok ? await res.json() : null;
      let collection = data?.data;

      // Fallback to Albums if Playlist fails (for legacy IDs)
      if (!res.ok || !collection) {
        if (!isAlbum) {
          url = `${LOCAL_API_BASE}/albums?id=${fetchId}`;
          res = await fetch(url);
          if (res.ok) {
            data = await res.json();
            collection = data?.data;
            isAlbum = true;
          }
        }
      }

      if (!collection) return null;

      const coverUrl = this.extractCoverUrl(collection.image || collection.coverUrl) || '/app-icon.png';

      let rawSongs = collection.songs ? this.mapResults(collection.songs) : [];

      // Only apply minimum padding/deduplication for playlists, NOT for actual albums
      // Because we want full movie albums to just show exactly the songs they have.
      if (isAlbum) {
        return {
          id: collection.id,
          title: decode(collection.name || collection.title || 'Unknown Album'),
          coverUrl,
          songs: rawSongs // Don't deduplicate or pad exact albums
        };
      }

      // Album Rules
      const albumRules = {
        minimumSongs: 50,
        targetSongs: 60,
        minimumUniquePercentage: 0.80,
        maximumOverlapPercentage: 0.20,
        maximumSameArtistPercentage: 0.25
      };

      const uniqueSongs: Song[] = [];
      const seenTitles = new Set<string>();
      const artistCounts: Record<string, number> = {};
      const maxPerArtist = Math.max(3, Math.floor(albumRules.targetSongs * albumRules.maximumSameArtistPercentage));

      for (const song of rawSongs) {
        if (uniqueSongs.length >= albumRules.targetSongs) break;

        // Basic normalization for title deduplication
        const normalizedTitle = song.title.toLowerCase()
          .replace(/\(from.*?\)/g, '')
          .replace(/lyrical|video|official/g, '')
          .replace(/[^a-z0-9]/g, '');

        const firstArtist = (song.artist || '').split(',')[0].trim().toLowerCase() || 'unknown';
        const compositeKey = `${normalizedTitle}_${firstArtist}`;

        if (seenTitles.has(compositeKey)) continue;

        artistCounts[firstArtist] = (artistCounts[firstArtist] || 0) + 1;
        if (artistCounts[firstArtist] > maxPerArtist) continue;

        seenTitles.add(compositeKey);
        uniqueSongs.push(song);
      }

      // If we fell short of minimum, pad with search (simplified padding for now)
      if (uniqueSongs.length < albumRules.minimumSongs && collection.name) {
        try {
          const padSongs = await this.searchRealSongs(collection.name, albumRules.targetSongs - uniqueSongs.length);
          for (const song of padSongs) {
            if (uniqueSongs.length >= albumRules.targetSongs) break;
            const normalizedTitle = song.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            const firstArtist = (song.artist || '').split(',')[0].trim().toLowerCase() || 'unknown';
            const compositeKey = `${normalizedTitle}_${firstArtist}`;
            if (!seenTitles.has(compositeKey)) {
              seenTitles.add(compositeKey);
              uniqueSongs.push(song);
            }
          }
        } catch (e) { }
      }

      return {
        id: collection.id,
        title: decode(collection.name || collection.title || 'Unknown Playlist'),
        coverUrl,
        songs: uniqueSongs
      };
    } catch (e) {
      console.warn(`[RealMusicEngine] Fetch error for playlist ${id}:`, e);
      return null;
    }
  }

  private mapResults(results: any[]): Song[] {
    const raw = results.map((track, idx) => {
      const pa = track.artists?.primary || track.artists?.all || [];
      const artist =
        pa.length > 0
          ? pa.map((a: any) => decode(a.name)).join(', ')
          : decode(track.artist || track.subtitle || 'Unknown Artist');

      const rawImages = track.image || track.images || [];
      let coverUrl = '/app-icon.png';

      if (typeof rawImages === 'string') {
        coverUrl = rawImages.replace('http://', 'https://');
      } else if (Array.isArray(rawImages) && rawImages.length > 0) {
        const hi = rawImages.find((i: any) => i?.quality === '500x500' || i?.quality === '500X500') || rawImages[rawImages.length - 1];
        const rawUrl = hi?.url || hi?.link || (typeof hi === 'string' ? hi : '');
        if (rawUrl) {
          coverUrl = rawUrl.replace('http://', 'https://');
        } else if (typeof rawImages[0] === 'string') {
          coverUrl = rawImages[rawImages.length - 1].replace('http://', 'https://');
        }
      }

      let audioUrl = '';
      if (Array.isArray(track.downloadUrl) && track.downloadUrl.length > 0) {
        const qualityPreset = usePlayerStore.getState().streamingQuality;
        const wantsDataSaver = (qualityPreset as string) === '320kbps MP3' || qualityPreset === 'LOW';

        const preferredQuality = wantsDataSaver ? '160kbps' : '320kbps';
        const fallbackQuality = wantsDataSaver ? '96kbps' : '160kbps';

        const best =
          track.downloadUrl.find((a: any) => a?.quality === preferredQuality) ||
          track.downloadUrl.find((a: any) => a?.quality === fallbackQuality) ||
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
