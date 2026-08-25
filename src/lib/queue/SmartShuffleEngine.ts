import { QueueItem } from './types';
import { QueueHistory } from './QueueHistory';
import { CandidateGenerator } from '../recommendation/CandidateGenerator';
import { QueueValidator } from './QueueValidator';
import { PersonalizationEngine } from '../recommendation/PersonalizationEngine';
import { Song } from '@/types/music';

export class SmartShuffleEngine {
  
  /**
   * Generates a deterministically seeded sequence that mixes the original playlist items
   * with intelligently selected recommendations.
   */
  public static async generateSmartSequence(
    originalItems: QueueItem[], 
    seed: string, 
    language: string
  ): Promise<QueueItem[]> {
    if (originalItems.length === 0) return [];

    // Setup pseudo-random number generator for this session
    let currentSeed = seed.charCodeAt(0) || 42;
    const nextRandom = () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };

    // 1. Initial Standard Shuffle on original items
    const shuffledOriginal = [...originalItems];
    shuffledOriginal.sort(() => nextRandom() - 0.5);

    // 2. Fetch candidates for injection (simulated in background or using current Context)
    // We only fetch enough to inject ~20% new songs
    const injectionCount = Math.max(1, Math.floor(originalItems.length * 0.2));
    
    // Pick the most common artist in the queue to use as seed context
    const currentSong = originalItems[0].song;
    const historyIds = QueueHistory.getInstance().getRecentlyPlayed(20).map(e => e.trackId);
    
    const candidates = await CandidateGenerator.generateCandidates(
      currentSong,
      historyIds,
      language,
      injectionCount * 3
    );

    const recommendedItems: QueueItem[] = [];
    const seenKeys = new Set<string>();
    const scoredCandidates: Array<{ song: Song, score: number }> = [];

    for (const song of candidates) {
      if (!QueueValidator.isValidSong(song)) continue;
      
      const key = QueueValidator.getDeduplicationKey(song);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const score = PersonalizationEngine.getInstance().scoreTrack(song as Song);
      scoredCandidates.push({ song, score });
    }

    // Sort by taste score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Pick top candidates up to injectionCount
    for (const item of scoredCandidates.slice(0, injectionCount)) {
      recommendedItems.push({
        queueItemId: crypto.randomUUID(),
        trackId: item.song.id,
        song: item.song,
        source: 'RECOMMENDATION',
        addedAt: Date.now(),
        playable: true,
        offlineAvailable: false
      });
    }

    // 3. Inject recommended items uniformly into the shuffled queue
    const finalSequence: QueueItem[] = [];
    const injectInterval = Math.floor(shuffledOriginal.length / (recommendedItems.length + 1));
    
    let originalIdx = 0;
    let recIdx = 0;
    
    while (originalIdx < shuffledOriginal.length) {
      // Add batch of original items
      for (let i = 0; i < injectInterval && originalIdx < shuffledOriginal.length; i++) {
        finalSequence.push(shuffledOriginal[originalIdx++]);
      }
      // Inject one recommendation
      if (recIdx < recommendedItems.length) {
        finalSequence.push(recommendedItems[recIdx++]);
      }
    }

    // Append any remaining recommendations if math wasn't perfect
    while (recIdx < recommendedItems.length) {
      finalSequence.push(recommendedItems[recIdx++]);
    }

    return finalSequence;
  }
}
