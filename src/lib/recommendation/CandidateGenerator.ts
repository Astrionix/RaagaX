import { supabase } from '@/lib/supabase';
import { Song } from '@/types/music';
import { LanguageEligibilityEngine } from '@/lib/language/LanguageEligibilityEngine';

export interface CandidateSong extends Song {
  candidateSource: 'personalized' | 'similar' | 'context' | 'trending' | 'popular';
  baseScore?: number;
}

export class CandidateGenerator {
  
  /**
   * Generates candidate tracks for queue refill using strict fallback hierarchy & language eligibility
   */
  public static async generateCandidates(
    currentSong: Song | null,
    historyIds: string[],
    language: string,
    limit: number = 20
  ): Promise<CandidateSong[]> {
    const candidates = new Map<string, CandidateSong>();
    const userId = (await supabase.auth.getSession()).data.session?.user?.id || 'guest';
    
    const addCandidates = async (songs: any[], source: CandidateSong['candidateSource']): Promise<boolean> => {
      // Filter songs for language eligibility
      const eligibleSongs = await LanguageEligibilityEngine.getInstance().filterCandidates(
        userId,
        songs,
        'PERSONALIZED_RECOMMENDATION',
        language,
        [language]
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
             category: 'latest_telugu',
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

      // 4. Cached trending in target language
      const { data: trending, error: trendingError } = await supabase
        .from('canonical_songs')
        .select('*')
        .eq('language', language)
        .order('trend_score', { ascending: false, nullsFirst: false })
        .limit(limit * 2);
        
      if (!trendingError && trending) {
         if (await addCandidates(trending, 'trending')) return Array.from(candidates.values());
      }

      // 5. Language popular
      const { data: popular, error: popularError } = await supabase
        .from('canonical_songs')
        .select('*')
        .eq('language', language)
        .order('popularity_score', { ascending: false, nullsFirst: false })
        .limit(limit * 2);
        
      if (!popularError && popular) {
         if (await addCandidates(popular, 'popular')) return Array.from(candidates.values());
      }

      // 6. Dynamic RealMusicEngine Fallback for Live API songs
      if (candidates.size < limit) {
        try {
          const { RealMusicEngine } = await import('@/lib/realMusicEngine');
          const query = currentSong?.artist ? `${currentSong.artist} songs` : `Trending ${language || 'Telugu'} Songs`;
          const realSongs = await RealMusicEngine.getInstance().searchRealSongs(query, limit * 2);
          if (realSongs && realSongs.length > 0) {
            await addCandidates(realSongs, 'trending');
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
   * Generates categorized candidate buckets for lifecycle composition ratio blending
   */
  public static async generateBuckets(
    currentSong: Song | null,
    historyIds: string[],
    language: string
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
      const lang = language || 'Telugu';
      const primaryArtist = currentSong?.artist ? currentSong.artist.split(',')[0].split('&')[0].trim() : '';

      const [popRes, newRes, artistRes, expRes] = await Promise.allSettled([
        RealMusicEngine.getInstance().searchRealSongs(`${lang} Hits`, 15),
        RealMusicEngine.getInstance().searchRealSongs(`Latest ${lang} Songs`, 15),
        primaryArtist ? RealMusicEngine.getInstance().searchRealSongs(`${primaryArtist} songs`, 15) : Promise.resolve([]),
        RealMusicEngine.getInstance().searchRealSongs(`${lang} Melodies`, 15),
      ]);

      if (popRes.status === 'fulfilled' && popRes.value.length > 0) {
        buckets.popular = popRes.value.filter(s => !historyIds.includes(s.id)).map(s => ({ ...s, candidateSource: 'popular' }));
      }
      if (newRes.status === 'fulfilled' && newRes.value.length > 0) {
        buckets.newRelease = newRes.value.filter(s => !historyIds.includes(s.id)).map(s => ({ ...s, candidateSource: 'trending' }));
      }
      if (artistRes.status === 'fulfilled' && artistRes.value.length > 0) {
        buckets.personalized = artistRes.value.filter(s => !historyIds.includes(s.id)).map(s => ({ ...s, candidateSource: 'personalized' }));
      }
      if (expRes.status === 'fulfilled' && expRes.value.length > 0) {
        buckets.exploration = expRes.value.filter(s => !historyIds.includes(s.id)).map(s => ({ ...s, candidateSource: 'similar' }));
      }
    } catch (e) {
      console.warn('[CandidateGenerator] Error generating buckets:', e);
    }

    return buckets;
  }
}
