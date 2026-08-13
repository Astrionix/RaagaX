import { RaagaDB, STORES } from '@/lib/storage/IndexedDB';

export interface UserPreferenceSignal {
  artistId?: string;
  artistName?: string;
  genre?: string;
  language?: string;
  scoreDelta: number;
  reason: 'COMPLETION_HIGH' | 'COMPLETION_MED' | 'SKIP_EARLY' | 'LIKE' | 'PLAYLIST_ADD' | 'SEARCH';
  timestamp: number;
}

export class RecommendationAnalytics {
  private static instance: RecommendationAnalytics;
  private signals: UserPreferenceSignal[] = [];

  private constructor() {}

  public static getInstance(): RecommendationAnalytics {
    if (!RecommendationAnalytics.instance) {
      RecommendationAnalytics.instance = new RecommendationAnalytics();
    }
    return RecommendationAnalytics.instance;
  }

  /**
   * Record playback completion or early skip signal (Skip Intelligence)
   */
  public recordPlaybackSignal(song: any, completionPercentage: number): void {
    if (!song) return;

    let scoreDelta = 0;
    let reason: UserPreferenceSignal['reason'] = 'COMPLETION_MED';

    if (completionPercentage >= 75) {
      scoreDelta = 8;
      reason = 'COMPLETION_HIGH';
    } else if (completionPercentage >= 50) {
      scoreDelta = 4;
      reason = 'COMPLETION_MED';
    } else if (completionPercentage < 15) {
      // Skip Intelligence: early skips indicate negative feedback
      scoreDelta = -5;
      reason = 'SKIP_EARLY';
    } else {
      return;
    }

    this.addSignal({
      artistId: song.artistId,
      artistName: song.artist,
      genre: song.genre,
      language: song.language || 'Telugu',
      scoreDelta,
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * Record explicitly positive signals (Like / Add to Playlist / Search)
   */
  public recordInteractionSignal(
    type: 'LIKE' | 'PLAYLIST_ADD' | 'SEARCH',
    data: { artistName?: string; genre?: string; language?: string }
  ): void {
    const scoreMap = {
      LIKE: 12,
      PLAYLIST_ADD: 10,
      SEARCH: 3,
    };

    this.addSignal({
      artistName: data.artistName,
      genre: data.genre,
      language: data.language || 'Telugu',
      scoreDelta: scoreMap[type],
      reason: type as any,
      timestamp: Date.now(),
    });
  }

  private async addSignal(signal: UserPreferenceSignal): Promise<void> {
    this.signals.push(signal);
    if (this.signals.length > 100) {
      this.signals.shift();
    }

    try {
      const db = RaagaDB.getInstance();
      await db.put(STORES.RECOMMENDATIONS_SNAPSHOT, {
        id: 'user_signals_snapshot',
        signals: this.signals,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('[RecommendationAnalytics] Failed to save signal snapshot:', e);
    }
  }

  public getSignals(): UserPreferenceSignal[] {
    return [...this.signals];
  }
}
