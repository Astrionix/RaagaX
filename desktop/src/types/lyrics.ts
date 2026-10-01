/**
 * Multi-Provider Lyrics Architecture Types for Raaga Desktop
 * Modeled after BitChord and Raaga Android core lyrics engines.
 */

export interface LyricWord {
  startMs: number;
  endMs: number;
  text: string;
}

export type LyricAlignment = "Start" | "End";

export interface LyricLine {
  startTimeMs: number;
  endTimeMs?: number;
  text: string;
  words?: LyricWord[];
  sungUntilMs?: number;
  background?: LyricLine;
  alignment?: LyricAlignment;
  isGap?: boolean;
}

export type LyricsSyncType = "plain" | "line-synced" | "word-synced" | "syllable-synced";

export type LyricsSource =
  | "AUTO"
  | "YOUTUBE_MUSIC"
  | "YOUTUBE_TRANSCRIPT"
  | "BETTER_LYRICS"
  | "BETTER_LYRICS_PORTATO"
  | "LYRICS_PLUS"
  | "SIMP_MUSIC"
  | "UNISON"
  | "LRCLIB"
  | "KUGOU"
  | "MUSIXMATCH"
  | "GENIUS";

export interface LyricsQuery {
  videoId?: string;
  title: string;
  artist: string;
  durationSeconds?: number;
  album?: string;
  isrc?: string;
  preferredSource?: LyricsSource;
}

export interface ProviderMeta {
  id: LyricsSource;
  label: string;
  detail: string;
  syncType: LyricsSyncType;
}

export interface LyricsData {
  synced: boolean;
  syncType: LyricsSyncType;
  lines: LyricLine[];
  plainText?: string;
  provider: string;
  providerId: LyricsSource;
  hasTimestamps: boolean;
  hasWordSync: boolean;
  availableProviders?: ProviderMeta[];
  notFoundOnProvider?: boolean;
}

export interface ILyricsProvider {
  readonly id: LyricsSource;
  readonly label: string;
  readonly detail: string;
  readonly syncType: LyricsSyncType;
  fetch(query: LyricsQuery): Promise<LyricLine[] | null>;
}
