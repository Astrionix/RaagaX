import { Renderer } from '@/types/music';

export interface RendererLease {
  renderer: Renderer;
  generation: number;
  acquiredAt: number;
}

export interface RendererState {
  isActive: boolean;
  element: HTMLMediaElement | null;
}

export class RendererManager {
  private static instance: RendererManager;
  private renderers: Map<Renderer, RendererState> = new Map([
    ['audio', { isActive: true, element: null }]
  ]);
  
  private currentLease: RendererLease | null = null;
  private generationCounter = 0;

  private constructor() {}

  public static getInstance(): RendererManager {
    if (!RendererManager.instance) {
      RendererManager.instance = new RendererManager();
    }
    return RendererManager.instance;
  }

  public registerRenderer(type: Renderer, element: HTMLMediaElement) {
    const state = this.renderers.get(type);
    if (state) {
      state.element = element;
    }
  }

  public unregisterRenderer(type: Renderer) {
    const state = this.renderers.get(type);
    if (state) {
      state.element = null;
    }
  }

  public acquireLease(type: Renderer): RendererLease {
    this.generationCounter++;
    this.currentLease = {
      renderer: type,
      generation: this.generationCounter,
      acquiredAt: Date.now()
    };
    
    // Enforce ownership rules immediately
    for (const [key, state] of this.renderers.entries()) {
      state.isActive = key === type;
      // Only pause other renderer types (e.g. video element when switching to audio)
      if (!state.isActive && key !== type && state.element && !state.element.paused) {
         state.element.pause();
      }
    }
    
    return this.currentLease;
  }

  public getActiveLease(): RendererLease | null {
    return this.currentLease;
  }

  public isLeaseValid(lease: RendererLease): boolean {
    if (!this.currentLease) return false;
    return this.currentLease.generation === lease.generation && 
           this.currentLease.renderer === lease.renderer;
  }

  public getRendererElement(type: Renderer): HTMLMediaElement | null {
    return this.renderers.get(type)?.element || null;
  }

  public getActiveRenderer(): Renderer | null {
    return this.currentLease?.renderer || null;
  }
}
