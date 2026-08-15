export type LyricsStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
export type LyricsType = 'plain' | 'line-synced';
export type LyricsScriptMode = 'native' | 'romanized' | 'both';

export interface LyricsLine {
  id: string;
  startMs: number;
  endMs?: number; // Optional: calculated based on the start time of the next line
  text: string; // Active text according to current script mode
  nativeText?: string; // Original native script (e.g. Telugu, Tamil, Hindi)
  romanizedText?: string; // Transliterated Latin script (e.g. Tinglish, Tanglish, Hinglish)
  translationText?: string; // Optional English meaning translation
}

export interface LyricsData {
  trackId: string;
  type: LyricsType;
  lines: LyricsLine[];
  source?: string;
  language?: string;
  hasRomanized?: boolean;
}

