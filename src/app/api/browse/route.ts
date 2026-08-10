import { NextRequest, NextResponse } from 'next/server';
import { AlbumResolver } from '@/lib/albumResolver';
import { ShelfItem, HomeSection } from '@/types/home';
import { JioSaavnProvider } from '@/lib/jioSaavnProvider';
import { Song } from '@/types/music';

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
    const saavn = JioSaavnProvider.getInstance(baseUrl);

    // Run parallel fetching
    const [
      trendingPlaylists,
      newReleasePlaylists,
      moodsPlaylists,
      movieAlbums,
      topAlbums
    ] = await Promise.all([
      saavn.searchPlaylists(`${lang} Trending Hits`, 1),
      saavn.searchPlaylists(`New Releases ${lang}`, 1),
      resolver.resolveAlbums(lang, `${lang} moods hits`, 15, 'playlist'),
      resolver.resolveAlbums(lang, `${lang} movies latest`, 30, 'album'),
      resolver.resolveAlbums(lang, `${lang} best albums`, 30, 'album')
    ]);

    let trendingSongs: Song[] = [];
    let newReleases: Song[] = [];

    const songPromises: Promise<any>[] = [];
    if (trendingPlaylists.length > 0) {
      songPromises.push(saavn.getPlaylistSongs(trendingPlaylists[0].id).then(songs => trendingSongs = songs.slice(0, 15)));
    } else {
      songPromises.push(saavn.searchSongs(`Trending ${lang}`, 15).then(songs => trendingSongs = songs));
    }

    if (newReleasePlaylists.length > 0) {
      songPromises.push(saavn.getPlaylistSongs(newReleasePlaylists[0].id).then(songs => newReleases = songs.slice(0, 15)));
    } else {
      songPromises.push(saavn.searchSongs(`Latest ${lang}`, 15).then(songs => newReleases = songs));
    }

    await Promise.all(songPromises);

    const sections: HomeSection[] = [];

    if (trendingSongs.length > 0) {
      sections.push({
        id: 'trending',
        title: 'Trending',
        type: 'carousel',
        items: trendingSongs.map(song => ({
          id: song.id,
          title: song.title,
          subtitle: song.artist,
          type: 'song',
          imageUrl: song.coverUrl,
          rawItem: song // Store song data for instant play
        }))
      });
    }

    if (newReleases.length > 0) {
      sections.push({
        id: 'new_releases',
        title: 'New Releases',
        type: 'carousel',
        items: newReleases.map(song => ({
          id: song.id,
          title: song.title,
          subtitle: song.artist,
          type: 'song',
          imageUrl: song.coverUrl,
          rawItem: song
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
