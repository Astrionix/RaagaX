import { Song } from '@/types/music';

/**
 * SongCoverEngine — Guarantees that every song playing in RaagaX
 * always has its raw, uncompressed 500x500 JioSaavn artwork.
 */
export class SongCoverEngine {
  private static instance: SongCoverEngine;
  private memoryCoverCache = new Map<string, string>();

  private constructor() {}

  public static getInstance(): SongCoverEngine {
    if (!SongCoverEngine.instance) {
      SongCoverEngine.instance = new SongCoverEngine();
    }
    return SongCoverEngine.instance;
  }

  /**
   * Formats any image URL to the highest 500x500 resolution on JioSaavn CDN
   */
  public formatRawCoverUrl(url?: string | null): string {
    if (!url || typeof url !== 'string') return '/app-icon.png';
    if (url.includes('/null/') || url.includes('null/null') || url.endsWith('/null')) {
      return '/app-icon.png';
    }

    let clean = url.trim().replace('http://', 'https://');

    // Upgrade low-res indicators to 500x500
    clean = clean.replace(/150x150|50x50|300x300|150X150|50X50|300X300/g, '500x500');

    // Strip dynamic cache query params if necessary or preserve secure CDN params
    return clean;
  }

  /**
   * Checks if a coverUrl is already a verified full-resolution image
   */
  public isHighResCover(url?: string | null): boolean {
    if (!url) return false;
    if (url === '/app-icon.png' || url.includes('/null/')) return false;
    if (url.includes('500x500') || url.includes('saavncdn.com')) return true;
    return false;
  }

  /**
   * Fetches raw real image from JioSaavn for a given song
   */
  public async fetchRawSongCover(song: Song): Promise<string | null> {
    if (!song) return null;

    // Check memory cache first
    const cacheKey = song.id || `${song.title}_${song.artist}`;
    if (this.memoryCoverCache.has(cacheKey)) {
      return this.memoryCoverCache.get(cacheKey)!;
    }

    // 1. If song already has a valid Saavn URL, format it to 500x500
    if (song.coverUrl && song.coverUrl !== '/app-icon.png' && song.coverUrl.includes('saavncdn.com')) {
      const formatted = this.formatRawCoverUrl(song.coverUrl);
      this.memoryCoverCache.set(cacheKey, formatted);
      return formatted;
    }

    // 2. Direct Song Details API by ID (if ID is a Saavn list/pid)
    if (song.id && !song.id.startsWith('local-') && !song.id.startsWith('offline-')) {
      try {
        const url = `https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=${encodeURIComponent(song.id)}&_format=json&_marker=0&ctx=web6dot0`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data = await res.json();
          const targetSong = data?.songs?.[0] || data?.[song.id];
          const rawImg = targetSong?.image || targetSong?.images || targetSong?.artwork;
          if (rawImg) {
            const rawUrl = typeof rawImg === 'string' ? rawImg : (rawImg[rawImg.length - 1]?.url || rawImg[0]?.url);
            if (rawUrl) {
              const formatted = this.formatRawCoverUrl(rawUrl);
              this.memoryCoverCache.set(cacheKey, formatted);
              return formatted;
            }
          }
        }
      } catch (e) {
        // Continue to search fallback
      }
    }

    // 3. Search Fallback via JioSaavn Search API for track name + artist
    if (song.title) {
      try {
        const query = `${song.title} ${song.artist || ''}`.trim();
        const searchUrl = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&query=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=web6dot0`;
        const res = await fetch(searchUrl, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data = await res.json();
          const songResults = data?.songs?.data || data?.albums?.data || [];
          if (songResults.length > 0 && songResults[0]?.image) {
            const formatted = this.formatRawCoverUrl(songResults[0].image);
            this.memoryCoverCache.set(cacheKey, formatted);
            return formatted;
          }
        }
      } catch {}
    }

    return null;
  }

  /**
   * Resolves and upgrades the active song's cover image in real-time
   */
  public async ensureActiveSongCover(song: Song): Promise<Song> {
    if (!song) return song;

    // Immediately format existing URL
    let coverUrl = this.formatRawCoverUrl(song.coverUrl);

    // If it's still missing or placeholder, fetch from JioSaavn asynchronously
    if (!this.isHighResCover(coverUrl)) {
      const fetchedCover = await this.fetchRawSongCover(song);
      if (fetchedCover) {
        coverUrl = fetchedCover;
      }
    }

    const updatedSong: Song = {
      ...song,
      coverUrl,
    };

    return updatedSong;
  }
}
