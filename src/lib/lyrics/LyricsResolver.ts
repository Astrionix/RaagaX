import { LyricsData } from './LyricsTypes';
import { LyricsCache } from './LyricsCache';
import { LyricsParser } from './LyricsParser';

export class LyricsResolver {
  private static instance: LyricsResolver;

  private constructor() {}

  public static getInstance(): LyricsResolver {
    if (!LyricsResolver.instance) {
      LyricsResolver.instance = new LyricsResolver();
    }
    return LyricsResolver.instance;
  }

  public async fetchLyrics(trackId: string, metadata?: { title: string, artist: string, album?: string, durationMs?: number }): Promise<LyricsData | null> {
    if (!trackId) return null;

    // 1. Check Local Cache (IndexedDB)
    const cached = await LyricsCache.getInstance().getLyrics(trackId);
    if (cached) {
      return cached;
    }

    if (!metadata || !metadata.title || !metadata.artist) {
      console.warn('LyricsResolver requires metadata (title, artist) to fetch from external API.');
      return null;
    }

    // 2. Fetch from API or direct fallback
    try {
      let baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://raaga-x-chi.vercel.app';
      if (baseUrl.includes('localhost') && typeof window !== 'undefined' && (window as any).Capacitor) {
        baseUrl = 'https://raaga-x-chi.vercel.app';
      }

      const url = new URL('/api/lyrics', baseUrl);
      url.searchParams.append('trackId', trackId);
      url.searchParams.append('title', metadata.title);
      url.searchParams.append('artist', metadata.artist);
      if (metadata.album) url.searchParams.append('album', metadata.album);
      if (metadata.durationMs) url.searchParams.append('durationMs', metadata.durationMs.toString());

      let rawText = '';
      let source = 'RaagaX';

      try {
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const apiData = await res.json();
          if (apiData.status === 'ready' && apiData.rawText) {
            rawText = apiData.rawText;
            source = apiData.source || 'LRCLIB';
          }
        }
      } catch {}

      // Direct client fallback to LRCLIB if API proxy fails
      if (!rawText) {
        try {
          const cleanTitle = metadata.title.replace(/\s*\([^)]*\)|\s*\[[^\]]*\]/g, '').trim();
          const cleanArtist = metadata.artist.split(/[,&/]/)[0].trim();
          const directUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle || metadata.title)}&artist_name=${encodeURIComponent(cleanArtist)}`;
          const directRes = await fetch(directUrl, { signal: AbortSignal.timeout(3500) });
          if (directRes.ok) {
            const data = await directRes.json();
            rawText = data.syncedLyrics || data.plainLyrics || '';
            source = 'LRCLIB';
          }
        } catch {}
      }

      if (!rawText) return null;

      const langHint = (metadata as any)?.language || (metadata as any)?.genre;
      const parsed = LyricsParser.parse(rawText, langHint);
      
      const lyricsData: LyricsData = {
        trackId,
        type: parsed.type,
        lines: parsed.lines,
        source,
        language: langHint,
        hasRomanized: parsed.lines.some(l => !!l.romanizedText)
      };

      // 3. Save to Cache
      await LyricsCache.getInstance().saveLyrics(lyricsData);

      return lyricsData;
    } catch (e) {
      console.error('Failed to resolve lyrics:', e);
      return null;
    }
  }
}
