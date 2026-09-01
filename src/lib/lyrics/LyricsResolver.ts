import { LyricsData } from './LyricsTypes';
import { LyricsCache } from './LyricsCache';
import { LyricsParser } from './LyricsParser';
import { getApiUrl } from '@/lib/config/apiConfig';

export class LyricsResolver {
  private static instance: LyricsResolver;
  private inFlightRequests = new Map<string, Promise<LyricsData | null>>();

  private constructor() {}

  public static getInstance(): LyricsResolver {
    if (!LyricsResolver.instance) {
      LyricsResolver.instance = new LyricsResolver();
    }
    return LyricsResolver.instance;
  }

  public async fetchLyrics(
    trackId: string,
    metadata?: { title: string; artist: string; album?: string; durationMs?: number }
  ): Promise<LyricsData | null> {
    if (!trackId) return null;

    // 1. Check Local Cache (IndexedDB) for 0ms instant response
    const cached = await LyricsCache.getInstance().getLyrics(trackId);
    if (cached) {
      return cached;
    }

    if (!metadata || !metadata.title || !metadata.artist) {
      console.warn('[LyricsResolver] Metadata (title, artist) required to query lyrics API.');
      return null;
    }

    // Deduplicate in-flight requests for the exact same track
    if (this.inFlightRequests.has(trackId)) {
      return this.inFlightRequests.get(trackId)!;
    }

    const fetchPromise = this.performFetch(trackId, metadata);
    this.inFlightRequests.set(trackId, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      this.inFlightRequests.delete(trackId);
    }
  }

  private async performFetch(
    trackId: string,
    metadata: { title: string; artist: string; album?: string; durationMs?: number }
  ): Promise<LyricsData | null> {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return null;
      }
      // 2. Fetch through centralized RaagaX API proxy (handles CORS & fallback providers)
      const endpoint = getApiUrl('/api/lyrics');
      const url = new URL(endpoint, typeof window !== 'undefined' ? window.location.origin : undefined);
      url.searchParams.append('trackId', trackId);
      url.searchParams.append('title', metadata.title);
      url.searchParams.append('artist', metadata.artist);
      if (metadata.album) url.searchParams.append('album', metadata.album);
      if (metadata.durationMs) url.searchParams.append('durationMs', metadata.durationMs.toString());

      let rawText = '';
      let source = 'RaagaX';

      try {
        const res = await fetch(url.toString(), {
          signal: AbortSignal.timeout(5000),
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const apiData = await res.json();
          if (apiData.status === 'ready' && apiData.rawText) {
            rawText = apiData.rawText;
            source = apiData.source || 'RaagaX';
          }
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError' && err?.name !== 'TimeoutError') {
          console.warn('[LyricsResolver] API proxy request error:', err);
        }
      }

      if (!rawText) return null;

      const langHint = (metadata as any)?.language || (metadata as any)?.genre;
      const parsed = LyricsParser.parse(rawText, langHint, metadata.durationMs);

      const lyricsData: LyricsData = {
        trackId,
        type: parsed.type,
        lines: parsed.lines,
        source,
        language: langHint,
        hasTransliteration: parsed.lines.some((l) => !!l.romanizedText),
      };

      // 3. Save to Local Cache (IndexedDB) for offline playback
      await LyricsCache.getInstance().saveLyrics(lyricsData);

      return lyricsData;
    } catch (e) {
      console.error('[LyricsResolver] Failed to resolve lyrics:', e);
      return null;
    }
  }
}
