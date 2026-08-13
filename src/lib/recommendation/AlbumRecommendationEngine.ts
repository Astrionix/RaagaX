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

  public async getRecommendedAlbums(userId: string, language: string = 'Telugu'): Promise<RecommendedAlbum[]> {
    const localDb = LocalDatabase.getInstance();
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000; // 48 Hours
    const now = Date.now();
    const cleanLang = LanguageEligibilityEngine.getInstance().normalizeLanguage(language);

    // 1. Check local 2-day snapshot
    const cached = await localDb.getUserStore<AlbumRecommendationSnapshot>(userId, 'album_recommendation_snapshot');
    if (cached && cached.expiresAt > now && cached.items && cached.items.length >= 10) {
      return cached.items.slice(0, 10);
    }

    // 2. Fetch fresh candidates using preferred language & user affinity
    try {
      const musicEngine = RealMusicEngine.getInstance();
      const queries = [
        `${cleanLang} Movie Albums`,
        `Top ${cleanLang} Albums`,
        `Latest ${cleanLang} Albums`,
        `Hit ${cleanLang} Albums`,
      ];

      // Fetch album search results in parallel
      const searchResults = await Promise.all(
        queries.map(q => musicEngine.searchRealAlbums(q, 10).catch(() => []))
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
              language: cleanLang,
            });
          }
        }
      }

      // Pick top 10 unique albums
      const top10 = candidateAlbums.slice(0, 10);

      const snapshot: AlbumRecommendationSnapshot = {
        category: `recommended_albums_${cleanLang.toLowerCase()}`,
        items: top10,
        generatedAt: now,
        expiresAt: now + TWO_DAYS_MS,
      };

      // Save locally
      await localDb.setUserStore(userId, 'album_recommendation_snapshot', snapshot);

      // Persist remote if authenticated
      if (userId && this.isUUID(userId) && navigator.onLine) {
        try {
          await supabase.from('recommendation_snapshots').insert({
            user_id: userId,
            category: snapshot.category,
            items: snapshot.items,
            generated_at: new Date(now).toISOString(),
            expires_at: new Date(now + TWO_DAYS_MS).toISOString(),
          });
        } catch (e) {
          console.warn('[AlbumRecommendationEngine] Failed to save remote snapshot:', e);
        }
      }

      return top10;
    } catch (e) {
      console.warn('[AlbumRecommendationEngine] Error generating album recommendations:', e);
      return [];
    }
  }
}
