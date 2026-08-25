import { QueueItem, QueueSource } from './types';
import { QueueHistory } from './QueueHistory';
import { Song } from '@/types/music';
import { CandidateGenerator } from '../recommendation/CandidateGenerator';
import { QueueValidator } from './QueueValidator';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PersonalizationEngine } from '../recommendation/PersonalizationEngine';

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
      
      const { LanguageEligibilityEngine } = await import('@/lib/language/LanguageEligibilityEngine');
      const langEngine = LanguageEligibilityEngine.getInstance();
      const songLang = currentSong ? langEngine.detectSongLanguage(currentSong) : null;
      const targetLanguage = songLang || store.sessionLanguage || store.preferredLanguage || 'Telugu';

      const candidates = await CandidateGenerator.generateCandidates(
        currentSong,
        historyIds,
        targetLanguage,
        count * 2
      );
      
      const newItems = this.rankAndDeduplicate(candidates, seedItems, targetLanguage);
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

  private rankAndDeduplicate(candidates: Song[], seedItems: QueueItem[], targetLanguage?: string): QueueItem[] {
    const history = QueueHistory.getInstance();
    const ranked: Array<{ item: QueueItem, score: number }> = [];
    
    // Track seen keys in this batch and from history/buffer
    const seenKeys = new Set<string>();
    const recentArtists = new Set<string>(seedItems.slice(-3).map(s => s.song.artist).filter(Boolean));
    const recentAlbums = new Set<string>(seedItems.slice(-3).map(s => s.song.album).filter(Boolean));

    const seedSong = seedItems[seedItems.length - 1]?.song;

    for (const song of candidates) {
      // 1. Strict Validation
      if (!QueueValidator.isValidSong(song)) {
        console.warn(`[AutoPlayEngine] Rejected invalid song: ${song.id} - ${song.title}`);
        continue;
      }

      // 2. Strict Queue Language Purity (HARD RULE: Telugu Queue -> Telugu Songs Only)
      if (targetLanguage) {
        const { LanguageEligibilityEngine } = require('@/lib/language/LanguageEligibilityEngine');
        const songLang = LanguageEligibilityEngine.getInstance().detectSongLanguage(song);
        if (songLang !== targetLanguage) {
          continue;
        }
      }

      // 3. Strict Deduplication by trackId and dedupKey
      const dedupKey = QueueValidator.getDeduplicationKey(song);
      if (seenKeys.has(dedupKey) || history.wasRecentlyPlayed(song.id)) {
        continue;
      }
      seenKeys.add(dedupKey);

      // 4. Soft Artist and Album Spacing Penalty + Taste Preference
      const personalizationScore = PersonalizationEngine.getInstance().scoreTrack(song);
      let score = 1.0 + (personalizationScore / 100);
      let reasonType: import('./types').SmartQueueReasonType = 'DISCOVERY';

      if (seedSong && song.artist && song.artist === seedSong.artist) {
        reasonType = 'SAME_ARTIST';
        score += 0.4;
      } else if (seedSong && song.album && song.album === seedSong.album) {
        reasonType = 'SAME_ALBUM';
        score += 0.3;
      } else if (seedSong && (song as any).language && (song as any).language === (seedSong as any).language) {
        reasonType = 'LANGUAGE_MATCH';
        score += 0.2;
      }

      // Apply penalty if same artist appeared in recent 3 items
      if (song.artist && recentArtists.has(song.artist)) {
        score -= 0.3;
      }
      if (song.album && recentAlbums.has(song.album)) {
        score -= 0.2;
      }

      ranked.push({
        item: {
          queueItemId: crypto.randomUUID(),
          trackId: song.id,
          song: song,
          source: 'AUTOPLAY',
          smartQueueReason: {
            type: reasonType,
            score: Math.round(score * 100) / 100,
          },
          addedAt: Date.now(),
          playable: true,
          offlineAvailable: false
        },
        score
      });
    }

    // Sort candidates by calculated score descending
    ranked.sort((a, b) => b.score - a.score);
    
    return ranked.map(r => r.item);
  }
}
