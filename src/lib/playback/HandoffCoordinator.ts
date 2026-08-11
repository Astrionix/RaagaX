import { Renderer } from '@/types/music';
import { PlaybackSource } from '../offline/types';
import { PlaybackRenderer } from './renderers/PlaybackRenderer';
import { RendererManager } from './RendererManager';
import { PlaybackEngine } from './PlaybackEngine';
import { SessionManager } from './PlaybackSession';
import { usePlayerStore } from '@/context/usePlayerStore';

export type HandoffPhase = 'idle' | 'prepare' | 'seek' | 'start' | 'commit' | 'rollback';

export interface RendererHandoff {
  id: string;
  from: Renderer;
  to: Renderer;
  canonicalPositionMs: number;
  phase: HandoffPhase;
  createdAt: number;
}

const HANDOFF_TOLERANCE_MS = 100;

export class HandoffCoordinator {
  private static instance: HandoffCoordinator;
  private currentHandoff: RendererHandoff | null = null;
  private generation: number = 0;

  private constructor() {}

  public static getInstance(): HandoffCoordinator {
    if (!HandoffCoordinator.instance) {
      HandoffCoordinator.instance = new HandoffCoordinator();
    }
    return HandoffCoordinator.instance;
  }

  public getCurrentHandoff(): RendererHandoff | null {
    return this.currentHandoff;
  }

  public async performHandoff(
    targetRendererType: Renderer,
    targetRenderer: PlaybackRenderer,
    source: PlaybackSource
  ): Promise<boolean> {
    const rendererManager = RendererManager.getInstance();
    const sourceRendererType = rendererManager.getActiveRenderer() || 'audio';

    if (sourceRendererType === targetRendererType) {
      console.log('[HandoffCoordinator] Source and target renderer types are identical, skipping handoff.');
      return true;
    }

    const currentGeneration = ++this.generation;
    const engine = PlaybackEngine.getInstance();
    const store = usePlayerStore.getState();
    const wasPlaying = store.isPlaying;

    // 1. CAPTURE CANONICAL POSITION
    const canonicalPositionMs = engine.getCanonicalPositionMs();

    this.currentHandoff = {
      id: crypto.randomUUID(),
      from: sourceRendererType,
      to: targetRendererType,
      canonicalPositionMs,
      phase: 'prepare',
      createdAt: Date.now(),
    };

    usePlayerStore.setState({
      handoffState: {
        from: sourceRendererType,
        to: targetRendererType,
        phase: 'prepare',
        positionMs: canonicalPositionMs,
      },
    });

    console.log(`[HandoffCoordinator] Initiating handoff generation #${currentGeneration}: ${sourceRendererType} -> ${targetRendererType} @ ${canonicalPositionMs}ms`);

    try {
      // 2. PREPARE TARGET RENDERER (do NOT stop source renderer yet!)
      await targetRenderer.prepare(source);

      // Race check
      if (this.generation !== currentGeneration) {
        console.warn(`[HandoffCoordinator] Generation #${currentGeneration} aborted due to newer request.`);
        return false;
      }

      // 3. SEEK TARGET RENDERER
      this.updatePhase('seek');
      const livePositionMs = engine.getCanonicalPositionMs();
      await targetRenderer.seekCanonical(livePositionMs);

      // 4. VERIFY POSITION TOLERANCE
      const targetPos = targetRenderer.getCanonicalPositionMs();
      const posDelta = Math.abs(targetPos - livePositionMs);

      if (posDelta > HANDOFF_TOLERANCE_MS) {
        console.warn(`[HandoffCoordinator] Position verification delta (${posDelta}ms) exceeded tolerance (${HANDOFF_TOLERANCE_MS}ms). Re-seeking...`);
        await targetRenderer.seekCanonical(engine.getCanonicalPositionMs());
      }

      // 5. START TARGET RENDERER & STOP SOURCE RENDERER
      this.updatePhase('start');
      if (wasPlaying) {
        await targetRenderer.play();
      }

      // 6. COMMIT HANDOFF & TRANSFER LEASE
      this.updatePhase('commit');
      rendererManager.acquireLease(targetRendererType);
      SessionManager.getInstance().setRenderer(targetRendererType);
      
      // Now attach target renderer to PlaybackEngine
      engine.attachRenderer(targetRenderer);

      usePlayerStore.setState({
        activeRenderer: targetRendererType,
        handoffState: null,
      });

      this.currentHandoff = null;
      console.log(`[HandoffCoordinator] Handoff generation #${currentGeneration} successfully committed to ${targetRendererType}.`);
      return true;
    } catch (err) {
      console.error(`[HandoffCoordinator] Handoff failed on generation #${currentGeneration}, performing ROLLBACK:`, err);
      
      // ROLLBACK: Source renderer continues unaffected
      this.updatePhase('rollback');
      targetRenderer.pause();

      usePlayerStore.setState({ handoffState: null });
      this.currentHandoff = null;
      return false;
    }
  }

  private updatePhase(phase: HandoffPhase) {
    if (this.currentHandoff) {
      this.currentHandoff.phase = phase;
      usePlayerStore.setState((state) => ({
        handoffState: state.handoffState ? { ...state.handoffState, phase } : null,
      }));
    }
  }
}
