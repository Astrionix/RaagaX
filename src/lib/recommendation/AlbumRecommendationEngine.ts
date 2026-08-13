import { LocalDatabase } from '@/lib/offline/LocalDatabase';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { supabase } from '@/lib/supabase';
import { LanguageEligibilityEngine } from '@/lib/language/LanguageEligibilityEngine';

export interface RecommendedAlbum {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  year?: number;
  trackCount?: number;
  language?: string;
}

export interface AlbumRecommendationSnapshot {
  category: string;
  items: RecommendedAlbum[];
  generatedAt: number;
  expiresAt: number;
}

export class AlbumRecommendationEngine {
  private static instance: AlbumRecommendationEngine;

  private constructor() {}

  public static getInstance(): AlbumRecommendationEngine {
    if (!AlbumRecommendationEngine.instance) {
      AlbumRecommendationEngine.instance = new AlbumRecommendationEngine();
    }
    return AlbumRecommendationEngine.instance;
  }

  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  public async getRecommendedAlbums(userId: string, languages: string[] | string = ['Telugu', 'Tamil', 'Hindi', 'Kannada', 'Malayalam', 'English']): Promise<RecommendedAlbum[]> {
    const localDb = LocalDatabase.getInstance();
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000; // 48 Hours
    const now = Date.now();
    const langList = typeof languages === 'string' ? [languages] : (languages.length > 0 ? languages : ['Telugu', 'Tamil', 'Hindi', 'Kannada', 'Malayalam', 'English']);
    const targetCategory = `recommended_albums_${langList.sort().join('_').toLowerCase()}`;

    // 1. Check local 2-day snapshot matching current language profile
    const cached = await localDb.getUserStore<AlbumRecommendationSnapshot>(userId, 'album_recommendation_snapshot');
    if (cached && cached.expiresAt > now && cached.items && cached.items.length >= 10 && cached.category === targetCategory) {
      return cached.items.slice(0, 10);
    }

    // 2. Fetch fresh candidates across user selected languages & affinity
    try {
      const musicEngine = RealMusicEngine.getInstance();
      const queries = langList.flatMap(l => [
        `Top ${l} Albums`,
        `Latest ${l} Albums`,
        `Hit ${l} Albums`,
      ]);

      // Fetch album search results in parallel across languages
      const searchResults = await Promise.all(
        queries.map(q => musicEngine.searchRealAlbums(q, 8).catch(() => []))
      );

      const seen = new Set<string>();
      const candidateAlbums: RecommendedAlbum[] = [];

      for (const resList of searchResults) {
        for (const item of resList) {
          if (item && item.id && !seen.has(item.id)) {
            seen.add(item.id);
            candidateAlbums.push({
              id: String(item.id),
              title: item.title || item.name || 'Unknown Album',
              artist: item.artist || item.subtitle || 'Various Artists',
              coverUrl: item.coverUrl || item.image || '/app-icon.png',
              year: item.year || new Date().getFullYear(),
              trackCount: item.trackCount || 10,
              language: item.language || langList[candidateAlbums.length % langList.length],
            });
          }
        }
      }

      // Pick top 10 unique albums
      const top10 = candidateAlbums.slice(0, 10);

      const snapshot: AlbumRecommendationSnapshot = {
        category: targetCategory,
        items: top10,
        generatedAt: now,
        expiresAt: now + TWO_DAYS_MS,
      };

      // Save locally
      await localDb.setUserStore(userId, 'album_recommendation_snapshot', snapshot);
      return top10;
    } catch (e) {
      console.warn('[AlbumRecommendationEngine] Error generating album recommendations:', e);
      return [];
    }
  }
}
