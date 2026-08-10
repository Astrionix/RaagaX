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
    return saavn.searchSongs(fallbackQuery, 100);
  }

  // Check Supabase Cache
  const { data: cached } = await supabaseAdmin
    .from('spotify_playlist_cache')
    .select('*')
    .eq('playlist_id', playlistId)
    .maybeSingle();

  if (cached && cached.data) {
    // If expired OR if we have less than 100 songs, trigger background sync but return stale data immediately
    const isStale = new Date(cached.expires_at).getTime() < Date.now();
    const isUndersized = (cached.data as Song[]).length < 100;
    if (isStale || isUndersized) {
      triggerBackgroundSync(baseUrl, playlistId, lang, category);
    }
    return (cached.data as Song[]).slice(0, 100);
  }

  // Cache MISS. Trigger sync for future and fallback to JioSaavn for immediate response
  triggerBackgroundSync(baseUrl, playlistId, lang, category);
  return saavn.searchSongs(fallbackQuery, 100);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang') || 'Telugu';

  try {
    const baseUrl = getBaseUrl(req);
    const albumResolver = new AlbumResolver(baseUrl);
    const saavn = JioSaavnProvider.getInstance(baseUrl);
    
    const trendingSource = TRENDING_SOURCES[lang] || TRENDING_SOURCES['Telugu'];
    const newReleasesSource = NEW_RELEASES_SOURCES[lang] || NEW_RELEASES_SOURCES['Telugu'];
    const classicsSource = CLASSICS_SOURCES[lang] || CLASSICS_SOURCES['Telugu'];
    const extraPlaylists = BROWSE_5_PLAYLISTS[lang] || BROWSE_5_PLAYLISTS['Telugu'];

    // Parallel fetch all core categories + expanded playlists + movie albums
    const [
      trendingSongs,
      newReleaseSongs,
      classicSongs,
      p1Songs,
      p2Songs,
      p3Songs,
      p4Songs,
      p5Songs,
      movieAlbums,
    ] = await Promise.all([
      getPlaylistWithSWR(baseUrl, trendingSource.id, lang, 'trending', `${lang} Top Hits`, saavn),
      getPlaylistWithSWR(baseUrl, newReleasesSource.id, lang, 'new_releases', `${lang} Latest Hits`, saavn),
      getPlaylistWithSWR(baseUrl, classicsSource.id, lang, 'classics', `${lang} Melody Songs`, saavn),
      getPlaylistWithSWR(baseUrl, extraPlaylists[0]?.id || null, lang, 'p1', extraPlaylists[0]?.title || `${lang} Hits`, saavn),
      getPlaylistWithSWR(baseUrl, extraPlaylists[1]?.id || null, lang, 'p2', extraPlaylists[1]?.title || `${lang} Mix`, saavn),
      getPlaylistWithSWR(baseUrl, extraPlaylists[2]?.id || null, lang, 'p3', extraPlaylists[2]?.title || `${lang} Indie`, saavn),
      getPlaylistWithSWR(baseUrl, extraPlaylists[3]?.id || null, lang, 'p4', extraPlaylists[3]?.title || `${lang} Beats`, saavn),
      getPlaylistWithSWR(baseUrl, extraPlaylists[4]?.id || null, lang, 'p5', extraPlaylists[4]?.title || `${lang} Popular`, saavn),
      albumResolver.resolveAlbums(lang, `${lang} movies latest`, 15, 'album'),
    ]);

    const sections: HomeSection[] = [];
    const addedPlaylistIds = new Set<string>();

    // 1. Trending Now Section
    if (trendingSongs.length > 0) {
      addedPlaylistIds.add(trendingSource.id);
      sections.push({
        id: 'trending',
        title: trendingSource.title,
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

    // 2. New Releases Section
    if (newReleaseSongs.length > 0 && !addedPlaylistIds.has(newReleasesSource.id)) {
      addedPlaylistIds.add(newReleasesSource.id);
      sections.push({
        id: 'new_releases',
        title: newReleasesSource.title,
        type: 'carousel',
        items: newReleaseSongs.map(song => ({
          id: song.id,
          title: song.title,
          subtitle: song.artist,
          type: 'song',
          imageUrl: song.coverUrl,
          rawItem: song
        }))
      });
    }

    // 3. Timeless Classics Section
    if (classicSongs.length > 0 && !addedPlaylistIds.has(classicsSource.id)) {
      addedPlaylistIds.add(classicsSource.id);
      sections.push({
        id: 'classics',
        title: classicsSource.title,
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

    // 4. Expanded Curated Playlists
    const extraFetched = [
      { info: extraPlaylists[0], songs: p1Songs, id: 'p1' },
      { info: extraPlaylists[1], songs: p2Songs, id: 'p2' },
      { info: extraPlaylists[2], songs: p3Songs, id: 'p3' },
      { info: extraPlaylists[3], songs: p4Songs, id: 'p4' },
      { info: extraPlaylists[4], songs: p5Songs, id: 'p5' },
    ];

    extraFetched.forEach(({ info, songs, id }) => {
      if (info && songs && songs.length > 0 && !addedPlaylistIds.has(info.id)) {
        addedPlaylistIds.add(info.id);
        sections.push({
          id,
          title: info.title,
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

    // 5. Movies & Soundtracks Section
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
