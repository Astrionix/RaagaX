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

function extractCover(img: any): string {
  if (!img) return '/app-icon.png';
  if (typeof img === 'string') return img.replace('http://', 'https://').replace(/150x150|50x50|300x300/g, '500x500');
  if (Array.isArray(img)) {
    const hi = img.find((i: any) => i?.quality === '500x500') || img[img.length - 1];
    return (hi?.url || hi?.link || '/app-icon.png').replace('http://', 'https://');
  }
  return (img.url || img.link || '/app-icon.png').replace('http://', 'https://');
}

// In-memory cache for charts (TTL 10 mins)
const chartsCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') || 'Telugu';
  const cacheKey = lang.toLowerCase().trim();

  const cached = chartsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({
      success: true,
      source: 'cache',
      language: lang,
      data: cached.data,
    });
  }

  try {
    const cookieLang = lang.toLowerCase() === 'all'
      ? 'english,hindi,telugu,tamil,kannada,malayalam,punjabi,marathi,gujarati,bengali,bhojpuri,haryanvi'
      : lang.toLowerCase();

    const { data, ok } = await apiFetch<any>({
      endpoint: 'content.getCharts' as any,
      params: {},
      cookieLanguage: cookieLang,
    });

    const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

    const mappedCharts = list.map((item: any) => ({
      id: item.id || item.listid,
      title: cleanHtml(item.title || item.listname || item.name),
      subtitle: cleanHtml(item.subtitle || item.header_desc || `${item.count || item.list_count || '50'} Songs`),
      coverUrl: extractCover(item.image),
      songCount: parseInt(item.count || item.list_count || item.more_info?.song_count) || 50,
      language: item.language || lang,
      type: 'chart',
    }));

    if (mappedCharts.length > 0) {
      chartsCache.set(cacheKey, { data: mappedCharts, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    return NextResponse.json({
      success: true,
      source: 'live',
      language: lang,
      data: mappedCharts,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch charts', data: [] },
      { status: 500 }
    );
  }
}
