export type LyricsStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
export type LyricsType = 'plain' | 'line-synced';

export interface LyricsLine {
  id: string;
  startMs: number;
  endMs?: number; // Optional: calculated based on the start time of the next line
  text: string;
}

export interface LyricsData {
  trackId: string;
  type: LyricsType;
  lines: LyricsLine[];
  source?: string;
  language?: string;
}
