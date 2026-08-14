import { Song } from '@/types/music';
import { LocalDatabase } from '@/lib/offline/LocalDatabase';

export type LanguageState = 'BLOCKED' | 'DISCOVERED' | 'EXPLICIT' | 'SELECTED' | 'ACTIVE';

export type ContextType =
  | 'STRICT_CATEGORY'           /* e.g. Top Telugu Albums, Telugu Mix (MUST strictly match language) */
  | 'AUTOPLAY'                  /* Queue next / autoplay / refill (MUST strictly match session language) */
  | 'QUEUE_REFILL'              /* Adaptive refill / continuous radio (MUST strictly match session language) */
  | 'PERSONALIZED_RECOMMENDATION' /* e.g. For You, Because You Listen, Your Mix */
  | 'DISCOVERY'                  /* e.g. Discover, Recently Explored */
  | 'USER_LIBRARY'               /* e.g. Liked Songs, Recently Played, Saved Albums (UNRESTRICTED) */
  | 'USER_PLAYLIST'              /* e.g. User-created playlist (UNRESTRICTED) */
  | 'SEARCH';                    /* Explicit user query (UNRESTRICTED override) */

export interface UserLanguageProfile {
  globalLanguage: string; // Explicit user selection (e.g. 'Telugu' / 'te')
  sessionLanguage: string; // Contextual playback language of current queue
  interestLanguages: Record<string, number>; // Normalized inferred soft signals (e.g. { Telugu: 0.9, Hindi: 0.25 })
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

