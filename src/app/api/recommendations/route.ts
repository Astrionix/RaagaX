import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { CandidateGenerator } from '@/lib/recommendation/CandidateGenerator';
import { Ranker } from '@/lib/recommendation/Ranker';

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

    // Stale-While-Revalidate: Return cache immediately if within TTL
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        source: 'CACHE_HIT',
      });
    }

    // Generate candidates & rank deterministically
    const candidates = await CandidateGenerator.generateCandidates(null, [], lang, limit * 2, userId);
    const rankedSongs = Ranker.rankCandidates(candidates, [], limit);

    // Update in-memory cache
    recCache.set(cacheKey, {
      data: rankedSongs,
      cachedAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      data: rankedSongs,
      source: 'RESOLVED',
    });
  } catch (err) {
    // Non-blocking fallback
    return NextResponse.json({
      success: true,
      data: [],
      error: 'Recommendations unavailable',
    });
  }
}
