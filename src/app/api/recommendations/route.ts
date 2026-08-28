import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { CandidateGenerator } from '@/lib/recommendation/CandidateGenerator';

export const dynamic = 'force-dynamic';

// In-memory SWR cache for recommendations (TTL 5 mins)
const recCache = new Map<string, { data: any; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = searchParams.get('lang') || 'Telugu';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const authHeader = req.headers.get('authorization');
    let userId: string | undefined = undefined;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data } = await supabaseAdmin.auth.getUser(token);
      userId = data?.user?.id || undefined;
    }

    const cacheKey = `rec_${userId || 'guest'}_${lang.toLowerCase()}_${limit}`;
    const cached = recCache.get(cacheKey);

    const revalidate = async () => {
      const candidates = await CandidateGenerator.generateCandidates(null, [], lang, limit * 2, userId);

      // Deterministic Server-side Ranking & Deduplication
      const seen = new Set<string>();
      const unique = candidates.filter(s => {
        if (!s || !s.id) return false;
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      // Score based on source priority and popularity
      const scored = unique.map(song => {
        let score = 0;
        switch (song.candidateSource) {
          case 'personalized':
            score += 25;
            break;
          case 'similar':
            score += 20;
            break;
          case 'trending':
            score += 15;
            break;
          case 'context':
            score += 10;
            break;
          case 'popular':
            score += 5;
            break;
        }
        if (song.popularity) score += (song.popularity / 10);
        return { song, score };
      });

      // Stable sort
      scored.sort((a, b) => {
        if (Math.abs(b.score - a.score) > 0.01) {
          return b.score - a.score;
        }
        return a.song.id.localeCompare(b.song.id);
      });

      const rankedSongs = scored.map(item => item.song).slice(0, limit);

      // Update in-memory cache
      recCache.set(cacheKey, {
        data: rankedSongs,
        cachedAt: Date.now(),
      });

      return rankedSongs;
    };

    if (cached) {
      const isFresh = Date.now() - cached.cachedAt < CACHE_TTL_MS;
      if (isFresh) {
        const response = NextResponse.json({
          success: true,
          data: cached.data,
          source: 'CACHE_HIT',
        });
        response.headers.set('Cache-Control', 'private, max-age=30');
        return response;
      } else {
        // Return stale and revalidate in background
        revalidate().catch((err) => console.error('[RecommendationsAPI] Background SWR failed:', err));
        const response = NextResponse.json({
          success: true,
          data: cached.data,
          source: 'CACHE_HIT_STALE',
        });
        response.headers.set('Cache-Control', 'private, max-age=30');
        return response;
      }
    }

    // Cache miss
    const rankedSongs = await revalidate();
    const response = NextResponse.json({
      success: true,
      data: rankedSongs,
      source: 'RESOLVED',
    });
    response.headers.set('Cache-Control', 'private, max-age=30');
    return response;
  } catch (err) {
    const response = NextResponse.json({
      success: true,
      data: [],
      error: 'Recommendations unavailable',
    });
    response.headers.set('Cache-Control', 'private, max-age=30');
    return response;
  }
}
