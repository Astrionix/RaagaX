import { create } from 'zustand';
import { LyricsLine, LyricsStatus, LyricsType, LyricsData, LyricsScriptMode } from '@/lib/lyrics/LyricsTypes';

const SCRIPT_MODE_STORAGE_KEY = 'raagax_lyrics_script_mode';

const getStoredScriptMode = (): LyricsScriptMode => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(SCRIPT_MODE_STORAGE_KEY) as LyricsScriptMode;
      if (saved === 'native' || saved === 'transliteration') {
        return saved;
      }
    } catch {}
  }
  return 'native';
};

interface LyricsState {
  trackId: string | null;
  status: LyricsStatus;
  type: LyricsType;
  lines: LyricsLine[];
  hasTransliteration: boolean;
  
  // Option A ('native') or Option B ('transliteration')
  scriptMode: LyricsScriptMode;
  
  // The actively highlighted line
  currentLineIndex: number;
  
  // User manual offset in milliseconds
  userOffsetMs: number;

  setLyricsData: (trackId: string, data: LyricsData | null, status: LyricsStatus) => void;
  setCurrentLineIndex: (index: number) => void;
  setUserOffsetMs: (offset: number) => void;
  setScriptMode: (mode: LyricsScriptMode) => void;
  toggleScriptMode: () => void;
  reset: () => void;
}

export const useLyricsStore = create<LyricsState>((set, get) => ({
  trackId: null,
  status: 'idle',
  type: 'plain',
  lines: [],
  hasTransliteration: false,
  scriptMode: getStoredScriptMode(),
  currentLineIndex: -1,
  userOffsetMs: 0,

  setLyricsData: (trackId, data, status) => {
    const lines = data?.lines || [];
    const hasTransliteration = lines.some(l => !!l.romanizedText && l.romanizedText !== l.nativeText);

    return set({
      trackId,
      status,
      type: data?.type || 'plain',
      lines,
      hasTransliteration,
      currentLineIndex: -1,
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

  toggleScriptMode: () => {
    const current = get().scriptMode;
    const next: LyricsScriptMode = current === 'native' ? 'transliteration' : 'native';
    get().setScriptMode(next);
  },

  reset: () => set({
    trackId: null,
    status: 'idle',
    type: 'plain',
    lines: [],
    hasTransliteration: false,
    currentLineIndex: -1,
    userOffsetMs: 0
  })
}));

