import { Song } from '@/types/music';
import { LocalDatabase } from '@/lib/offline/LocalDatabase';
import { supabase } from '@/lib/supabase';

export type LanguageState = 'BLOCKED' | 'DISCOVERED' | 'EXPLICIT' | 'SELECTED' | 'ACTIVE';

export type ContextType =
  | 'STRICT_CATEGORY'           /* e.g. Top Telugu Albums, Telugu Mix (MUST strictly match language) */
  | 'PERSONALIZED_RECOMMENDATION' /* e.g. For You, Because You Listen, Your Mix */
  | 'DISCOVERY'                  /* e.g. Discover, Recently Explored */
  | 'USER_LIBRARY'               /* e.g. Liked Songs, Recently Played, Saved Albums (UNRESTRICTED) */
  | 'USER_PLAYLIST'              /* e.g. User-created playlist (UNRESTRICTED) */
  | 'SEARCH';                    /* Explicit user query (UNRESTRICTED override) */

export interface UserLanguageAffinityRecord {
  language: string;
  score: number;
  state: LanguageState;
  explicit: boolean;
}

export interface PlaylistLanguageProfile {
  primaryLanguage: string;
  distribution: Record<string, number>; // e.g. { Telugu: 0.8, Tamil: 0.2 }
  eligibleLanguages: string[];
}

export class LanguageEligibilityEngine {
  private static instance: LanguageEligibilityEngine;

  private constructor() {}

  public static getInstance(): LanguageEligibilityEngine {
    if (!LanguageEligibilityEngine.instance) {
      LanguageEligibilityEngine.instance = new LanguageEligibilityEngine();
    }
    return LanguageEligibilityEngine.instance;
  }

  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  /**
   * Normalizes song language text string (e.g. 'telugu' -> 'Telugu')
   */
  public normalizeLanguage(lang?: string): string {
    if (!lang) return 'Telugu';
    const clean = lang.trim().toLowerCase();
    if (clean.includes('telugu')) return 'Telugu';
    if (clean.includes('tamil')) return 'Tamil';
    if (clean.includes('hindi')) return 'Hindi';
    if (clean.includes('kannada')) return 'Kannada';
    if (clean.includes('malayalam')) return 'Malayalam';
    if (clean.includes('english')) return 'English';
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  /**
   * Calculates language state for a specific user and language
   */
  public async getLanguageState(userId: string, language: string, selectedLanguages: string[] = []): Promise<LanguageState> {
    const targetLang = this.normalizeLanguage(language);
    const selected = selectedLanguages.map(l => this.normalizeLanguage(l));

    if (selected.includes(targetLang)) {
      return 'ACTIVE';
    }

    const localDb = LocalDatabase.getInstance();
    const affinities = (await localDb.getUserStore<Record<string, number>>(userId, 'language_affinity')) || {};
    const score = affinities[targetLang] || 0;

    if (score >= 30) return 'ACTIVE';
    if (score >= 15) return 'EXPLICIT';
    return 'DISCOVERED';
  }

  /**
   * Evaluates song eligibility for a specified category context
   */
  public async isSongEligible(
    userId: string,
    song: Song,
    contextType: ContextType,
    targetCategoryLanguage?: string,
    userSelectedLanguages: string[] = []
  ): Promise<boolean> {
    // 1. User Explicit Action / Library / Search / User-Created Playlist -> UNRESTRICTED
    if (
      contextType === 'USER_LIBRARY' ||
      contextType === 'USER_PLAYLIST' ||
      contextType === 'SEARCH'
    ) {
      return true;
    }

    const songLang = this.normalizeLanguage((song as any).language || (song as any).languageId || song.genre);
    const targetLang = targetCategoryLanguage ? this.normalizeLanguage(targetCategoryLanguage) : '';

    // 2. Strict Category Rule: e.g., Top Telugu Albums, Tamil Mix MUST match song language exactly
    if (contextType === 'STRICT_CATEGORY' && targetLang) {
      return songLang === targetLang;
    }

    // 3. Personalized Recommendation / Discovery Context: Language is a preference signal, allow all non-blocked languages
    const state = await this.getLanguageState(userId, songLang, userSelectedLanguages);
    return state !== 'BLOCKED';
  }

  /**
   * Infers the language profile of a playlist to guide playlist recommendation additions
   */
  public inferPlaylistLanguageProfile(songs: Song[]): PlaylistLanguageProfile {
    if (!songs || songs.length === 0) {
      return {
        primaryLanguage: 'Telugu',
        distribution: { Telugu: 1.0 },
        eligibleLanguages: ['Telugu'],
      };
    }

    const counts: Record<string, number> = {};
    let total = 0;

    for (const song of songs) {
      const lang = this.normalizeLanguage((song as any).language || (song as any).languageId || song.genre);
      counts[lang] = (counts[lang] || 0) + 1;
      total++;
    }

    const distribution: Record<string, number> = {};
    let maxCount = 0;
    let primaryLanguage = 'Telugu';
    const eligibleLanguages: string[] = [];

    for (const [lang, count] of Object.entries(counts)) {
      const ratio = count / total;
      distribution[lang] = ratio;
      if (count > maxCount) {
        maxCount = count;
        primaryLanguage = lang;
      }
      // Include language if it represents at least 15% of playlist tracks
      if (ratio >= 0.15) {
        eligibleLanguages.push(lang);
      }
    }

    return {
      primaryLanguage,
      distribution,
      eligibleLanguages: eligibleLanguages.length > 0 ? eligibleLanguages : [primaryLanguage],
    };
  }

  /**
   * Filters an array of candidate songs based on category context and language eligibility
   */
  public async filterCandidates(
    userId: string,
    candidates: Song[],
    contextType: ContextType,
    targetCategoryLanguage?: string,
    userSelectedLanguages: string[] = []
  ): Promise<Song[]> {
    const eligible: Song[] = [];
    for (const song of candidates) {
      const ok = await this.isSongEligible(userId, song, contextType, targetCategoryLanguage, userSelectedLanguages);
      if (ok) {
        eligible.push(song);
      }
    }
    return eligible;
  }
}
