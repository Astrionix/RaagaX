'use client';

import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';

export interface PlaybackSnapshot {
  trackId: string;
  song: Song;
  positionMs: number;
  queueIndex: number;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: string;
  updatedAt: number;
}

const SNAPSHOT_KEY = 'raagax_playback_snapshot_v1';
const SNAPSHOT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export class PlaybackRecoveryEngine {
  private static instance: PlaybackRecoveryEngine;
  private saveTimeout: any = null;
  private isSubscribed = false;

  private constructor() {
    this.initSnapshotSaver();
  }

  public static getInstance(): PlaybackRecoveryEngine {
    if (!PlaybackRecoveryEngine.instance) {
      PlaybackRecoveryEngine.instance = new PlaybackRecoveryEngine();
    }
    return PlaybackRecoveryEngine.instance;
  }

  private initSnapshotSaver() {
    if (typeof window === 'undefined' || this.isSubscribed) return;
    this.isSubscribed = true;

    usePlayerStore.subscribe((state, prevState) => {
      // Throttle snapshot saves to avoid heavy disk/storage I/O
      if (
        state.currentSong?.id !== prevState.currentSong?.id ||
        state.isPlaying !== prevState.isPlaying ||
        Math.abs(state.currentTime - prevState.currentTime) > 5
      ) {
        this.scheduleSave(state);
      }
    });
  }

  private scheduleSave(state: any) {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.persistSnapshot(state);
    }, 1000);
  }

  public persistSnapshot(state?: any) {
    if (typeof window === 'undefined') return;
    try {
      const s = state || usePlayerStore.getState();
      if (!s.currentSong || !s.currentSong.id) return;

      const snapshot: PlaybackSnapshot = {
        trackId: s.currentSong.id,
        song: s.currentSong,
        positionMs: Math.round((s.currentTime || 0) * 1000),
        queueIndex: s.queueIndex || 0,
        isPlaying: s.isPlaying || false,
        shuffle: s.isShuffle || false,
        repeat: s.repeatMode || 'off',
        updatedAt: Date.now(),
      };

      try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
      } catch (err: any) {
        if (err?.name === 'QuotaExceededError' || err?.code === 22) {
          try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (key && (key.startsWith('search_cache_') || key.startsWith('lyrics_cache_') || key.startsWith('trend_') || key.startsWith('temp_'))) {
                localStorage.removeItem(key);
              }
            }
            localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
          } catch {}
        }
      }
    } catch {}
  }

  public restoreSnapshot(): PlaybackSnapshot | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return null;

      const snapshot: PlaybackSnapshot = JSON.parse(raw);
      if (!snapshot || !snapshot.song || !snapshot.song.id) return null;

      // Check expiry
      if (Date.now() - snapshot.updatedAt > SNAPSHOT_EXPIRY_MS) {
        localStorage.removeItem(SNAPSHOT_KEY);
        return null;
      }

      console.log('[PlaybackRecoveryEngine] Restoring playback snapshot:', snapshot.song.title, '@', snapshot.positionMs, 'ms');
      return snapshot;
    } catch (err) {
      console.warn('[PlaybackRecoveryEngine] Error restoring snapshot:', err);
      return null;
    }
  }

  public clearSnapshot() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(SNAPSHOT_KEY);
    } catch {}
  }
}
