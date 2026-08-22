import { NextResponse } from 'next/server';
import { apiFetch } from '#common/helpers';

export const dynamic = 'force-dynamic';

function cleanHtml(str?: string) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const COMPILATION_REGEX = /top\s*\d+|superhits|best\s*of|greatest\s*hits|valentines?\s*day|dance\s*dhamaka|party\s*mix|mashup|evergreen|remix\s*collection|anniversary\s*special|world\s*music\s*day|hits\s*\d{4}/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') || 'Telugu';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

  try {
    const { data: albumData, ok } = await apiFetch<any>({
      endpoint: 'content.getAlbums' as any,
      params: {
        n: 20,
        p: 1,
        language: lang.toLowerCase(),
      },
      cookieLanguage: lang.toLowerCase() === 'all' ? 'english,hindi,telugu,tamil,kannada,malayalam,punjabi,marathi,gujarati,bengali,bhojpuri,haryanvi' : lang.toLowerCase(),
    });

    if (ok && Array.isArray(albumData?.data)) {
      const items = albumData.data;
      const songs: any[] = [];
      const seenKeys = new Set<string>();

      for (const item of items) {
        const rawTitle = cleanHtml(item.title);
        const releaseDate = item.more_info?.release_date || (item.year ? `${item.year}-01-01` : undefined);
        const releaseYear = item.more_info?.release_date ? parseInt(item.more_info.release_date.slice(0, 4)) : (item.year ? parseInt(item.year) : 2026);

        if (COMPILATION_REGEX.test(rawTitle)) continue;
        if (releaseYear && releaseYear < 2023) continue;

        if (item.type === 'song') {
          const pa = item.more_info?.artistMap?.primary_artists || [];
          const artist = pa.length > 0
            ? pa.map((a: any) => a.name).join(', ')
            : cleanHtml(item.subtitle || item.more_info?.singers || 'Various Artists');
          const key = `${rawTitle.toLowerCase()}:::${artist.toLowerCase()}`;

          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            songs.push({
              id: item.id,
              title: rawTitle,
              artist,
              album: rawTitle,
              coverUrl: item.image ? item.image.replace('150x150', '500x500') : '/app-icon.png',
              language: lang,
              releaseDate,
              releaseYear,
              duration: parseInt(item.more_info?.duration) || 210,
              plays: parseInt(item.play_count) || 100000,
            });
          }
        } else {
          // Album
          const { data: details } = await apiFetch<any>({
            endpoint: 'content.getAlbumDetails' as any,
            params: { albumid: item.id },
            cookieLanguage: lang.toLowerCase(),
          });

          const albSongs = details?.list || details?.songs || [];
          const albDate = details?.release_date || releaseDate;
          const albYear = albDate ? parseInt(albDate.slice(0, 4)) : releaseYear;

          if (albYear && albYear < 2023) continue;

          for (const s of albSongs) {
            const sTitle = cleanHtml(s.song || s.title);
            if (COMPILATION_REGEX.test(sTitle)) continue;

            const pa = s.more_info?.artistMap?.primary_artists || [];
            const artist = pa.length > 0
              ? pa.map((a: any) => a.name).join(', ')
              : cleanHtml(s.singers || s.primary_artists || details?.artist || 'Various Artists');

            const key = `${sTitle.toLowerCase()}:::${artist.toLowerCase()}`;

            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              songs.push({
                id: s.id,
                title: sTitle,
                artist,
                album: rawTitle,
                coverUrl: (s.image || details?.image || item.image)?.replace('150x150', '500x500') || '/app-icon.png',
                language: lang,
                releaseDate: s.release_date || albDate,
                releaseYear: albYear,
                duration: parseInt(s.duration) || 210,
                plays: parseInt(s.play_count) || 100000,
              });
            }
          }
        }
      }

      if (songs.length > 0) {
        songs.sort((a, b) => new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime());
        return NextResponse.json(
          { success: true, data: songs.slice(0, limit) },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=3600',
            },
          }
        );
      }
    }

    return NextResponse.json(
      { success: true, data: [] },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=3600',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching new releases:', error);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
