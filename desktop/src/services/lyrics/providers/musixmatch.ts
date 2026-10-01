import { ILyricsProvider, LyricsQuery, LyricLine, LyricsSource, LyricsSyncType } from "@/types/lyrics";
import { normalizeTitle, normalizeArtist } from "../query-normalizer";
import { parseLrc } from "../parsers/lrc-parser";

export class MusixmatchProvider implements ILyricsProvider {
  readonly id: LyricsSource = "MUSIXMATCH";
  readonly label = "Musixmatch";
  readonly detail = "Line and rich sync via public Musixmatch proxy";
  readonly syncType: LyricsSyncType = "line-synced";

  async fetch(query: LyricsQuery): Promise<LyricLine[] | null> {
    const title = normalizeTitle(query.title);
    const artist = normalizeArtist(query.artist);
    if (!title) return null;

    try {
      // Query Musixmatch through public tokenless proxy
      const searchUrl = `https://apic-desktop.musixmatch.com/ws/1.1/macro.subtitles.get?format=json&q_track=${encodeURIComponent(
        title
      )}&q_artist=${encodeURIComponent(
        artist
      )}&user_language=en&f_subtitle_length=${Math.round(query.durationSeconds || 0)}&f_subtitle_length_max_deviation=20&app_id=web-desktop-app-v1.0`;

      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Cookie: "AWSELBCORS=0; AWSELB=0",
        },
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) return null;
      const json = await res.json();
      const body = json?.message?.body?.macro_calls;

      // 1. Try richsync (word-level)
      const richsyncRaw = body?.["track.richsync.get"]?.message?.body?.richsync?.richsync_body;
      if (richsyncRaw) {
        try {
          const parsedRich = JSON.parse(richsyncRaw);
          if (Array.isArray(parsedRich)) {
            const lines: LyricLine[] = parsedRich.map((item: any) => ({
              startTimeMs: Math.round((item.ts || 0) * 1000),
              endTimeMs: Math.round((item.te || 0) * 1000),
              text: item.x || "",
              words: Array.isArray(item.l)
                ? item.l.map((w: any) => ({
                    startMs: Math.round(((item.ts || 0) + (w.o || 0)) * 1000),
                    endMs: Math.round(((item.ts || 0) + (w.o || 0) + (w.d || 0.3)) * 1000),
                    text: w.c || "",
                  }))
                : undefined,
            }));
            if (lines.length > 0) return lines;
          }
        } catch {}
      }

      // 2. Try subtitle (line-level)
      const subtitleRaw = body?.["track.subtitles.get"]?.message?.body?.subtitle_list?.[0]?.subtitle?.subtitle_body;
      if (subtitleRaw) {
        const lines = parseLrc(subtitleRaw);
        if (lines.length > 0) return lines;
      }

      return null;
    } catch {
      return null;
    }
  }
}
