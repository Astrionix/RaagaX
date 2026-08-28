'use client';

import { Song } from '@/types/music';
import { supabase } from '@/lib/supabase';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { LanguageEligibilityEngine } from '@/lib/language/LanguageEligibilityEngine';
import { QueueHistory } from '@/lib/queue/QueueHistory';
import { SongUniquenessEngine } from '@/lib/music/SongUniquenessEngine';
import { NewReleasesEngine } from '@/lib/catalog/NewReleasesEngine';
import { AppCacheDB } from '@/lib/cache/AppCacheDB';
import { usePlayerStore } from '@/context/usePlayerStore';

export interface UserTasteProfile {
  artistScores: Record<string, number>;
  genreScores: Record<string, number>;
  languageScores: Record<string, number>;
  playCounts: Record<string, number>;
  skipCounts: Record<string, number>;
  lastPlayedAt: Record<string, number>;
  lastSongId?: string;
  lastArtist?: string;
  lastGenre?: string;
}

export interface PersonalizedHomeFeed {
  greeting: string;
  continueListening: Song[];
  recentlyPlayed: Song[];
  moreLikeWhatYouHeard: {
    seedSongTitle?: string;
    seedSong?: Song;
    items: Song[];
  } | null;
  madeForYou: Song[];
  becauseYouListenedTo: {
    seedSongOrArtist: string;
    items: Song[];
  } | null;
  topArtists: Array<{ name: string; coverUrl: string; playCount: number; id: string }>;
  topSongs: Song[];
  trendingSongs: Song[];
  newReleases: Song[];
  dailyMixes: Array<{
    id: string;
    title: string;
    description: string;
    coverUrl: string;
    songs: Song[];
  }>;
}

// Configurable central weights
export const RANKING_WEIGHTS = {
  artistAffinity: 1.5,
  genreAffinity: 1.2,
  languageAffinity: 2.0,
  freshness: 0.8,
  popularity: 0.3,
  followedArtistBoost: 2.0,
  skipPenalty: -2.5,
  repetitionPenalty: -2.0,
};

// Signal impact increments
export const SIGNAL_IMPACT = {
  like: 12,
  playlistAdd: 8,
  replay: 6,
  complete: 5,
  play: 2,
  search: 2,
  partialPlay: 1,
  skip: -5,
};

const TASTE_PROFILE_KEY = 'raagax_personalization_profile_v2';
const NOT_INTERESTED_KEY = 'raagax_not_interested_songs_v1';

export class PersonalizationEngine {
  private static instance: PersonalizationEngine;

  public static configureWeights(customWeights: Partial<typeof RANKING_WEIGHTS>) {
    Object.assign(RANKING_WEIGHTS, customWeights);
  }

  private tasteProfile: UserTasteProfile = {
    artistScores: {},
    genreScores: {},
    languageScores: {},
    playCounts: {},
    skipCounts: {},
    lastPlayedAt: {},
  };

  // Current session intent: temporary boosts decay over time or reset
  private sessionIntent: {
    artists: Record<string, { score: number; timestamp: number }>;
    genres: Record<string, { score: number; timestamp: number }>;
    languages: Record<string, { score: number; timestamp: number }>;
  } = {
    artists: {},
    genres: {},
    languages: {},
  };

  private notInterestedSongs = new Set<string>();
  private initialLoaded = false;
  private feedCache = new Map<string, PersonalizedHomeFeed>();

  private constructor() {
    this.initProfile();
  }

  public static getInstance(): PersonalizationEngine {
    if (!PersonalizationEngine.instance) {
      PersonalizationEngine.instance = new PersonalizationEngine();
    }
    return PersonalizationEngine.instance;
  }

  private initProfile() {
    if (typeof window === 'undefined') return;
    try {
      // 1. Load taste profile from L2 localStorage cache
      const storedProfile = localStorage.getItem(TASTE_PROFILE_KEY);
      if (storedProfile) {
        this.tasteProfile = { ...this.tasteProfile, ...JSON.parse(storedProfile) };
      }

      // 2. Load "Not Interested" ids
      const storedNotInterested = localStorage.getItem(NOT_INTERESTED_KEY);
      if (storedNotInterested) {
        const list = JSON.parse(storedNotInterested);
        if (Array.isArray(list)) {
          list.forEach((id) => this.notInterestedSongs.add(id));
        }
      }

      this.initialLoaded = true;

      // 3. Trigger background sync with Supabase profiles
      this.syncTasteProfileWithServer().catch(() => {});
    } catch (e) {
      console.warn('[PersonalizationEngine] Failed to initialize profiles:', e);
    }
  }

