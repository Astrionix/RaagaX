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

  public async evaluatePreload(standbyElement: HTMLAudioElement) {
    // Only preload if not already loading or ready
    if (this.status === 'LOADING' || this.status === 'READY') return;

    const nextItem = QueueManager.getInstance().peekNext();
    if (!nextItem) return;

    const trackId = nextItem.trackId;
    
    // Check if remaining duration is small enough to start preloading
    const engine = PlaybackEngine.getInstance();
    const mediaMs = engine.getMediaPositionMs();
    const duration = engine.getDurationMs();
    
    // Start preloading if within last 30s of track
    if (duration > 0 && duration - mediaMs < 30000) {
      this.status = 'LOADING';
      this.currentPreloadId = trackId;
      
      try {
        const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(nextItem.song);
        if (source && source.type === 'remote') {
          standbyElement.src = source.url;
        } else {
          // It's offline or we don't have a URL to preload
          standbyElement.src = nextItem.song.audioUrl || '';
        }
        standbyElement.load();
        
        // Setup listener to mark ready
        const handleCanPlayThrough = () => {
          if (this.currentPreloadId === trackId) {
            this.status = 'READY';
          }
          standbyElement.removeEventListener('canplaythrough', handleCanPlayThrough);
        };
        standbyElement.addEventListener('canplaythrough', handleCanPlayThrough);
        
      } catch (e) {
        console.error('Preload failed', e);
        this.status = 'FAILED';
      }
    }
  }

  public reset() {
    this.status = 'IDLE';
    this.currentPreloadId = null;
  }
}
