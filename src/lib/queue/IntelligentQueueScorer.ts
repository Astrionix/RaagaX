import { Song } from '@/types/music';
import { TasteGraphEngine } from '../recommendation/TasteGraphEngine';
import { UserLifecycleManager } from '../lifecycle/UserLifecycleManager';
import { ListeningDnaEngine } from '../lifecycle/ListeningDnaEngine';
import { CooldownManager } from './CooldownManager';

export interface ScoreFactors {
  userAffinity: number;
  sessionAffinity: number;
  songSimilarity: number;
  artistAffinity: number;
  languageAffinity: number;
  freshness: number;
  discoveryValue: number;
  artistRepeatPenalty: number;
  albumRepeatPenalty: number;
  skipPenalty: number;
  totalScore: number;
}

export class IntelligentQueueScorer {
  private static instance: IntelligentQueueScorer;

  private constructor() {}

  public static getInstance(): IntelligentQueueScorer {
    if (!IntelligentQueueScorer.instance) {
      IntelligentQueueScorer.instance = new IntelligentQueueScorer();
    }
    return IntelligentQueueScorer.instance;
  }

  /**
   * Calculates 12-factor intelligent recommendation score for a candidate song
   */
  public scoreCandidate(
    candidate: Song,
    currentSong: Song | null,
    recentQueueItems: any[]
  ): ScoreFactors {
    const tasteGraph = TasteGraphEngine.getInstance();
    const lifecycle = UserLifecycleManager.getInstance().getData();
    const dna = ListeningDnaEngine.getInstance().getDna();
    const cooldown = CooldownManager.getInstance();

    const artist = candidate.artist || '';
    const album = candidate.album || '';
    const lang = (candidate as any).language || (candidate as any).languageId || candidate.genre?.split(' ')[0] || '';

    // 1. User Affinity (Taste Graph Relationship Strength)
    const artistScore = tasteGraph.getRelationshipScore(artist, 'artist');
    const userAffinity = artistScore * 20;

    // 2. Session Intent Affinity
    let sessionAffinity = 0;
    if (lifecycle.sessionIntentCategory) {
      const match = (candidate.genre && candidate.genre.toLowerCase().includes(lifecycle.sessionIntentCategory.toLowerCase())) ||
                    (candidate.category && candidate.category.toLowerCase().includes(lifecycle.sessionIntentCategory.toLowerCase()));
      if (match) sessionAffinity = 15;
    }

    // 3. Current Song Similarity
    let songSimilarity = 0;
    if (currentSong) {
      if (currentSong.artist && currentSong.artist.toLowerCase() === artist.toLowerCase()) {
        songSimilarity += 10;
      }
      if (currentSong.album && currentSong.album.toLowerCase() === album.toLowerCase()) {
        songSimilarity += 8;
      }
    }

    // 4. Language Affinity
    const langShare = dna.languageDistribution[lang] || 0;
    const languageAffinity = (langShare / 100) * 12;

    // 5. Freshness
    const releaseYear = candidate.releaseYear || 2020;
    const freshness = releaseYear >= 2024 ? 8 : releaseYear >= 2020 ? 5 : 2;

    // 6. Discovery Value
    const discoveryValue = dna.noveltyTolerance * 10;

    // 7. Cooldown Penalties
    let artistRepeatPenalty = 0;
    if (cooldown.isArtistInCooldown(artist, recentQueueItems, 3)) {
      artistRepeatPenalty = -25;
    }

    let albumRepeatPenalty = 0;
    if (cooldown.isAlbumInCooldown(album, recentQueueItems, 2)) {
      albumRepeatPenalty = -15;
    }

    let skipPenalty = 0;
    if (!tasteGraph.isSongAllowedInRecommendations(candidate)) {
      skipPenalty = -100; // Hidden or Not For Me
    }

    const totalScore = Math.max(0, Math.round(
      userAffinity +
      sessionAffinity +
      songSimilarity +
      (artistScore * 10) +
      languageAffinity +
      freshness +
      discoveryValue +
      artistRepeatPenalty +
      albumRepeatPenalty +
      skipPenalty
    ));

    return {
      userAffinity,
      sessionAffinity,
      songSimilarity,
      artistAffinity: artistScore * 10,
      languageAffinity,
      freshness,
      discoveryValue,
      artistRepeatPenalty,
      albumRepeatPenalty,
      skipPenalty,
      totalScore,
    };
  }

  /**
   * Sorts candidate songs using multi-factor intelligent queue scoring
   */
  public rankCandidates(candidates: Song[], currentSong: Song | null, recentQueueItems: any[]): Song[] {
    return [...candidates].sort((a, b) => {
      const scoreA = this.scoreCandidate(a, currentSong, recentQueueItems).totalScore;
      const scoreB = this.scoreCandidate(b, currentSong, recentQueueItems).totalScore;
      return scoreB - scoreA;
    });
  }
}