  private saveTasteProfile() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(TASTE_PROFILE_KEY, JSON.stringify(this.tasteProfile));
    } catch (e) {
      console.warn('[PersonalizationEngine] Failed to save taste profile:', e);
    }
  }

  /**
   * Sync local profile weights with Supabase tables asynchronously
   */
  private async syncTasteProfileWithServer(): Promise<void> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      // Load server affinities to boost local taste profile
      const [artistRes, genreRes, langRes] = await Promise.all([
        supabase.from('user_artist_affinity').select('artist_id, score').eq('user_id', userId).limit(50),
        supabase.from('user_genre_affinity').select('genre, score').eq('user_id', userId).limit(30),
        supabase.from('user_language_affinity').select('language, score').eq('user_id', userId).limit(10),
      ]);

      let changed = false;

      if (artistRes.data) {
        artistRes.data.forEach((row: any) => {
          const cleanId = String(row.artist_id);
          const current = this.tasteProfile.artistScores[cleanId] || 0;
          if (row.score > current) {
            this.tasteProfile.artistScores[cleanId] = row.score;
            changed = true;
          }
        });
      }

      if (genreRes.data) {
        genreRes.data.forEach((row: any) => {
          const cleanGenre = String(row.genre);
          const current = this.tasteProfile.genreScores[cleanGenre] || 0;
          if (row.score > current) {
            this.tasteProfile.genreScores[cleanGenre] = row.score;
            changed = true;
          }
        });
      }

      if (langRes.data) {
        langRes.data.forEach((row: any) => {
          const cleanLang = String(row.language);
          const current = this.tasteProfile.languageScores[cleanLang] || 0;
          if (row.score > current) {
            this.tasteProfile.languageScores[cleanLang] = row.score;
            changed = true;
          }
        });
      }

      if (changed) {
        this.saveTasteProfile();
        this.feedCache.clear();
      }
    } catch {}
  }

  /**
   * Tracks user playback actions and updates local scores & queues server-side telemetry.
   */
  public async trackEngagement(
    song: Song,
    action: 'play' | 'complete' | 'skip' | 'like' | 'unlike' | 'download' | 'playlist_add' | 'search',
    positionSec = 0,
    completionRatio = 0,
    context = 'home',
    skipTimestampSec?: number
  ): Promise<void> {
    if (!song || !song.id) return;

    const artist = song.artist || 'Unknown Artist';
    const firstArtist = artist.split(/[,&/]/)[0].trim();
    const artistId = song.artistId || firstArtist;
    const genre = song.genre || 'Hits';
    const lang = song.language || 'Telugu';

    // 1. Calculate Score Delta based on event weight
    let scoreDelta = 0;
    switch (action) {
      case 'like':
        scoreDelta = SIGNAL_IMPACT.like;
        break;
      case 'unlike':
        scoreDelta = SIGNAL_IMPACT.skip;
        break;
      case 'playlist_add':
        scoreDelta = SIGNAL_IMPACT.playlistAdd;
        break;
      case 'complete':
        scoreDelta = SIGNAL_IMPACT.complete;
        break;
      case 'play':
        scoreDelta = SIGNAL_IMPACT.play;
        break;
      case 'skip':
        scoreDelta = SIGNAL_IMPACT.skip;
        break;
      case 'search':
        scoreDelta = SIGNAL_IMPACT.search;
        break;
      default:
        scoreDelta = SIGNAL_IMPACT.partialPlay;
    }

    // Adjust score based on completion ratio
    if (action === 'play' && completionRatio >= 0.8) {
      scoreDelta += SIGNAL_IMPACT.complete;
    }

    // 2. Update Taste Profile
    this.tasteProfile.artistScores[artistId] = Math.max(0, (this.tasteProfile.artistScores[artistId] || 0) + scoreDelta);
    this.tasteProfile.genreScores[genre] = Math.max(0, (this.tasteProfile.genreScores[genre] || 0) + (scoreDelta * 0.8));
    this.tasteProfile.languageScores[lang] = Math.max(0, (this.tasteProfile.languageScores[lang] || 0) + (scoreDelta * 0.5));

    if (action === 'play') {
      this.tasteProfile.playCounts[song.id] = (this.tasteProfile.playCounts[song.id] || 0) + 1;
      this.tasteProfile.lastPlayedAt[song.id] = Date.now();
      this.tasteProfile.lastSongId = song.id;
      this.tasteProfile.lastArtist = artistId;
      this.tasteProfile.lastGenre = genre;

      // Update in-memory session intent (expires/decays after 15 mins)
      const now = Date.now();
      this.sessionIntent.artists[artistId] = { score: 10, timestamp: now };
      this.sessionIntent.genres[genre] = { score: 8, timestamp: now };
      this.sessionIntent.languages[lang] = { score: 5, timestamp: now };
    } else if (action === 'skip') {
      this.tasteProfile.skipCounts[song.id] = (this.tasteProfile.skipCounts[song.id] || 0) + 1;
    }

    this.saveTasteProfile();

    // 3. Batch and write non-blocking telemetry event to Supabase
    try {
      const { UserBehaviorTracker } = await import('@/lib/analytics/UserBehaviorTracker');
      const { useAuthStore } = await import('@/context/useAuthStore');
      const userId = useAuthStore.getState().user?.id || 'guest';

      let eventType = 'PLAY';
      if (action === 'complete') eventType = 'COMPLETE';
      else if (action === 'skip') eventType = 'SKIP';
      else if (action === 'like') eventType = 'LIKE';
      else if (action === 'unlike') eventType = 'UNLIKE';
      else if (action === 'playlist_add') eventType = 'ADD_TO_PLAYLIST';
      else if (action === 'search') eventType = 'SEARCH';

      // Record behavior locally & queue upload
      UserBehaviorTracker.getInstance().trackEvent(userId, {
        event_type: eventType as any,
        song_id: song.id,
        artist_id: artistId,
        language: lang,
        genre: genre,
        position_ms: positionSec * 1000,
        duration_ms: (song.duration || 180) * 1000,
        metadata: {
          context,
          completionRatio,
          skipTimestampSec,
        },
      });
    } catch {}
  }

  /**
   * Computes personalized score for a track using configurable weights and recency.
   */
  public scoreTrack(song: Song): number {
    if (!song || !song.id || this.notInterestedSongs.has(song.id)) {
      return -9999;
    }

    let score = 0;
    const artist = song.artist || '';
    const firstArtist = artist.split(/[,&/]/)[0].trim();
    const artistId = song.artistId || firstArtist;
    const genre = song.genre || 'Hits';
    const lang = song.language || 'Telugu';

    // 1. Long-Term Artist Affinity
    const artistScore = this.tasteProfile.artistScores[artistId] || 0;
    score += artistScore * RANKING_WEIGHTS.artistAffinity;

    // 2. Long-Term Genre Affinity
    const genreScore = this.tasteProfile.genreScores[genre] || 0;
    score += genreScore * RANKING_WEIGHTS.genreAffinity;

    // 3. Long-Term Language Affinity
    const langScore = this.tasteProfile.languageScores[lang] || 0;
    score += langScore * RANKING_WEIGHTS.languageAffinity;

    // 4. Session Intent Boost (Decays over 15 mins)
    const now = Date.now();
    const fifteenMins = 15 * 60 * 1000;

    const sessionArtist = this.sessionIntent.artists[artistId];
    if (sessionArtist && now - sessionArtist.timestamp < fifteenMins) {
      const decay = 1 - (now - sessionArtist.timestamp) / fifteenMins;
      score += sessionArtist.score * decay * 2.0;
    }

    const sessionGenre = this.sessionIntent.genres[genre];
    if (sessionGenre && now - sessionGenre.timestamp < fifteenMins) {
      const decay = 1 - (now - sessionGenre.timestamp) / fifteenMins;
      score += sessionGenre.score * decay * 1.5;
    }

    // 5. Freshness / Release Year (Qualifies recent songs)
    const currentYear = new Date().getFullYear();
    const releaseYear = song.releaseYear || currentYear;
    if (releaseYear >= currentYear - 1) {
      score += 15 * RANKING_WEIGHTS.freshness;
    } else if (releaseYear >= currentYear - 3) {
      score += 5 * RANKING_WEIGHTS.freshness;
    }

    // 6. Popularity Score (Normalized 0-100 baseline)
    const pop = song.popularity || song.plays || 50;
    const popNorm = Math.min(100, Math.max(0, pop));
    score += (popNorm / 10) * RANKING_WEIGHTS.popularity;

    // 7. Followed Artist Boost
    const followedArtistIds = usePlayerStore.getState().favoriteArtistIds || [];
    const isFollowed = followedArtistIds.includes(artistId) ||
      followedArtistIds.some(id => artist.toLowerCase().includes(id.toLowerCase()));
    if (isFollowed) {
      score += 25 * RANKING_WEIGHTS.followedArtistBoost;
    }

    // 8. Skip Penalty
    const skipCount = this.tasteProfile.skipCounts[song.id] || 0;
    if (skipCount > 0) {
      score += skipCount * RANKING_WEIGHTS.skipPenalty * 4;
    }

    // 9. Recency / Repetition Penalty (Avoids repeating recently played items)
    const lastPlayed = this.tasteProfile.lastPlayedAt[song.id];
    if (lastPlayed) {
      const timeDiff = now - lastPlayed;
      const oneHour = 60 * 60 * 1000;
      if (timeDiff < oneHour) {
        // Heavy penalty if played in the last hour
        const decay = 1 - timeDiff / oneHour;
        score += RANKING_WEIGHTS.repetitionPenalty * 40 * decay;
      }
    }

    return score;
  }

  /**
   * Deterministically ranks list of songs with tie-breakers and diversity controls.
   */
  public rankSongs(candidates: Song[], limit = 30): Song[] {
    // 1. Deduplicate by canonical identity (title + artist)
    const deduplicated = SongUniquenessEngine.deduplicate(candidates, []);

    // 2. Score each candidate
    const scored = deduplicated.map((song) => {
      const score = this.scoreTrack(song);
      return { song, score };
    });

    // 3. Stable sorting: descending by score, tie-breaker on ID to prevent async replacement jumps
    scored.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.01) {
        return b.score - a.score;
      }
      return a.song.id.localeCompare(b.song.id);
    });

    // 4. Enforce Controlled Diversity (max 2 consecutive tracks from the same artist/album)
    const result: Song[] = [];
    const artistCounts = new Map<string, number>();
    const albumCounts = new Map<string, number>();

    // Keep track of candidates pushed to reserve list if they violate diversity
    const reservePool: { song: Song; score: number }[] = [];

    for (const item of scored) {
      if (result.length >= limit) break;

      const artist = (item.song.artist || 'Unknown').split(/[,&/]/)[0].trim().toLowerCase();
      const album = (item.song.album || 'Unknown').trim().toLowerCase();

      const artCount = artistCounts.get(artist) || 0;
      const albCount = albumCounts.get(album) || 0;

      if (artCount < 2 && albCount < 2) {
        result.push(item.song);
        artistCounts.set(artist, artCount + 1);
        albumCounts.set(album, albCount + 1);
      } else {
        reservePool.push(item);
      }
    }

    // Refill from reserve if limit not reached
    for (const item of reservePool) {
      if (result.length >= limit) break;
      if (!result.some((s) => s.id === item.song.id)) {
        result.push(item.song);
      }
    }

    return result;
  }

  /**
   * Generate customized contextual recommendations specifically for a seed song (AUTOPLAY queue refill).
   */
  public async getContextualRecommendations(seedSong: Song, userId = 'guest', limit = 20): Promise<Song[]> {
    if (!seedSong || !seedSong.id) return [];

    const cacheKey = `recs_${userId}_${seedSong.id}`;
    try {
      const cached = await AppCacheDB.getInstance().getRecommendations<Song[]>(cacheKey);
      if (Array.isArray(cached) && cached.length >= 4) {
        const filtered = cached.filter((s) => s.id !== seedSong.id && !this.notInterestedSongs.has(s.id));
        if (filtered.length >= 4) return this.rankSongs(filtered, limit);
      }
    } catch {}

    const musicEngine = RealMusicEngine.getInstance();
    const primaryArtist = seedSong.artist ? seedSong.artist.split(/[,&/]/)[0].trim() : '';
    const songLang = seedSong.language || 'Telugu';

    const queries = [
      primaryArtist ? `${primaryArtist} ${songLang} hits` : null,
      seedSong.title ? `similar to ${seedSong.title}` : null,
      seedSong.album ? `${seedSong.album} songs` : null,
    ].filter(Boolean) as string[];

    try {
      const results = await Promise.all(
        queries.map((q) => musicEngine.searchRealSongs(q, 15).catch(() => []))
      );

      const candidatePool: Song[] = [];
      results.forEach((res) => candidatePool.push(...res));

      const cleanPool = candidatePool.filter(
        (s) => s.id !== seedSong.id && !this.notInterestedSongs.has(s.id)
      );

      const ranked = this.rankSongs(cleanPool, limit);

      if (ranked.length > 0) {
        AppCacheDB.getInstance().setRecommendations(cacheKey, ranked).catch(() => {});
      }

      return ranked;
    } catch (err) {
      console.warn('[PersonalizationEngine] getContextualRecommendations error:', err);
      return [];
    }
  }

  /**
   * Dynamic Personalization for Home Feed sections
   */
  public async getPersonalizedHomeFeed(userId: string, preferredLanguage = ''): Promise<PersonalizedHomeFeed> {
    const storeLangs = usePlayerStore.getState().selectedLanguages;
    const lang = preferredLanguage || (storeLangs && storeLangs.length > 0 ? storeLangs[0] : 'Telugu');
    const musicEngine = RealMusicEngine.getInstance();
    const currentPlayingSong = usePlayerStore.getState().currentSong;

    const cacheKey = `${userId}_${lang.toLowerCase()}`;

    // 1. Define greetings
    const hour = new Date().getHours();
    const greeting =
      hour < 12
        ? 'Good morning'
        : hour < 17
        ? 'Good afternoon'
        : hour < 21
        ? 'Good evening'
        : 'Good night';

    // 2. Fetch history songs
    let recentHistorySongs: Song[] = [];
    try {
      const historyInstance = QueueHistory.getInstance();
      await historyInstance.ensureLoaded();
      const historyEntries = historyInstance.getRecentlyPlayed(40);
      const seen = new Set<string>();
      for (let i = historyEntries.length - 1; i >= 0; i--) {
        const s = historyEntries[i].song;
        if (s && !seen.has(s.id) && !this.notInterestedSongs.has(s.id)) {
          seen.add(s.id);
          recentHistorySongs.push(s);
        }
      }
    } catch {}

    const continueListening = recentHistorySongs.slice(0, 6);
    const recentlyPlayed = recentHistorySongs.slice(0, 15);

    // 3. Contextual recommendation shelf
    let moreLikeWhatYouHeard: PersonalizedHomeFeed['moreLikeWhatYouHeard'] = null;
    const activeSeedSong = currentPlayingSong || recentHistorySongs[0];

    if (activeSeedSong) {
      const contextualList = await this.getContextualRecommendations(activeSeedSong, userId, 15);
      if (contextualList.length >= 3) {
        moreLikeWhatYouHeard = {
          seedSongTitle: activeSeedSong.title,
          seedSong: activeSeedSong,
          items: contextualList,
        };
      }
    }

    // 4. "Because you listened to..."
    let becauseYouListenedTo: PersonalizedHomeFeed['becauseYouListenedTo'] = null;
    const topRecent = recentHistorySongs[0];

    if (topRecent) {
      const seedArtist = topRecent.artist.split(/[,&/]/)[0].trim();
      try {
        const similarSongs = await musicEngine.searchRealSongs(`${seedArtist} ${lang}`, 20);
        const cleanList = similarSongs.filter((s) => !this.notInterestedSongs.has(s.id) && s.id !== topRecent.id);
        const ranked = this.rankSongs(cleanList, 10);
        if (ranked.length > 0) {
          becauseYouListenedTo = {
            seedSongOrArtist: seedArtist,
            items: ranked,
          };
        }
      } catch {}
    }

    // 5. Top Artists & Songs calculations
    const artistPlayCounts: Record<string, { count: number; coverUrl: string; id: string }> = {};
    const songPlayCounts: Record<string, { count: number; song: Song }> = {};

    for (const song of recentHistorySongs) {
      if (song.artist) {
        const primaryArtist = song.artist.split(/[,&/]/)[0].trim();
        if (!artistPlayCounts[primaryArtist]) {
          artistPlayCounts[primaryArtist] = {
            count: 0,
            coverUrl: song.coverUrl,
            id: song.artistId || `art-${primaryArtist.toLowerCase().replace(/\s+/g, '-')}`,
          };
        }
        artistPlayCounts[primaryArtist].count += 1;
      }

      if (!songPlayCounts[song.id]) {
        songPlayCounts[song.id] = { count: 0, song };
      }
      songPlayCounts[song.id].count += 1;
    }

    const topArtists = Object.entries(artistPlayCounts)
      .map(([name, data]) => ({ name, coverUrl: data.coverUrl, playCount: data.count, id: data.id }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 8);

    const topSongs = Object.values(songPlayCounts)
      .map((entry) => entry.song)
      .filter((s) => !this.notInterestedSongs.has(s.id))
      .slice(0, 10);

    // 6. Fetch Trending & New Releases (silently in background)
    const [trendingSongs, newReleases] = await Promise.all([
      musicEngine.getRealTrendingSongs(15, lang).catch(() => []),
      NewReleasesEngine.getInstance().getNewReleasesForLanguage(lang, 15).catch(() => []),
    ]);

    // Made For You: Algorithmic blend ranked strictly by PersonalizationEngine
    const candidates = [...trendingSongs, ...newReleases, ...recentHistorySongs];
    const madeForYou = this.rankSongs(candidates, 12);

    const dailyMixes = [
      {
        id: `daily-mix-1-${lang.toLowerCase()}`,
        title: `Daily Mix 1`,
        description: `${topArtists[0]?.name || 'Your Favorites'} & ${lang} Melodies`,
        coverUrl: topArtists[0]?.coverUrl || trendingSongs[0]?.coverUrl || '/app-icon.png',
        songs: madeForYou.slice(0, 10),
      },
      {
        id: `daily-mix-2-${lang.toLowerCase()}`,
        title: `Daily Mix 2`,
        description: `Trending ${lang} Hits & Fresh Vibes`,
        coverUrl: trendingSongs[1]?.coverUrl || newReleases[0]?.coverUrl || '/app-icon.png',
        songs: this.rankSongs(trendingSongs, 10),
      },
      {
        id: `daily-mix-3-${lang.toLowerCase()}`,
        title: `Daily Mix 3`,
        description: `Energetic ${lang} Beats & Recents`,
        coverUrl: newReleases[1]?.coverUrl || trendingSongs[2]?.coverUrl || '/app-icon.png',
        songs: this.rankSongs(newReleases, 10),
      },
    ];

    const result: PersonalizedHomeFeed = {
      greeting,
      continueListening,
      recentlyPlayed,
      moreLikeWhatYouHeard,
      madeForYou,
      becauseYouListenedTo,
      topArtists,
      topSongs,
      trendingSongs,
      newReleases,
      dailyMixes,
    };

    this.feedCache.set(cacheKey, result);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`raagax_feed_${cacheKey}`, JSON.stringify(result));
      } catch {}
    }

    return result;
  }

  public getCachedHomeFeedSnapshot(userId: string, lang = ''): PersonalizedHomeFeed | null {
    const key = `${userId}_${lang.toLowerCase()}`;
    if (this.feedCache.has(key)) {
      return this.feedCache.get(key)!;
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(`raagax_feed_${key}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.feedCache.set(key, parsed);
          return parsed;
        }
      } catch {}
    }
    return null;
  }

  public markNotInterested(songId: string): void {
    if (!songId) return;
    this.notInterestedSongs.add(songId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          NOT_INTERESTED_KEY,
          JSON.stringify(Array.from(this.notInterestedSongs))
        );
      } catch {}
    }
    this.feedCache.clear();
  }

  public getNotInterestedSet(): Set<string> {
    return this.notInterestedSongs;
  }
}
