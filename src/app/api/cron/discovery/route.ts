import { NextRequest, NextResponse } from 'next/server';
import { PlaylistResolver } from '@/lib/discovery/PlaylistResolver';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SOURCES } from '@/lib/spotifySources';
import { Song } from '@/types/music';

export const maxDuration = 300; // Allow up to 5 minutes for this cron on Vercel Pro

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('host') || 'localhost:3001';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playlistId = searchParams.get('playlistId');
  const lang = searchParams.get('lang') || 'Unknown';
  const category = searchParams.get('category') || 'Unknown';

  if (!playlistId) {
    return NextResponse.json({ error: 'Missing playlistId' }, { status: 400 });
  }

  try {
    const baseUrl = getBaseUrl(req);
    const resolver = new PlaylistResolver(baseUrl);
    
    let resolvedSongs: Song[] = [];

    if (playlistId === 'aggregated_new_releases') {
      console.log(`[Cron] Running massive aggregation for ${lang} ${category}`);
      const langSources = SOURCES[lang] || SOURCES['Hindi'];
      const candidatePlaylists = [...(langSources.primary || []), ...(langSources.secondary || [])];
      
      resolvedSongs = await resolver.resolveAggregatedCandidates(candidatePlaylists, 100);
    } else {
      console.log(`[Cron] Syncing Spotify Playlist ${playlistId} for ${lang} ${category}`);
      resolvedSongs = await resolver.resolveSpotifyPlaylist(playlistId, 100);
    }

    // Save to Playlist Cache
    if (resolvedSongs.length > 0) {
      await supabaseAdmin.from('spotify_playlist_cache').upsert({
        playlist_id: playlistId,
        playlist_name: `${lang} ${category}`,
        language: lang,
        category: category,
        track_count: resolvedSongs.length, // Just what we processed
        resolved_count: resolvedSongs.length,
        data: resolvedSongs,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(), // 12 hours expiry by default
      });
      console.log(`[Cron] Successfully synced ${playlistId} with ${resolvedSongs.length} tracks.`);
    } else {
      console.warn(`[Cron] Sync resulted in 0 tracks for ${playlistId}`);
    }

    return NextResponse.json({ success: true, count: resolvedSongs.length });
  } catch (error) {
    console.error(`[Cron] Failed to sync ${playlistId}:`, error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
