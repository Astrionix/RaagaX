import { CandidateSong } from './CandidateGenerator';
import { usePlayerStore } from '@/context/usePlayerStore';

export class Ranker {
  /**
   * Ranks an array of candidate songs using a weighted formula.
   * Score = (0.25 * Affinity) + (0.20 * Vector Similarity) + (0.15 * Trending) + (0.10 * Freshness) + (0.20 * Followed Artist Boost) + (0.05 * Diversity Penalty)
   */
  public static rankCandidates(
    candidates: CandidateSong[],
    lastArtists: string[],
    limit: number = 20
  ): CandidateSong[] {
    const followedArtistIds = usePlayerStore.getState().favoriteArtistIds || [];

    const scoredCandidates = candidates.map(song => {
      let score = 0;

      // Base weight from source
      switch (song.candidateSource) {
        case 'similar':
          score += 0.20 * (song.baseScore ?? 1);
          break;
        case 'personalized':
          score += 0.25 * (song.baseScore ?? 1);
          break;
        case 'trending':
          score += 0.15 * (song.baseScore ?? 1);
          break;
        case 'context':
          score += 0.10 * (song.baseScore ?? 1);
          break;
        case 'popular':
          score += 0.05 * (song.baseScore ?? 1);
          break;
      }

      // Add popularity baseline (normalize 0-100 to 0-0.10)
      if (song.popularity) {
        score += (song.popularity / 100) * 0.10;
      }

      // Followed Artist Subscription Boost (+10 Affinity Behavior Weight)
      const isFollowed = followedArtistIds.includes(song.artistId || '') ||
        followedArtistIds.some(id => (song.artist || '').toLowerCase().includes(id.toLowerCase()));
      if (isFollowed) {
        score += 0.35;
      }

      // Diversity Penalty: If this artist was played recently, heavily penalize to prevent echo chambers
      const artist = song.artist || '';
      if (lastArtists.includes(artist)) {
        // More recent = bigger penalty
        const recentIndex = lastArtists.indexOf(artist);
        score -= (0.20 / (recentIndex + 1)); 
      }

      return { song, score };
    });

    // Sort by final score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Apply strict diversity constraint: No more than 2 consecutive tracks from same artist
    const finalQueue: CandidateSong[] = [];
    const artistCounts = new Map<string, number>();

    for (const item of scoredCandidates) {
      if (finalQueue.length >= limit) break;

      const artist = item.song.artist || 'Unknown';
      const currentCount = artistCounts.get(artist) || 0;

      if (currentCount < 2) {
        finalQueue.push(item.song);
        artistCounts.set(artist, currentCount + 1);
      }
    }

    return finalQueue;
  }
}
