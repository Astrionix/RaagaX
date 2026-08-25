import { NextRequest, NextResponse } from 'next/server';
import { JioSaavnProvider, mapTrackToSong } from '@/lib/jioSaavnProvider';

export const dynamic = 'force-dynamic';

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playlistId = searchParams.get('playlistId')?.trim();
  const lang = searchParams.get('lang') || 'Telugu';
  const limitParam = searchParams.get('limit') || '100';

  if (!playlistId) {
    return NextResponse.json({ success: false, error: 'Missing playlistId' }, { status: 400 });
  }

  const baseUrl = getBaseUrl(req);

  try {
    const saavn = JioSaavnProvider.getInstance(baseUrl);

    // 1. Direct playlist songs fetch
    const songs = await saavn.getPlaylistSongs(playlistId, parseInt(limitParam, 10) || 100);
    if (songs && songs.length > 0) {
      return NextResponse.json({
        success: true,
        playlist: {
          id: playlistId,
          title: `${lang} Playlist`,
          coverUrl: songs[0]?.coverUrl || '/app-icon.png',
          songs
        }
      });
    }

    // 2. Fetch via internal API if direct getPlaylistSongs returned empty
    const saavnRes = await fetch(`${baseUrl}/api/playlists?id=${encodeURIComponent(playlistId)}&limit=${limitParam}`);
    if (saavnRes.ok) {
      const saavnJson = await saavnRes.json();
      const data = saavnJson?.data;
      if (data && Array.isArray(data.songs) && data.songs.length > 0) {
        const mappedSongs = data.songs.map(mapTrackToSong);
        const coverUrl = data.image?.[data.image.length - 1]?.url || data.image?.[0]?.url || mappedSongs[0]?.coverUrl || '/app-icon.png';
        return NextResponse.json({
          success: true,
          playlist: {
            id: playlistId,
            title: data.name || data.title || `${lang} Playlist`,
            coverUrl: typeof coverUrl === 'string' ? coverUrl.replace(/150x150|50x50/g, '500x500') : '/app-icon.png',
            songs: mappedSongs
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      playlist: {
        id: playlistId,
        title: `${lang} Playlist`,
        coverUrl: '/app-icon.png',
        songs: []
      }
    });
  } catch (err: any) {
    console.error('[PLAYLIST DETAILS API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch playlist' }, { status: 500 });
  }
}
