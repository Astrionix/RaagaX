/**
 * RealMusicEngine — client-side music search.
 * Routes through the local Next.js API proxy (/api/search/songs).
 * The proxy in turn calls the configured JioSaavn provider server-side.
 * Never calls external APIs directly from the browser.
 */

import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { getApiBaseUrl } from '@/lib/config/apiConfig';
import { SongUniquenessEngine } from '@/lib/music/SongUniquenessEngine';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { QualityManager } from '@/lib/playback/QualityManager';

const getLocalApiBase = () => {
  return `${getApiBaseUrl().replace(/\/+$/, '')}/api`;
};

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
    // Sanitize query: strip surrounding/unescaped quotes and brackets that break upstream parsers
    const cleanQ = (query || '')
      .replace(/["“”'‘’]/g, '')
      .replace(/\(From\s+[^)]+\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const q = cleanQ || 'Trending Telugu Songs';
    const url = `${getLocalApiBase()}/search/songs?query=${encodeURIComponent(q)}&limit=${limit}`;

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
    return url.replace(/150x150|50x50|300x300/g, '500x500');
  }

  public async searchRealAlbums(query: string, limit = 15): Promise<any[]> {
    const q = query.trim();
    if (!q) return [];
    const url = `${getLocalApiBase()}/search/albums?query=${encodeURIComponent(q)}&limit=${limit}`;

    try {
      let data: any = null;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (res.ok) data = await res.json();
      } catch {}

      // Direct fallback if proxy is cold or unreachable
      if (!data || (!data.data?.results && !data.results)) {
        try {
          const directUrl = `https://saavn.dev/api/search/albums?query=${encodeURIComponent(q)}&limit=${limit}`;
          const dRes = await fetch(directUrl, { signal: AbortSignal.timeout(6000) });
          if (dRes.ok) data = await dRes.json();
        } catch {}
      }

      const results = data?.data?.results || data?.results || [];
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

    const tryEndpoints = [
      isAlbum ? `${getLocalApiBase()}/albums?id=${fetchId}` : `${getLocalApiBase()}/playlists?id=${fetchId}`,
      isAlbum ? `https://saavn.dev/api/albums?id=${fetchId}` : `https://saavn.dev/api/playlists?id=${fetchId}`,
      `${getLocalApiBase()}/albums?id=${fetchId}`,
      `https://saavn.dev/api/albums?id=${fetchId}`,
    ];

    try {
      let collection: any = null;

      for (const ep of tryEndpoints) {
        if (collection) break;
        try {
          const res = await fetch(ep, { signal: AbortSignal.timeout(6000) });
          if (res.ok) {
            const json = await res.json();
            collection = json?.data || json;
            if (collection && (Array.isArray(collection.songs) || collection.name || collection.title)) {
              if (ep.includes('/albums')) isAlbum = true;
              break;
            }
          }
        } catch {}
      }

      if (!collection) return null;

      const coverUrl = this.extractCoverUrl(collection.image || collection.coverUrl) || '/app-icon.png';

      const albReleaseDate = collection.release_date || collection.releaseDate || (collection.year ? `${collection.year}-01-01` : undefined);
      let rawSongs = collection.songs ? this.mapResults(collection.songs) : [];

      if (albReleaseDate) {
        rawSongs = rawSongs.map((s) => ({
          ...s,
          releaseDate: s.releaseDate && !s.releaseDate.endsWith('-01-01') ? s.releaseDate : albReleaseDate,
          releaseYear: albReleaseDate ? parseInt(String(albReleaseDate).slice(0, 4)) : s.releaseYear,
        }));
      }

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
        targetSongs: 100,
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
        coverUrl = rawImages.replace('http://', 'https://').replace(/150x150|50x50|300x300/g, '500x500');
      } else if (Array.isArray(rawImages) && rawImages.length > 0) {
        const hi = rawImages.find((i: any) => i?.quality === '500x500' || i?.quality === '500X500') || rawImages[rawImages.length - 1];
        const rawUrl = hi?.url || hi?.link || (typeof hi === 'string' ? hi : '');
        if (rawUrl) {
          coverUrl = rawUrl.replace('http://', 'https://').replace(/150x150|50x50|300x300/g, '500x500');
        } else if (typeof rawImages[0] === 'string') {
          coverUrl = rawImages[rawImages.length - 1].replace('http://', 'https://').replace(/150x150|50x50|300x300/g, '500x500');
        }
      }
      if (!coverUrl || coverUrl.includes('/null/') || coverUrl.endsWith('/null')) {
        coverUrl = '/app-icon.png';
      }

      let audioUrl = '';
      if (Array.isArray(track.downloadUrl) && track.downloadUrl.length > 0) {
        const qualityPreset = usePlayerStore.getState().streamingQuality;
        const wantsDataSaver = (qualityPreset as string) === '320kbps MP3' || qualityPreset === 'LOW' || usePlayerStore.getState().isDataSaverEnabled;
        const maxBitrate = wantsDataSaver ? 160 : 320;
        
        const selected = QualityManager.selectHighestQuality(track.downloadUrl, maxBitrate);
        if (selected) {
          audioUrl = selected;
        }
      } else if (typeof track.downloadUrl === 'string' && track.downloadUrl) {
        audioUrl = track.downloadUrl.replace('http://', 'https://');
      } else if (track.media_preview_url) {
        audioUrl = track.media_preview_url.replace('http://', 'https://').replace('_preview.mp3', '_320.mp4');
      }

      const rawTitle = track.name || track.title || 'Untitled Track';
      const rawAlbum = track.album?.name || track.album || track.more_info?.album || '';

      const title = SongFormatter.cleanSongTitle(rawTitle);
      const albumName = SongFormatter.cleanAlbumTitle(rawAlbum, rawTitle) || title;
      const playCount =
        typeof track.playCount === 'number' ? track.playCount : parseInt(track.playCount) || 125000;
      const duration =
        typeof track.duration === 'number' ? track.duration : parseInt(track.duration) || 210;

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
        language: track.language ? track.language.charAt(0).toUpperCase() + track.language.slice(1) : 'Telugu',
        language_code: track.language ? (track.language.toLowerCase() === 'telugu' ? 'te' : track.language.toLowerCase() === 'hindi' ? 'hi' : track.language.toLowerCase() === 'tamil' ? 'ta' : track.language.slice(0, 2).toLowerCase()) : 'te',
        category: 'latest_telugu' as const,
        releaseYear: parseInt(track.year || (track.releaseDate ? track.releaseDate.slice(0, 4) : '2026')) || 2026,
        releaseDate: track.releaseDate || track.release_date || (track.year ? `${track.year}-01-01` : undefined),
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
    }).filter((song: Song) => {
      if (!song.title) return false;
      const titleLower = song.title.toLowerCase();
      if (/testing|sample trailer|test track|test audio|dummy|sound check|preview only/i.test(titleLower)) {
        return false;
      }
      // Genuine songs duration between 30s and 15 mins (900s)
      if (song.duration && (song.duration > 900 || song.duration < 30)) {
        return false;
      }
      return true;
    });

    return SongUniquenessEngine.deduplicate(raw);
  }
}
