import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface PreferenceProfile {
  topLanguages: Array<{ language: string; score: number }>;
  topArtists: Array<{ artistId: string; artistName?: string; score: number }>;
  topGenres: Array<{ genre: string; score: number }>;
  stats: {
    totalEvents: number;
    completionRate: number;
  };
}

// In-memory SWR cache (TTL 5 mins)
const profileCache = new Map<string, { data: PreferenceProfile; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data } = await supabaseAdmin.auth.getUser(token);
      userId = data?.user?.id || null;
    }

    if (!userId) {
      // Default guest taste profile
      return NextResponse.json({
        success: true,
        data: {
          topLanguages: [{ language: 'Telugu', score: 100 }],
          topArtists: [],
          topGenres: [{ genre: 'Melodies', score: 80 }],
          stats: { totalEvents: 0, completionRate: 1.0 },
        },
        source: 'GUEST_DEFAULT',
      });
    }

    const cacheKey = `prof_${userId}`;
    const cached = profileCache.get(cacheKey);

    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        source: 'CACHE_HIT',
      });
    }

    // Fetch user affinity records
    const [artistRes, eventsRes] = await Promise.all([
      supabaseAdmin
        .from('user_artist_affinity')
        .select('artist_id, score')
        .eq('user_id', userId)
        .order('score', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('listening_events')
        .select('event_type')
        .eq('user_id', userId)
        .limit(100),
    ]);

    const topArtists = (artistRes.data || []).map((a: any) => ({
      artistId: a.artist_id,
      score: a.score || 0,
    }));

    const events = eventsRes.data || [];
    const totalEvents = events.length;
    const completedCount = events.filter((e: any) => e.event_type === 'COMPLETE').length;
    const completionRate = totalEvents > 0 ? completedCount / totalEvents : 1.0;

    const profileData: PreferenceProfile = {
      topLanguages: [{ language: 'Telugu', score: 90 }],
      topArtists,
      topGenres: [{ genre: 'Melodies', score: 75 }],
      stats: {
        totalEvents,
        completionRate: parseFloat(completionRate.toFixed(2)),
      },
    };

    profileCache.set(cacheKey, {
      data: profileData,
      cachedAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      data: profileData,
      source: 'RESOLVED',
    });
  } catch (err) {
    return NextResponse.json({
      success: true,
      data: {
        topLanguages: [{ language: 'Telugu', score: 100 }],
        topArtists: [],
        topGenres: [],
        stats: { totalEvents: 0, completionRate: 1.0 },
      },
      error: 'Profile query fallback',
    });
  }
}
