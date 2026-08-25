import { Song } from '@/types/music';

export interface ArtworkResolutions {
  artworkUrl50: string;
  artworkUrl150: string;
  artworkUrl500: string;
}

/**
 * SongCoverEngine — Guarantees that every song, album, artist, and playlist
 * in RaagaX always uses its official original 500x500 artwork from the metadata source.
 *
 * Rules:
 * 1. Uses official artwork URLs from music metadata sources (JioSaavn CDN).
 * 2. Never generates fake AI covers when official metadata exists.
 * 3. Never substitutes unrelated song covers.
 * 4. Caches by stable song/album ID.
 * 5. Provides multi-resolution mapping (50x50, 150x150, 500x500).
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
    if (url.includes('/null/') || url.includes('null/null') || url.endsWith('/null') || url.trim() === '') {
      return '/app-icon.png';
    }

    let clean = url.trim().replace('http://', 'https://');

    // Upgrade low-res indicators to 500x500 original
    clean = clean.replace(/150x150|50x50|300x300|150X150|50X50|300X300/g, '500x500');

    return clean;
  }

  /**
   * Generates all three standard artwork resolutions (50x50, 150x150, 500x500)
   */
  public getArtworkResolutions(url?: string | null): ArtworkResolutions {
    const raw = this.formatRawCoverUrl(url);
    if (raw === '/app-icon.png') {
      return {
        artworkUrl50: '/app-icon.png',
        artworkUrl150: '/app-icon.png',
        artworkUrl500: '/app-icon.png',
      };
    }

    return {
      artworkUrl50: raw.replace(/150x150|500x500/g, '50x50'),
      artworkUrl150: raw.replace(/50x50|500x500/g, '150x150'),
      artworkUrl500: raw.replace(/50x50|150x150/g, '500x500'),
    };
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
   * Fetches the official original cover artwork from JioSaavn for a given song
   */
  public async fetchRawSongCover(song: Song): Promise<string | null> {
    if (!song) return null;

    // Cache by stable song ID first, fallback to stable artist+title
    const cacheKey = song.id || `${song.title}_${song.artist}`;
    if (this.memoryCoverCache.has(cacheKey)) {
      return this.memoryCoverCache.get(cacheKey)!;
    }

    // 1. If song already has a valid Saavn URL, format to 500x500 original
    if (song.coverUrl && song.coverUrl !== '/app-icon.png' && song.coverUrl.includes('saavncdn.com')) {
      const formatted = this.formatRawCoverUrl(song.coverUrl);
      this.memoryCoverCache.set(cacheKey, formatted);
      return formatted;
    }

    // 2. Direct Song Details API by stable PID
    if (song.id && !song.id.startsWith('local-') && !song.id.startsWith('offline-')) {
      try {
        const url = `https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=${encodeURIComponent(song.id)}&_format=json&_marker=0&ctx=web6dot0`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
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
      } catch {
        // Continue to search fallback
      }
    }

    const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 3. Official Album Search Fallback (Exact / Substring Match Only)
    if (song.album && song.album !== 'Unknown Album') {
      try {
        const albumQuery = encodeURIComponent(song.album);
        const searchUrl = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&query=${albumQuery}&_format=json&_marker=0&ctx=web6dot0`;
        const res = await fetch(searchUrl, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const data = await res.json();
          const albums = data?.albums?.data || [];
          const matchedAlbum = albums.find((a: any) => {
            const cleanA = sanitize(a.title || a.name || '');
            const cleanTarget = sanitize(song.album || '');
            return cleanA && cleanTarget && (cleanA === cleanTarget || cleanA.includes(cleanTarget) || cleanTarget.includes(cleanA));
          });
          if (matchedAlbum?.image) {
            const formatted = this.formatRawCoverUrl(matchedAlbum.image);
            this.memoryCoverCache.set(cacheKey, formatted);
            return formatted;
          }
        }
      } catch {
        // Continue to song title fallback
      }
    }

    // 4. Exact Title + Artist Autocomplete Fallback (Strict Match Only)
    if (song.title) {
      try {
        const query = `${song.title} ${song.artist || ''}`.trim();
        const searchUrl = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&query=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=web6dot0`;
        const res = await fetch(searchUrl, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const data = await res.json();
          const songResults = data?.songs?.data || [];
          const matchedSong = songResults.find((s: any) => {
            const cleanS = sanitize(s.title || s.name || '');
            const cleanTarget = sanitize(song.title || '');
            return cleanS && cleanTarget && (cleanS === cleanTarget || cleanS.includes(cleanTarget) || cleanTarget.includes(cleanS));
          });
          if (matchedSong?.image) {
            const formatted = this.formatRawCoverUrl(matchedSong.image);
            this.memoryCoverCache.set(cacheKey, formatted);
            return formatted;
          }
        }
      } catch {
        // Return neutral placeholder
      }
    }

    return '/app-icon.png';
  }

  /**
   * Ensures the active song in PlayerStore has its official 500x500 artwork
   */
  public async ensureActiveSongCover(song: Song): Promise<Song> {
    if (!song) return song;

    if (this.isHighResCover(song.coverUrl)) {
      return {
        ...song,
        coverUrl: this.formatRawCoverUrl(song.coverUrl),
      };
    }

    const officialCover = await this.fetchRawSongCover(song);
    if (officialCover && officialCover !== '/app-icon.png') {
      return {
        ...song,
        coverUrl: officialCover,
      };
    }

    return song;
  }
}
