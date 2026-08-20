import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ListeningDnaEngine } from '../lifecycle/ListeningDnaEngine';
import { Ranker } from './Ranker';
import { CandidateSong } from './CandidateGenerator';

export interface SmartMix {
  id: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  category: 'daily' | 'language' | 'mood' | 'artist' | 'discovery';
  songs: Song[];
}

export class SmartMixEngine {
  private static instance: SmartMixEngine;

  private constructor() {}

  public static getInstance(): SmartMixEngine {
    if (!SmartMixEngine.instance) {
      SmartMixEngine.instance = new SmartMixEngine();
    }
    return SmartMixEngine.instance;
  }

  /**
   * Generates dynamic smart mixes based on user's Listening DNA, Follows, and History.
   */
  public generateMixes(candidatePool: Song[]): SmartMix[] {
    const store = usePlayerStore.getState();
    const preferredLang = store.preferredLanguage || 'Telugu';
    const likedSongs = store.likedSongs || [];
    const favoriteArtistIds = store.favoriteArtistIds || [];

    if (!candidatePool || candidatePool.length === 0) {
      return [];
    }

    const mixes: SmartMix[] = [];

    // 1. My Mix (Daily personalized blend)
    const myMixSongs = this.buildMyMix(candidatePool, likedSongs, favoriteArtistIds);
    if (myMixSongs.length > 0) {
      mixes.push({
        id: 'smart_my_mix',
        title: 'My Mix',
        subtitle: 'Your daily personalized blend of favorites & fresh finds',
        coverUrl: myMixSongs[0]?.coverUrl || '/app-icon.png',
        category: 'daily',
        songs: myMixSongs,
      });
    }

    // 2. Language Melody Mix (e.g. Telugu Melody Mix)
    const langMelodySongs = candidatePool
      .filter((s) => {
        const lang = (s.language || s.genre || '').toLowerCase();
        return lang.includes(preferredLang.toLowerCase());
      })
      .slice(0, 25);

    if (langMelodySongs.length > 0) {
      mixes.push({
        id: `smart_${preferredLang.toLowerCase()}_mix`,
        title: `${preferredLang} Mix`,
        subtitle: `Top hits and discoveries in ${preferredLang}`,
        coverUrl: langMelodySongs[0]?.coverUrl || '/app-icon.png',
        category: 'language',
        songs: langMelodySongs,
      });
    }

    // 3. Chill & Lo-fi Mix
    const chillSongs = candidatePool
      .filter((s) => {
        const genre = (s.genre || '').toLowerCase();
        return genre.includes('chill') || genre.includes('lo-fi') || genre.includes('melody') || genre.includes('acoustic');
      })
      .slice(0, 25);

    if (chillSongs.length > 0) {
      mixes.push({
        id: 'smart_chill_mix',
        title: 'Chill & Acoustic Mix',
        subtitle: 'Relaxed melodies and calm vibes for work or unwinding',
        coverUrl: chillSongs[0]?.coverUrl || '/app-icon.png',
        category: 'mood',
        songs: chillSongs,
      });
    }

    // 4. Favorite Artists Mix
    if (favoriteArtistIds.length > 0) {
      const artistSongs = candidatePool
        .filter((s) => {
          const artistName = (s.artist || '').toLowerCase();
          const artistId = s.artistId || '';
          return favoriteArtistIds.some((fav) => fav === artistId || artistName.includes(fav.toLowerCase()));
        })
        .slice(0, 25);

      if (artistSongs.length > 0) {
        mixes.push({
          id: 'smart_artists_mix',
          title: 'Favorite Artists Mix',
          subtitle: 'Continuous hits from the artists you follow',
          coverUrl: artistSongs[0]?.coverUrl || '/app-icon.png',
          category: 'artist',
          songs: artistSongs,
        });
      }
    }

    // 5. Late Night Mix
    const timeOfDay = ListeningDnaEngine.getInstance().getTimeOfDay();
    if (timeOfDay === 'evening' || timeOfDay === 'night') {
      const lateNightSongs = candidatePool.slice(0, 25).sort(() => Math.random() - 0.5);
      mixes.push({
        id: 'smart_late_night_mix',
        title: 'Late Night Mix',
        subtitle: 'Ambient melodies and peaceful tunes for the night',
        coverUrl: lateNightSongs[0]?.coverUrl || '/app-icon.png',
        category: 'mood',
        songs: lateNightSongs,
      });
    }

    return mixes;
  }

  private buildMyMix(pool: Song[], liked: Song[], follows: string[]): Song[] {
    const scored: CandidateSong[] = pool.map((song) => {
      const isLiked = liked.some((l) => l.id === song.id);
      const isFollowed = follows.some((f) => f === song.artistId || (song.artist || '').toLowerCase().includes(f.toLowerCase()));
      
      let baseScore = 1.0;
      if (isLiked) baseScore += 0.8; // +8 Like boost
      if (isFollowed) baseScore += 1.0; // +10 Follow boost

      return {
        ...song,
        candidateSource: isLiked ? 'personalized' : isFollowed ? 'similar' : 'trending',
        baseScore,
      };
    });

    return Ranker.rankCandidates(scored, [], 30);
  }
}
