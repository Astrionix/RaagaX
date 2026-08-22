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
      resolvedSongs = await resolver.resolveSpotifyPlaylist(playlistId);
    }

    const sourceTrackCount = (resolvedSongs as any).sourceTrackCount ?? resolvedSongs.length;
    const resolvedCount = (resolvedSongs as any).uniqueMatchedTrackCount ?? resolvedSongs.length;

    // Save to Playlist Cache is handled internally by PlaylistResolver.resolveSpotifyPlaylist
    console.log(`[Cron] Successfully resolved ${playlistId} with ${resolvedSongs.length} tracks.`);

    return NextResponse.json({ success: true, count: resolvedSongs.length });
  } catch (error) {
    console.error(`[Cron] Failed to sync ${playlistId}:`, error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
