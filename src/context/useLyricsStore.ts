import { create } from 'zustand';
import { LyricsLine, LyricsStatus, LyricsType, LyricsData, LyricsScriptMode } from '@/lib/lyrics/LyricsTypes';

interface LyricsState {
  trackId: string | null;
  status: LyricsStatus;
  type: LyricsType;
  lines: LyricsLine[];
  hasRomanized: boolean;
  
  // Active script presentation mode ('native' | 'romanized' | 'both')
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
  scriptMode: 'both',
  currentLineIndex: -1,
  userOffsetMs: 0,

  setLyricsData: (trackId, data, status) => {
    const lines = data?.lines || [];
    const hasRomanized = lines.some(l => !!l.romanizedText && l.romanizedText !== l.nativeText);

    return set({
      trackId,
      status,
      type: data?.type || 'plain',
      lines,
      hasRomanized,
      currentLineIndex: -1,
      // Reset offset on new track
      userOffsetMs: 0
    });
  },
  
  setCurrentLineIndex: (index) => set({ currentLineIndex: index }),
  
  setUserOffsetMs: (offset) => set({ userOffsetMs: offset }),

  setScriptMode: (mode) => set({ scriptMode: mode }),

  reset: () => set({
    trackId: null,
    status: 'idle',
    type: 'plain',
    lines: [],
    hasRomanized: false,
    currentLineIndex: -1,
    userOffsetMs: 0
  })
}));

