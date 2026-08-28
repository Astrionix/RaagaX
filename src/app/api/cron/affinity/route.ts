import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const SIGNAL_WEIGHTS = {
  play: 2,
  complete: 5,
  replay: 6,
  skip: -5,
  like: 12,
  unlike: -8,
  search: 2,
  add_to_queue: 1,
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return new Response('Unauthorized', { status: 401 });
  }

  console.log('[AffinityCron] Affinity score calculation started...');
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Identify active users from events, likes, and favorite artists
    const [eventsRes, likesRes, artistsRes] = await Promise.all([
      supabaseAdmin.from('listening_events').select('user_id').gt('created_at', thirtyDaysAgo),
      supabaseAdmin.from('liked_songs').select('user_id'),
      supabaseAdmin.from('user_artists').select('user_id'),
    ]);

    const userIds = Array.from(new Set([
      ...(eventsRes.data || []).map(r => r.user_id),
      ...(likesRes.data || []).map(r => r.user_id),
      ...(artistsRes.data || []).map(r => r.user_id),
    ].filter(Boolean) as string[]));

    console.log(`[AffinityCron] Found ${userIds.length} active users to calculate affinities for.`);

    let totalAffinitiesUpdated = 0;

    for (const userId of userIds) {
      try {
        // 2. Fetch user behaviors
        const [userEvents, userLikes, userFavArtists, userFavLanguages] = await Promise.all([
          supabaseAdmin.from('listening_events').select('song_id, event_type, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
          supabaseAdmin.from('liked_songs').select('song_id').eq('user_id', userId),
          supabaseAdmin.from('user_artists').select('artist_id').eq('user_id', userId),
          supabaseAdmin.from('user_languages').select('language_id').eq('user_id', userId),
        ]);

        const uniqueSongIds = Array.from(new Set([
          ...(userEvents.data || []).map(e => e.song_id),
          ...(userLikes.data || []).map(l => l.song_id),
        ].filter(Boolean) as string[]));

        // 3. Resolve metadata for these songs to obtain artists and languages
        let songMetadataMap = new Map<string, { artist: string; language: string }>();
        if (uniqueSongIds.length > 0) {
          const { data: songsData } = await supabaseAdmin
            .from('canonical_songs')
            .select('id, artist, language')
            .in('id', uniqueSongIds);
          
          if (songsData) {
            songsData.forEach((s: any) => {
              songMetadataMap.set(s.id, {
                artist: s.artist || 'Unknown Artist',
                language: s.language || 'Telugu'
              });
            });
          }
        }

        // Initialize score maps
        const artistScores: Record<string, number> = {};
        const languageScores: Record<string, number> = {};
        const genreScores: Record<string, number> = {};

        const artistInteractionCounts: Record<string, number> = {};
        const genreInteractionCounts: Record<string, number> = {};
        const languageInteractionCounts: Record<string, number> = {};

        // 4. Score based on Listening Events with Recency Decay (10% decay per day)
        if (userEvents.data) {
          userEvents.data.forEach((event: any) => {
            const songMeta = songMetadataMap.get(event.song_id);
            if (!songMeta) return;

            const ageDays = (now - new Date(event.created_at).getTime()) / (24 * 60 * 60 * 1000);
            const decay = Math.exp(-0.1 * ageDays); // recency decay

            const baseWeight = SIGNAL_WEIGHTS[event.event_type as keyof typeof SIGNAL_WEIGHTS] || 0;
            const scoreDelta = baseWeight * decay;

            // Artist score delta
            const artistId = songMeta.artist;
            artistScores[artistId] = (artistScores[artistId] || 0) + scoreDelta;
            artistInteractionCounts[artistId] = (artistInteractionCounts[artistId] || 0) + 1;

            // Language score delta
            const lang = songMeta.language;
            languageScores[lang] = (languageScores[lang] || 0) + (scoreDelta * 0.5);
            languageInteractionCounts[lang] = (languageInteractionCounts[lang] || 0) + 1;

            // Genre score delta (distribute among Hits and Melodies as fallback)
            const genres = ['Hits', 'Melodies'];
            genres.forEach(genre => {
              genreScores[genre] = (genreScores[genre] || 0) + (scoreDelta * 0.4);
              genreInteractionCounts[genre] = (genreInteractionCounts[genre] || 0) + 1;
            });
          });
        }

        // 5. Score based on Liked Songs (+10 artist, +5 language, +5 genre)
        if (userLikes.data) {
          userLikes.data.forEach((like: any) => {
            const songMeta = songMetadataMap.get(like.song_id);
            if (!songMeta) return;

            const artistId = songMeta.artist;
            const lang = songMeta.language;

            artistScores[artistId] = (artistScores[artistId] || 0) + 10;
            languageScores[lang] = (languageScores[lang] || 0) + 5;
            genreScores['Melodies'] = (genreScores['Melodies'] || 0) + 5;
          });
        }

        // 6. Score based on Favorited Artists (+25 score)
        if (userFavArtists.data) {
          userFavArtists.data.forEach((fav: any) => {
            artistScores[fav.artist_id] = (artistScores[fav.artist_id] || 0) + 25;
          });
        }

        // 7. Score based on Favorited Languages (+25 score)
        if (userFavLanguages.data) {
          userFavLanguages.data.forEach((fav: any) => {
            languageScores[fav.language_id] = (languageScores[fav.language_id] || 0) + 25;
          });
        }

        // 8. Enforce boundaries and format for database insertion
        // Artist Affinity: Top 50
        const sortedArtists = Object.entries(artistScores)
          .map(([artist_id, score]) => ({
            user_id: userId,
            artist_id,
            score: Math.max(1, Math.round(score)),
            interaction_count: artistInteractionCounts[artist_id] || 0,
            last_interaction: new Date().toISOString()
          }))
          .filter(a => a.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 50);

        // Language Affinity: Top 10
        const sortedLanguages = Object.entries(languageScores)
          .map(([language, score]) => ({
            user_id: userId,
            language,
            score: Math.max(1, Math.round(score)),
            interaction_count: languageInteractionCounts[language] || 0,
            last_interaction_at: new Date().toISOString(),
            state: score >= 15 ? 'ACTIVE' : 'DISCOVERED'
          }))
          .filter(l => l.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);

        // Genre Affinity: Top 30
        const sortedGenres = Object.entries(genreScores)
          .map(([genre, score]) => ({
            user_id: userId,
            genre,
            score: Math.max(1, Math.round(score)),
            interaction_count: genreInteractionCounts[genre] || 0,
            last_interaction: new Date().toISOString()
          }))
          .filter(g => g.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 30);

        // 9. Atomic DB updates (delete existing -> insert new top score rows)
        await Promise.all([
          supabaseAdmin.from('user_artist_affinity').delete().eq('user_id', userId),
          supabaseAdmin.from('user_genre_affinity').delete().eq('user_id', userId),
          supabaseAdmin.from('user_language_affinity').delete().eq('user_id', userId)
        ]);

        const insertPromises: any[] = [];
        if (sortedArtists.length > 0) {
          insertPromises.push(supabaseAdmin.from('user_artist_affinity').insert(sortedArtists));
        }
        if (sortedGenres.length > 0) {
          insertPromises.push(supabaseAdmin.from('user_genre_affinity').insert(sortedGenres));
        }
        if (sortedLanguages.length > 0) {
          insertPromises.push(supabaseAdmin.from('user_language_affinity').insert(sortedLanguages));
        }

        if (insertPromises.length > 0) {
          await Promise.all(insertPromises);
        }

        totalAffinitiesUpdated++;
      } catch (err: any) {
        console.error(`[AffinityCron] Failed to calculate affinities for user ${userId}:`, err);
      }
    }

    console.log(`[AffinityCron] Affinity score calculation completed. Updated ${totalAffinitiesUpdated} users.`);
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      usersUpdated: totalAffinitiesUpdated,
    });
  } catch (err: any) {
    console.error('[AffinityCron] Fatal error in affinity calculation:', err);
    return NextResponse.json({ success: false, error: err.message || 'Affinity calculation failed' }, { status: 500 });
  }
}
