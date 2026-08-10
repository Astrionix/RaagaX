import { NextRequest, NextResponse } from 'next/server';
import { AlbumResolver } from '@/lib/albumResolver';
import { ShelfItem, HomeSection } from '@/types/home';
import { JioSaavnProvider } from '@/lib/jioSaavnProvider';
import { PlaylistResolver } from '@/lib/discovery/PlaylistResolver';
import { Song } from '@/types/music';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import { BROWSE_5_PLAYLISTS, TRENDING_SOURCES, NEW_RELEASES_SOURCES, CLASSICS_SOURCES, WEEKLY_RELEASE_SOURCES } from '@/lib/spotifySources';

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

async function getPlaylistWithSWR(
  baseUrl: string,
  playlistId: string | null,
  lang: string,
  category: string,
  saavn: JioSaavnProvider,
  resolver: PlaylistResolver
): Promise<Song[]> {
  if (!playlistId) {
    return saavn.searchSongs(`${lang} Top Songs`, 100);
  }

  // 1. Check Supabase Cache FIRST (Instant response)
  const { data: cached } = await supabaseAdmin
    .from('spotify_playlist_cache')
    .select('*')
    .eq('playlist_id', playlistId)
    .maybeSingle();

  if (cached && cached.data && (cached.data as Song[]).length > 0) {
    const isStale = new Date(cached.expires_at).getTime() < Date.now();
    const isUndersized = (cached.data as Song[]).length < 50;
    if (isStale || isUndersized) {
      triggerBackgroundSync(baseUrl, playlistId, lang, category);
    }
    return (cached.data as Song[]).slice(0, 100);
  }

  // 2. On Cache MISS: Trigger background sync immediately so future loads are instant
  triggerBackgroundSync(baseUrl, playlistId, lang, category);

  // Try live resolution with a strict 1.5s max race condition so UI never hangs
  try {
    const livePromise = resolver.resolveSpotifyPlaylist(playlistId, 100);
    const timeoutPromise = new Promise<Song[]>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 1500)
    );
    const liveResolved = await Promise.race([livePromise, timeoutPromise]);
    if (liveResolved && liveResolved.length > 0) {
      const expiresAt = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
      await supabaseAdmin.from('spotify_playlist_cache').upsert({
        playlist_id: playlistId,
        playlist_name: category,
        language: lang,
        data: liveResolved,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'playlist_id' });

      return liveResolved.slice(0, 100);
    }
  } catch (err) {
    // If live resolution times out or fails, fall back to fast JioSaavn response immediately
  }

  // 3. Lightning-fast fallback
  return saavn.searchSongs(`${lang} Top Songs`, 100);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang') || 'Telugu';

  try {
    const baseUrl = getBaseUrl(req);
    const albumResolver = new AlbumResolver(baseUrl);
    const playlistResolver = new PlaylistResolver(baseUrl);
    const saavn = JioSaavnProvider.getInstance(baseUrl);
    
    const trendingSource = TRENDING_SOURCES[lang] || TRENDING_SOURCES['Telugu'];
    const newReleasesSource = WEEKLY_RELEASE_SOURCES[lang] || NEW_RELEASES_SOURCES[lang] || NEW_RELEASES_SOURCES['Telugu'];
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
      getPlaylistWithSWR(baseUrl, trendingSource.id, lang, trendingSource.title, saavn, playlistResolver),
      getPlaylistWithSWR(baseUrl, newReleasesSource.id, lang, newReleasesSource.title, saavn, playlistResolver),
      getPlaylistWithSWR(baseUrl, classicsSource.id, lang, classicsSource.title, saavn, playlistResolver),
      getPlaylistWithSWR(baseUrl, extraPlaylists[0]?.id || null, lang, extraPlaylists[0]?.title || 'P1', saavn, playlistResolver),
      getPlaylistWithSWR(baseUrl, extraPlaylists[1]?.id || null, lang, extraPlaylists[1]?.title || 'P2', saavn, playlistResolver),
      getPlaylistWithSWR(baseUrl, extraPlaylists[2]?.id || null, lang, extraPlaylists[2]?.title || 'P3', saavn, playlistResolver),
      getPlaylistWithSWR(baseUrl, extraPlaylists[3]?.id || null, lang, extraPlaylists[3]?.title || 'P4', saavn, playlistResolver),
      getPlaylistWithSWR(baseUrl, extraPlaylists[4]?.id || null, lang, extraPlaylists[4]?.title || 'P5', saavn, playlistResolver),
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
        title: "This Week's Releases",
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
