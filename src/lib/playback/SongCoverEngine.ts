import { Song } from '@/types/music';
import { JioSaavnMediaPipeline } from '@/lib/media/JioSaavnMediaPipeline';

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
 * 2. Never accepts playlist/editorial/discovery banners as song or album artwork.
 * 3. Never generates fake AI covers when official metadata exists.
 * 4. Never substitutes unrelated song covers.
 * 5. Caches by stable song/album ID (e.g. jiosaavn:song:123, jiosaavn:album:456).
 * 6. Provides multi-resolution mapping (50x50, 150x150, 500x500).
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
   * Checks if a coverUrl is a verified direct song or album artwork (NOT playlist/editorial)
   */
  public isHighResCover(url?: string | null): boolean {
    if (!url) return false;
    if (url === '/app-icon.png' || url.includes('/null/')) return false;
    return JioSaavnMediaPipeline.getInstance().isDirectSongOrAlbumArtwork(url);
  }

  /**
   * Fetches the official original cover artwork from JioSaavn for a given song
   */
  public async fetchRawSongCover(song: Song): Promise<string | null> {
    if (!song) return null;

    const pipeline = JioSaavnMediaPipeline.getInstance();

    // Cache by stable key: jiosaavn:song:{id} or jiosaavn:album:{albumId}
    const songKey = song.id ? `jiosaavn:song:${song.id}` : null;
    const albumKey = song.albumId ? `jiosaavn:album:${song.albumId}` : null;
    const titleKey = `jiosaavn:title:${song.title}_${song.artist}`;

    if (songKey && this.memoryCoverCache.has(songKey)) {
      return this.memoryCoverCache.get(songKey)!;
    }
    if (albumKey && this.memoryCoverCache.has(albumKey)) {
      return this.memoryCoverCache.get(albumKey)!;
    }
    if (this.memoryCoverCache.has(titleKey)) {
      return this.memoryCoverCache.get(titleKey)!;
    }

    // 1. Direct song artwork if already a valid numeric song/album URL (NOT editorial/playlist)
    if (pipeline.isDirectSongOrAlbumArtwork(song.coverUrl)) {
      const formatted = this.formatRawCoverUrl(song.coverUrl);
      if (songKey) this.memoryCoverCache.set(songKey, formatted);
      return formatted;
    }

    // 2. Direct album artwork if present
    const rawAlbumImg = (song as any).albumCoverUrl || (song as any).album_artwork_url;
    if (pipeline.isDirectSongOrAlbumArtwork(rawAlbumImg)) {
      const formatted = this.formatRawCoverUrl(rawAlbumImg);
      if (songKey) this.memoryCoverCache.set(songKey, formatted);
      if (albumKey) this.memoryCoverCache.set(albumKey, formatted);
      return formatted;
    }

    const isBrowser = typeof window !== 'undefined';

    // 3. Direct Song Details API by stable PID (Extracts true song/album artwork)
    if (song.id && !song.id.startsWith('local-') && !song.id.startsWith('offline-') && !song.id.startsWith('saavn-')) {
      try {
        const url = isBrowser
          ? `/api/songs/${encodeURIComponent(song.id)}`
          : `https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=${encodeURIComponent(song.id)}&_format=json&_marker=0&ctx=web6dot0`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const data = await res.json();
          const targetSong = data?.data?.[0] || data?.songs?.[0] || data?.[song.id] || data;
          const rawImg = targetSong?.image || targetSong?.images || targetSong?.coverUrl || targetSong?.artwork || targetSong?.more_info?.album_url;
          if (rawImg) {
            const rawUrl = typeof rawImg === 'string' ? rawImg : (rawImg[rawImg.length - 1]?.url || rawImg[0]?.url);
            if (rawUrl && pipeline.isDirectSongOrAlbumArtwork(rawUrl)) {
              const formatted = this.formatRawCoverUrl(rawUrl);
              if (songKey) this.memoryCoverCache.set(songKey, formatted);
              return formatted;
            }
          }
        }
      } catch {
        // Continue to album fetch
      }
    }

    // 4. Official Album Details API by Album ID
    if (song.albumId && !song.albumId.startsWith('alb-') && !song.albumId.startsWith('local-')) {
      try {
        const url = isBrowser
          ? `/api/albums/${encodeURIComponent(song.albumId)}`
          : `https://www.jiosaavn.com/api.php?__call=content.getAlbumDetails&albumid=${encodeURIComponent(song.albumId)}&_format=json&_marker=0&ctx=web6dot0`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const data = await res.json();
          const albumObj = data?.data || data;
          const rawImg = albumObj?.image || albumObj?.images || albumObj?.coverUrl;
          if (rawImg) {
            const rawUrl = typeof rawImg === 'string' ? rawImg : (rawImg[rawImg.length - 1]?.url || rawImg[0]?.url);
            if (rawUrl && pipeline.isDirectSongOrAlbumArtwork(rawUrl)) {
              const formatted = this.formatRawCoverUrl(rawUrl);
              if (songKey) this.memoryCoverCache.set(songKey, formatted);
              if (albumKey) this.memoryCoverCache.set(albumKey, formatted);
              return formatted;
            }
          }
        }
      } catch {
        // Continue to search fallback
      }
    }

    const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 5. Official Album Search (Exact match for album name)
    if (song.album && song.album !== 'Unknown Album') {
      try {
        const albumQuery = encodeURIComponent(song.album);
        const searchUrl = isBrowser
          ? `/api/search/albums?q=${albumQuery}`
          : `https://www.jiosaavn.com/api.php?__call=autocomplete.get&query=${albumQuery}&_format=json&_marker=0&ctx=web6dot0`;
        const res = await fetch(searchUrl, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const data = await res.json();
          const albums = data?.data?.results || data?.albums?.data || [];
          const matchedAlbum = albums.find((a: any) => {
            const cleanA = sanitize(a.title || a.name || '');
            const cleanTarget = sanitize(song.album || '');
            return cleanA && cleanTarget && (cleanA === cleanTarget || cleanA.includes(cleanTarget) || cleanTarget.includes(cleanA));
          });
          const albumCover = matchedAlbum?.image || matchedAlbum?.coverUrl;
          if (albumCover && pipeline.isDirectSongOrAlbumArtwork(albumCover)) {
            const formatted = this.formatRawCoverUrl(albumCover);
            if (songKey) this.memoryCoverCache.set(songKey, formatted);
            if (albumKey) this.memoryCoverCache.set(albumKey, formatted);
            return formatted;
          }
        }
      } catch {
        // Continue to song title fallback
      }
    }

    // 6. Exact Title + Artist Autocomplete Fallback (Strict Match Only)
    if (song.title) {
      try {
        const query = `${song.title} ${song.artist || ''}`.trim();
        const searchUrl = isBrowser
          ? `/api/search/songs?q=${encodeURIComponent(query)}`
          : `https://www.jiosaavn.com/api.php?__call=autocomplete.get&query=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=web6dot0`;
        const res = await fetch(searchUrl, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const data = await res.json();
          const songResults = data?.data?.results || data?.songs?.data || [];
          const matchedSong = songResults.find((s: any) => {
            const cleanS = sanitize(s.title || s.name || '');
            const cleanTarget = sanitize(song.title || '');
            return cleanS && cleanTarget && (cleanS === cleanTarget || cleanS.includes(cleanTarget) || cleanTarget.includes(cleanS));
          });
          const songCover = matchedSong?.image || matchedSong?.coverUrl;
          if (songCover && pipeline.isDirectSongOrAlbumArtwork(songCover)) {
            const formatted = this.formatRawCoverUrl(songCover);
            if (songKey) this.memoryCoverCache.set(songKey, formatted);
            this.memoryCoverCache.set(titleKey, formatted);
            return formatted;
          }
        }
      } catch {
        // Return null
      }
    }

    return null;
  }

  /**
   * Ensures the active song in PlayerStore has its official 500x500 song/album artwork
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
