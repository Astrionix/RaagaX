import { NextRequest, NextResponse } from 'next/server';
import { AlbumResolver } from '@/lib/albumResolver';
import { ShelfItem, HomeSection } from '@/types/home';
import { JioSaavnProvider } from '@/lib/jioSaavnProvider';
import { Song } from '@/types/music';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const SPOTIFY_PLAYLISTS: Record<string, any> = {
  Telugu: {
    trending: '37i9dQZF1DWTt3gMo0DLxA',
    latest: 'aggregated_new_releases', // Special ID to trigger aggregation
    romance: '37i9dQZF1DX44F1QWqYoaV',
    pop: '37i9dQZF1EIdegp8DGOKNT',
    classics: '37i9dQZF1DX5EEpa9ekxRI',
  },
  Tamil: {
    trending: '37i9dQZF1DX4Im4BTs2WMg',
    latest: 'aggregated_new_releases',
    romance: '5TlgIY5CX9fQO4qvUWnPLh',
    pop: '37i9dQZF1DXaVmfUr97Uve',
    classics: null,
  },
  Kannada: {
    trending: '4TvxxFHYjBvRtaOrGl25N8',
    latest: 'aggregated_new_releases',
    romance: '37i9dQZF1DX2MvScOHAAiE',
    pop: '37i9dQZF1DX9i6vCEoH6jH',
    classics: '7pQiU6Zl6PgDUHUHUMZxEM',
  },
  Malayalam: {
    trending: '37i9dQZF1DWTYKFynxp6Fs',
    latest: 'aggregated_new_releases',
    romance: '37i9dQZF1DX3lmpQSniUBH',
    pop: '37i9dQZF1DX0YqJHUZrLcd',
    classics: '37i9dQZF1DXaDDXaHNhJDD',
  },
  Hindi: {
    trending: '37i9dQZF1DX0XUfTFmNBRM',
    latest: 'aggregated_new_releases',
    romance: '37i9dQZF1EIeJhaZUDlJS8',
    pop: '37i9dQZF1EIcOc4ILc4bgO',
    classics: '37i9dQZF1EIfFo1P2382IG',
  },
  English: {
    trending: '37i9dQZF1DXcBWIGoYBM5M',
    latest: 'aggregated_new_releases',
    romance: '37i9dQZF1DX7rOY2tZUw1k',
    pop: '37i9dQZF1DWWEcRhUVtL8n',
    classics: '37i9dQZF1DXaKIA8E7WcJj',
  },
  'All Languages': {
    trending: '37i9dQZF1DX4ghkRUdIogy',
    latest: 'aggregated_new_releases',
    romance: null,
    pop: '37i9dQZF1EIe9njJIhd9wt',
    classics: null,
  }
};


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
    return saavn.searchSongs(fallbackQuery, 15);
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
    const isUndersized = (cached.data as Song[]).length < 100;
    if (isStale || isUndersized) {
      triggerBackgroundSync(baseUrl, playlistId, lang, category);
    }
    return (cached.data as Song[]).slice(0, 100);
  }

  // Cache MISS. Trigger sync for future and fallback to JioSaavn for immediate response
  triggerBackgroundSync(baseUrl, playlistId, lang, category);
  return saavn.searchSongs(fallbackQuery, 15);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang') || 'Telugu';

  try {
    const baseUrl = getBaseUrl(req);
    const albumResolver = new AlbumResolver(baseUrl);
    const saavn = JioSaavnProvider.getInstance(baseUrl);
    const config = SPOTIFY_PLAYLISTS[lang] || SPOTIFY_PLAYLISTS['Hindi'];

    // Parallel fetch using SWR logic
    const [
      trendingSongs,
      latestSongs,
      romanceSongs,
      popSongs,
      classicSongs,
      movieAlbums, 
    ] = await Promise.all([
      getPlaylistWithSWR(baseUrl, config.trending, lang, 'trending', `Trending ${lang}`, saavn),
      getPlaylistWithSWR(baseUrl, config.latest, lang, 'latest', `Latest ${lang}`, saavn),
      getPlaylistWithSWR(baseUrl, config.romance, lang, 'romance', `${lang} Romance`, saavn),
      getPlaylistWithSWR(baseUrl, config.pop, lang, 'pop', `${lang} Pop`, saavn),
      getPlaylistWithSWR(baseUrl, config.classics, lang, 'classics', `${lang} Classics 90s`, saavn),
      albumResolver.resolveAlbums(lang, `${lang} movies latest`, 15, 'album'),
    ]);

    const sections: HomeSection[] = [];

    if (trendingSongs.length > 0) {
      sections.push({
        id: 'trending',
        title: `Trending Now ${lang !== 'All Languages' ? lang : ''}`,
        type: 'carousel',
        items: trendingSongs.map(song => ({
          id: song.id,
          title: song.title,
          subtitle: song.artist,
          type: 'song',
          imageUrl: song.coverUrl,
          rawItem: song 
        }))
      });
    }

    if (latestSongs.length > 0) {
      sections.push({
        id: 'new_releases',
        title: 'New Releases',
        type: 'carousel',
        items: latestSongs.map(song => ({
          id: song.id,
          title: song.title,
          subtitle: song.artist,
          type: 'song',
          imageUrl: song.coverUrl,
          rawItem: song
        }))
      });
    }

    if (romanceSongs.length > 0) {
      sections.push({
        id: 'moods',
        title: 'Love & Romance',
        type: 'carousel',
        items: romanceSongs.map(song => ({
          id: song.id,
          title: song.title,
          subtitle: song.artist,
          type: 'song',
          imageUrl: song.coverUrl,
          rawItem: song
        }))
      });
    }

    if (popSongs.length > 0) {
      sections.push({
        id: 'charts',
        title: 'Pop & Mixes',
        type: 'carousel',
        items: popSongs.map(song => ({
          id: song.id,
          title: song.title,
          subtitle: song.artist,
          type: 'song',
          imageUrl: song.coverUrl,
          rawItem: song
        }))
      });
    }

    if (classicSongs.length > 0) {
      sections.push({
        id: 'classics',
        title: 'Timeless Classics',
        type: 'carousel',
        items: classicSongs.map(song => ({
          id: song.id,
          title: song.title,
          subtitle: song.artist,
          type: 'song',
          imageUrl: song.coverUrl,
          rawItem: song
        }))
      });
    }

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
