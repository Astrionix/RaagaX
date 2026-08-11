import { supabase } from '@/lib/supabase';
import { Song } from '@/types/music';

export interface CandidateSong extends Song {
  candidateSource: 'personalized' | 'similar' | 'context' | 'trending' | 'popular';
  baseScore?: number;
}

export class CandidateGenerator {
  
  /**
   * Generates candidate tracks for the next queue refill using a strict fallback hierarchy.
   */
  public static async generateCandidates(
    currentSong: Song | null,
    historyIds: string[],
    language: string,
    limit: number = 20
  ): Promise<CandidateSong[]> {
    const candidates = new Map<string, CandidateSong>();
    
    const addCandidates = (songs: any[], source: CandidateSong['candidateSource']): boolean => {
      let added = false;
      for (const song of songs) {
        if (historyIds.includes(song.id)) continue;
        if (!candidates.has(song.id)) {
          // Normalize DB response to Song interface
          const mappedSong: Song = {
             id: song.id,
             title: song.title,
             artist: song.artist,
             artistId: song.artist_id || '',
             album: song.album || '',
             albumId: song.album_id || '',
             coverUrl: song.cover_url || '',
             audioUrl: song.playable_url || '',
             duration: song.duration ? parseInt(song.duration, 10) : 0,
             genre: song.language ? `${String(song.language).toUpperCase()} HITS` : 'HITS',
             category: 'latest_telugu',
             releaseYear: song.release_year || new Date().getFullYear(),
             plays: song.play_count || 0,
             likes: 0,
          };
          candidates.set(song.id, { ...mappedSong, candidateSource: source });
          added = true;
        }
        if (candidates.size >= limit) return true;
      }
      return candidates.size >= limit;
    };

    try {
      // 1. Personalized songs (User Affinity)
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
          const { data: affinitySongs, error: affinityError } = await supabase
            .from('canonical_songs')
            .select('*')
            .in('artist', topArtists)
            .limit(limit * 2);
            
          if (!affinityError && affinitySongs) {
             if (addCandidates(affinitySongs, 'personalized')) return Array.from(candidates.values());
          }
        }
      }

      // 2. Similar real songs (Vector Match)
      if (currentSong) {
        const { data: vectorMatches, error: vectorError } = await supabase.rpc('match_similar_songs', {
          target_song_id: currentSong.id,
          match_count: limit * 2
        });
        
        if (!vectorError && vectorMatches && vectorMatches.length > 0) {
          if (addCandidates(vectorMatches, 'similar')) return Array.from(candidates.values());
        }
      }

      // 3. Current context (Same Artist)
      if (currentSong) {
        const { data: artistMatches, error: artistError } = await supabase
          .from('canonical_songs')
          .select('*')
          .eq('artist', currentSong.artist)
          .limit(limit * 2);
          
        if (!artistError && artistMatches) {
           if (addCandidates(artistMatches, 'context')) return Array.from(candidates.values());
        }
      }

      // 4. Cached trending (Freshness / Trending score)
      const { data: trending, error: trendingError } = await supabase
        .from('canonical_songs')
        .select('*')
        .eq('language', language)
        .order('trend_score', { ascending: false, nullsFirst: false })
        .limit(limit * 2);
        
      if (!trendingError && trending) {
         if (addCandidates(trending, 'trending')) return Array.from(candidates.values());
      }

      // 5. Language popular
      const { data: popular, error: popularError } = await supabase
        .from('canonical_songs')
        .select('*')
        .eq('language', language)
        .order('popularity_score', { ascending: false, nullsFirst: false })
        .limit(limit * 2);
        
      if (!popularError && popular) {
         if (addCandidates(popular, 'popular')) return Array.from(candidates.values());
      }

    } catch (e) {
      console.error('[CandidateGenerator] Error in fallback hierarchy:', e);
    }

    return Array.from(candidates.values());
  }
}
