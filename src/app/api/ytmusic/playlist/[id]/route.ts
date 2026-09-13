import { NextRequest, NextResponse } from 'next/server';
import { YouTubeMusicEngine } from '@/lib/ytmusic/YouTubeMusicEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const playlistId = params.id;
    if (!playlistId) {
      return NextResponse.json({ success: false, error: 'Missing playlist ID' }, { status: 400 });
    }

    const details = await YouTubeMusicEngine.getInstance().getPlaylistDetails(playlistId);
    if (!details) {
      return NextResponse.json({ success: false, error: 'Playlist not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: details,
    });
  } catch (err: any) {
    console.error('[API /api/ytmusic/playlist] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
