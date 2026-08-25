import { NextRequest, NextResponse } from 'next/server';
import { JioSaavnProvider } from '@/lib/jioSaavnProvider';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playlistId = searchParams.get('playlistId');
  const offsetParam = searchParams.get('offset') || '0';
  const limitParam = searchParams.get('limit') || '20';

  if (!playlistId) {
    return NextResponse.json({ success: false, error: 'playlistId is required' }, { status: 400 });
  }

  const offset = parseInt(offsetParam, 10);
  const limit = parseInt(limitParam, 10);

  if (isNaN(offset) || isNaN(limit) || offset < 0 || limit < 1) {
    return NextResponse.json({ success: false, error: 'Invalid offset or limit' }, { status: 400 });
  }

  try {
    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const saavn = JioSaavnProvider.getInstance(`${proto}://${host}`);
    
    // Fetch playlist songs directly from JioSaavn
    const songs = await saavn.getPlaylistSongs(playlistId, 100);

    const total = songs.length;
    const items = songs.slice(offset, offset + limit);
    const hasMore = offset + items.length < total;

    return NextResponse.json({
      success: true,
      items: items.map(s => ({
        id: s.id,
        title: s.title,
        subtitle: s.artist,
        type: 'song',
        imageUrl: s.coverUrl,
        rawItem: s
      })),
      hasMore,
      status: 'ready',
      total
    });
  } catch (err: any) {
    console.warn('[BROWSE SECTION API] Resolution failed:', err);
    return NextResponse.json({
      success: true,
      items: [],
      hasMore: false,
      status: 'empty',
      total: 0
    });
  }
}
