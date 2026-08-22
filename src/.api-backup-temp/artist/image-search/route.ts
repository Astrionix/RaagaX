import { NextResponse } from 'next/server';
import { JioSaavnProvider } from '@/lib/jioSaavnProvider';
import cachedArtistsData from '@/lib/cached_artists.json';

export const dynamic = 'force-dynamic';

const cachedArtists = cachedArtistsData as Record<string, any[]>;
const serverMemoryCache = new Map<string, string>();

/**
 * Validates whether an image URL is active and reachable.
 */
async function validateImageUrl(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      return contentType.startsWith('image/') || contentType.includes('octet-stream');
    }
  } catch {}
  return false;
}

/**
 * Open Music / Wikipedia verified artist portrait lookup
 */
async function fetchWikipediaArtistImage(name: string): Promise<string | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      name
    )}&prop=pageimages&format=json&pithumbsize=600&origin=*`;

    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;

    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;

    for (const pageId in pages) {
      const page = pages[pageId];
      if (page?.thumbnail?.source) {
        const src = page.thumbnail.source;
        if (!src.endsWith('.svg') && !src.includes('Disambig') && !src.includes('Icon')) {
          return src;
        }
      }
    }
  } catch {}
  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name')?.trim();
    const id = searchParams.get('id')?.trim();
    const lang = searchParams.get('lang')?.trim();

    if (!name && !id) {
      return NextResponse.json({ success: false, error: 'Artist name or ID is required' }, { status: 400 });
    }

    const artistName = name || '';
    const cacheKey = (artistName + (id || '')).toLowerCase();

    // 1. Server Memory Cache
    if (serverMemoryCache.has(cacheKey)) {
      return NextResponse.json({
        success: true,
        imageUrl: serverMemoryCache.get(cacheKey),
        source: 'server_cache',
      });
    }

    // 2. Bundled Seed / Cached Catalog
    for (const langKey in cachedArtists) {
      const list = cachedArtists[langKey];
      const match = list.find(
        (a) =>
          (id && a.id === id) ||
          (artistName && a.name?.toLowerCase() === artistName.toLowerCase())
      );
      if (match && match.imageUrl) {
        serverMemoryCache.set(cacheKey, match.imageUrl);
        return NextResponse.json({
          success: true,
          imageUrl: match.imageUrl,
          source: 'catalog',
        });
      }
    }

    // 3. JioSaavn Provider Search
    try {
      const provider = JioSaavnProvider.getInstance();
      const results = await provider.searchArtists(artistName);
      if (results && results.length > 0) {
        const top = results[0];
        if (top.imageUrl && (top.imageUrl.includes('500x500') || top.imageUrl.includes('150x150'))) {
          const highRes = top.imageUrl.replace('150x150', '500x500').replace('50x50', '500x500');
          serverMemoryCache.set(cacheKey, highRes);
          return NextResponse.json({
            success: true,
            imageUrl: highRes,
            source: 'provider',
          });
        }
      }
    } catch {}

    // 4. Wikipedia / Open Database Fallback
    const wikiImage = await fetchWikipediaArtistImage(artistName);
    if (wikiImage) {
      const isValid = await validateImageUrl(wikiImage);
      if (isValid) {
        serverMemoryCache.set(cacheKey, wikiImage);
        return NextResponse.json({
          success: true,
          imageUrl: wikiImage,
          source: 'wikipedia_verified',
        });
      }
    }

    // 5. Google Custom Search Engine (if credentials provided in environment)
    if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
      try {
        const query = `"${artistName}" singer artist portrait`;
        const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${
          process.env.GOOGLE_SEARCH_API_KEY
        }&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(
          query
        )}&searchType=image&num=3&imgType=photo&imgSize=medium`;

        const gRes = await fetch(googleUrl, { signal: AbortSignal.timeout(4000) });
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.items && gData.items.length > 0) {
            for (const item of gData.items) {
              const candidate = item.link;
              if (candidate && (await validateImageUrl(candidate))) {
                serverMemoryCache.set(cacheKey, candidate);
                return NextResponse.json({
                  success: true,
                  imageUrl: candidate,
                  source: 'google',
                });
              }
            }
          }
        }
      } catch {}
    }

    return NextResponse.json({
      success: false,
      error: 'No verified artist image found',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
