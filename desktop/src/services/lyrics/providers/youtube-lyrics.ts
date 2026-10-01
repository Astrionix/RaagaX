import { ILyricsProvider, LyricsQuery, LyricLine, LyricsSource, LyricsSyncType } from "@/types/lyrics";

const INNERTUBE_CONTEXT = {
  client: {
    clientName: "WEB_REMIX",
    clientVersion: "1.20240318.01.00",
    hl: "en",
    gl: "US",
  },
};

export class YouTubeMusicLyricsProvider implements ILyricsProvider {
  readonly id: LyricsSource = "YOUTUBE_MUSIC";
  readonly label = "YouTube Music";
  readonly detail = "Official lyrics from YouTube Music's Lyrics tab";
  readonly syncType: LyricsSyncType = "plain";

  async fetch(query: LyricsQuery): Promise<LyricLine[] | null> {
    if (!query.videoId) return null;

    try {
      // 1. Call next endpoint to get lyrics browseId
      const nextRes = await fetch("https://music.youtube.com/youtubei/v1/next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Referer: "https://music.youtube.com/",
        },
        body: JSON.stringify({
          context: INNERTUBE_CONTEXT,
          videoId: query.videoId,
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (!nextRes.ok) return null;
      const nextData = await nextRes.json();

      // Find lyrics browseId from tabRenderer
      const tabs = nextData?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs;
      if (!Array.isArray(tabs)) return null;

      let lyricsBrowseId: string | null = null;
      for (const tab of tabs) {
        const tabRenderer = tab?.tabRenderer;
        const title = tabRenderer?.title?.toLowerCase?.() || "";
        if (title.includes("lyric")) {
          lyricsBrowseId = tabRenderer?.endpoint?.browseEndpoint?.browseId;
          break;
        }
      }

      if (!lyricsBrowseId) return null;

      // 2. Fetch lyrics content via browse endpoint
      const browseRes = await fetch("https://music.youtube.com/youtubei/v1/browse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Referer: "https://music.youtube.com/",
        },
        body: JSON.stringify({
          context: INNERTUBE_CONTEXT,
          browseId: lyricsBrowseId,
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (!browseRes.ok) return null;
      const browseData = await browseRes.json();

      const descriptionShelf = browseData?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer;
      const rawText = descriptionShelf?.description?.runs?.map((r: any) => r.text || "").join("") || "";
      if (!rawText.trim()) return null;

      const lines = rawText
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .map((text: string, idx: number) => ({
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

export class YouTubeTranscriptProvider implements ILyricsProvider {
  readonly id: LyricsSource = "YOUTUBE_TRANSCRIPT";
  readonly label = "YouTube Captions";
  readonly detail = "Time-aligned captions matched to the exact playing video";
  readonly syncType: LyricsSyncType = "line-synced";

  async fetch(query: LyricsQuery): Promise<LyricLine[] | null> {
    if (!query.videoId) return null;

    try {
      // Fetch timed captions from YouTube timedtext endpoint
      const res = await fetch(`https://video.google.com/timedtext?type=track&v=${query.videoId}&lang=en&fmt=json3`, {
        headers: { "User-Agent": "Raaga-Desktop/1.0.0" },
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data?.events)) return null;

      const lines: LyricLine[] = [];

      for (const event of data.events) {
        if (!event.segs || !event.tStartMs) continue;
        const text = event.segs.map((s: any) => s.utf8 || "").join("").trim().replace(/^♪\s*|\s*♪$/g, "");
        if (!text) continue;

        lines.push({
          startTimeMs: event.tStartMs,
          endTimeMs: event.tStartMs + (event.dDurationMs || 2500),
          text,
        });
      }

      lines.sort((a, b) => a.startTimeMs - b.startTimeMs);
      return lines.length > 0 ? lines : null;
    } catch {
      return null;
    }
  }
}
