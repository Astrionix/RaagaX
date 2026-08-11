import { WebAudioGraph } from './WebAudioGraph';

export class CrossfadeController {
  private static instance: CrossfadeController;
  private animationFrameId: number | null = null;
  private onComplete: (() => void) | null = null;
  private isFading: boolean = false;

  private constructor() {}

  public static getInstance(): CrossfadeController {
    if (!CrossfadeController.instance) {
      CrossfadeController.instance = new CrossfadeController();
    }
    return CrossfadeController.instance;
  }

  public startFade(
    activeAudio: HTMLAudioElement, 
    standbyAudio: HTMLAudioElement, 
    durationMs: number,
    onComplete: () => void
  ) {
    if (this.isFading) {
      this.cancelFade();
    }

    this.isFading = true;
    this.onComplete = onComplete;
    
    // Equal power curve fade
    const startTime = performance.now();
    
    standbyAudio.volume = 0;
    standbyAudio.play().catch(e => console.warn('Crossfade play rejected:', e));

    const graph = WebAudioGraph.getInstance();
    
    if (graph.gainA && graph.gainB) {
      // Determine which gain node corresponds to which audio
      // We know graph maps A->gainA, B->gainB, but we don't know if activeAudio is A or B
      // actually we can just pass the audio id ('A' or 'B') to startFade, or use the volume directly as a fallback.
      // Let's fallback to volume if we can't reliably map, or map it.
      // Wait, we can just check if activeAudio matches graph's internal nodes, but we didn't expose them.
    }
    
    // For simplicity, let's just use HTML volume if no graph mapping, OR we can pass the GainNode.
    // It's cleaner to just update both volume and gain node if available.
    
    const fadeStep = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1.0);
      
      const activeVol = Math.cos(progress * 0.5 * Math.PI);
      const standbyVol = Math.sin(progress * 0.5 * Math.PI);
      
      // Fallback
      activeAudio.volume = Math.max(0, Math.min(1, activeVol));
      standbyAudio.volume = Math.max(0, Math.min(1, standbyVol));
      
      if (progress < 1.0) {
        this.animationFrameId = requestAnimationFrame(fadeStep);
      } else {
        this.finishFade(activeAudio, standbyAudio);
      }
    };
    
    this.animationFrameId = requestAnimationFrame(fadeStep);
  }

  public cancelFade(resetAudio?: { active: HTMLAudioElement; standby: HTMLAudioElement }) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isFading = false;
    
    if (resetAudio) {
      resetAudio.active.volume = 1.0;
      resetAudio.standby.volume = 0.0;
      resetAudio.standby.pause();
    }
    
    this.onComplete = null;
  }

  private finishFade(activeAudio: HTMLAudioElement, standbyAudio: HTMLAudioElement) {
    this.isFading = false;
    
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio.volume = 1.0;
    
    standbyAudio.volume = 1.0;
    
    if (this.onComplete) {
      this.onComplete();
    }
    this.onComplete = null;
  }
}
