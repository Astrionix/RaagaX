import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PlayRecord {
  videoId: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  durationSec: number;
  totalSeconds: number;
  plays: number;
  lastPlayedAt: number;
  firstPlayedAt: number;
}

export interface ListeningStatsState {
  records: Record<string, PlayRecord>;
  totalSeconds: number;
  firstListenedAt: number;
  recordPlay: (
    track: {
      videoId: string;
      title: string;
      artist: string;
      artworkUrl?: string | null;
      durationSec?: number;
    },
    playedSeconds: number,
  ) => void;
  clearStats: () => void;
}

export const useListeningStore = create<ListeningStatsState>()(
  persist(
    (set, get) => ({
      records: {},
      totalSeconds: 0,
      firstListenedAt: Date.now(),

      recordPlay: (track, playedSeconds) => {
        if (!track.videoId || playedSeconds <= 0) return;
        const now = Date.now();
        const duration = Math.max(0, Math.round(playedSeconds));

        set((state) => {
          const existing = state.records[track.videoId];
          const isEligiblePlay = duration >= 15;

          const updated: PlayRecord = existing
            ? {
                ...existing,
                title: track.title || existing.title,
                artist: track.artist || existing.artist,
                artworkUrl: track.artworkUrl ?? existing.artworkUrl,
                durationSec: track.durationSec ?? existing.durationSec,
                totalSeconds: existing.totalSeconds + duration,
                plays: existing.plays + (isEligiblePlay ? 1 : 0),
                lastPlayedAt: now,
              }
            : {
                videoId: track.videoId,
                title: track.title,
                artist: track.artist,
                artworkUrl: track.artworkUrl ?? null,
                durationSec: track.durationSec ?? 0,
                totalSeconds: duration,
                plays: isEligiblePlay ? 1 : 0,
                lastPlayedAt: now,
                firstPlayedAt: now,
              };

          return {
            totalSeconds: state.totalSeconds + duration,
            records: {
              ...state.records,
              [track.videoId]: updated,
            },
          };
        });
      },

      clearStats: () => set({ records: {}, totalSeconds: 0, firstListenedAt: Date.now() }),
    }),
    {
      name: 'raaga:listening-stats',
      version: 1,
    },
  ),
);
