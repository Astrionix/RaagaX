import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { BROWSE_5_PLAYLISTS, TRENDING_SOURCES, NEW_RELEASES_SOURCES, CLASSICS_SOURCES } from '@/lib/spotifySources';
import { Song } from '@/types/music';

export const dynamic = 'force-dynamic';

function isAllowedSource(playlistId: string): boolean {
  if (playlistId === 'aggregated_new_releases') return true;
  const languages = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English'];
  for (const lang of languages) {
    if (TRENDING_SOURCES[lang]?.id === playlistId) return true;
    if (NEW_RELEASES_SOURCES[lang]?.id === playlistId) return true;
    if (CLASSICS_SOURCES[lang]?.id === playlistId) return true;
    const extraPlaylists = BROWSE_5_PLAYLISTS[lang] || [];
    if (extraPlaylists.some(p => p.id === playlistId)) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playlistId = searchParams.get('playlistId');
  const lang = searchParams.get('lang') || 'Telugu';
  const offsetParam = searchParams.get('offset') || '20';
  const limitParam = searchParams.get('limit') || '20';

  if (!playlistId) {
    return NextResponse.json({ success: false, error: 'playlistId is required' }, { status: 400 });
  }

  // Validate allowed playlist IDs to prevent arbitrary querying
  if (!isAllowedSource(playlistId)) {
    return NextResponse.json({ success: false, error: 'Invalid source' }, { status: 400 });
  }

  const offset = parseInt(offsetParam, 10);
  const limit = parseInt(limitParam, 10);

  if (isNaN(offset) || isNaN(limit) || offset < 0 || limit < 1) {
    return NextResponse.json({ success: false, error: 'Invalid offset or limit' }, { status: 400 });
  }

  try {
    let query = supabaseAdmin
      .from('spotify_playlist_cache')
      .select('data, playlist_name')
      .eq('playlist_id', playlistId);

    if (playlistId === 'aggregated_new_releases') {
      query = query.eq('language', lang);
    }

    let { data: cachedRow, error } = await query.maybeSingle();

    if (error) {
      console.error('[BROWSE SECTION API] DB Error:', error);
    }

    // Extract songs from cache
    let cachedSongs: Song[] = [];
    if (cachedRow && cachedRow.data) {
      if (Array.isArray(cachedRow.data)) {
        cachedSongs = cachedRow.data;
      } else if (typeof cachedRow.data === 'object' && Array.isArray((cachedRow.data as any).songs)) {
        cachedSongs = (cachedRow.data as any).songs;
      }
    }

    // If cache is completely missing or empty, resolve on-demand
    if (cachedSongs.length === 0) {
      try {
        const host = req.headers.get('host') || 'localhost:3000';
        const proto = req.headers.get('x-forwarded-proto') || 'http';
        const baseUrl = `${proto}://${host}`;
        const { PlaylistResolver } = await import('@/lib/discovery/PlaylistResolver');
        const resolver = new PlaylistResolver(baseUrl);
        const resolved = await resolver.resolveSpotifyPlaylist(playlistId);

        if (resolved && resolved.length > 0) {
          cachedSongs = resolved;
        }
      } catch (resErr) {
        console.warn('[BROWSE SECTION API] On-demand resolution failed:', resErr);
      }
    }

    if (cachedSongs.length === 0) {
      return NextResponse.json({ 
        success: true, 
        items: [],
        hasMore: false,
        status: 'empty',
        total: 0
      });
    }

    const total = cachedSongs.length;
    const items = cachedSongs.slice(offset, offset + limit);
    const hasMore = offset + items.length < total;

    return NextResponse.json({ 
      success: true, 
      status: 'ready',
      hasMore,
      total,
      items: items.map((song: any) => ({
        id: song.id,
        title: song.title,
        subtitle: song.artist,
        type: 'song',
        imageUrl: song.coverUrl,
        rawItem: song
      }))
    });
  } catch (err) {
    console.error('[BROWSE SECTION API] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error', items: [], hasMore: false }, { status: 500 });
  }
}
