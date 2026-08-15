import { create } from 'zustand';
import { LyricsLine, LyricsStatus, LyricsType, LyricsData, LyricsScriptMode } from '@/lib/lyrics/LyricsTypes';

const SCRIPT_MODE_STORAGE_KEY = 'raagax_lyrics_script_mode';

const getStoredScriptMode = (): LyricsScriptMode => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(SCRIPT_MODE_STORAGE_KEY) as LyricsScriptMode;
      if (saved === 'native' || saved === 'romanized' || saved === 'both' || saved === 'all') {
        return saved;
      }
    } catch {}
  }
  return 'both';
};

interface LyricsState {
  trackId: string | null;
  status: LyricsStatus;
  type: LyricsType;
  lines: LyricsLine[];
  hasRomanized: boolean;
  hasTranslation: boolean;
  
  // Active script presentation mode ('native' | 'romanized' | 'both' | 'all')
  scriptMode: LyricsScriptMode;
  
  // The actively highlighted line
  currentLineIndex: number;
  
  // User manual offset in milliseconds
  userOffsetMs: number;

  setLyricsData: (trackId: string, data: LyricsData | null, status: LyricsStatus) => void;
  setCurrentLineIndex: (index: number) => void;
  setUserOffsetMs: (offset: number) => void;
  setScriptMode: (mode: LyricsScriptMode) => void;
  reset: () => void;
}

export const useLyricsStore = create<LyricsState>((set) => ({
  trackId: null,
  status: 'idle',
  type: 'plain',
  lines: [],
  hasRomanized: false,
  hasTranslation: false,
  scriptMode: getStoredScriptMode(),
  currentLineIndex: -1,
  userOffsetMs: 0,

  setLyricsData: (trackId, data, status) => {
    const lines = data?.lines || [];
    const hasRomanized = lines.some(l => !!l.romanizedText && l.romanizedText !== l.nativeText);
    const hasTranslation = lines.some(l => !!l.translationText);

    return set({
      trackId,
      status,
      type: data?.type || 'plain',
      lines,
      hasRomanized,
      hasTranslation,
      currentLineIndex: -1,
      // Reset offset on new track
      userOffsetMs: 0
    });
  },
  
  setCurrentLineIndex: (index) => set({ currentLineIndex: index }),
  
  setUserOffsetMs: (offset) => set({ userOffsetMs: offset }),

  setScriptMode: (mode) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(SCRIPT_MODE_STORAGE_KEY, mode);
      } catch {}
    }
    set({ scriptMode: mode });
  },

  reset: () => set({
    trackId: null,
    status: 'idle',
    type: 'plain',
    lines: [],
    hasRomanized: false,
    hasTranslation: false,
    currentLineIndex: -1,
    userOffsetMs: 0
  })
}));

