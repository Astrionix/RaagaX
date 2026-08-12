import { QueueManager } from './QueueManager';
import { QueueItem } from './types';
import { UserLifecycleManager } from '../lifecycle/UserLifecycleManager';
import { CandidateGenerator } from '../recommendation/CandidateGenerator';

export class AdaptiveQueueController {
  private static instance: AdaptiveQueueController;
  private isRegenerating = false;

  private constructor() {}

  public static getInstance(): AdaptiveQueueController {
    if (!AdaptiveQueueController.instance) {
      AdaptiveQueueController.instance = new AdaptiveQueueController();
    }
    return AdaptiveQueueController.instance;
  }

  /**
   * Evaluates and updates the DYNAMIC_ZONE (+2 through +6) after user engagement events.
   * NEVER modifies LOCKED_NEXT (+1) to maintain preloader and playback stability.
   */
  public async regenerateDynamicZone(): Promise<void> {
    if (this.isRegenerating) return;
    this.isRegenerating = true;

    try {
      const manager = QueueManager.getInstance();
      const snapshot = manager.getSnapshot();
      const currentIndex = snapshot.currentIndex;
      const items = snapshot.items;

      if (currentIndex < 0 || currentIndex >= items.length - 2) {
        return; // No room for dynamic zone
      }

      // LOCKED_NEXT is item at currentIndex + 1 — MUST remain untouched!
      const currentItem = items[currentIndex];
      const lockedNext = items[currentIndex + 1];

      const lifecycle = UserLifecycleManager.getInstance();
      const lifecycleData = lifecycle.getData();
      const language = lifecycleData.selectedLanguages[0] || 'Telugu';
      const historyIds = items.map(i => i.trackId);

      // Generate categorized candidate buckets
      const buckets = await CandidateGenerator.generateBuckets(
        currentItem?.song || null,
        historyIds,
        language
      );

      // Combine candidates based on current lifecycle phase composition ratios
      const candidates: QueueItem[] = [];
      const sessionIntent = lifecycleData.sessionIntentCategory;

      const pickCandidates = (sourceList: any[], count: number, reason: any) => {
        for (const s of sourceList) {
          if (candidates.length >= count) break;
          if (!candidates.some(c => c.trackId === s.id)) {
            candidates.push(manager.createQueueItem(s, 'RECOMMENDATION'));
          }
        }
      };

      // Bias toward session intent if active
      if (sessionIntent) {
        const intentMatches = buckets.personalized.filter(s =>
          (s.genre && s.genre.toLowerCase().includes(sessionIntent.toLowerCase())) ||
          (s.category && s.category.toLowerCase().includes(sessionIntent.toLowerCase()))
        );
        pickCandidates(intentMatches, 2, 'USER_AFFINITY');
      }

      // Fill remaining dynamic slots
      pickCandidates(buckets.personalized, 2, 'USER_AFFINITY');
      pickCandidates(buckets.popular, 2, 'POPULAR');
      pickCandidates(buckets.newRelease, 1, 'NEW_RELEASE');
      pickCandidates(buckets.exploration, 1, 'DISCOVERY');

      if (candidates.length > 0) {
        // Reconstruct items array: items[0..currentIndex+1] + candidates + items[currentIndex+7..]
        const prefix = items.slice(0, currentIndex + 2); // includes current + lockedNext
        const suffix = items.slice(currentIndex + 7);
        const newQueue = [...prefix, ...candidates, ...suffix];

        manager.replaceQueue(newQueue.map(i => i.song), currentIndex, 'AUTOPLAY');
        console.log(`[AdaptiveQueueController] Regenerated DYNAMIC_ZONE with ${candidates.length} lifecycle candidates (Phase: ${lifecycleData.phase})`);
      }
    } catch (e) {
      console.warn('[AdaptiveQueueController] Dynamic zone update failed:', e);
    } finally {
      this.isRegenerating = false;
    }
  }
}
