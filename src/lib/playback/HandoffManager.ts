import { Renderer } from '@/types/music';
import { RendererManager } from './RendererManager';
import { PlaybackEngine } from './PlaybackEngine';
import { usePlayerStore } from '@/context/usePlayerStore';

export type HandoffState = 
  | 'IDLE'
  | 'SOURCE_ACTIVE'
  | 'PREPARING'
  | 'LOADING'
  | 'SEEKING'
  | 'READY'
  | 'STARTING'
  | 'COMMITTING'
  | 'TARGET_ACTIVE'
  | 'FAILED'
  | 'ROLLBACK';

export class HandoffManager {
  private static instance: HandoffManager;
  private currentState: HandoffState = 'IDLE';

  private constructor() {}

  public static getInstance(): HandoffManager {
    if (!HandoffManager.instance) {
      HandoffManager.instance = new HandoffManager();
    }
    return HandoffManager.instance;
  }

  public getState(): HandoffState {
    return this.currentState;
  }

  private transition(state: HandoffState) {
    console.log(`[HandoffManager] State transition: ${this.currentState} -> ${state}`);
    this.currentState = state;
    // We could emit events here if UI needs to know exact loading states
  }

  public async initiateHandoff(targetRenderer: Renderer) {
    if (this.currentState !== 'IDLE' && this.currentState !== 'TARGET_ACTIVE') {
      console.warn('[HandoffManager] Handoff already in progress, ignoring.');
      return;
    }
    
    const rendererManager = RendererManager.getInstance();
    const sourceRenderer = rendererManager.getActiveRenderer();
    
    if (sourceRenderer === targetRenderer) return;
    
    this.transition('SOURCE_ACTIVE');

    const engine = PlaybackEngine.getInstance();
    const store = usePlayerStore.getState();
    const wasPlaying = store.isPlaying;

    try {
      this.transition('PREPARING');
      const targetElement = rendererManager.getRendererElement(targetRenderer);
      
      if (!targetElement) {
        throw new Error(`Target renderer ${targetRenderer} is not available.`);
      }

      if (targetElement) {
        this.transition('LOADING');
        // Preload/Buffer
        targetElement.load();
        
        // Wait for buffer ready (canplay)
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Handoff loading timeout')), 5000);
          const onReady = () => {
            clearTimeout(timeout);
            targetElement.removeEventListener('canplay', onReady);
            resolve();
          };
          targetElement.addEventListener('canplay', onReady);
          if (targetElement.readyState >= 3) {
            onReady();
          }
        });

        this.transition('SEEKING');
        // Sync time based on the STILL RUNNING source
        const currentCanonical = engine.getCanonicalPositionMs();
        
        // Use a temporary mapper execution to avoid detaching engine yet
        const targetMediaMs = engine.getTimelineMapper().canonicalToMedia(currentCanonical);
        targetElement.currentTime = targetMediaMs / 1000;
        
        this.transition('READY');

        if (wasPlaying) {
          this.transition('STARTING');
          try {
            await targetElement.play();
          } catch (e) {
            throw new Error(`Target ${targetRenderer} failed to play(): ${e}`);
          }
        }
      }

      // CRITICAL: Playback on target is confirmed. Now we commit.
      this.transition('COMMITTING');
      
      // Acquire lease for the new target. This automatically pauses the old source.
      rendererManager.acquireLease(targetRenderer);
      
      if (targetElement) {
         engine.attachMediaElement(targetElement);
      } else {
         engine.detachMediaElement();
      }
      
      store.setRemoteState({ activeRenderer: targetRenderer });
      this.transition('TARGET_ACTIVE');

    } catch (error) {
      console.error(`[HandoffManager] Handoff failed:`, error);
      this.transition('FAILED');
      
      this.transition('ROLLBACK');
      // On failure, the source renderer lease was never revoked, 
      // so it implicitly continued playing without interruption.
      // We just need to reset our state machine.
      
      // Ensure target is stopped just in case
      const targetElement = rendererManager.getRendererElement(targetRenderer);
      if (targetElement) targetElement.pause();
      
      this.transition('IDLE');
    }
  }
}
