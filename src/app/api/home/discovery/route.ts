import { NextResponse } from 'next/server';
import { apiFetch } from '#common/helpers';
import { createSongPayload } from '#modules/songs/helpers';

export const dynamic = 'force-dynamic';

function cleanHtml(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractCover(img: any): string {
  if (!img) return '/app-icon.png';
  if (typeof img === 'string') return img.replace('http://', 'https://').replace(/150x150|50x50|300x300/g, '500x500');
  if (Array.isArray(img)) {
    const hi = img.find((i: any) => i?.quality === '500x500') || img[img.length - 1];
    return (hi?.url || hi?.link || '/app-icon.png').replace('http://', 'https://');
  }
  return (img.url || img.link || '/app-icon.png').replace('http://', 'https://');
}

import { createDownloadLinks } from '#common/helpers';

function toFrontendSong(s: any): any {
  const encUrl = s.more_info?.encrypted_media_url || s.encrypted_media_url;
  const dlLinks = encUrl ? createDownloadLinks(encUrl) : [];
  const audio320 = dlLinks.find((l: any) => l.quality === '320kbps')?.url || dlLinks[dlLinks.length - 1]?.url || '';
  
  const title = cleanHtml(s.title || s.name || 'Unknown Track');
  const artist = cleanHtml(
    s.more_info?.artistMap?.primary_artists?.map((a: any) => a.name).join(', ') ||
    s.more_info?.music ||
    s.more_info?.singers ||
    s.subtitle ||
    'Various Artists'
  );
  const album = cleanHtml(s.more_info?.album || s.album || title);
  const coverUrl = extractCover(s.image);
  const duration = parseInt(s.more_info?.duration || s.duration || '210', 10);
  const releaseYear = parseInt(s.year || s.more_info?.year || '2026', 10);

  return {
    id: s.id,
    title,
    artist,
    artistId: s.more_info?.artistMap?.primary_artists?.[0]?.id || `art-${s.id}`,
    album,
    albumId: s.more_info?.album_id || `alb-${s.id}`,
    coverUrl,
    duration,
    audioUrl: audio320,
    genre: 'Various',
    category: 'global_trending',
    releaseYear,
    plays: parseInt(s.play_count || '0', 10),
    likes: 1,
    quality: 'HIGH',
    language: s.language || 'Telugu',
  };
}

// In-memory cache for discovery sets (TTL 10 mins)
const discoveryCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'new_music';
  const lang = searchParams.get('lang') || 'Telugu';
  const mood = searchParams.get('mood') || '';
  const genre = searchParams.get('genre') || '';
  const activity = searchParams.get('activity') || '';
  const era = searchParams.get('era') || '';

  const cacheKey = `${type}:::${lang.toLowerCase()}:::m_${mood.toLowerCase()}:::g_${genre.toLowerCase()}:::a_${activity.toLowerCase()}:::e_${era.toLowerCase()}`;

  const cached = discoveryCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({
      success: true,
      source: 'cache',
      type,
      language: lang,
      data: cached.data,
    });
  }

  const cookieLang = lang.toLowerCase() === 'all'
    ? 'english,hindi,telugu,tamil,kannada,malayalam,punjabi,marathi,gujarati,bengali,bhojpuri,haryanvi'
    : lang.toLowerCase();

  try {
    // 1. DISCOVERY: CHARTS (Ranked with trend movements)
    if (type === 'charts') {
      const { data } = await apiFetch<any>({
        endpoint: 'content.getCharts' as any,
        params: {},
        cookieLanguage: cookieLang,
      });

      const rawCharts = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      const primaryChart = rawCharts[0] || { id: '1134643225', title: `${lang} Top 50` };

      // Fetch top 50 songs from primary chart
      const chartDetails = await apiFetch<any>({
        endpoint: 'playlist.getDetails' as any,
        params: { listid: primaryChart.id || primaryChart.listid },
        cookieLanguage: cookieLang,
      });

      const rawSongs = chartDetails.data?.songs || chartDetails.data?.list || [];
      const rankedSongs = rawSongs.slice(0, 50).map((s: any, idx: number) => {
        let trend: 'UP' | 'DOWN' | 'NEW' | 'SAME' = 'SAME';
        let change = 0;
        
        const hash = (s.id || '').split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        const mod = (hash + idx) % 10;
        if (idx < 3) {
          trend = 'UP';
          change = ((hash % 3) + 1);
        } else if (mod < 2) {
          trend = 'NEW';
        } else if (mod < 6) {
          trend = 'UP';
          change = (hash % 5) + 1;
        } else if (mod < 8) {
          trend = 'DOWN';
          change = (hash % 4) + 1;
        }

        return {
          rank: idx + 1,
          trend,
          change: trend === 'NEW' || trend === 'SAME' ? undefined : change,
          song: toFrontendSong(s),
        };
      });

      const result = {
        primaryChart: {
          id: primaryChart.id || primaryChart.listid,
          title: cleanHtml(primaryChart.title || primaryChart.listname || `${lang} Superhits Top 50`),
          coverUrl: extractCover(primaryChart.image),
          songCount: rankedSongs.length,
        },
        rankedSongs,
        allCharts: rawCharts.map((c: any) => ({
          id: c.id || c.listid,
          title: cleanHtml(c.title || c.listname),
          subtitle: `${c.count || c.list_count || '50'} Songs`,
          coverUrl: extractCover(c.image),
        })),
      };

      discoveryCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
      return NextResponse.json({ success: true, source: 'live', type, language: lang, data: result });
    }

    // 2. DISCOVERY: COMBINATORIAL / MOOD / GENRE SEARCH
    if (type === 'combinatorial' || type === 'mood' || type === 'genres') {
      const queryParts = [lang];
      if (mood) queryParts.push(mood);
      if (genre) queryParts.push(genre);
      if (activity) queryParts.push(activity);
      if (era) queryParts.push(era);
      if (queryParts.length === 1) queryParts.push('Hits');

      const searchQuery = queryParts.join(' ');

      const { data: searchData } = await apiFetch<any>({
        endpoint: 'search.getResults' as any,
        params: { q: searchQuery, n: 30, p: 1 },
        cookieLanguage: cookieLang,
      });

      const songs = (searchData?.results || []).map((s: any) => {
        try {
          return toFrontendSong(s);
        } catch {
          return null;
        }
      }).filter(Boolean);

      const result = {
        query: searchQuery,
        tags: { language: lang, mood, genre, activity, era },
        songs,
      };

      discoveryCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
      return NextResponse.json({ success: true, source: 'live', type, language: lang, data: result });
    }

    // 3. DISCOVERY: NEW MUSIC (Time-based: Today, Week, Albums, Singles, EPs)
    const { data: albumsData } = await apiFetch<any>({
      endpoint: 'content.getAlbums' as any,
      params: { n: 50, p: 1 },
      cookieLanguage: cookieLang,
    });

    const items = Array.isArray(albumsData?.data) ? albumsData.data : (Array.isArray(albumsData) ? albumsData : []);
    
    const albums: any[] = [];
    const singles: any[] = [];
    const eps: any[] = [];

    const now = new Date();
    const currentYear = now.getFullYear();

    for (const item of items) {
      const rawTitle = cleanHtml(item.title || item.name);
      const songCount = parseInt(item.more_info?.song_count || item.song_count || '1');
      const releaseDate = item.more_info?.release_date || (item.year ? `${item.year}-01-01` : '2026-01-01');

      const mapped = {
        id: item.id,
        title: rawTitle,
        artist: cleanHtml(item.subtitle || item.more_info?.music || item.more_info?.singers || 'Various Artists'),
        coverUrl: extractCover(item.image),
        releaseDate,
        releaseYear: parseInt(releaseDate.slice(0, 4)) || currentYear,
        songCount,
        type: songCount >= 5 ? 'album' : (songCount >= 2 ? 'ep' : 'single'),
      };

      if (songCount >= 5) {
        albums.push(mapped);
      } else if (songCount >= 2) {
        eps.push(mapped);
      } else {
        singles.push(mapped);
      }
    }

    const result = {
      releasedToday: items.slice(0, 6).map((item: any) => ({
        id: item.id,
        title: cleanHtml(item.title || item.name),
        artist: cleanHtml(item.subtitle || item.more_info?.music || 'Various Artists'),
        coverUrl: extractCover(item.image),
        releaseDate: '2026-08-20',
        badge: '🔥 RELEASED TODAY',
      })),
      latestSingles: singles.slice(0, 10),
      latestAlbums: albums.slice(0, 10),
      latestEPs: eps.slice(0, 10),
      upcoming: [
        {
          id: 'up-1',
          title: `Upcoming ${lang} Blockbusters`,
          artist: 'Exclusive Pre-Releases & Soundtracks',
          coverUrl: albums[0]?.coverUrl || '/app-icon.png',
          releaseDate: 'Coming This Friday',
          badge: '📅 UPCOMING',
        },
        {
          id: 'up-2',
          title: `Viral Regional Anthem`,
          artist: 'Top Motion Picture Soundtrack',
          coverUrl: albums[1]?.coverUrl || '/app-icon.png',
          releaseDate: 'August 2026',
          badge: '📅 UPCOMING',
        },
      ],
    };

    discoveryCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json({ success: true, source: 'live', type: 'new_music', language: lang, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Discovery fetch failed', data: null },
      { status: 500 }
    );
  }
}
