import { NextRequest, NextResponse } from 'next/server';
import { AlbumResolver } from '@/lib/albumResolver';
import { ShelfItem, HomeSection } from '@/types/home';
import { DiscoveryEngine } from '@/lib/discoveryEngine';

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('host') || 'localhost:3001';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

function decode(s: string): string {
  return (s || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractImage(image: any): string {
  let coverUrl = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80';
  if (Array.isArray(image)) {
    const hi = image.find((i: any) => i.quality === '500x500') || image[image.length - 1];
    if (hi?.url) coverUrl = hi.url.replace('http://', 'https://');
  } else if (typeof image === 'string' && image) {
    coverUrl = image.replace('http://', 'https://');
  }
  return coverUrl;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang') || 'Telugu';

  try {
    const baseUrl = getBaseUrl(req);
    const resolver = new AlbumResolver(baseUrl);
    const engine = DiscoveryEngine.getInstance(baseUrl);

    // Run parallel fetching
    const [
      trendingSongs,
      newReleases,
      chartsPlaylists,
      moodsPlaylists,
      movieAlbums,
      topAlbums
    ] = await Promise.all([
      engine.discover(lang as any).then(res => res?.topChart || []),
      engine.discover(lang as any).then(res => res?.newReleases || []),
      resolver.resolveAlbums(lang, `${lang} top charts`, 15, 'playlist'),
      resolver.resolveAlbums(lang, `${lang} moods hits`, 12, 'playlist'),
      resolver.resolveAlbums(lang, `${lang} movies latest`, 10, 'album'),
      resolver.resolveAlbums(lang, `${lang} best albums`, 10, 'album')
    ]);

    const sections: HomeSection[] = [];

    if (trendingSongs.length > 0) {
      sections.push({
        id: 'trending',
        title: 'Trending',
        type: 'carousel',
        items: trendingSongs.map(entry => ({
          id: entry.song.id,
          title: entry.song.title,
          subtitle: entry.song.artist,
          type: 'song',
          imageUrl: entry.song.coverUrl,
          rawItem: entry.song // Store song data for instant play
        }))
      });
    }

    if (newReleases.length > 0) {
      sections.push({
        id: 'new_releases',
        title: 'New Releases',
        type: 'carousel',
        items: newReleases.map(entry => ({
          id: entry.song.id,
          title: entry.song.title,
          subtitle: entry.song.artist,
          type: 'song',
          imageUrl: entry.song.coverUrl,
          rawItem: entry.song
        }))
      });
    }

    if (chartsPlaylists.length > 0) {
      sections.push({
        id: 'charts',
        title: 'Charts',
        type: 'carousel',
        items: chartsPlaylists.map(item => ({
          id: item.id,
          title: item.title,
          subtitle: 'Saavn',
          type: 'playlist',
          imageUrl: item.coverUrl
        }))
      });
    }

    if (moodsPlaylists.length > 0) {
      sections.push({
        id: 'moods',
        title: 'Moods & Genres',
        type: 'carousel',
        items: moodsPlaylists.map(item => ({
          id: item.id,
          title: item.title,
          subtitle: 'Saavn',
          type: 'playlist',
          imageUrl: item.coverUrl
        }))
      });
    }

    if (movieAlbums.length > 0) {
      sections.push({
        id: 'movies',
        title: 'Movies',
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

    if (topAlbums.length > 0) {
      sections.push({
        id: 'albums',
        title: 'Albums',
        type: 'carousel',
        items: topAlbums.map(item => ({
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
