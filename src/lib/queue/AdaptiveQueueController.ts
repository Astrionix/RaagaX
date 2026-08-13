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
      const firstItemSource = snapshot.items[0]?.source;
      const ctxType = String(snapshot.context?.type || snapshot.context?.contextType || '').toLowerCase();

      // HARD QUEUE BOUNDARY RULE: Bounded queues (album, playlist, liked, artist, user) are locked to their source.
      // Recommendations MUST NEVER modify active bounded queues while playing.
      if (firstItemSource && firstItemSource !== 'RECOMMENDATION' && firstItemSource !== 'AUTOPLAY') {
        return;
      }
      if (ctxType && ['album', 'playlist', 'liked', 'artist', 'user'].includes(ctxType)) {
        return;
      }

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
      const store = (await import('@/context/usePlayerStore')).usePlayerStore.getState();
      const selectedLanguages = lifecycleData.selectedLanguages ?? (store.preferredLanguage ? [store.preferredLanguage] : []);
      const historyIds = items.map(i => i.trackId);

      const activeUserId = (await import('@/context/useAuthStore')).useAuthStore.getState().user?.id || 'guest';

      // Generate categorized candidate buckets
      const buckets = await CandidateGenerator.generateBuckets(
        currentItem?.song || null,
        historyIds,
        { selectedLanguages, userId: activeUserId }
      );

      // Combine candidates based on current lifecycle phase composition ratios
      const candidates: QueueItem[] = [];
      const sessionIntent = lifecycleData.sessionIntentCategory;

      const cooldown = (await import('./CooldownManager')).CooldownManager.getInstance();
      const recentSlice = items.slice(Math.max(0, currentIndex - 2), currentIndex + 2);

      const pickCandidates = (sourceList: any[], count: number, reason: any) => {
        const filtered = cooldown.filterWithCooldowns(sourceList, recentSlice);
        const listToUse = filtered.length > 0 ? filtered : sourceList; // fallback if all cooled down

        for (const s of listToUse) {
          if (candidates.length >= count) break;
          if (!candidates.some(c => c.trackId === s.id)) {
            const item = manager.createQueueItem(s, 'RECOMMENDATION');
            item.smartQueueReason = { type: 'DISCOVERY', score: 0.95 };
            candidates.push(item);
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

  /**
   * Fetches autoplay recommendations ONLY AFTER a bounded queue (album/playlist) has completed naturally.
   */
  public async fetchAutoplayForCompletedQueue(): Promise<import('@/types/music').Song[]> {
    try {
      const manager = QueueManager.getInstance();
      const snapshot = manager.getSnapshot();

      // Ensure this is a bounded queue (album, playlist, liked, artist, user) and completed naturally
      const firstSource = snapshot.items[0]?.source?.toUpperCase();
      const boundedSources = ['ALBUM', 'PLAYLIST', 'LIKED', 'ARTIST', 'USER'];
      if (!firstSource || !boundedSources.includes(firstSource)) {
        return [];
      }
      const ctx = (snapshot.context?.type || snapshot.context?.contextType || '').toString().toUpperCase();
      if (ctx && !boundedSources.includes(ctx)) {
        return [];
      }

      const lastItem = snapshot.items[snapshot.items.length - 1];
      const lifecycle = UserLifecycleManager.getInstance();
      const lifecycleData = lifecycle.getData();
      const store = (await import('@/context/usePlayerStore')).usePlayerStore.getState();
      const selectedLanguages = lifecycleData.selectedLanguages ?? (store.preferredLanguage ? [store.preferredLanguage] : []);

      const activeUserId = (await import('@/context/useAuthStore')).useAuthStore.getState().user?.id || 'guest';

      const buckets = await CandidateGenerator.generateBuckets(
        lastItem?.song || null,
        snapshot.items.map(i => i.trackId),
        { selectedLanguages, userId: activeUserId }
      );

      const allCandidates = [...buckets.personalized, ...buckets.popular, ...buckets.newRelease];
      return allCandidates.slice(0, 10);
    } catch (e) {
      console.warn('[AdaptiveQueueController] Autoplay fetch failed:', e);
      return [];
    }
  }
}
