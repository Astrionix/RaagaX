import { Song } from '@/types/music';
import { LocalDatabase } from '@/lib/offline/LocalDatabase';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { supabase } from '@/lib/supabase';
import { LanguageEligibilityEngine } from '@/lib/language/LanguageEligibilityEngine';

export interface RecommendationSnapshot {
  category: string;
  items: Song[];
  generatedAt: number;
  expiresAt: number;
}

export class RecommendationEngine {
  private static instance: RecommendationEngine;

  private constructor() {}

  public static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance) {
      RecommendationEngine.instance = new RecommendationEngine();
    }
    return RecommendationEngine.instance;
  }

  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  public async getRecommendations(userId: string, language: string = 'Telugu'): Promise<Song[]> {
    const localDb = LocalDatabase.getInstance();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // 1. Check local 3-day snapshot
    const cached = await localDb.getUserStore<RecommendationSnapshot>(userId, 'recommendation_snapshot');
    if (cached && cached.expiresAt > now && cached.items.length > 0) {
      return cached.items;
    }

    // 2. Fetch fresh candidates using preferred language & user affinity
    try {
      const musicEngine = RealMusicEngine.getInstance();
      const queries = [
        `${language} Hits`,
        `Latest ${language} Songs`,
        `${language} Melodies`,
        `Trending ${language} Songs`,
      ];
      
      // Select random query for freshness
      const query = queries[Math.floor(Math.random() * queries.length)];
      const rawCandidates = await musicEngine.searchRealSongs(query, 40);

      // Filter candidate pool through LanguageEligibilityEngine
      const eligibleCandidates = await LanguageEligibilityEngine.getInstance().filterCandidates(
        userId,
        rawCandidates,
        'PERSONALIZED_RECOMMENDATION',
        language,
        [language]
      );

      // Shuffle & pick top 15
      const shuffled = eligibleCandidates.sort(() => 0.5 - Math.random()).slice(0, 15);

      const snapshot: RecommendationSnapshot = {
        category: `recommended_${language.toLowerCase()}`,
        items: shuffled,
        generatedAt: now,
        expiresAt: now + THREE_DAYS_MS,
      };

      await localDb.setUserStore(userId, 'recommendation_snapshot', snapshot);

      if (userId && this.isUUID(userId) && navigator.onLine) {
        try {
          await supabase.from('recommendation_snapshots').insert({
            user_id: userId,
            category: snapshot.category,
            items: snapshot.items,
            generated_at: new Date(now).toISOString(),
            expires_at: new Date(now + THREE_DAYS_MS).toISOString(),
          });
        } catch (e) {
          console.warn('[RecommendationEngine] Failed to save snapshot remote:', e);
        }
      }

      return shuffled;
    } catch (e) {
      console.warn('[RecommendationEngine] Candidate generation error:', e);
      return [];
    }
  }
}
