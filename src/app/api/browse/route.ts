import { NextRequest, NextResponse } from 'next/server';
import { AlbumResolver } from '@/lib/albumResolver';
import { ShelfItem, HomeSection } from '@/types/home';
import { JioSaavnProvider } from '@/lib/jioSaavnProvider';
import { Song } from '@/types/music';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import { NEW_SOURCES, TRENDING_SOURCES, NEW_RELEASES_SOURCES, CLASSICS_SOURCES } from '@/lib/spotifySources';

export const dynamic = 'force-dynamic';

const SPOTIFY_PLAYLISTS: Record<string, any> = {
  Telugu: {
    trending: TRENDING_SOURCES.Telugu.id,
    latest: NEW_RELEASES_SOURCES.Telugu.id,
    romance: NEW_SOURCES.Telugu.primary[2],
    pop: NEW_SOURCES.Telugu.secondary[0],
    classics: CLASSICS_SOURCES.Telugu.id,
  },
  Tamil: {
    trending: TRENDING_SOURCES.Tamil.id,
    latest: NEW_RELEASES_SOURCES.Tamil.id,
    romance: NEW_SOURCES.Tamil.primary[2],
    pop: NEW_SOURCES.Tamil.secondary[0],
    classics: CLASSICS_SOURCES.Tamil.id,
  },
  Kannada: {
    trending: TRENDING_SOURCES.Kannada.id,
    latest: NEW_RELEASES_SOURCES.Kannada.id,
    romance: NEW_SOURCES.Kannada.primary[2],
    pop: NEW_SOURCES.Kannada.secondary[0],
    classics: CLASSICS_SOURCES.Kannada.id,
  },
  Malayalam: {
    trending: TRENDING_SOURCES.Malayalam.id,
    latest: NEW_RELEASES_SOURCES.Malayalam.id,
    romance: NEW_SOURCES.Malayalam.primary[2],
    pop: null,
    classics: CLASSICS_SOURCES.Malayalam.id,
  },
  Hindi: {
    trending: TRENDING_SOURCES.Hindi.id,
    latest: NEW_RELEASES_SOURCES.Hindi.id,
    romance: NEW_SOURCES.Hindi.primary[2],
    pop: NEW_SOURCES.Hindi.secondary[0],
    classics: CLASSICS_SOURCES.Hindi.id,
  },
  English: {
    trending: TRENDING_SOURCES.English.id,
    latest: NEW_RELEASES_SOURCES.English.id,
    romance: NEW_SOURCES.English.primary[2],
    pop: NEW_SOURCES.English.secondary[0],
    classics: CLASSICS_SOURCES.English.id,
  },
  'All Languages': {
    trending: TRENDING_SOURCES.Telugu.id,
    latest: NEW_RELEASES_SOURCES.Hindi.id,
    romance: TRENDING_SOURCES.Tamil.id,
    pop: TRENDING_SOURCES.English.id,
    classics: CLASSICS_SOURCES.Telugu.id,
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
    const config = SPOTIFY_PLAYLISTS[lang] || SPOTIFY_PLAYLISTS['Hindi'];

    const trendingTitle = TRENDING_SOURCES[lang]?.title || `Trending Now ${lang !== 'All Languages' ? lang : ''}`;

    // Parallel fetch using SWR logic
    const [
      trendingSongs,
      latestSongs,
      romanceSongs,
      popSongs,
      classicSongs,
      movieAlbums, 
    ] = await Promise.all([
      getPlaylistWithSWR(baseUrl, config.trending, lang, 'trending', `${lang} Top Hits`, saavn),
      getPlaylistWithSWR(baseUrl, config.latest, lang, 'latest', `${lang} Latest Hits`, saavn),
      getPlaylistWithSWR(baseUrl, config.romance, lang, 'romance', `${lang} Love Songs`, saavn),
      getPlaylistWithSWR(baseUrl, config.pop, lang, 'pop', `${lang} Party Hits`, saavn),
      getPlaylistWithSWR(baseUrl, config.classics, lang, 'classics', `${lang} Melody Songs`, saavn),
      albumResolver.resolveAlbums(lang, `${lang} movies latest`, 15, 'album'),
    ]);

    const sections: HomeSection[] = [];

    if (trendingSongs.length > 0) {
      sections.push({
        id: 'trending',
        title: trendingTitle,
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
