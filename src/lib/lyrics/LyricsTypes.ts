export type LyricsStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
export type LyricsType = 'plain' | 'line-synced';
export type LyricsScriptMode = 'native' | 'english' | 'romanized' | 'dual' | 'transliteration';

export interface LyricsLine {
  id: string;
  startMs: number;
  endMs?: number; // Optional: calculated based on the start time of the next line
  text: string;
  nativeText?: string; // Option A: Original native script (e.g. Telugu, Tamil, Hindi, Japanese, Arabic)
  englishText?: string; // Option B: English translated meaning
  romanizedText?: string; // Option C: Transliterated Latin script (e.g. Tinglish, Tanglish, Hinglish, Romaji)
}

export interface LyricsData {
  trackId: string;
  type: LyricsType;
  lines: LyricsLine[];
  source?: string;
  language?: string;
  hasTransliteration?: boolean;
}

