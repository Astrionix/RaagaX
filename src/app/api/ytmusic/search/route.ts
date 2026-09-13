import { NextResponse } from 'next/server';
import { YouTubeMusicEngine } from '@/lib/ytmusic/YouTubeMusicEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    if (!query.trim()) {
      return NextResponse.json({ success: true, data: [], playlists: [] });
    }

    const engine = YouTubeMusicEngine.getInstance();
    const songs = await engine.searchSongs(query, Math.min(limit, 30));

    let playlists: any[] = [];
    try {
      playlists = await engine.searchPlaylists(query, 5);
    } catch {}

    return NextResponse.json({
      success: true,
      data: songs,
      playlists,
    });
  } catch (error: any) {
    console.error('[API /api/ytmusic/search] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Search failed' },
      { status: 500 }
    );
  }
}
