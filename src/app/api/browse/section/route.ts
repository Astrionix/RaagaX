import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { BROWSE_5_PLAYLISTS, TRENDING_SOURCES, NEW_RELEASES_SOURCES, CLASSICS_SOURCES } from '@/lib/spotifySources';

export const dynamic = 'force-dynamic';

function isAllowedSource(playlistId: string): boolean {
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
    // Strictly read from the cache for pagination
    const { data: cached, error } = await supabaseAdmin
      .from('spotify_playlist_cache')
      .select('data')
      .eq('playlist_id', playlistId)
      .maybeSingle();

    if (error) {
      console.error('[BROWSE SECTION API] DB Error:', error);
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    if (!cached || !cached.data || !Array.isArray(cached.data)) {
      // Cache MISS or empty. Return warming state so frontend can retry
      return NextResponse.json({ 
        success: true, 
        items: [],
        hasMore: true,
        status: 'warming'
      });
    }

    const total = cached.data.length;
    const items = cached.data.slice(offset, offset + limit);
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
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
