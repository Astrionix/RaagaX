import { ILyricsProvider, LyricsQuery, LyricLine, LyricsSource, LyricsSyncType } from "@/types/lyrics";
import { normalizeTitle, normalizeArtist } from "../query-normalizer";
import { parseTtml } from "../parsers/ttml-parser";
import { parseLrc } from "../parsers/lrc-parser";

export class LyricsPlusProvider implements ILyricsProvider {
  readonly id: LyricsSource = "LYRICS_PLUS";
  readonly label = "LyricsPlus";
  readonly detail = "Syllable-by-syllable timings through YouLy+ community mirrors";
  readonly syncType: LyricsSyncType = "syllable-synced";

  private readonly mirrors = [
    "https://lyricsplus.prjktla.my.id",
    "https://lyricsplus.atomix.one",
    "https://lyricsplus.binimum.org",
    "https://lyricsplus.prjktla.workers.dev",
    "https://lyricsplus-seven.vercel.app",
    "https://lyrics-plus-backend.vercel.app",
  ];

  private lastWorkingMirror: string | null = null;

  async fetch(query: LyricsQuery): Promise<LyricLine[] | null> {
    const title = normalizeTitle(query.title);
    const artist = normalizeArtist(query.artist);
    if (!title) return null;

    const hosts = this.lastWorkingMirror
      ? [this.lastWorkingMirror, ...this.mirrors.filter((m) => m !== this.lastWorkingMirror)]
      : this.mirrors;

    const fetchMirror = async (mirror: string): Promise<{ mirror: string; lines: LyricLine[] } | null> => {
      try {
        const url = new URL(`${mirror}/v2/lyrics/get`);
        url.searchParams.set("title", title);
        url.searchParams.set("artist", artist);
        if (query.durationSeconds && query.durationSeconds > 0) {
          url.searchParams.set("duration", Math.round(query.durationSeconds).toString());
        }
        if (query.isrc) {
          url.searchParams.set("isrc", query.isrc);
        }

        const res = await fetch(url.toString(), {
          headers: { "User-Agent": "Raaga-Desktop/1.0.0" },
          signal: AbortSignal.timeout(4000),
        });

        if (!res.ok) return null;
        const text = await res.text();
        if (!text) return null;

        // LyricsPlus returns JSON or direct TTML/LRC
        let rawContent = text;
        try {
          const json = JSON.parse(text);
          rawContent = json.ttml || json.lyrics || json.syncedLyrics || json.lines || text;
          if (typeof rawContent !== "string") {
            rawContent = JSON.stringify(rawContent);
          }
        } catch {}

        if (rawContent.includes("<p") || rawContent.includes("<tt")) {
          const lines = parseTtml(rawContent);
          if (lines.length > 0) return { mirror, lines };
        }

        const lrcLines = parseLrc(rawContent);
        if (lrcLines.length > 0) return { mirror, lines: lrcLines };

        return null;
      } catch {
        return null;
      }
    };

    // Race the mirrors concurrently, accept the first valid answer
    try {
      const results = await Promise.any(
        hosts.map((host) =>
          fetchMirror(host).then((res) => {
            if (res && res.lines.length > 0) return res;
            throw new Error("No lyrics from mirror");
          })
        )
      );

      if (results && results.lines.length > 0) {
        this.lastWorkingMirror = results.mirror;
        return results.lines;
      }
    } catch {}

    return null;
  }
}
