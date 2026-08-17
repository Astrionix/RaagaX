import { Song } from '@/types/music';
import { LocalDatabase } from '@/lib/offline/LocalDatabase';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { LanguageEligibilityEngine } from '@/lib/language/LanguageEligibilityEngine';
import { QueueHistory } from '@/lib/queue/QueueHistory';
import { UserBehaviorTracker, UserEventType } from '@/lib/analytics/UserBehaviorTracker';
import { usePlayerStore } from '@/context/usePlayerStore';

export interface PersonalizedHomeFeed {
  greeting: string;
  continueListening: Song[];
  recentlyPlayed: Song[];
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

export class RecommendationEngine {
  private static instance: RecommendationEngine;

  private constructor() {}

  public static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance) {
      RecommendationEngine.instance = new RecommendationEngine();
    }
    return RecommendationEngine.instance;
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
   * Builds full dynamic personalized Home feed based on listening history & language
   */
  public async getPersonalizedHomeFeed(
    userId: string,
    preferredLanguage: string = ''
  ): Promise<PersonalizedHomeFeed> {
    const storeLangs = usePlayerStore.getState().selectedLanguages;
    const lang = preferredLanguage || (storeLangs && storeLangs.length > 0 ? storeLangs[0] : 'Hindi');
    const musicEngine = RealMusicEngine.getInstance();

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
        if (s && !seen.has(s.id)) {
          seen.add(s.id);
          recentHistorySongs.push(s);
        }
      }
    } catch {}

    // 3. Continue Listening (items recently played or in progress)
    const continueListening = recentHistorySongs.slice(0, 6);
    const recentlyPlayed = recentHistorySongs.slice(0, 15);

    // 4. Determine seed artist / track for "Because You Listened To..."
    let becauseYouListenedTo: PersonalizedHomeFeed['becauseYouListenedTo'] = null;
    const topRecent = recentHistorySongs[0];

    if (topRecent) {
      const seedArtist = topRecent.artist.split(/[,&/]/)[0].trim();
      try {
        const similarSongs = await musicEngine.searchRealSongs(`${seedArtist} ${lang}`, 12);
        const filteredSimilar = similarSongs.filter((s) => s.id !== topRecent.id);
        if (filteredSimilar.length > 0) {
          becauseYouListenedTo = {
            seedSongOrArtist: seedArtist,
            items: filteredSimilar.slice(0, 10),
          };
        }
      } catch {}
    }

    // 5. Compute Top Artists & Top Songs from History & Affinity
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
      .slice(0, 10);

    // 6. Fetch Trending & New Releases for the active language
    const [trendingSongs, newReleases] = await Promise.all([
      musicEngine.getRealTrendingSongs(15, lang).catch(() => []),
      musicEngine.getNewReleases(15, lang).catch(() => []),
    ]);

    // 7. Made For You (Algorithmic blended recommendations)
    const madeForYouPool = await this.getRecommendations(userId, [lang]);
    const madeForYou = madeForYouPool.length > 0 ? madeForYouPool : trendingSongs.slice(0, 10);

    // 8. Generate Daily Mixes
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

    return {
      greeting,
      continueListening,
      recentlyPlayed,
      madeForYou,
      becauseYouListenedTo,
      topArtists,
      topSongs,
      trendingSongs,
      newReleases,
      dailyMixes,
    };
  }

  public async getRecommendations(
    userId: string,
    languages: string[] | string = ['Telugu', 'Tamil', 'Hindi', 'Kannada', 'Malayalam', 'English']
  ): Promise<Song[]> {
    const localDb = LocalDatabase.getInstance();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const langList =
      typeof languages === 'string'
        ? [languages]
        : languages.length > 0
        ? languages
        : ['Telugu', 'Tamil', 'Hindi', 'Kannada', 'Malayalam', 'English'];
    const targetCategory = `personalized_${langList.sort().join('_').toLowerCase()}`;

    // 1. Check local 3-day snapshot
    const cached = await localDb.getUserStore<any>(userId, 'recommendation_snapshot');
    if (cached && cached.expiresAt > now && cached.items && cached.items.length > 0 && cached.category === targetCategory) {
      return cached.items;
    }

    // 2. Fetch fresh candidates across language & affinity
    try {
      const musicEngine = RealMusicEngine.getInstance();
      const candidatePromises = langList.map((l) => {
        const queries = [`${l} Hits`, `Latest ${l} Songs`, `${l} Melodies`, `Trending ${l} Songs`];
        const query = queries[Math.floor(Math.random() * queries.length)];
        return musicEngine.searchRealSongs(query, 20).catch(() => []);
      });

      const candidateLists = await Promise.all(candidatePromises);
      const rawCandidates = candidateLists.flat();

      const eligibleCandidates = await LanguageEligibilityEngine.getInstance().filterCandidates(
        userId,
        rawCandidates,
        'PERSONALIZED_RECOMMENDATION',
        undefined,
        langList
      );

      const shuffled = eligibleCandidates.sort(() => 0.5 - Math.random()).slice(0, 15);

      const snapshot = {
        category: targetCategory,
        items: shuffled,
        generatedAt: now,
        expiresAt: now + THREE_DAYS_MS,
      };

      await localDb.setUserStore(userId, 'recommendation_snapshot', snapshot);
      return shuffled;
    } catch (e) {
      console.warn('[RecommendationEngine] Candidate generation error:', e);
      return [];
    }
  }
}