  /**
   * Normalizes language names and ISO codes into canonical language names
   */
  public normalizeLanguage(lang?: string): string {
    if (!lang) return '';
    const clean = lang.trim().toLowerCase();
    
    if (clean === 'te' || clean.includes('telugu')) return 'Telugu';
    if (clean === 'ta' || clean.includes('tamil')) return 'Tamil';
    if (clean === 'hi' || clean.includes('hindi')) return 'Hindi';
    if (clean === 'kn' || clean.includes('kannada')) return 'Kannada';
    if (clean === 'ml' || clean.includes('malayalam')) return 'Malayalam';
    if (clean === 'en' || clean.includes('english')) return 'English';
    if (clean === 'pa' || clean.includes('punjabi')) return 'Punjabi';
    if (clean === 'bn' || clean.includes('bengali')) return 'Bengali';
    
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  /**
   * Detects the song's language from explicit metadata, genre, title keywords, or artist
   */
  public detectSongLanguage(song: Partial<Song>): string {
    if (!song) return 'Telugu';

    // 1. Direct language property
    const rawLang = (song as any).language || (song as any).languageId || (song as any).lang;
    if (rawLang) {
      const normalized = this.normalizeLanguage(rawLang);
      if (normalized) return normalized;
    }

    // 2. Genre text
    const genre = (song.genre || '').toLowerCase();
    if (genre.includes('telugu') || genre.includes('tollywood')) return 'Telugu';
    if (genre.includes('tamil') || genre.includes('kollywood')) return 'Tamil';
    if (genre.includes('hindi') || genre.includes('bollywood')) return 'Hindi';
    if (genre.includes('kannada') || genre.includes('sandalwood')) return 'Kannada';
    if (genre.includes('malayalam') || genre.includes('mollywood')) return 'Malayalam';
    if (genre.includes('english') || genre.includes('pop') || genre.includes('western') || genre.includes('hollywood')) return 'English';
    if (genre.includes('punjabi')) return 'Punjabi';

    // 3. Artist/Title context heuristics for popular Indian music
    const artist = (song.artist || '').toLowerCase();
    const title = (song.title || '').toLowerCase();

    if (artist.includes('arijit singh') || artist.includes('shreya ghoshal') || artist.includes('jubin nautiyal') || title.includes('kesariya')) {
      return 'Hindi';
    }
    if (artist.includes('anirudh') || artist.includes('sid sriram') || artist.includes('devi sri prasad') || artist.includes('thaman')) {
      if (title.includes('samajavaragamana') || title.includes('butta bomma') || title.includes('naatu')) return 'Telugu';
      if (title.includes('arabic kuthu') || title.includes('hukum') || title.includes('vaathi')) return 'Tamil';
    }

    return 'Telugu'; // Fallback baseline
  }

  /**
   * Infers intended search language from user query string
   */
  public inferLanguageFromQuery(query: string): string | null {
    if (!query) return null;
    const clean = query.trim().toLowerCase();

    if (clean.includes('telugu') || clean.includes('tollywood')) return 'Telugu';
    if (clean.includes('hindi') || clean.includes('bollywood') || clean.includes('arijit') || clean.includes('kesariya')) return 'Hindi';
    if (clean.includes('tamil') || clean.includes('kollywood') || clean.includes('anirudh')) return 'Tamil';
    if (clean.includes('kannada') || clean.includes('sandalwood')) return 'Kannada';
    if (clean.includes('malayalam') || clean.includes('mollywood')) return 'Malayalam';
    if (clean.includes('english') || clean.includes('pop') || clean.includes('billboard')) return 'English';
    if (clean.includes('punjabi') || clean.includes('diljit')) return 'Punjabi';

    return null;
  }

  /**
   * Records a soft inferred language interest signal (from search, play, or like)
   * Note: Explicit global language always retains dominant weight (>= 0.80)
   */
  public async recordLanguageInterest(userId: string, language: string, delta: number = 0.15): Promise<void> {
    const normLang = this.normalizeLanguage(language);
    if (!normLang) return;

    try {
      const localDb = LocalDatabase.getInstance();
      const current = (await localDb.getUserStore<Record<string, number>>(userId || 'guest', 'language_interest_scores')) || {
        Telugu: 0.90,
      };

      const prevScore = current[normLang] || 0;
      current[normLang] = Math.min(1.0, Math.max(0.01, Math.round((prevScore + delta) * 100) / 100));

      await localDb.setUserStore(userId || 'guest', 'language_interest_scores', current);

      // Sync to zustand store if available in client
      if (typeof window !== 'undefined') {
        const { usePlayerStore } = await import('@/context/usePlayerStore');
        usePlayerStore.setState({ interestLanguages: current });
      }
    } catch (e) {
      console.warn('[LanguageEligibilityEngine] Failed to record interest:', e);
    }
  }

  /**
   * Evaluates song eligibility under strict 3-tier rules
   */
  public async isSongEligible(
    userId: string,
    song: Song,
    contextType: ContextType,
    targetCategoryLanguage?: string,
    userSelectedLanguages: string[] = []
  ): Promise<boolean> {
    // 1. Direct explicit user actions / Library / Search -> UNRESTRICTED
    if (
      contextType === 'USER_LIBRARY' ||
      contextType === 'USER_PLAYLIST' ||
      contextType === 'SEARCH'
    ) {
      return true;
    }

    const songLang = this.detectSongLanguage(song);
    const targetLang = targetCategoryLanguage ? this.normalizeLanguage(targetCategoryLanguage) : '';

    // 2. HARD RULE: Queue Purity (Autoplay, Queue Refill, Strict Shelves, Radio)
    // If a session / target language is established, DO NOT inject cross-language songs!
    if (
      contextType === 'STRICT_CATEGORY' ||
      contextType === 'AUTOPLAY' ||
      contextType === 'QUEUE_REFILL'
    ) {
      if (targetLang) {
        return songLang === targetLang;
      }
      if (userSelectedLanguages.length > 0) {
        const normalizedSelected = userSelectedLanguages.map(l => this.normalizeLanguage(l));
        return normalizedSelected.includes(songLang);
      }
      return true;
    }

    // 3. Personalized Home Recommendations & Discovery:
    // Respect selected language as primary constraint
    if (userSelectedLanguages.length > 0) {
      const normalizedSelected = userSelectedLanguages.map(l => this.normalizeLanguage(l));
      return normalizedSelected.includes(songLang);
    }

    return true;
  }

  /**
   * Filters candidate tracks strictly according to context and target language
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

