import { NextRequest, NextResponse } from 'next/server';
import { AlbumResolver } from '@/lib/albumResolver';
import { ShelfItem, HomeSection } from '@/types/home';
import { JioSaavnProvider } from '@/lib/jioSaavnProvider';
import { Song } from '@/types/music';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// --- Spotify Discovery Configuration ---
// These are Tier-1 Verified Editorial Playlists for high-quality discovery.
const SPOTIFY_PLAYLISTS: Record<string, any> = {
  Telugu: {
    trending: '37i9dQZF1DWTt3gMo0DLxA',   // Trending Now Telugu
    latest: '37i9dQZF1DWWwrjLPC16W7',     // Latest Telugu
    romance: '37i9dQZF1DX44F1QWqYoaV',    // Telugu Love Songs
    pop: '37i9dQZF1EIdegp8DGOKNT',        // Telugu Pop Mix
    classics: '37i9dQZF1DX5EEpa9ekxRI',   // All Out 90s Telugu
  },
  Tamil: {
    trending: '37i9dQZF1DX4Im4BTs2WMg',   // Trending Now Tamil
    latest: '37i9dQZF1DWVo4cdnikh7Z',     // Latest Tamil
    romance: '5TlgIY5CX9fQO4qvUWnPLh',    // Tamil Love Songs (Community Tier-2)
    pop: '37i9dQZF1DXaVmfUr97Uve',        // Tamil Pop
    classics: null,
  },
  Kannada: {
    trending: null,
    latest: '37i9dQZF1DWZqTcNLmb3sH',     // Latest Kannada
    romance: '37i9dQZF1DX2MvScOHAAiE',    // Kannada Romance
    pop: null,
    classics: null,
  },
  Malayalam: {
    trending: '37i9dQZF1DWTYKFynxp6Fs',   // Trending Now Malayalam
    latest: '37i9dQZF1DX688wU47emR9',     // Hot Hits Malayalam
    romance: '37i9dQZF1DX3lmpQSniUBH',    // Romantic Malayalam
    pop: '37i9dQZF1DX0YqJHUZrLcd',        // Feel Good Malayalam
    classics: '37i9dQZF1DXaDDXaHNhJDD',   // Mollywood Gold
  },
  Hindi: {
    trending: '37i9dQZF1DX0XUfTFmNBRM',   // Hot Hits Hindi
    latest: '37i9dQZF1DX4ghkRUdIogy',     // New Music Friday India
    romance: '37i9dQZF1EIeJhaZUDlJS8',    // Romantic Soft Bollywood Mix
    pop: '37i9dQZF1EIcOc4ILc4bgO',        // Party Bollywood Mix
    classics: '37i9dQZF1EIfFo1P2382IG',   // Energetic Classic Bollywood
  },
  English: {
    trending: '37i9dQZF1DXcBWIGoYBM5M',   // Today's Top Hits
    latest: '37i9dQZF1DX4JAvHpjipBk',     // New Music Friday
    romance: '37i9dQZF1DX7rOY2tZUw1k',    // Timeless Love Songs
    pop: '37i9dQZF1DWWEcRhUVtL8n',        // Indie Pop
    classics: '37i9dQZF1DXaKIA8E7WcJj',   // All Out 2000s
  },
  'All Languages': {
    trending: '37i9dQZF1DX4ghkRUdIogy',   // New Music Friday India
    latest: '37i9dQZF1DXcBWIGoYBM5M',     // Global Top Hits
    romance: null,
    pop: '37i9dQZF1EIe9njJIhd9wt',        // Happy Indian Music Mix
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
    // If expired, trigger background sync but return stale data immediately
    const isStale = new Date(cached.expires_at).getTime() < Date.now();
    if (isStale) {
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
