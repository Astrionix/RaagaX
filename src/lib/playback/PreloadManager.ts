import { QueueManager } from '../queue/QueueManager';
import { PlaybackEngine } from './PlaybackEngine';
import { PlaybackSourceResolver } from '@/lib/playbackSourceResolver';
import { PlayableUrlCache } from './PlayableUrlCache';
import { Song } from '@/types/music';

export type PreloadStatus = 'IDLE' | 'RESOLVING' | 'BUFFERING' | 'READY' | 'FAILED';

export interface PreloadToken {
  queueItemId: string | null;
  trackId: string | null;
  sourceUrl: string | null;
  state: PreloadStatus;
  preloadedAt?: number;
}

export class PreloadManager {
  private static instance: PreloadManager;
  private currentPreloadId: string | null = null;
  private currentQueueItemId: string | null = null;
  private currentSourceUrl: string | null = null;
  private status: PreloadStatus = 'IDLE';
  private preloadedAt: number = 0;
  private activeAbortController: AbortController | null = null;

  private constructor() {}

  public static getInstance(): PreloadManager {
    if (!PreloadManager.instance) {
      PreloadManager.instance = new PreloadManager();
    }
    return PreloadManager.instance;
  }

  public getStatus(): PreloadStatus {
    return this.status;
  }

  public getPreloadedTrackId(): string | null {
    return (this.status === 'READY' || this.status === 'BUFFERING') ? this.currentPreloadId : null;
  }

  public isTrackReady(songId: string): boolean {
    return this.status === 'READY' && this.currentPreloadId === songId;
  }

  public getPreloadToken(): PreloadToken {
    return {
      queueItemId: this.currentQueueItemId,
      trackId: this.currentPreloadId,
      sourceUrl: this.currentSourceUrl,
      state: this.status,
      preloadedAt: this.preloadedAt,
    };
  }

  /**
   * prepareNextTrack — Pre-resolves audio source, pre-buffers audio bytes into standby element,
   * and keeps it fully ready for 0ms instantaneous handoff when user taps Next or track ends.
   */
  public async prepareNextTrack(song: Song, standbyElement: HTMLAudioElement | null = null, force: boolean = false): Promise<boolean> {
    if (!song || !song.id) return false;
    try {
      const { usePlayerStore } = require('@/context/usePlayerStore');
      if (!usePlayerStore.getState().isLocalPlayback) return false;
    } catch {}

    // Skip if already preloaded and ready
    if (!force && this.status === 'READY' && this.currentPreloadId === song.id && standbyElement?.src) {
      return true;
    }

    // Cancel any previous in-flight preload
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    this.activeAbortController = new AbortController();
    const currentTrackId = song.id;

    this.status = 'RESOLVING';
    this.currentPreloadId = currentTrackId;

    try {
      // 1. Resolve source URL (checks local offline files and PlayableUrlCache first)
      const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
      
      if (this.currentPreloadId !== currentTrackId) {
        return false; // Superseded
      }

      let finalSrc = song.audioUrl || '';
      if (source && source.url) {
        finalSrc = source.url;
        song.audioUrl = finalSrc;
        try {
          PlayableUrlCache.getInstance().set(song.id, finalSrc, [finalSrc], source.type === 'offline' ? 'offline' : 'remote');
        } catch {}
      }

      // Update native player queue URL just-in-time
      if (finalSrc) {
        import('@/lib/playback/native/RaagaXNativePlayer').then(({ RaagaXNativePlayer }) => {
          if (RaagaXNativePlayer.isNative()) {
            RaagaXNativePlayer.updateQueueUrl(song.id, finalSrc).catch(() => {});
          }
        });
      }

      if (!finalSrc) {
        this.status = 'FAILED';
        return false;
      }

      this.currentSourceUrl = finalSrc;

      // 2. If standby audio element exists, pre-buffer audio bytes
      if (standbyElement) {
        this.status = 'BUFFERING';

        if (standbyElement.src !== finalSrc) {
          standbyElement.preload = 'auto';
          standbyElement.src = finalSrc;
          standbyElement.load();
        }

        // Check if readyState already satisfies startup threshold
        if (standbyElement.readyState >= 2) {
          this.status = 'READY';
          this.preloadedAt = Date.now();
          return true;
        }

        return new Promise<boolean>((resolve) => {
          const cleanup = () => {
            standbyElement.removeEventListener('canplay', handleReady);
            standbyElement.removeEventListener('loadeddata', handleReady);
            standbyElement.removeEventListener('error', handleError);
          };

          const handleReady = () => {
            if (this.currentPreloadId === currentTrackId) {
              this.status = 'READY';
              this.preloadedAt = Date.now();
              console.log(`[PreloadManager] Next track PRELOAD_READY: "${song.title}" (${finalSrc.substring(0, 45)}...)`);
            }
            cleanup();
            resolve(true);
          };

          const handleError = () => {
            if (this.currentPreloadId === currentTrackId) {
              this.status = 'FAILED';
            }
            cleanup();
            resolve(false);
          };

          standbyElement.addEventListener('canplay', handleReady, { once: true });
          standbyElement.addEventListener('loadeddata', handleReady, { once: true });
          standbyElement.addEventListener('error', handleError, { once: true });

          // Safe timeout for preloading (do not hang forever)
          setTimeout(() => {
            if (standbyElement.readyState >= 1 && this.currentPreloadId === currentTrackId) {
              this.status = 'READY';
              this.preloadedAt = Date.now();
            }
            cleanup();
            resolve(this.status === 'READY');
          }, 3500);
        });
      }

      this.status = 'READY';
      this.preloadedAt = Date.now();
      return true;
    } catch (e) {
      console.warn('[PreloadManager] Preload preparation failed for song:', song.title, e);
      if (this.currentPreloadId === currentTrackId) {
        this.status = 'FAILED';
      }
      return false;
    }
  }

  /**
   * preparePreviousTrack — Priority 2: Pre-resolve audio URL into memory cache for previous track
   */
  public async preparePreviousTrack(song: Song): Promise<void> {
    if (!song || !song.id) return;
    const cached = PlayableUrlCache.getInstance().get(song.id);
    if (cached) return;

    try {
      await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
    } catch {
      // Non-critical background operation
    }
  }

  public preloadArtwork(url?: string | null) {
    if (!url || typeof window === 'undefined') return;
    try {
      const img = new Image();
      img.src = url;
    } catch {}
  }

  /**
   * evaluatePreload — Evaluates the queue and triggers preload for upcoming tracks
   */
  public async evaluatePreload(standbyElement: HTMLAudioElement | null) {
    try {
      const { usePlayerStore } = require('@/context/usePlayerStore');
      if (!usePlayerStore.getState().isLocalPlayback) return;
    } catch {}
    const nextItem = QueueManager.getInstance().peekNext();
    if (!nextItem || !nextItem.song) return;

    if (nextItem.song.coverUrl) {
      this.preloadArtwork(nextItem.song.coverUrl);
    }

    this.currentQueueItemId = nextItem.queueItemId;

    if (
      this.status === 'BUFFERING' ||
      (this.status === 'READY' && this.currentPreloadId === nextItem.song.id && standbyElement && standbyElement.src)
    ) {
      return;
    }

    // Start preloading standby element immediately
    await this.prepareNextTrack(nextItem.song, standbyElement);
  }

  public reset() {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    this.status = 'IDLE';
    this.currentPreloadId = null;
    this.currentQueueItemId = null;
    this.currentSourceUrl = null;
    this.preloadedAt = 0;
  }
}
