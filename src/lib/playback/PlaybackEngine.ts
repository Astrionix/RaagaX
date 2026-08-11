import { MediaTimelineMapper, TimelineMap } from './TimelineMapper';
import { PlaybackStateMachine } from './PlaybackStateMachine';
import { PlaybackInterruption } from './types';
import { PlaybackClock } from './PlaybackClock';
import { MediaSessionManager } from './MediaSessionManager';
import { PlaybackRenderer } from './renderers/PlaybackRenderer';
import { PlaybackSource } from '../offline/types';

type FalliblePlayResult = { success: boolean; error?: Error };

export class PlaybackEngine implements PlaybackClock {
  private static instance: PlaybackEngine;
  private timelineMapper: MediaTimelineMapper;
  private activeMediaElement: HTMLMediaElement | null = null;
  private activeRenderer: PlaybackRenderer | null = null;
  private stateMachine: PlaybackStateMachine;
  private isDucked: boolean = false;
  private unduckedVolume: number = 1.0;
  
  // For prediction between media time updates
  private lastAnchorMediaMs: number = 0;
  private lastAnchorPerfNow: number = 0;

  private constructor() {
    this.timelineMapper = new MediaTimelineMapper();
    this.stateMachine = new PlaybackStateMachine();
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
    (this.stateMachine as any).currentState = 'PLAYING';
    this.anchor();
  }

  public attachRenderer(renderer: PlaybackRenderer) {
    this.activeRenderer = renderer;
    this.anchor();
  }

  public detachMediaElement() {
    this.activeMediaElement = null;
    this.activeRenderer = null;
  }

  public anchor() {
    if (!this.activeMediaElement) return;
    this.lastAnchorMediaMs = this.activeMediaElement.currentTime * 1000;
    this.lastAnchorPerfNow = performance.now();
  }

  public getDurationMs(): number {
    if (!this.activeMediaElement || isNaN(this.activeMediaElement.duration)) return 0;
    return this.activeMediaElement.duration * 1000;
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

  public async load(source: PlaybackSource) {
    if (!this.activeRenderer) return;
    this.stateMachine.transitionTo('LOADING');
    try {
      await this.activeRenderer.prepare(source);
      this.stateMachine.transitionTo('READY');
    } catch (e) {
      this.stateMachine.transitionTo('ERROR');
      throw e;
    }
  }

  public async play(): Promise<FalliblePlayResult> {
    if (!this.activeMediaElement) return { success: false, error: new Error('No media element attached') };

    if (!this.stateMachine.canTransitionTo('PLAYING')) {
      return { success: false, error: new Error('Invalid state transition to PLAYING') };
    }

    try {
      this.anchor();
      await this.activeMediaElement.play();
      this.anchor();
      this.stateMachine.transitionTo('PLAYING');
      MediaSessionManager.getInstance().setPlaybackState('playing');
      return { success: true };
    } catch (error: any) {
      console.warn('[PlaybackEngine] Fallible play rejected:', error);
      this.stateMachine.transitionTo('ERROR');
      MediaSessionManager.getInstance().setPlaybackState('none');
      return { success: false, error };
    }
  }

  public isPlayingLocally(): boolean {
    return this.activeMediaElement !== null && !this.activeMediaElement.paused;
  }

  public getPlaybackState(): { trackId?: string; isPlaying: boolean; positionMs: number } {
    const store = require('@/context/usePlayerStore').usePlayerStore.getState();
    return {
      trackId: store.activeTrack?.id,
      isPlaying: this.isPlayingLocally(),
      positionMs: this.getCanonicalPositionMs()
    };
  }

  public pause(reason?: PlaybackInterruption | 'USER') {
    if (this.activeMediaElement) {
      this.activeMediaElement.pause();
      this.anchor();
      
      const targetState = reason === 'HANDOFF' ? 'HANDOFF' :
                          reason === 'USER' ? 'PAUSED' : 
                          reason ? 'INTERRUPTED' : 'PAUSED';
                          
      this.stateMachine.transitionTo(targetState);
      MediaSessionManager.getInstance().setPlaybackState('paused');
      
      if (reason) {
        console.log(`[PlaybackEngine] Paused due to reason: ${reason}`);
      }
    }
  }

  public setDucked(ducked: boolean, duckedVolumeRatio: number = 0.2) {
    if (!this.activeMediaElement) return;
    
    if (ducked && !this.isDucked) {
      this.unduckedVolume = this.activeMediaElement.volume;
      this.activeMediaElement.volume = this.unduckedVolume * duckedVolumeRatio;
      this.isDucked = true;
      console.log(`[PlaybackEngine] Volume ducked to ${(duckedVolumeRatio * 100).toFixed(0)}%`);
    } else if (!ducked && this.isDucked) {
      this.activeMediaElement.volume = this.unduckedVolume;
      this.isDucked = false;
      console.log(`[PlaybackEngine] Volume restored to ${(this.unduckedVolume * 100).toFixed(0)}%`);
    }
  }

  public seekCanonical(targetMs: number) {
    if (!this.activeMediaElement) return;
    const mediaMs = this.timelineMapper.canonicalToMedia(targetMs);
    
    // Cancel any ongoing transitions when user seeks
    import('./TransitionManager').then(m => {
       const tm = m.TransitionManager.getInstance();
    });

    this.activeMediaElement.currentTime = mediaMs / 1000;
    this.anchor();
    
    if (this.stateMachine.canTransitionTo('PLAYING') && !this.activeMediaElement.paused) {
      this.stateMachine.transitionTo('PLAYING');
    }
  }
}
