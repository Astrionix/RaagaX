import { QueueEngine } from './QueueEngine';
import { AutoPlayEngine } from './AutoPlayEngine';
import { QueueItem } from './types';

export class SmartQueue {
  private static instance: SmartQueue;
  private isGenerating: boolean = false;
  private readonly REFILL_THRESHOLD = 5;
  private readonly REFILL_AMOUNT = 5;

  public static getInstance(): SmartQueue {
    if (!SmartQueue.instance) {
      SmartQueue.instance = new SmartQueue();
    }
    return SmartQueue.instance;
  }

  private constructor() {}

  public async evaluateRefill(engine: QueueEngine) {
    if (this.isGenerating) return;
    if (!engine.isAutoplayEnabled()) return;
    if (engine.getRepeatMode() !== 'OFF') return;

    const remaining = engine.getRemainingCount();
    
    if (remaining <= this.REFILL_THRESHOLD) {
      this.isGenerating = true;
      try {
        const seedItems = engine.getRecentItems(5); // Context based on last 5 items
        const newItems = await AutoPlayEngine.getInstance().generateCandidates(seedItems, this.REFILL_AMOUNT);
        
        if (newItems.length > 0) {
          engine.appendAutoplayItems(newItems);
          import('../playback/PlaybackService').then(({ PlaybackService }) => {
            PlaybackService.getInstance().preloadNativeNextTrack();
          });
        }
      } catch (e) {
        console.error('[SmartQueue] Refill failed', e);
      } finally {
        this.isGenerating = false;
      }
    }
  }
}
