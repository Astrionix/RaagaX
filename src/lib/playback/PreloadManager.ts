import { QueueManager } from '../queue/QueueManager';
import { PlaybackEngine } from './PlaybackEngine';
import { PlaybackSourceResolver } from '@/lib/playbackSourceResolver';

export type PreloadStatus = 'IDLE' | 'LOADING' | 'READY' | 'FAILED';

export class PreloadManager {
  private static instance: PreloadManager;
  private currentPreloadId: string | null = null;
  private status: PreloadStatus = 'IDLE';

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
    return this.status === 'READY' ? this.currentPreloadId : null;
  }

  public async preloadTrack(song: import('@/types/music').Song, standbyElement: HTMLAudioElement, force: boolean = false) {
    if (!song || !standbyElement) return;
    if (!force && (this.status === 'LOADING' || (this.status === 'READY' && this.currentPreloadId === song.id))) {
      return;
    }

    this.status = 'LOADING';
    this.currentPreloadId = song.id;

    try {
      const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
      let finalSrc = song.audioUrl || '';
      if (source && source.type === 'remote' && source.url) {
        finalSrc = source.url;
        song.audioUrl = finalSrc;
      }

      if (!finalSrc) {
        this.status = 'FAILED';
        return;
      }

      if (standbyElement.src !== finalSrc) {
        standbyElement.src = finalSrc;
        standbyElement.preload = 'auto';
        standbyElement.load();
      }

      const handleCanPlay = () => {
        if (this.currentPreloadId === song.id) {
          this.status = 'READY';
        }
        standbyElement.removeEventListener('canplay', handleCanPlay);
        standbyElement.removeEventListener('canplaythrough', handleCanPlay);
      };

      standbyElement.addEventListener('canplay', handleCanPlay);
      standbyElement.addEventListener('canplaythrough', handleCanPlay);
      
      // Fallback: If metadata is already loaded or readyState >= 2
      if (standbyElement.readyState >= 2) {
        this.status = 'READY';
      }
    } catch (e) {
      console.error('[PreloadManager] Preload failed for song:', song.title, e);
      this.status = 'FAILED';
    }
  }

  public async evaluatePreload(standbyElement: HTMLAudioElement) {
    const nextItem = QueueManager.getInstance().peekNext();
    if (!nextItem || !nextItem.song) return;

    if (
      this.status === 'LOADING' ||
      (this.status === 'READY' && this.currentPreloadId === nextItem.song.id && standbyElement && standbyElement.src)
    ) {
      return;
    }

    // Start preloading standby element immediately
    await this.preloadTrack(nextItem.song, standbyElement);
  }

  public reset() {
    this.status = 'IDLE';
    this.currentPreloadId = null;
  }
}
