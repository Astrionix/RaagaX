import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { PlaylistResolver } from '@/lib/discovery/PlaylistResolver';
import { Song } from '@/types/music';

export const dynamic = 'force-dynamic';

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let playlistId = searchParams.get('playlistId');
  const lang = searchParams.get('lang') || 'Telugu';

  if (!playlistId) {
    return NextResponse.json({ success: false, error: 'Missing playlistId' }, { status: 400 });
  }

  playlistId = playlistId.replace('spotify:', '').trim();

  try {
    // 1. Check DB Cache
    const { data: cached, error } = await supabaseAdmin
      .from('spotify_playlist_cache')
      .select('*')
      .eq('playlist_id', playlistId)
      .maybeSingle();

    if (cached && cached.data) {
      let songs: Song[] = [];
      if (Array.isArray(cached.data)) {
        songs = cached.data;
      } else if (typeof cached.data === 'object' && Array.isArray((cached.data as any).songs)) {
        songs = (cached.data as any).songs;
      }

      if (songs.length > 0) {
        const coverUrl = songs[0]?.coverUrl || '/app-icon.png';
        return NextResponse.json({
          success: true,
          playlist: {
            id: playlistId,
            title: cached.playlist_name || `${lang} Playlist`,
            coverUrl,
            songs
          }
        });
      }
    }

    // 2. Resolve on Cache Miss
    const baseUrl = getBaseUrl(req);
    const resolver = new PlaylistResolver(baseUrl);
    const resolvedSongs = await resolver.resolveSpotifyPlaylist(playlistId);
    const sourceTrackCount = (resolvedSongs as any).sourceTrackCount ?? resolvedSongs.length;
    const resolvedCount = (resolvedSongs as any).uniqueMatchedTrackCount ?? resolvedSongs.length;

    if (resolvedSongs.length > 0) {
      await supabaseAdmin.from('spotify_playlist_cache').upsert({
        playlist_id: playlistId,
        playlist_name: `${lang} Playlist`,
        language: lang,
        category: 'Playlist',
        track_count: sourceTrackCount,
        resolved_count: resolvedCount,
        data: resolvedSongs,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days
      });

      return NextResponse.json({
        success: true,
        playlist: {
          id: playlistId,
          title: `${lang} Playlist`,
          coverUrl: resolvedSongs[0]?.coverUrl || '/app-icon.png',
          songs: resolvedSongs
        }
      });
    }

    return NextResponse.json({ success: false, error: 'No songs resolved' }, { status: 404 });
  } catch (err: any) {
    console.error('[PLAYLIST DETAILS API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
