import { supabase } from '@/lib/supabase';
import { Song } from '@/types/music';

export interface CandidateSong extends Song {
  candidateSource: 'vector' | 'trending' | 'affinity' | 'fresh';
  baseScore: number;
}

export class CandidateGenerator {
  
  /**
   * Generates candidate tracks for the next queue refill.
   */
  public static async generateCandidates(
    currentSong: Song | null,
    historyIds: string[],
    likedIds: string[],
    language: string,
    limit: number = 100
  ): Promise<CandidateSong[]> {
    const candidates = new Map<string, CandidateSong>();
    
    const addCandidates = (songs: any[], source: CandidateSong['candidateSource'], baseScore: number) => {
      for (const song of songs) {
        if (historyIds.includes(song.id)) continue; // Don't recommend recently played
        if (!candidates.has(song.id)) {
          candidates.set(song.id, { ...song, candidateSource: source, baseScore });
        }
      }
    };

    try {
      // 1. Vector Similarity (if we have a current song)
      if (currentSong) {
        const { data: vectorMatches } = await supabase.rpc('match_similar_songs', {
          target_song_id: currentSong.id,
          match_count: 20
        });
        
        if (vectorMatches && vectorMatches.length > 0) {
          addCandidates(vectorMatches, 'vector', 1.0);
        } else {
          // Fallback: fetch songs from same artist
          const { data: artistMatches } = await supabase
            .from('canonical_songs')
            .select('*')
            .eq('artist', currentSong.artist)
            .limit(15);
          if (artistMatches) addCandidates(artistMatches, 'affinity', 0.8);
        }
      }

      // 2. Fetch Trending / Popular
      const { data: trending } = await supabase
        .from('canonical_songs')
        .select('*')
        .eq('language', language)
        .order('popularity', { ascending: false, nullsFirst: false })
        .limit(30);
      
      if (trending) addCandidates(trending, 'trending', 0.7);

      // 3. User Affinity (If user is logged in, grab their highest affinity artists)
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        const { data: affinities } = await supabase
          .from('user_artist_affinity')
          .select('artist')
          .eq('user_id', session.session.user.id)
          .order('affinity_score', { ascending: false })
          .limit(5);

        if (affinities && affinities.length > 0) {
          const topArtists = affinities.map(a => a.artist);
          const { data: affinitySongs } = await supabase
            .from('canonical_songs')
            .select('*')
            .in('artist', topArtists)
            .limit(30);
            
          if (affinitySongs) addCandidates(affinitySongs, 'affinity', 0.9);
        }
      }

      // 4. Freshness (New Releases)
      const { data: fresh } = await supabase
        .from('canonical_songs')
        .select('*')
        .eq('language', language)
        .order('release_date', { ascending: false, nullsFirst: false })
        .limit(20);
        
      if (fresh) addCandidates(fresh, 'fresh', 0.6);

    } catch (e) {
      console.error('[CandidateGenerator] Failed to generate candidates:', e);
    }

    // Convert Map to Array and limit
    return Array.from(candidates.values()).slice(0, limit);
  }
}
