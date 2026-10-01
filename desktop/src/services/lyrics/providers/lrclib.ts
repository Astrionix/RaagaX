import { ILyricsProvider, LyricsQuery, LyricLine, LyricsSource, LyricsSyncType } from "@/types/lyrics";
import { normalizeTitle, normalizeArtist } from "../query-normalizer";
import { parseLrc } from "../parsers/lrc-parser";

export class LrcLibProvider implements ILyricsProvider {
  readonly id: LyricsSource = "LRCLIB";
  readonly label = "LRCLIB";
  readonly detail = "High availability line-synced open community LRC database";
  readonly syncType: LyricsSyncType = "line-synced";

  private readonly baseUrl = "https://lrclib.net/api/get";

  async fetch(query: LyricsQuery): Promise<LyricLine[] | null> {
    const track_name = normalizeTitle(query.title);
    const artist_name = normalizeArtist(query.artist);
    if (!track_name) return null;

    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set("track_name", track_name);
      url.searchParams.set("artist_name", artist_name);
      if (query.durationSeconds && query.durationSeconds > 0) {
        url.searchParams.set("duration", Math.round(query.durationSeconds).toString());
      }
      if (query.album) {
        url.searchParams.set("album_name", query.album);
      }

      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "Raaga-Desktop/1.0.0 (https://raaga.app)" },
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) return null;
      const data = await res.json();

      if (data.syncedLyrics && data.syncedLyrics.trim()) {
        const lines = parseLrc(data.syncedLyrics);
        if (lines.length > 0) return lines;
      }

      if (data.plainLyrics && data.plainLyrics.trim()) {
        const plainLines = data.plainLyrics
          .split("\n")
          .map((t: string, idx: number) => ({
            text: t.trim(),
            startTimeMs: idx * 4000,
            endTimeMs: (idx + 1) * 4000,
          }))
          .filter((l: any) => l.text.length > 0);

        if (plainLines.length > 0) return plainLines;
      }

      return null;
    } catch {
      return null;
    }
  }
}
