import { ILyricsProvider, LyricsQuery, LyricLine, LyricsSource, LyricsSyncType } from "@/types/lyrics";
import { normalizeTitle, normalizeArtist } from "../query-normalizer";
import { parseTtml } from "../parsers/ttml-parser";
import { parseLrc } from "../parsers/lrc-parser";

export class UnisonProvider implements ILyricsProvider {
  readonly id: LyricsSource = "UNISON";
  readonly label = "Unison";
  readonly detail = "Contributed by listeners, carries tracks not found elsewhere";
  readonly syncType: LyricsSyncType = "word-synced";

  private readonly baseUrl = "https://unison.boidu.dev/lyrics";

  async fetch(query: LyricsQuery): Promise<LyricLine[] | null> {
    const song = normalizeTitle(query.title);
    const artist = normalizeArtist(query.artist);
    if (!song) return null;

    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set("song", song);
      url.searchParams.set("artist", artist);
      if (query.album) url.searchParams.set("album", query.album);
      if (query.durationSeconds && query.durationSeconds > 0) {
        url.searchParams.set("duration", Math.round(query.durationSeconds).toString());
      }

      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "Raaga-Desktop/1.0.0" },
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) return null;
      const json = await res.json();
      if (!json?.success || !json.data?.lyrics) return null;

      const rawLyrics = json.data.lyrics;
      const format = (json.data.format || "").toLowerCase();

      if (format.includes("ttml") || rawLyrics.includes("<p") || rawLyrics.includes("<tt")) {
        const lines = parseTtml(rawLyrics);
        if (lines.length > 0) return lines;
      }

      const lrcLines = parseLrc(rawLyrics);
      return lrcLines.length > 0 ? lrcLines : null;
    } catch {
      return null;
    }
  }
}
