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

  const limitParam = searchParams.get('limit') || '100';
  const baseUrl = getBaseUrl(req);
  const isNumericId = /^\d+$/.test(playlistId);

  try {
    // 1. Numeric ID -> Direct JioSaavn playlist
    if (isNumericId) {
      try {
        const saavnRes = await fetch(`${baseUrl}/api/playlists?id=${playlistId}&limit=${limitParam}`);
        if (saavnRes.ok) {
          const saavnJson = await saavnRes.json();
          const plData = saavnJson?.data;
          if (plData && Array.isArray(plData.songs) && plData.songs.length > 0) {
            const { mapTrackToSong } = await import('@/lib/jioSaavnProvider');
            const songs = plData.songs.map(mapTrackToSong);
            const coverUrl = plData.image?.[plData.image.length - 1]?.url || plData.image?.[0]?.url || songs[0]?.coverUrl || '/app-icon.png';
            return NextResponse.json({
              success: true,
              playlist: {
                id: playlistId,
                title: plData.name || plData.title || `${lang} Playlist`,
                coverUrl: typeof coverUrl === 'string' ? coverUrl.replace(/150x150|50x50/g, '500x500') : '/app-icon.png',
                songs
              }
            });
          }
        }
      } catch (err) {
        console.warn('[PLAYLIST DETAILS API] Direct JioSaavn fetch failed:', err);
      }
    }

    // 2. Spotify ID -> Check DB Cache
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

    // 3. Resolve Spotify on Cache Miss
    const resolver = new PlaylistResolver(baseUrl);
    let resolvedSongs: Song[] = [];
    try {
      const resolvePromise = resolver.resolveSpotifyPlaylist(playlistId);
      const timeoutPromise = new Promise<Song[]>((resolve) => setTimeout(() => resolve([]), 8000));
      resolvedSongs = await Promise.race([resolvePromise, timeoutPromise]);
    } catch (e) {
      console.warn('[PLAYLIST DETAILS API] Spotify resolver error:', e);
    }

    // Fallback to JioSaavn provider if Spotify resolver returned empty
    if (!resolvedSongs || resolvedSongs.length === 0) {
      try {
        const { JioSaavnProvider } = await import('@/lib/jioSaavnProvider');
        const saavn = JioSaavnProvider.getInstance(baseUrl);
        const songs = await saavn.getPlaylistSongs(playlistId);
        if (songs && songs.length > 0) {
          resolvedSongs = songs;
        }
      } catch (saavnErr) {
        console.warn('[PLAYLIST DETAILS API] JioSaavn fallback error:', saavnErr);
      }
    }

    const sourceTrackCount = (resolvedSongs as any)?.sourceTrackCount ?? resolvedSongs?.length ?? 0;
    const resolvedCount = (resolvedSongs as any)?.uniqueMatchedTrackCount ?? resolvedSongs?.length ?? 0;

    if (resolvedSongs && resolvedSongs.length > 0) {
      try {
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
      } catch {}

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

    return NextResponse.json({ success: false, error: 'Playlist not available' }, { status: 404 });
  } catch (err: any) {
    console.error('[PLAYLIST DETAILS API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
