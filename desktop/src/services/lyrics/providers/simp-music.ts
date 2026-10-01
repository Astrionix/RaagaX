import { ILyricsProvider, LyricsQuery, LyricLine, LyricsSource, LyricsSyncType } from "@/types/lyrics";
import { parseLrc } from "../parsers/lrc-parser";

export class SimpMusicProvider implements ILyricsProvider {
  readonly id: LyricsSource = "SIMP_MUSIC";
  readonly label = "SimpMusic";
  readonly detail = "Keyed on the YouTube video ID, so never the wrong edit";
  readonly syncType: LyricsSyncType = "word-synced";

  private readonly baseUrl = "https://api-lyrics.simpmusic.org/v1/";

  async fetch(query: LyricsQuery): Promise<LyricLine[] | null> {
    if (!query.videoId) return null;

    try {
      const res = await fetch(`${this.baseUrl}${query.videoId}`, {
        headers: { "User-Agent": "Raaga-Desktop/1.0.0" },
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.success || !Array.isArray(data.data) || !data.data.length) return null;

      const duration = query.durationSeconds || 0;
      const tolerance = 10;

      // Find closest duration match
      const matching = data.data.filter((item: any) => {
        if (!duration) return true;
        const diff = Math.abs((item.duration || 0) - duration);
        return diff <= tolerance;
      });

      const track = matching.length > 0 ? matching[0] : data.data[0];
      if (!track) return null;

      // Word timing first via richSyncLyrics
      if (track.richSyncLyrics && track.richSyncLyrics.trim()) {
        const decoded = decodeHtmlEntities(track.richSyncLyrics);
        const lines = parseLrc(decoded);
        if (lines.length > 0) return lines;
      }

      // Line synced fallback
      if (track.syncedLyrics && track.syncedLyrics.trim()) {
        const lines = parseLrc(track.syncedLyrics);
        if (lines.length > 0) return lines;
      }

      return null;
    } catch {
      return null;
    }
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
