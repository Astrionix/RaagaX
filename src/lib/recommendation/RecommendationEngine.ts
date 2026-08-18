import { Song } from '@/types/music';
import { LocalDatabase } from '@/lib/offline/LocalDatabase';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { LanguageEligibilityEngine } from '@/lib/language/LanguageEligibilityEngine';
import { QueueHistory } from '@/lib/queue/QueueHistory';
import { UserBehaviorTracker, UserEventType } from '@/lib/analytics/UserBehaviorTracker';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SongUniquenessEngine } from '@/lib/music/SongUniquenessEngine';
import { NewReleasesEngine } from '@/lib/catalog/NewReleasesEngine';

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

const MIN_RECOMMENDATION_HISTORY = 5;
const NOT_INTERESTED_STORAGE_KEY = 'raagax_not_interested_songs_v1';

export class RecommendationEngine {
  private static instance: RecommendationEngine;
  private feedCacheMap = new Map<string, PersonalizedHomeFeed>();
  private notInterestedSet = new Set<string>();
  private notInterestedLoaded = false;

  private constructor() {}

  public static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance) {
      RecommendationEngine.instance = new RecommendationEngine();
    }
    return RecommendationEngine.instance;
  }

  private loadNotInterested(): void {
    if (this.notInterestedLoaded) return;
    this.notInterestedLoaded = true;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(NOT_INTERESTED_STORAGE_KEY);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            list.forEach((id: string) => this.notInterestedSet.add(id));
          }
        }
      } catch (e) {}
    }
  }

  public markNotInterested(songId: string, reason = 'user_action'): void {
    if (!songId) return;
    this.loadNotInterested();
    this.notInterestedSet.add(songId);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          NOT_INTERESTED_STORAGE_KEY,
          JSON.stringify(Array.from(this.notInterestedSet))
        );
      } catch (e) {}
    }

    this.feedCacheMap.clear();
  }

  public getNotInterestedSet(): Set<string> {
    this.loadNotInterested();
    return this.notInterestedSet;
  }

  public getCachedHomeFeedSnapshot(userId: string, lang: string = ''): PersonalizedHomeFeed | null {
    const key = `${userId}_${lang.toLowerCase()}`;
    if (this.feedCacheMap.has(key)) {
      return this.feedCacheMap.get(key)!;
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`raagax_feed_${key}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.feedCacheMap.set(key, parsed);
          return parsed;
        }
      } catch {}
    }
    return null;
  }

  /**
   * Track user engagement event (played, completed, skipped, liked, downloaded)
   */
  public async trackEngagement(
    song: Song,
    action: 'play' | 'complete' | 'skip' | 'like' | 'unlike' | 'download' | 'playlist_add',
    positionSec?: number,
    completionRatio?: number,
    context?: string,
    skipTimestampSec?: number
  ): Promise<void> {
    if (!song || !song.id) return;

    try {
      const { useAuthStore } = await import('@/context/useAuthStore');
      const userId = useAuthStore.getState().user?.id || 'guest';

      let eventType: UserEventType = 'PLAY';
      if (action === 'complete') eventType = 'COMPLETE';
      else if (action === 'skip') eventType = 'SKIP';
      else if (action === 'like') eventType = 'LIKE';
      else if (action === 'unlike') eventType = 'UNLIKE';
      else if (action === 'playlist_add') eventType = 'ADD_TO_PLAYLIST';

      await UserBehaviorTracker.getInstance().trackEvent(userId, {
        event_type: eventType,
        song_id: song.id,
        artist_id: song.artistId || song.artist,
        language: (song as any)?.language || song.genre,
        genre: song.genre,
        metadata: {
          positionSec,
          completionRatio,
          context,
          skipTimestampSec,
        },
      });
    } catch (e) {
      console.warn('[RecommendationEngine] Track engagement error:', e);
    }
  }

  /**
   * Generates dynamic contextual recommendations specifically for a seed song (e.g. currentSong).
   * Caches per seedSong.id and userId for instantaneous reuse.
   */
  public async getContextualRecommendations(
    seedSong: Song,
    userId = 'user',
    limit = 25
  ): Promise<Song[]> {
    if (!seedSong || !seedSong.id) return [];
    this.loadNotInterested();

    const cacheKey = `raagax_context_recs_${userId}_${seedSong.id}`;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const filtered = parsed.filter((s: Song) => s.id !== seedSong.id && !this.notInterestedSet.has(s.id));
            if (filtered.length >= 4) return filtered.slice(0, limit);
          }
        }
      } catch {}
    }

    const musicEngine = RealMusicEngine.getInstance();
    const primaryArtist = seedSong.artist ? seedSong.artist.split(/[,&/]/)[0].trim() : '';
    const songLang = seedSong.language || 'Telugu';

    const queries: string[] = [
      primaryArtist ? `${primaryArtist} ${songLang} hits` : null,
      seedSong.title ? `similar to ${seedSong.title}` : null,
      seedSong.album ? `${seedSong.album} songs` : null,
      primaryArtist ? `${primaryArtist} best songs` : null,
    ].filter(Boolean) as string[];

    try {
      const results = await Promise.all(
        queries.map(q => musicEngine.searchRealSongs(q, 15).catch(() => []))
      );

      const candidatePool: Song[] = [];
      results.forEach(res => candidatePool.push(...res));

      // Strictly exclude seedSong.id and Not Interested songs
      const excludedIds = new Set<string>([
        seedSong.id,
        ...Array.from(this.notInterestedSet),
      ]);

      const deduplicated = SongUniquenessEngine.deduplicate(candidatePool, [seedSong]);
      const filtered = deduplicated.filter(s => !excludedIds.has(s.id));

      // Apply artist diversity (max 2 tracks per artist)
      const artistCounts = new Map<string, number>();
      const ranked: Song[] = [];

      for (const s of filtered) {
        const artKey = (s.artist || 'unknown').split(/[,&/]/)[0].trim().toLowerCase();
        const count = artistCounts.get(artKey) || 0;
        if (count < 2) {
          ranked.push(s);
          artistCounts.set(artKey, count + 1);
        }
        if (ranked.length >= limit) break;
      }

      if (ranked.length > 0 && typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(ranked));
        } catch {}
      }

      return ranked;
    } catch (err) {
      console.warn('[RecommendationEngine] getContextualRecommendations error:', err);
      return [];
    }
  }

  /**
   * Builds full dynamic personalized Home feed based on listening history & language
   */
  public async getPersonalizedHomeFeed(
    userId: string,
    preferredLanguage: string = ''
  ): Promise<PersonalizedHomeFeed> {
    this.loadNotInterested();
    const storeLangs = usePlayerStore.getState().selectedLanguages;
    const lang = preferredLanguage || (storeLangs && storeLangs.length > 0 ? storeLangs[0] : 'Hindi');
    const musicEngine = RealMusicEngine.getInstance();
    const currentPlayingSong = usePlayerStore.getState().currentSong;

    // 1. Greeting
    const hour = new Date().getHours();
    const greeting =
      hour < 12
        ? 'Good morning'
        : hour < 17
        ? 'Good afternoon'
        : hour < 21
        ? 'Good evening'
        : 'Good night';

    // 2. Fetch listening history from QueueHistory
    let recentHistorySongs: Song[] = [];
    try {
      const historyInstance = QueueHistory.getInstance();
      await historyInstance.ensureLoaded();
      const historyEntries = historyInstance.getRecentlyPlayed(40);
      const seen = new Set<string>();
      for (let i = historyEntries.length - 1; i >= 0; i--) {
        const s = historyEntries[i].song;
        if (s && !seen.has(s.id) && !this.notInterestedSet.has(s.id)) {
          seen.add(s.id);
          recentHistorySongs.push(s);
        }
      }
    } catch {}

    // 3. Continue Listening (items recently played or in progress)
    const continueListening = recentHistorySongs.slice(0, 6);
    const recentlyPlayed = recentHistorySongs.slice(0, 15);

    // 4. "MORE LIKE WHAT YOU HEARD" — Dynamic Personalized Recommendation Shelf
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

    // 5. Seed artist / track for "Because You Listened To..."
    let becauseYouListenedTo: PersonalizedHomeFeed['becauseYouListenedTo'] = null;
    const topRecent = recentHistorySongs[0];

    if (topRecent) {
      const seedArtist = topRecent.artist.split(/[,&/]/)[0].trim();
      try {
        const similarSongs = await musicEngine.searchRealSongs(`${seedArtist} ${lang}`, 20);
        const uniqueSimilar = SongUniquenessEngine.deduplicate(similarSongs, [topRecent]);
        const cleanList = uniqueSimilar.filter(s => !this.notInterestedSet.has(s.id));
        if (cleanList.length > 0) {
          becauseYouListenedTo = {
            seedSongOrArtist: seedArtist,
            items: cleanList.slice(0, 10),
          };
        }
      } catch {}
    }

    // 6. Compute Top Artists & Top Songs from History & Affinity
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
      .filter(s => !this.notInterestedSet.has(s.id))
      .slice(0, 10);

    // 7. Fetch Trending for active language & Strict Language New Releases
    const [trendingSongs, newReleases] = await Promise.all([
      musicEngine.getRealTrendingSongs(15, lang).catch(() => []),
      NewReleasesEngine.getInstance().getNewReleasesForLanguage(lang, 15).catch(() => []),
    ]);

    // 8. Made For You (Algorithmic blended recommendations)
    const madeForYouPool = await this.getRecommendations(userId, [lang]);
    const madeForYou = madeForYouPool.length > 0
      ? madeForYouPool.filter(s => !this.notInterestedSet.has(s.id))
      : trendingSongs.slice(0, 10);

    // 9. Generate Daily Mixes
    const dailyMixes = [
      {
        id: `daily-mix-1-${lang.toLowerCase()}`,
        title: `Daily Mix 1`,
        description: `${topArtists[0]?.name || 'Top Artists'} & ${lang} Melodies`,
        coverUrl: topArtists[0]?.coverUrl || trendingSongs[0]?.coverUrl || '/app-icon.png',
        songs: madeForYou.slice(0, 10),
      },
      {
        id: `daily-mix-2-${lang.toLowerCase()}`,
        title: `Daily Mix 2`,
        description: `Trending ${lang} Hits & New Vibes`,
        coverUrl: trendingSongs[1]?.coverUrl || newReleases[0]?.coverUrl || '/app-icon.png',
        songs: trendingSongs.slice(0, 10),
      },
      {
        id: `daily-mix-3-${lang.toLowerCase()}`,
        title: `Daily Mix 3`,
        description: `Energetic ${lang} Beats & Favorites`,
        coverUrl: newReleases[1]?.coverUrl || trendingSongs[2]?.coverUrl || '/app-icon.png',
        songs: newReleases.slice(0, 10),
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

    const key = `${userId}_${lang.toLowerCase()}`;
    this.feedCacheMap.set(key, result);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`raagax_feed_${key}`, JSON.stringify(result));
      } catch {}
    }

    return result;
  }

  public async getRecommendations(userId: string, languages: string[] = ['Telugu']): Promise<Song[]> {
    this.loadNotInterested();
    try {
      const { CandidateGenerator } = await import('./CandidateGenerator');
      const { Ranker } = await import('./Ranker');
      const currentTrack = usePlayerStore.getState().currentSong;
      const targetLang = languages[0] || 'Telugu';

      const candidates = await CandidateGenerator.generateCandidates(currentTrack, [], targetLang, 30, userId);
      const ranked = Ranker.rankCandidates(candidates, [], 15);
      return ranked.filter(s => !this.notInterestedSet.has(s.id));
    } catch (err) {
      console.warn('[RecommendationEngine] Failed to generate algorithm recommendations:', err);
      return [];
    }
  }
}
