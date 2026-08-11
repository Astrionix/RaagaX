import { QueueItem, QueueSource } from './types';
import { QueueHistory } from './QueueHistory';
import { Song } from '@/types/music';
import { CandidateGenerator } from '../recommendation/CandidateGenerator';
import { QueueValidator } from './QueueValidator';
import { usePlayerStore } from '@/context/usePlayerStore';

export class AutoPlayEngine {
  private static instance: AutoPlayEngine;
  
  private candidateBuffer: QueueItem[] = [];
  private isRefilling: boolean = false;
  private readonly MIN_BUFFER_SIZE = 5;
  private readonly TARGET_BUFFER_SIZE = 15;

  private constructor() {}

  public static getInstance(): AutoPlayEngine {
    if (!AutoPlayEngine.instance) {
      AutoPlayEngine.instance = new AutoPlayEngine();
    }
    return AutoPlayEngine.instance;
  }

  /**
   * Refills the internal buffer asynchronously if it falls below the minimum size.
   */
  public async ensureBuffer(seedItems: QueueItem[], count: number = this.TARGET_BUFFER_SIZE): Promise<void> {
    if (this.isRefilling) return;
    if (this.candidateBuffer.length >= this.MIN_BUFFER_SIZE) return;

    this.isRefilling = true;
    try {
      const store = usePlayerStore.getState();
      const currentSong = store.currentSong;
      const historyIds = QueueHistory.getInstance().getRecentlyPlayed(50).map(e => e.trackId);
      
      const candidates = await CandidateGenerator.generateCandidates(
        currentSong,
        historyIds,
        store.preferredLanguage || 'Telugu',
        count * 2
      );
      
      const newItems = this.rankAndDeduplicate(candidates, seedItems);
      this.candidateBuffer.push(...newItems);
      
    } catch (e) {
      console.error('[AutoPlayEngine] Background refill failed:', e);
    } finally {
      this.isRefilling = false;
    }
  }

  /**
   * Returns up to `count` items from the buffer, triggering a background refill if necessary.
   */
  public async generateCandidates(seedItems: QueueItem[], count: number = 5): Promise<QueueItem[]> {
    // If we have items in buffer, just return them and trigger a background refill if getting low
    if (this.candidateBuffer.length > 0) {
      const itemsToReturn = this.candidateBuffer.splice(0, count);
      
      // Async trigger refill if we dip below min buffer size
      if (this.candidateBuffer.length < this.MIN_BUFFER_SIZE) {
        this.ensureBuffer(seedItems).catch(console.error);
      }
      
      return itemsToReturn;
    }

    // Buffer is completely empty, we must block and wait for refill
    await this.ensureBuffer(seedItems, this.TARGET_BUFFER_SIZE);
    
    return this.candidateBuffer.splice(0, count);
  }

  private rankAndDeduplicate(candidates: Song[], seedItems: QueueItem[]): QueueItem[] {
    const history = QueueHistory.getInstance();
    const ranked: Array<{ item: QueueItem, score: number }> = [];
    
    // Track seen keys in this batch and from history/buffer
    const seenKeys = new Set<string>();

    for (const song of candidates) {
      // 1. Strict Validation
      if (!QueueValidator.isValidSong(song)) {
        console.warn(`[AutoPlayEngine] Rejected invalid song: ${song.id} - ${song.title}`);
        continue;
      }

      // 2. Strict Deduplication
      const dedupKey = QueueValidator.getDeduplicationKey(song);
      if (seenKeys.has(dedupKey) || history.wasRecentlyPlayed(song.id)) {
        continue;
      }
      seenKeys.add(dedupKey);

      // Score logic can be improved, but candidate generator already ordered them logically.
      // We just push them as queue items.
      ranked.push({
        item: {
          queueItemId: crypto.randomUUID(),
          trackId: song.id,
          song: song,
          source: 'AUTOPLAY',
          addedAt: Date.now(),
          playable: true,
          offlineAvailable: false // This will be resolved later
        },
        score: 1.0 // If we wanted further client ranking, we could adjust this
      });
    }
    
    return ranked.map(r => r.item);
  }
}
