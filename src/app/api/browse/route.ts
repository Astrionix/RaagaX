import { NextRequest, NextResponse } from 'next/server';
import { AlbumResolver } from '@/lib/albumResolver';
import { ShelfItem, HomeSection } from '@/types/home';
import { JioSaavnProvider } from '@/lib/jioSaavnProvider';
import { Song } from '@/types/music';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import { BROWSE_5_PLAYLISTS, TRENDING_SOURCES, NEW_RELEASES_SOURCES, CLASSICS_SOURCES } from '@/lib/spotifySources';

export const dynamic = 'force-dynamic';

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('host') || 'localhost:3001';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

async function triggerBackgroundSync(baseUrl: string, playlistId: string, lang: string, category: string) {
  try {
    // Fire and forget - do not await
    fetch(`${baseUrl}/api/cron/discovery?playlistId=${playlistId}&lang=${lang}&category=${category}`).catch(() => {});
  } catch(e) {}
}

async function getPlaylistWithSWR(baseUrl: string, playlistId: string | null, lang: string, category: string, fallbackQuery: string, saavn: JioSaavnProvider): Promise<Song[]> {
  if (!playlistId) {
    return saavn.searchSongs(fallbackQuery, 75);
  }

  // Check Supabase Cache
  const { data: cached } = await supabaseAdmin
    .from('spotify_playlist_cache')
    .select('*')
    .eq('playlist_id', playlistId)
    .maybeSingle();

  if (cached && cached.data) {
    // If expired OR if we have less than 100 songs (from the old limit), trigger background sync but return stale data immediately
    const isStale = new Date(cached.expires_at).getTime() < Date.now();
    const isUndersized = (cached.data as Song[]).length < 75;
    if (isStale || isUndersized) {
      triggerBackgroundSync(baseUrl, playlistId, lang, category);
    }
    return (cached.data as Song[]).slice(0, 100);
  }

  // Cache MISS. Trigger sync for future and fallback to JioSaavn for immediate response
  triggerBackgroundSync(baseUrl, playlistId, lang, category);
  return saavn.searchSongs(fallbackQuery, 75);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang') || 'Telugu';

  try {
    const baseUrl = getBaseUrl(req);
    const albumResolver = new AlbumResolver(baseUrl);
    const saavn = JioSaavnProvider.getInstance(baseUrl);
    const playlists = BROWSE_5_PLAYLISTS[lang] || BROWSE_5_PLAYLISTS['Telugu'];

    // Parallel fetch all 5 playlists + movie albums
    const [
      p1Songs,
      p2Songs,
      p3Songs,
      p4Songs,
      p5Songs,
      movieAlbums,
    ] = await Promise.all([
      getPlaylistWithSWR(baseUrl, playlists[0]?.id || null, lang, 'p1', playlists[0]?.title || `${lang} Top Hits`, saavn),
      getPlaylistWithSWR(baseUrl, playlists[1]?.id || null, lang, 'p2', playlists[1]?.title || `${lang} Hits`, saavn),
      getPlaylistWithSWR(baseUrl, playlists[2]?.id || null, lang, 'p3', playlists[2]?.title || `${lang} Mix`, saavn),
      getPlaylistWithSWR(baseUrl, playlists[3]?.id || null, lang, 'p4', playlists[3]?.title || `${lang} Beats`, saavn),
      getPlaylistWithSWR(baseUrl, playlists[4]?.id || null, lang, 'p5', playlists[4]?.title || `${lang} Classics`, saavn),
      albumResolver.resolveAlbums(lang, `${lang} movies latest`, 15, 'album'),
    ]);

    const fetchedPlaylists = [
      { info: playlists[0], songs: p1Songs, id: 'p1' },
      { info: playlists[1], songs: p2Songs, id: 'p2' },
      { info: playlists[2], songs: p3Songs, id: 'p3' },
      { info: playlists[3], songs: p4Songs, id: 'p4' },
      { info: playlists[4], songs: p5Songs, id: 'p5' },
    ];

    const sections: HomeSection[] = [];

    fetchedPlaylists.forEach(({ info, songs, id }) => {
      if (songs && songs.length > 0) {
        sections.push({
          id,
          title: info?.title || `Top ${lang} Playlist`,
          type: 'carousel',
          items: songs.map(song => ({
            id: song.id,
            title: song.title,
            subtitle: song.artist,
            type: 'song',
            imageUrl: song.coverUrl,
            rawItem: song
          }))
        });
      }
    });

    if (movieAlbums.length > 0) {
      sections.push({
        id: 'movies',
        title: 'Movies & Soundtracks',
        type: 'carousel',
        items: movieAlbums.map(item => ({
          id: item.id,
          title: item.title,
          subtitle: item.artist,
          type: 'album',
          imageUrl: item.coverUrl
        }))
      });
    }

    return NextResponse.json({ success: true, sections });
  } catch (err) {
    console.error('[BROWSE API] Error:', err);
    return NextResponse.json({ success: false, sections: [] });
  }
}
