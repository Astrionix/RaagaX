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

    // 2. Fetch from API
    try {
      const url = new URL('/api/lyrics', window.location.origin);
      url.searchParams.append('trackId', trackId);
      url.searchParams.append('title', metadata.title);
      url.searchParams.append('artist', metadata.artist);
      if (metadata.album) url.searchParams.append('album', metadata.album);
      if (metadata.durationMs) url.searchParams.append('durationMs', metadata.durationMs.toString());

      const res = await fetch(url.toString());
      if (!res.ok) return null;

      const apiData = await res.json();
      
      if (apiData.status !== 'ready' || !apiData.rawText) {
        return null; // or cache the negative result
      }

      const parsed = LyricsParser.parse(apiData.rawText);
      
      const lyricsData: LyricsData = {
        trackId,
        type: parsed.type,
        lines: parsed.lines,
        source: apiData.source
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
