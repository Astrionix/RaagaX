import { ILyricsProvider, LyricsQuery, LyricLine, LyricsSource, LyricsSyncType } from "@/types/lyrics";
import { normalizeTitle, normalizeArtist } from "../query-normalizer";
import { parseTtml } from "../parsers/ttml-parser";
import { parseLrc } from "../parsers/lrc-parser";

export class BetterLyricsProvider implements ILyricsProvider {
  readonly id: LyricsSource = "BETTER_LYRICS";
  readonly label = "BetterLyrics";
  readonly detail = "Apple Music word/syllable timings via BetterLyrics";
  readonly syncType: LyricsSyncType = "syllable-synced";

  private readonly baseUrl = "https://lyrics-api.boidu.dev/getLyrics";

  async fetch(query: LyricsQuery): Promise<LyricLine[] | null> {
    const s = normalizeTitle(query.title);
    const a = normalizeArtist(query.artist);
    if (!s) return null;

    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set("s", s);
      url.searchParams.set("a", a);
      if (query.durationSeconds && query.durationSeconds > 0) {
        url.searchParams.set("d", Math.round(query.durationSeconds).toString());
      }
      if (query.album) {
        url.searchParams.set("al", query.album);
      }

      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "Raaga-Desktop/1.0.0" },
        signal: AbortSignal.timeout(4500),
      });

      if (!res.ok) return null;
      const body = await res.text();
      if (!body || body.trim().length === 0) return null;

      if (body.includes("<p") || body.includes("<tt")) {
        const lines = parseTtml(body);
        return lines.length > 0 ? lines : null;
      }

      const lrcLines = parseLrc(body);
      return lrcLines.length > 0 ? lrcLines : null;
    } catch {
      return null;
    }
  }
}

export class BetterLyricsPortatoProvider implements ILyricsProvider {
  readonly id: LyricsSource = "BETTER_LYRICS_PORTATO";
  readonly label = "BetterLyrics Portato";
  readonly detail = "QQ Music karaoke timings through BetterLyrics";
  readonly syncType: LyricsSyncType = "syllable-synced";

  private readonly baseUrl = "https://lyrics-api.boidu.dev/qq/getLyrics";

  async fetch(query: LyricsQuery): Promise<LyricLine[] | null> {
    const s = normalizeTitle(query.title);
    const a = normalizeArtist(query.artist);
    if (!s) return null;

    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set("s", s);
      url.searchParams.set("a", a);
      if (query.durationSeconds && query.durationSeconds > 0) {
        url.searchParams.set("d", Math.round(query.durationSeconds).toString());
      }

      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "Raaga-Desktop/1.0.0" },
        signal: AbortSignal.timeout(4500),
      });

      if (!res.ok) return null;
      const body = await res.text();
      if (!body) return null;

      if (body.includes("<p") || body.includes("<tt")) {
        const lines = parseTtml(body);
        return lines.length > 0 ? lines : null;
      }

      const lrcLines = parseLrc(body);
      return lrcLines.length > 0 ? lrcLines : null;
    } catch {
      return null;
    }
  }
}
