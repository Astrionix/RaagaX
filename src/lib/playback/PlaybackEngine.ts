import { MediaTimelineMapper, TimelineMap } from './TimelineMapper';
import { PlaybackClock } from './PlaybackClock';

type FalliblePlayResult = { success: boolean; error?: Error };

export class PlaybackEngine implements PlaybackClock {
  private static instance: PlaybackEngine;
  private timelineMapper: MediaTimelineMapper;
  private activeMediaElement: HTMLMediaElement | null = null;
  
  // For prediction between media time updates
  private lastAnchorMediaMs: number = 0;
  private lastAnchorPerfNow: number = 0;

  private constructor() {
    this.timelineMapper = new MediaTimelineMapper();
  }

  public static getInstance(): PlaybackEngine {
    if (!PlaybackEngine.instance) {
      PlaybackEngine.instance = new PlaybackEngine();
    }
    return PlaybackEngine.instance;
  }

  public setTimelineMap(map: TimelineMap) {
    this.timelineMapper.setTimelineMap(map);
    this.anchor();
  }

  public getTimelineMapper(): MediaTimelineMapper {
    return this.timelineMapper;
  }

  public attachMediaElement(element: HTMLMediaElement) {
    this.activeMediaElement = element;
    this.anchor();
  }
  
  public detachMediaElement() {
    this.activeMediaElement = null;
  }

  public anchor() {
    if (!this.activeMediaElement) return;
    this.lastAnchorMediaMs = this.activeMediaElement.currentTime * 1000;
    this.lastAnchorPerfNow = performance.now();
  }

  public getMediaPositionMs(): number {
    if (!this.activeMediaElement) return 0;
    
    // Use the actual media element as the source of truth, but we can predict with perf.now() if it's playing
    // to give smoother 60fps UI updates between timeupdate events
    if (!this.activeMediaElement.paused && !this.activeMediaElement.seeking) {
       const elapsedSinceAnchor = performance.now() - this.lastAnchorPerfNow;
       // We cap the prediction to avoid drift if the video stalls but doesn't fire waiting event immediately
       if (elapsedSinceAnchor < 500) {
          return this.lastAnchorMediaMs + elapsedSinceAnchor;
       }
    }

    // Default to strict authority
    return this.activeMediaElement.currentTime * 1000;
  }

  public getCanonicalPositionMs(): number {
    const mediaMs = this.getMediaPositionMs();
    return this.timelineMapper.mediaToCanonical(mediaMs);
  }

  public async play(): Promise<FalliblePlayResult> {
    if (!this.activeMediaElement) return { success: false, error: new Error('No media element attached') };

    try {
      this.anchor();
      await this.activeMediaElement.play();
      this.anchor();
      return { success: true };
    } catch (error: any) {
      console.warn('[PlaybackEngine] Fallible play rejected:', error);
      return { success: false, error };
    }
  }

  public pause(reason?: string) {
    if (this.activeMediaElement) {
      this.activeMediaElement.pause();
      this.anchor();
      if (reason) {
        console.log(`[PlaybackEngine] Paused due to reason: ${reason}`);
      }
    }
  }

  public seekCanonical(canonicalMs: number) {
    if (!this.activeMediaElement) return;
    
    const mediaMs = this.timelineMapper.canonicalToMedia(canonicalMs);
    this.activeMediaElement.currentTime = mediaMs / 1000;
    this.anchor();
  }
}
