import { NextResponse } from 'next/server';

interface CachedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  expiresAt: number;
}

const videoCache = new Map<string, CachedVideo>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const songId = searchParams.get('songId') || '';
  const title = searchParams.get('title') || '';
  const artist = searchParams.get('artist') || '';
  const directVideoId = searchParams.get('videoId') || '';

  if (directVideoId && directVideoId.length === 11) {
    return NextResponse.json({
      success: true,
      available: true,
      videoId: directVideoId,
      thumbnail: `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${directVideoId}`,
    });
  }

  if (!title && !songId) {
    return NextResponse.json(
      { success: false, available: false, error: 'Title or songId required' },
      { status: 400 }
    );
  }

  const cacheKey = `${songId}_${title}_${artist}`.toLowerCase().trim();
  const cached = videoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({
      success: true,
      available: true,
      videoId: cached.videoId,
      title: cached.title,
      thumbnail: cached.thumbnail,
      embedUrl: `https://www.youtube-nocookie.com/embed/${cached.videoId}`,
      cached: true,
    });
  }

  try {
    const cleanTitle = title
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/feat\..*|ft\..*/gi, '')
      .trim();
    const cleanArtist = artist.split(/[,&/]/)[0].trim();
    const query = `${cleanTitle} ${cleanArtist} official music video`.trim();

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json({ success: true, available: false, error: 'Video search failed' });
    }

    const html = await res.text();
    const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);

    if (match && match[1]) {
      const videoId = match[1];
      const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      const videoData: CachedVideo = {
        videoId,
        title: `${title} - ${artist}`,
        thumbnail,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };

      videoCache.set(cacheKey, videoData);

      return NextResponse.json({
        success: true,
        available: true,
        videoId,
        title: videoData.title,
        thumbnail,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        cached: false,
      });
    }

    return NextResponse.json({ success: true, available: false });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      available: false,
      error: err?.message || 'Video resolution failed',
    });
  }
}
