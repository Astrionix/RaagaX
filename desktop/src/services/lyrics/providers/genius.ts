import { ILyricsProvider, LyricsQuery, LyricLine, LyricsSource, LyricsSyncType } from "@/types/lyrics";
import { normalizeTitle, normalizeArtist } from "../query-normalizer";

export class GeniusProvider implements ILyricsProvider {
  readonly id: LyricsSource = "GENIUS";
  readonly label = "Genius";
  readonly detail = "Vast plain text catalog, used as final fallback";
  readonly syncType: LyricsSyncType = "plain";

  async fetch(query: LyricsQuery): Promise<LyricLine[] | null> {
    const title = normalizeTitle(query.title);
    const artist = normalizeArtist(query.artist);
    if (!title) return null;

    try {
      const q = `${title} ${artist}`.trim();
      const searchUrl = `https://genius.com/api/search/multi?q=${encodeURIComponent(q)}`;

      const searchRes = await fetch(searchUrl, {
        headers: { "User-Agent": "Raaga" },
        signal: AbortSignal.timeout(3500),
      });

      if (!searchRes.ok) return null;
      const searchData = await searchRes.json();
      const sections = searchData?.response?.sections;
      if (!Array.isArray(sections)) return null;

      let songUrl: string | null = null;
      for (const section of sections) {
        if (section.type === "song" && Array.isArray(section.hits)) {
          for (const hit of section.hits) {
            if (hit.type === "song" && hit.result?.url) {
              songUrl = hit.result.url;
              break;
            }
          }
        }
        if (songUrl) break;
      }

      if (!songUrl) return null;

      // 2. Fetch Genius song page and extract lyric containers
      const pageRes = await fetch(songUrl, {
        headers: { "User-Agent": "Raaga" },
        signal: AbortSignal.timeout(4000),
      });

      if (!pageRes.ok) return null;
      const html = await pageRes.text();
      if (!html) return null;

      // Match all data-lyrics-container="true" elements
      const containerRegex = /<div\b[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
      let match: RegExpExecArray | null;
      const fragments: string[] = [];

      while ((match = containerRegex.exec(html)) !== null) {
        let text = match[1];
        // Replace <br> with newlines
        text = text.replace(/<br\s*\/?>/gi, "\n");
        // Strip remaining HTML tags
        text = text.replace(/<[^>]+>/g, "");
        fragments.push(text);
      }

      if (!fragments.length) return null;

      const rawLyrics = fragments.join("\n").trim();
      if (!rawLyrics) return null;

      const lines: LyricLine[] = rawLyrics
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !/^\[.*\]$/.test(l)) // keep verses or filter empty
        .map((text, idx) => ({
          startTimeMs: idx * 4000,
          endTimeMs: (idx + 1) * 4000,
          text,
        }));

      return lines.length > 0 ? lines : null;
    } catch {
      return null;
    }
  }
}
