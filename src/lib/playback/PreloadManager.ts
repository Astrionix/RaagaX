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
    if (this.status === 'LOADING' || this.status === 'READY') return;

    const nextItem = QueueManager.getInstance().peekNext();
    if (!nextItem || !nextItem.song) return;

    const trackId = nextItem.trackId;
    
    // Check if remaining duration is small enough to start preloading (or if overall track duration is known)
    const engine = PlaybackEngine.getInstance();
    const mediaMs = engine.getMediaPositionMs();
    const duration = engine.getDurationMs();
    
    // Start preloading if within last 30s of track or track has played > 5s
    if (mediaMs > 5000 || (duration > 0 && duration - mediaMs < 30000)) {
      await this.preloadTrack(nextItem.song, standbyElement);
    }
  }

  public reset() {
    this.status = 'IDLE';
    this.currentPreloadId = null;
  }
}
