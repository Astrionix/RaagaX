import { ILyricsProvider, LyricsQuery, LyricLine, LyricsSource, LyricsSyncType } from "@/types/lyrics";
import { normalizeTitle, normalizeArtist } from "../query-normalizer";
import { parseLrc } from "../parsers/lrc-parser";

export class KuGouProvider implements ILyricsProvider {
  readonly id: LyricsSource = "KUGOU";
  readonly label = "KuGou";
  readonly detail = "Global and Asian line-synced catalog with strong regional coverage";
  readonly syncType: LyricsSyncType = "line-synced";

  async fetch(query: LyricsQuery): Promise<LyricLine[] | null> {
    const title = normalizeTitle(query.title);
    const artist = normalizeArtist(query.artist);
    if (!title) return null;

    try {
      const keyword = `${artist} - ${title}`.trim();
      const searchUrl = `https://mobileservice.kugou.com/api/v3/search/song?version=9108&plat=0&pagesize=5&showtype=0&keyword=${encodeURIComponent(
        keyword
      )}`;

      const searchRes = await fetch(searchUrl, {
        headers: { "User-Agent": "Raaga-Desktop/1.0.0" },
        signal: AbortSignal.timeout(3500),
      });

      if (!searchRes.ok) return null;
      const searchData = await searchRes.json();
      const songs = searchData?.data?.info;
      if (!Array.isArray(songs) || !songs.length) return null;

      const duration = query.durationSeconds || 0;
      let matchedHash = songs[0].hash;

      if (duration > 0) {
        const closest = songs.find((s: any) => Math.abs((s.duration || 0) - duration) <= 8);
        if (closest) matchedHash = closest.hash;
      }

      if (!matchedHash) return null;

      // 2. Search lyrics candidate by song hash
      const lyricSearchUrl = `http://krcs.kugou.com/search?ver=1&man=yes&client=mobi&keyword=&duration=&hash=${matchedHash}`;
      const candidateRes = await fetch(lyricSearchUrl, {
        headers: { "User-Agent": "Raaga-Desktop/1.0.0" },
        signal: AbortSignal.timeout(3500),
      });

      if (!candidateRes.ok) return null;
      const candidateData = await candidateRes.json();
      const candidate = candidateData?.candidates?.[0];
      if (!candidate?.id || !candidate?.accesskey) return null;

      // 3. Download lyrics content
      const downloadUrl = `http://lyrics.kugou.com/download?ver=1&client=pc&id=${candidate.id}&accesskey=${candidate.accesskey}&fmt=lrc&charset=utf8`;
      const dlRes = await fetch(downloadUrl, {
        headers: { "User-Agent": "Raaga-Desktop/1.0.0" },
        signal: AbortSignal.timeout(3500),
      });

      if (!dlRes.ok) return null;
      const dlData = await dlRes.json();
      if (!dlData?.content) return null;

      // Base64 decode
      const decodedLrc = Buffer.from(dlData.content, "base64").toString("utf-8");
      if (!decodedLrc) return null;

      const lines = parseLrc(decodedLrc);
      return lines.length > 0 ? lines : null;
    } catch {
      return null;
    }
  }
}
