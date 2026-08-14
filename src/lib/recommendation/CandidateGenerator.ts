import { supabase } from '@/lib/supabase';
import { Song } from '@/types/music';
import { LanguageEligibilityEngine } from '@/lib/language/LanguageEligibilityEngine';

export interface CandidateSong extends Song {
  candidateSource: 'personalized' | 'similar' | 'context' | 'trending' | 'popular';
  baseScore?: number;
}

export interface CandidateContext {
  selectedLanguages?: string[];
  userId?: string;
}

export class CandidateGenerator {
  
  /**
   * Generates candidate tracks for queue refill using multilingual signals & candidate source hierarchy
   */
  public static async generateCandidates(
    currentSong: Song | null,
    historyIds: string[],
    context?: CandidateContext | string,
    limit: number = 20
  ): Promise<CandidateSong[]> {
    const candidates = new Map<string, CandidateSong>();
    const userId = (await supabase.auth.getSession()).data.session?.user?.id || 'guest';
    const targetLanguage = typeof context === 'string' ? context : (context?.selectedLanguages?.[0] || 'Telugu');
    const langs = typeof context === 'string' ? [context] : (context?.selectedLanguages && context.selectedLanguages.length > 0 ? context.selectedLanguages : [targetLanguage]);
    
    const addCandidates = async (songs: any[], source: CandidateSong['candidateSource']): Promise<boolean> => {
      // Pass strict targetLanguage for queue purity during autoplay / refill
      const eligibleSongs = await LanguageEligibilityEngine.getInstance().filterCandidates(
        userId,
        songs,
        'AUTOPLAY',
        targetLanguage,
        langs
      );

      for (const song of eligibleSongs) {
        if (historyIds.includes(song.id)) continue;
        if (!candidates.has(song.id)) {
          const mappedSong: Song = {
             id: song.id,
             title: song.title,
             artist: song.artist,
             artistId: (song as any).artist_id || song.artistId || '',
             album: song.album || '',
             albumId: (song as any).album_id || song.albumId || '',
             coverUrl: (song as any).cover_url || song.coverUrl || '/app-icon.png',
             audioUrl: (song as any).playable_url || song.audioUrl || '',
             duration: song.duration ? parseInt(String(song.duration), 10) : 0,
             genre: (song as any).language ? `${String((song as any).language).toUpperCase()} HITS` : 'HITS',
             category: 'global_trending',
             releaseYear: (song as any).release_year || song.releaseYear || new Date().getFullYear(),
             plays: (song as any).play_count || song.plays || 0,
             likes: 0,
          };
          candidates.set(song.id, { ...mappedSong, candidateSource: source });
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
             if (await addCandidates(affinitySongs, 'personalized')) return Array.from(candidates.values());
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
          if (await addCandidates(vectorMatches, 'similar')) return Array.from(candidates.values());
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
           if (await addCandidates(artistMatches, 'context')) return Array.from(candidates.values());
        }
      }

      // 4. Cached trending in selected user languages
      const { data: trending, error: trendingError } = await supabase
        .from('canonical_songs')
        .select('*')
        .in('language', langs)
        .order('trend_score', { ascending: false, nullsFirst: false })
        .limit(limit * 2);
        
      if (!trendingError && trending) {
         if (await addCandidates(trending, 'trending')) return Array.from(candidates.values());
      }

      // 5. Dynamic RealMusicEngine Fallback balanced across all selected user languages
      if (candidates.size < limit) {
        try {
          const { RealMusicEngine } = await import('@/lib/realMusicEngine');
          for (const searchLang of langs) {
            if (candidates.size >= limit) break;
            const query = currentSong?.artist ? `${currentSong.artist} songs` : `Trending ${searchLang} Songs`;
            const realSongs = await RealMusicEngine.getInstance().searchRealSongs(query, Math.max(5, Math.ceil(limit / langs.length)));
            if (realSongs && realSongs.length > 0) {
              await addCandidates(realSongs, 'trending');
            }
          }
        } catch (realErr) {
          console.warn('[CandidateGenerator] RealMusicEngine fallback error:', realErr);
        }
      }

    } catch (e) {
      console.error('[CandidateGenerator] Error in fallback hierarchy:', e);
    }

    return Array.from(candidates.values());
  }

  /**
   * Generates categorized candidate buckets across user's multilingual preferences
   */
  public static async generateBuckets(
    currentSong: Song | null,
    historyIds: string[],
    context?: CandidateContext | string
  ): Promise<{
    personalized: CandidateSong[];
    popular: CandidateSong[];
    newRelease: CandidateSong[];
    adjacent: CandidateSong[];
    exploration: CandidateSong[];
  }> {
    const buckets = {
      personalized: [] as CandidateSong[],
      popular: [] as CandidateSong[],
      newRelease: [] as CandidateSong[],
      adjacent: [] as CandidateSong[],
      exploration: [] as CandidateSong[],
    };

    try {
      const { RealMusicEngine } = await import('@/lib/realMusicEngine');
      const selectedLangs = typeof context === 'string' 
        ? [context] 
        : (context?.selectedLanguages && context.selectedLanguages.length > 0 
            ? context.selectedLanguages 
            : ['Telugu', 'Tamil', 'Hindi', 'Kannada', 'Malayalam', 'English']);
      
      const primaryArtist = currentSong?.artist ? currentSong.artist.split(',')[0].split('&')[0].trim() : '';

      // Query across all selected languages in parallel for balanced candidates
      const popPromises = selectedLangs.map(l => RealMusicEngine.getInstance().searchRealSongs(`${l} Hits`, 10).catch(() => []));
      const newPromises = selectedLangs.map(l => RealMusicEngine.getInstance().searchRealSongs(`Latest ${l} Songs`, 10).catch(() => []));
      const expPromises = selectedLangs.map(l => RealMusicEngine.getInstance().searchRealSongs(`${l} Melodies`, 10).catch(() => []));
      const artistPromise: Promise<any[]> = primaryArtist ? RealMusicEngine.getInstance().searchRealSongs(`${primaryArtist} songs`, 15).catch(() => []) : Promise.resolve([]);

      const [popLists, newLists, expLists, artistList] = await Promise.all([
        Promise.all(popPromises),
        Promise.all(newPromises),
        Promise.all(expPromises),
        artistPromise
      ]);

      const flattenAndFilter = (lists: any[][], source: CandidateSong['candidateSource']) => {
        const result: CandidateSong[] = [];
        const seen = new Set<string>();
        for (const list of lists) {
          for (const s of list) {
            if (s && s.id && !historyIds.includes(s.id) && !seen.has(s.id)) {
              seen.add(s.id);
              result.push({ ...s, candidateSource: source });
            }
          }
        }
        return result;
      };

      buckets.popular = flattenAndFilter(popLists, 'popular');
      buckets.newRelease = flattenAndFilter(newLists, 'trending');
      buckets.exploration = flattenAndFilter(expLists, 'similar');
      if (Array.isArray(artistList) && artistList.length > 0) {
        buckets.personalized = artistList.filter(s => s && s.id && !historyIds.includes(s.id)).map(s => ({ ...s, candidateSource: 'personalized' }));
      }
    } catch (e) {
      console.warn('[CandidateGenerator] Error generating buckets:', e);
    }

    return buckets;
  }
}
