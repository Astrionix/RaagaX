import { PreloadManager } from './PreloadManager';
import { GaplessController } from './GaplessController';
import { CrossfadeController } from './CrossfadeController';
import { PlaybackEngine } from './PlaybackEngine';

export type TransitionMode = 'GAPLESS' | 'CROSSFADE' | 'NONE';
export type TransitionState = 'IDLE' | 'PRELOADING' | 'READY' | 'WAITING_FOR_BOUNDARY' | 'CROSSFADING' | 'COMMITTED' | 'FAILED';

export class TransitionManager {
  private static instance: TransitionManager;
  private state: TransitionState = 'IDLE';
  private mode: TransitionMode = 'NONE';
  private durationMs: number = 8000;

  private constructor() {}

  public static getInstance(): TransitionManager {
    if (!TransitionManager.instance) {
      TransitionManager.instance = new TransitionManager();
    }
    return TransitionManager.instance;
  }

  public setMode(mode: TransitionMode, durationMs: number = 8000) {
    this.mode = mode;
    this.durationMs = durationMs;
  }

  public getMode(): TransitionMode {
    return this.mode;
  }

  public getDuration(): number {
    return this.durationMs;
  }

  public getState(): TransitionState {
    return this.state;
  }

  public checkBoundary(activeAudio: HTMLAudioElement, standbyAudio: HTMLAudioElement, onSwap: () => void) {
    const engine = PlaybackEngine.getInstance();
    const mediaMs = engine.getMediaPositionMs();
    const totalMs = engine.getDurationMs();
    
    // Safety check
    if (totalMs === 0 || mediaMs === 0) return;
    
    const remainingMs = totalMs - mediaMs;
    
    // Evaluate preload
    PreloadManager.getInstance().evaluatePreload(standbyAudio);
    
    // Start transition if ready
    if (PreloadManager.getInstance().getStatus() === 'READY') {
      if (this.mode === 'CROSSFADE') {
        // Cap crossfade to half of the track duration to prevent fading tiny tracks fully
        const effectiveFadeMs = Math.min(this.durationMs, totalMs / 2);
        
        if (remainingMs <= effectiveFadeMs && this.state !== 'CROSSFADING') {
          this.state = 'CROSSFADING';
          CrossfadeController.getInstance().startFade(activeAudio, standbyAudio, effectiveFadeMs, () => {
            this.state = 'COMMITTED';
            PreloadManager.getInstance().reset();
            onSwap();
            this.state = 'IDLE';
          });
        }
      } else if (this.mode === 'GAPLESS') {
        if (remainingMs <= 100 && this.state !== 'WAITING_FOR_BOUNDARY') {
          this.state = 'WAITING_FOR_BOUNDARY';
          GaplessController.getInstance().handleBoundary(activeAudio, standbyAudio);
          this.state = 'COMMITTED';
          PreloadManager.getInstance().reset();
          onSwap();
          this.state = 'IDLE';
        }
      }
    }
  }

  public cancelTransition(activeAudio: HTMLAudioElement, standbyAudio: HTMLAudioElement) {
    if (this.state === 'CROSSFADING') {
      CrossfadeController.getInstance().cancelFade({ active: activeAudio, standby: standbyAudio });
    }
    this.state = 'IDLE';
    PreloadManager.getInstance().reset();
  }
}
