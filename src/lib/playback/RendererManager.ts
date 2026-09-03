import { Renderer } from '@/types/music';

export interface RendererLease {
  leaseId: string;
  renderer: Renderer;
  generation: number;
  acquiredAt: number;
  originTabId: string;
}

export interface LeaseBroadcastMessage {
  type: 'LEASE_ACQUIRED' | 'LEASE_REVOKED';
  leaseId: string;
  originTabId: string;
  timestamp: number;
}

export interface RendererState {
  isActive: boolean;
  element: HTMLMediaElement | null;
}

export class RendererManager {
  private static instance: RendererManager;
  private readonly tabId: string;
  private broadcastChannel: BroadcastChannel | null = null;
  private onLeaseRevokedCallbacks: Set<(message: LeaseBroadcastMessage) => void> = new Set();

  private renderers: Map<Renderer, RendererState> = new Map([
    ['audio', { isActive: true, element: null }]
  ]);
  
  private currentLease: RendererLease | null = null;
  private generationCounter = 0;

  private constructor() {
    this.tabId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `tab_${Math.random().toString(36).slice(2)}_${Date.now()}`;

    this.initBroadcastChannel();
  }

  public static getInstance(): RendererManager {
    if (!RendererManager.instance) {
      RendererManager.instance = new RendererManager();
    }
    return RendererManager.instance;
  }

  /**
   * Cross-Tab Coordination via BroadcastChannel:
   * Ensures only one browser tab on the same device holds an active hardware lease.
   */
  private initBroadcastChannel(): void {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;

    try {
      this.broadcastChannel = new BroadcastChannel('raagax-hardware-lease');
      this.broadcastChannel.onmessage = (event: MessageEvent<LeaseBroadcastMessage>) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'LEASE_ACQUIRED' && data.originTabId !== this.tabId) {
          this.handleExternalLeaseAcquired(data);
        }
      };
    } catch (e) {
      console.warn('[RendererManager] Failed to initialize hardware lease BroadcastChannel:', e);
    }
  }

  /**
   * Preemptively revokes local hardware ownership when another tab starts playing.
   */
  private handleExternalLeaseAcquired(message: LeaseBroadcastMessage): void {
    if (!this.currentLease) return;

    console.log(`[RendererManager] Hardware lease revoked by external tab (${message.originTabId})`);
    this.currentLease = null;

    // Pause all registered local media elements immediately
    for (const [, state] of this.renderers.entries()) {
      state.isActive = false;
      if (state.element && !state.element.paused) {
        try {
          state.element.pause();
        } catch {}
      }
    }

    // Preemptively pause PlaybackService without mutating remote queue / SSOT connect state
    try {
      const { PlaybackService } = require('./PlaybackService');
      PlaybackService.getInstance().pause();
    } catch {}

    // Notify registered revocation subscribers
    for (const cb of this.onLeaseRevokedCallbacks) {
      try {
        cb(message);
      } catch {}
    }
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

  /**
   * Acquires the exclusive hardware lease for a renderer type and broadcasts
   * the acquisition to all other browser tabs to preempt collision.
   */
  public acquireLease(type: Renderer): RendererLease {
    this.generationCounter++;
    const leaseId = `lease_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    this.currentLease = {
      leaseId,
      renderer: type,
      generation: this.generationCounter,
      acquiredAt: Date.now(),
      originTabId: this.tabId,
    };
    
    // Enforce local ownership rules immediately
    for (const [key, state] of this.renderers.entries()) {
      state.isActive = key === type;
      // Only pause other renderer types (e.g. video element when switching to audio)
      if (!state.isActive && key !== type && state.element && !state.element.paused) {
        try {
          state.element.pause();
        } catch {}
      }
    }

    // Broadcast acquisition across browser tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'LEASE_ACQUIRED',
          leaseId,
          originTabId: this.tabId,
          timestamp: Date.now(),
        } satisfies LeaseBroadcastMessage);
      } catch {}
    }
    
    return this.currentLease;
  }

  public getActiveLease(): RendererLease | null {
    return this.currentLease;
  }

  public isLeaseValid(lease: RendererLease): boolean {
    if (!this.currentLease) return false;
    return this.currentLease.generation === lease.generation && 
           this.currentLease.renderer === lease.renderer &&
           this.currentLease.leaseId === lease.leaseId;
  }

  public getRendererElement(type: Renderer): HTMLMediaElement | null {
    return this.renderers.get(type)?.element || null;
  }

  public getActiveRenderer(): Renderer | null {
    return this.currentLease?.renderer || null;
  }

  public getTabId(): string {
    return this.tabId;
  }

  public onLeaseRevoked(cb: (message: LeaseBroadcastMessage) => void): () => void {
    this.onLeaseRevokedCallbacks.add(cb);
    return () => {
      this.onLeaseRevokedCallbacks.delete(cb);
    };
  }

  /**
   * Clean teardown for hot-module reloading or component unmounting
   */
  public destroy(): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
    }
    this.onLeaseRevokedCallbacks.clear();
  }
}
