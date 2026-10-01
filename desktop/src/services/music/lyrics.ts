import { LyricsData, LyricsQuery } from "@/types/lyrics";
import { lyricsRepository } from "../lyrics/lyrics-repository";

export { parseLrc } from "../lyrics/parsers/lrc-parser";
export { parseTtml } from "../lyrics/parsers/ttml-parser";

/**
 * High-level lyrics fetcher delegating to the prioritized multi-provider LyricsRepository.
 */
export async function fetchLyrics(
  trackName: string,
  artistName: string,
  durationSeconds?: number,
  videoId?: string,
  album?: string,
  preferredSource?: any
): Promise<LyricsData> {
  const query: LyricsQuery = {
    title: trackName,
    artist: artistName,
    durationSeconds: durationSeconds || 0,
    videoId,
    album,
    preferredSource,
  };

  return lyricsRepository.getLyrics(query);
}
