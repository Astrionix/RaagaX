import { create } from 'zustand';
import { LyricsLine, LyricsStatus, LyricsType, LyricsData } from '@/lib/lyrics/LyricsTypes';

interface LyricsState {
  trackId: string | null;
  status: LyricsStatus;
  type: LyricsType;
  lines: LyricsLine[];
  
  // The actively highlighted line
  currentLineIndex: number;
  
  // User manual offset in milliseconds
  userOffsetMs: number;

  setLyricsData: (trackId: string, data: LyricsData | null, status: LyricsStatus) => void;
  setCurrentLineIndex: (index: number) => void;
  setUserOffsetMs: (offset: number) => void;
  reset: () => void;
}

export const useLyricsStore = create<LyricsState>((set) => ({
  trackId: null,
  status: 'idle',
  type: 'plain',
  lines: [],
  currentLineIndex: -1,
  userOffsetMs: 0,

  setLyricsData: (trackId, data, status) => set({
    trackId,
    status,
    type: data?.type || 'plain',
    lines: data?.lines || [],
    currentLineIndex: -1,
    // Reset offset on new track
    userOffsetMs: 0
  }),
  
  setCurrentLineIndex: (index) => set({ currentLineIndex: index }),
  
  setUserOffsetMs: (offset) => set({ userOffsetMs: offset }),

  reset: () => set({
    trackId: null,
    status: 'idle',
    type: 'plain',
    lines: [],
    currentLineIndex: -1,
    userOffsetMs: 0
  })
}));
