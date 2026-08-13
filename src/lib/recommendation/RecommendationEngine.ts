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

  public async getRecommendations(userId: string, languages: string[] | string = ['Telugu', 'Tamil', 'Hindi', 'Kannada', 'Malayalam', 'English']): Promise<Song[]> {
    const localDb = LocalDatabase.getInstance();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const langList = typeof languages === 'string' ? [languages] : (languages.length > 0 ? languages : ['Telugu', 'Tamil', 'Hindi', 'Kannada', 'Malayalam', 'English']);
    const targetCategory = `personalized_${langList.sort().join('_').toLowerCase()}`;

    // 1. Check local 3-day snapshot matching current language profile
    const cached = await localDb.getUserStore<RecommendationSnapshot>(userId, 'recommendation_snapshot');
    if (cached && cached.expiresAt > now && cached.items.length > 0 && cached.category === targetCategory) {
      return cached.items;
    }

    // 2. Fetch fresh candidates across user selected languages & affinity
    try {
      const musicEngine = RealMusicEngine.getInstance();
      const candidatePromises = langList.map(l => {
        const queries = [`${l} Hits`, `Latest ${l} Songs`, `${l} Melodies`, `Trending ${l} Songs`];
        const query = queries[Math.floor(Math.random() * queries.length)];
        return musicEngine.searchRealSongs(query, 20).catch(() => []);
      });

      const candidateLists = await Promise.all(candidatePromises);
      const rawCandidates = candidateLists.flat();

      // Filter candidate pool through LanguageEligibilityEngine with multilingual preference signals
      const eligibleCandidates = await LanguageEligibilityEngine.getInstance().filterCandidates(
        userId,
        rawCandidates,
        'PERSONALIZED_RECOMMENDATION',
        undefined,
        langList
      );

      // Shuffle & pick top 15
      const shuffled = eligibleCandidates.sort(() => 0.5 - Math.random()).slice(0, 15);

      const snapshot: RecommendationSnapshot = {
        category: targetCategory,
        items: shuffled,
        generatedAt: now,
        expiresAt: now + THREE_DAYS_MS,
      };

      await localDb.setUserStore(userId, 'recommendation_snapshot', snapshot);
      return shuffled;

      return shuffled;
    } catch (e) {
      console.warn('[RecommendationEngine] Candidate generation error:', e);
      return [];
    }
  }
}
