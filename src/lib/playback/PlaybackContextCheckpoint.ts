import { Song } from '@/types/music';
import { QueueSource } from '../queue/types';

export interface ListeningContextCheckpoint {
  song: Song | null;
  positionMs: number;
  durationMs: number;
  sourceType: QueueSource | string;
  sourceId?: string;
  sourceTitle?: string;
  queueIndex: number;
  updatedAt: number;
}

const STORAGE_KEY = 'raagax_last_meaningful_listening_checkpoint';

export class PlaybackContextCheckpointManager {
  private static instance: PlaybackContextCheckpointManager;

  private checkpoint: ListeningContextCheckpoint | null = null;

  private constructor() {
    this.loadCheckpoint();
  }

  public static getInstance(): PlaybackContextCheckpointManager {
    if (!PlaybackContextCheckpointManager.instance) {
      PlaybackContextCheckpointManager.instance = new PlaybackContextCheckpointManager();
    }
    return PlaybackContextCheckpointManager.instance;
  }

  private loadCheckpoint() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.checkpoint = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[PlaybackContextCheckpointManager] Failed to load checkpoint:', e);
    }
  }

  /**
   * Saves a meaningful playback checkpoint on track changes, pause, seek, or app suspend
   */
  public saveCheckpoint(
    song: Song | null,
    positionSec: number,
    durationSec: number,
    sourceType: QueueSource | string,
    queueIndex: number = 0,
    sourceId?: string,
    sourceTitle?: string
  ) {
    if (!song) return;

    this.checkpoint = {
      song,
      positionMs: Math.floor(positionSec * 1000),
      durationMs: Math.floor(durationSec * 1000),
      sourceType,
      sourceId,
      sourceTitle,
      queueIndex,
      updatedAt: Date.now(),
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.checkpoint));
      } catch (e) {
        console.warn('[PlaybackContextCheckpointManager] Failed to save checkpoint:', e);
      }
    }
  }

  public getCheckpoint(): ListeningContextCheckpoint | null {
    return this.checkpoint;
  }
}
