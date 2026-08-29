/**
 * CategoryDiscoveryEngine — Production Category & Catalog Discovery Engine.
 * 
 * Grounded strictly in real JioSaavn catalog data & metadata capabilities.
 * Translates structured category intents into high-relevance search queries,
 * enforces strict language validation, deduplicates tracks, and caches results.
 */

import { Song } from '@/types/music';
import { UnifiedSearchEngine, UnifiedSearchResults } from '@/lib/search/UnifiedSearchEngine';
import { SongUniquenessEngine } from '@/lib/music/SongUniquenessEngine';

export type CategoryType = 'language' | 'genre' | 'mood' | 'trend' | 'curated_playlist';

export interface RaagaCategory {
  id: string;
  title: string;
  subtitle: string;
  type: CategoryType;
  language?: string;
  genre?: string;
  query: string;
  gradient: string;
  badge?: string;
  curatedPlaylistQuery?: string;
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REAL JIOSAAVN SUPPORTED CATALOG REGISTRIES
// ─────────────────────────────────────────────────────────────────────────────

export const LANGUAGE_CATEGORIES: RaagaCategory[] = [
  {
    id: 'lang_telugu',
    title: 'Telugu',
    subtitle: 'Tollywood Hits & Classics',
    type: 'language',
    language: 'Telugu',
    query: 'Telugu Songs Hits',
    gradient: 'from-rose-700/80 via-red-900/60 to-zinc-950/90',
    badge: 'REGIONAL',
    description: 'Top trending Tollywood soundtracks, melody classics, and recent releases.',
  },
  {
    id: 'lang_tamil',
    title: 'Tamil',
    subtitle: 'Kollywood Mass & Melodies',
    type: 'language',
    language: 'Tamil',
    query: 'Tamil Songs Hits',
    gradient: 'from-amber-600/80 via-orange-900/60 to-zinc-950/90',
    badge: 'KUTHU & MASS',
    description: 'Kollywood chartbusters, mass anthems, and soulful Tamil melodies.',
  },
  {
    id: 'lang_hindi',
    title: 'Hindi',
    subtitle: 'Bollywood & Hindi Pop',
    type: 'language',
    language: 'Hindi',
    query: 'Hindi Bollywood Hits',
    gradient: 'from-purple-700/80 via-indigo-900/60 to-zinc-950/90',
    badge: 'BOLLYWOOD',
    description: 'Latest Bollywood cinema tracks, romantic duets, and pop chart toppers.',
  },
  {
    id: 'lang_kannada',
    title: 'Kannada',
    subtitle: 'Sandalwood Melodies & Beats',
    type: 'language',
    language: 'Kannada',
    query: 'Kannada Songs Hits',
    gradient: 'from-emerald-700/80 via-teal-900/60 to-zinc-950/90',
    badge: 'SANDALWOOD',
    description: 'Sandalwood hits, evergreen Kannada melodies, and new releases.',
  },
  {
    id: 'lang_malayalam',
    title: 'Malayalam',
    subtitle: 'Mollywood Soul & Acoustic',
    type: 'language',
    language: 'Malayalam',
    query: 'Malayalam Songs Hits',
    gradient: 'from-cyan-700/80 via-blue-900/60 to-zinc-950/90',
    badge: 'MOLLEWOOD',
    description: 'Soulful Mollywood melodies, indie Malayalam songs, and movie hits.',
  },
  {
    id: 'lang_punjabi',
    title: 'Punjabi',
    subtitle: 'Bhangra & Desi Pop Beats',
    type: 'language',
    language: 'Punjabi',
    query: 'Punjabi Songs Hits',
    gradient: 'from-yellow-600/80 via-amber-900/60 to-zinc-950/90',
    badge: 'BHANGRA',
    description: 'High-voltage Punjabi club beats, pop hits, and regional folk tracks.',
  },
  {
    id: 'lang_english',
    title: 'English',
    subtitle: 'Global Top Hits & Pop',
    type: 'language',
    language: 'English',
    query: 'Top Hits English Billboard',
    gradient: 'from-blue-700/80 via-indigo-950/60 to-zinc-950/90',
    badge: 'GLOBAL TOP 50',
    description: 'International Billboard chart toppers, pop, and global viral hits.',
  },
  {
    id: 'lang_bengali',
    title: 'Bengali',
    subtitle: 'Modern Bangla & Rabindra',
    type: 'language',
    language: 'Bengali',
    query: 'Bengali Songs Hits',
    gradient: 'from-red-700/80 via-rose-950/60 to-zinc-950/90',
    badge: 'BANGLA',
    description: 'Modern Bangla cinema hits, Rabindra Sangeet, and folk melodies.',
  },
  {
    id: 'lang_marathi',
    title: 'Marathi',
    subtitle: 'Lavani, Bhavgeet & Movie Hits',
    type: 'language',
    language: 'Marathi',
    query: 'Marathi Songs Hits',
    gradient: 'from-orange-700/80 via-red-950/60 to-zinc-950/90',
    badge: 'MAHARASHTRA',
    description: 'Popular Marathi movie tracks, Natyageet, and traditional rhythms.',
  },
  {
    id: 'lang_gujarati',
    title: 'Gujarati',
    subtitle: 'Garba, Dandiya & Urban Hits',
    type: 'language',
    language: 'Gujarati',
    query: 'Gujarati Songs Hits',
    gradient: 'from-lime-700/80 via-emerald-950/60 to-zinc-950/90',
    badge: 'GARBA',
    description: 'Festive Garba rhythms, Gujarati folk, and urban modern hits.',
  },
  {
    id: 'lang_bhojpuri',
    title: 'Bhojpuri',
    subtitle: 'Folk, DJ & Festive Songs',
    type: 'language',
    language: 'Bhojpuri',
    query: 'Bhojpuri Songs Hits',
    gradient: 'from-amber-700/80 via-red-950/60 to-zinc-950/90',
    badge: 'DESI BEATS',
    description: 'Upbeat Bhojpuri dance tracks, stage hits, and festive songs.',
  },
];

export const GENRE_MOOD_CATEGORIES: RaagaCategory[] = [
  {
    id: 'genre_trending',
    title: 'Trending',
    subtitle: 'Viral Hits & Chart Risers',
    type: 'trend',
    query: 'Trending Viral Songs',
    gradient: 'from-[#FA233B]/85 via-rose-950/60 to-zinc-950/90',
    badge: 'VIRAL NOW',
    description: 'The most played and rapidly rising tracks across music charts today.',
  },
  {
    id: 'genre_romantic',
    title: 'Romantic',
    subtitle: 'Love Songs & Heartfelt Duets',
    type: 'mood',
    genre: 'romantic',
    query: 'Romantic Love Duets Songs',
    gradient: 'from-pink-700/80 via-rose-950/60 to-zinc-950/90',
    badge: 'LOVE & DUETS',
    description: 'Heartwarming love songs, soulful melodies, and romantic cinema duets.',
  },
  {
    id: 'genre_melody',
    title: 'Melody',
    subtitle: 'Soulful & Unplugged Acoustics',
    type: 'genre',
    genre: 'melody',
    query: 'Melody Hits Unplugged Acoustic',
    gradient: 'from-fuchsia-700/80 via-purple-950/60 to-zinc-950/90',
    badge: 'SOULFUL ACOUSTIC',
    description: 'Timeless melodic compositions, unplugged renditions, and relaxing tunes.',
  },
  {
    id: 'genre_party',
    title: 'Party & Dance',
    subtitle: 'Club Bangers & High Energy',
    type: 'genre',
    genre: 'party',
    query: 'Party Dance DJ Club Hits',
    gradient: 'from-violet-700/80 via-purple-950/60 to-zinc-950/90',
    badge: 'DJ & DANCE',
    description: 'Dancefloor anthems, high-energy remixes, and celebration hits.',
  },
  {
    id: 'genre_devotional',
    title: 'Devotional',
    subtitle: 'Bhakti, Stotrams & Chants',
    type: 'mood',
    genre: 'devotional',
    query: 'Devotional Bhakti Songs Stotram',
    gradient: 'from-amber-500/80 via-yellow-900/60 to-zinc-950/90',
    badge: 'SPIRITUAL',
    description: 'Peaceful morning devotional prayers, stotrams, and spiritual hymns.',
  },
  {
    id: 'genre_classical',
    title: 'Classical',
    subtitle: 'Carnatic & Hindustani Ragas',
    type: 'genre',
    genre: 'classical',
    query: 'Indian Classical Carnatic Hindustani Raga',
    gradient: 'from-amber-700/80 via-orange-950/60 to-zinc-950/90',
    badge: 'HERITAGE RAGAS',
    description: 'Traditional Carnatic vocal, Hindustani classical ragas, and instrumental mastery.',
  },
  {
    id: 'genre_indie',
    title: 'Indie Pop',
    subtitle: 'Independent Music & Non-Film',
    type: 'genre',
    genre: 'indie',
    query: 'Indian Indie Independent Pop',
    gradient: 'from-teal-600/80 via-emerald-950/60 to-zinc-950/90',
    badge: 'INDEPENDENT',
    description: 'Fresh sounds from independent singer-songwriters and alternative artists.',
  },
  {
    id: 'genre_hiphop',
    title: 'Hip-Hop & Rap',
    subtitle: 'Desi Hip Hop & Street Beats',
    type: 'genre',
    genre: 'hiphop',
    query: 'Desi Hip Hop Rap Street Beats',
    gradient: 'from-red-800/80 via-zinc-900/80 to-zinc-950/90',
    badge: 'DESI RAP',
    description: 'Indian street rap, energetic drill beats, and lyrical hip hop.',
  },
  {
    id: 'genre_folk',
    title: 'Folk & Janapada',
    subtitle: 'Traditional Regional Roots',
    type: 'genre',
    genre: 'folk',
    query: 'Folk Songs Janapada Traditional',
    gradient: 'from-yellow-700/80 via-amber-950/60 to-zinc-950/90',
    badge: 'TRADITIONAL',
    description: 'Authentic regional folk music, Janapada geethegalu, and rustic instruments.',
  },
  {
    id: 'genre_lofi',
    title: 'Lo-Fi Chill',
    subtitle: 'Slowed & Reverb Late Night',
    type: 'mood',
    genre: 'lofi',
    query: 'Lofi Chill Beats Slowed Reverb',
    gradient: 'from-indigo-800/80 via-slate-900/80 to-zinc-950/90',
    badge: 'LATE NIGHT CHILL',
    description: 'Slowed, reverb, aesthetic ambient lo-fi beats for relaxing and focus.',
  },
];

export const CURATED_THEMES: RaagaCategory[] = [
  {
    id: 'curated_telugu_trending',
    title: 'Now Trending Telugu',
    subtitle: 'JioSaavn Curated',
    type: 'curated_playlist',
    language: 'Telugu',
    query: 'Now Trending Telugu',
    curatedPlaylistQuery: 'Now Trending Telugu',
    gradient: 'from-rose-600/80 via-red-950/60 to-zinc-950/90',
    badge: 'OFFICIAL PLAYLIST',
    description: 'The authoritative playlist of top viral Tollywood chart toppers.',
  },
  {
    id: 'curated_kotha_tunes',
    title: 'Kotha Tunes',
    subtitle: 'Fresh Telugu Drops',
    type: 'curated_playlist',
    language: 'Telugu',
    query: 'Kotha Tunes Telugu',
    curatedPlaylistQuery: 'Kotha Tunes',
    gradient: 'from-red-700/80 via-rose-950/60 to-zinc-950/90',
    badge: 'NEW DROPS',
    description: 'Brand new releases, singles, and teaser tracks in Telugu.',
  },
  {
    id: 'curated_top_kuthu',
    title: 'Top Kuthu',
    subtitle: 'Tamil Dance & Folk Hits',
    type: 'curated_playlist',
    language: 'Tamil',
    query: 'Top Kuthu Tamil',
    curatedPlaylistQuery: 'Top Kuthu',
    gradient: 'from-amber-600/80 via-orange-950/60 to-zinc-950/90',
    badge: 'HIGH ENERGY',
    description: 'Electrifying Tamil Dappankuthu beats and high-octane celebration tracks.',
  },
  {
    id: 'curated_pudhu_tunes',
    title: 'Pudhu Tunes',
    subtitle: 'Latest Kollywood Songs',
    type: 'curated_playlist',
    language: 'Tamil',
    query: 'Pudhu Tunes Tamil',
    curatedPlaylistQuery: 'Pudhu Tunes',
    gradient: 'from-orange-700/80 via-amber-950/60 to-zinc-950/90',
    badge: 'NEW DROPS',
    description: 'Fresh Tamil tracks, promo songs, and latest movie drops.',
  },
  {
    id: 'curated_romance_hindi',
    title: 'Best Of Romance',
    subtitle: 'Hindi Love Songs',
    type: 'curated_playlist',
    language: 'Hindi',
    query: 'Best Of Romance Hindi',
    curatedPlaylistQuery: 'Best Of Romance Hindi',
    gradient: 'from-purple-600/80 via-indigo-950/60 to-zinc-950/90',
    badge: 'CURATED',
    description: 'Evergreen Bollywood romantic classics and heartfelt modern love ballads.',
  },
  {
    id: 'curated_fresh_tunes_hindi',
    title: 'Fresh Tunes Hindi',
    subtitle: 'Latest Bollywood Releases',
    type: 'curated_playlist',
    language: 'Hindi',
    query: 'Fresh Tunes Hindi',
    curatedPlaylistQuery: 'Fresh Tunes Hindi',
    gradient: 'from-indigo-600/80 via-purple-950/60 to-zinc-950/90',
    badge: 'NEW DROPS',
    description: 'New Bollywood audio drops, singles, and emerging chartbusters.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryDiscoveryDiagnostics {
  category: string;
  type: string;
  provider: string;
  query: string;
  expectedLanguage?: string;
  totalReceived: number;
  validCount: number;
  rejectedCount: number;
  cacheHit: boolean;
}

export class CategoryDiscoveryEngine {
  private static instance: CategoryDiscoveryEngine;
  private cache: Map<string, { data: UnifiedSearchResults; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

  private constructor() {}

  public static getInstance(): CategoryDiscoveryEngine {
    if (!CategoryDiscoveryEngine.instance) {
      CategoryDiscoveryEngine.instance = new CategoryDiscoveryEngine();
    }
    return CategoryDiscoveryEngine.instance;
  }

  /**
   * Get personalized category ordering based on user language preferences
   */
  public getPersonalizedCategories(userLanguage: string = 'Telugu'): {
    languages: RaagaCategory[];
    genres: RaagaCategory[];
    curated: RaagaCategory[];
  } {
    const langLower = userLanguage.toLowerCase();

    // Sort user's language first in languages list
    const languages = [...LANGUAGE_CATEGORIES].sort((a, b) => {
      const aMatch = a.language?.toLowerCase() === langLower;
      const bMatch = b.language?.toLowerCase() === langLower;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });

    // Curated playlists matching user's language ranked first
    const curated = [...CURATED_THEMES].sort((a, b) => {
      const aMatch = a.language?.toLowerCase() === langLower;
      const bMatch = b.language?.toLowerCase() === langLower;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });

    return {
      languages,
      genres: GENRE_MOOD_CATEGORIES,
      curated,
    };
  }

  /**
   * Execute structured discovery with language validation and telemetry
   */
  public async discover(
    category: RaagaCategory,
    userLanguage: string = 'Telugu'
  ): Promise<{ results: UnifiedSearchResults; diagnostics: CategoryDiscoveryDiagnostics }> {
    const cacheKey = `cat_disc_${category.id}_${userLanguage.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      const diagnostics: CategoryDiscoveryDiagnostics = {
        category: category.title,
        type: category.type,
        provider: 'JioSaavn (Memory Cache)',
        query: category.query,
        expectedLanguage: category.language || userLanguage,
        totalReceived: cached.data.songs.length,
        validCount: cached.data.songs.length,
        rejectedCount: 0,
        cacheHit: true,
      };
      return { results: cached.data, diagnostics };
    }

    // Formulate structured search query
    let effectiveQuery = category.query;
    let targetLanguage = category.language;

    if (category.type === 'genre' || category.type === 'mood') {
      // If genre has no strict language, prioritize user's active session language
      effectiveQuery = `${userLanguage} ${category.title} Songs Hits`;
      targetLanguage = userLanguage;
    } else if (category.type === 'trend') {
      effectiveQuery = `${userLanguage} Trending Songs 2026`;
      targetLanguage = userLanguage;
    }

    // Execute provider search through UnifiedSearchEngine
    const rawResults = await UnifiedSearchEngine.getInstance().search(
      effectiveQuery,
      targetLanguage || userLanguage
    );

    // Metadata validation and language guard
    let validSongs: Song[] = [];
    let rejectedCount = 0;

    const songsPool = rawResults.songs || [];
    const expectedLang = targetLanguage ? targetLanguage.toLowerCase() : '';

    if (category.type === 'language' && expectedLang) {
      songsPool.forEach((s) => {
        const songGenre = (s.genre || '').toLowerCase();
        const songTitle = (s.title || '').toLowerCase();
        const songArtist = (s.artist || '').toLowerCase();

        // Validate language match
        const matchesLang =
          songGenre.includes(expectedLang) ||
          songTitle.includes(expectedLang) ||
          songArtist.includes(expectedLang) ||
          // Fallback: If song genre contains other conflicting language, reject
          !this.isConflictingLanguage(songGenre, expectedLang);

        if (matchesLang) {
          validSongs.push(s);
        } else {
          rejectedCount++;
        }
      });
    } else {
      validSongs = songsPool;
    }

    // Deduplicate songs
    const deduplicatedSongs = SongUniquenessEngine.deduplicate(validSongs);

    const finalResults: UnifiedSearchResults = {
      ...rawResults,
      songs: deduplicatedSongs,
      query: effectiveQuery,
    };

    // Cache the validated results
    this.cache.set(cacheKey, { data: finalResults, timestamp: Date.now() });

    const diagnostics: CategoryDiscoveryDiagnostics = {
      category: category.title,
      type: category.type,
      provider: 'JioSaavn',
      query: effectiveQuery,
      expectedLanguage: targetLanguage,
      totalReceived: songsPool.length,
      validCount: deduplicatedSongs.length,
      rejectedCount,
      cacheHit: false,
    };

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[CategoryDiscovery] Category="${category.title}" | Type=${category.type} | Query="${effectiveQuery}" | Received=${songsPool.length} | Valid=${deduplicatedSongs.length} | Rejected=${rejectedCount}`
      );
    }

    return { results: finalResults, diagnostics };
  }

  private isConflictingLanguage(genreText: string, expectedLang: string): boolean {
    const knownLangs = ['telugu', 'tamil', 'hindi', 'kannada', 'malayalam', 'punjabi', 'bengali', 'marathi', 'gujarati', 'bhojpuri', 'english'];
    for (const l of knownLangs) {
      if (l !== expectedLang && genreText.includes(l)) {
        return true;
      }
    }
    return false;
  }
}
