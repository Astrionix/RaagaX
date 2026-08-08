import { NextRequest, NextResponse } from 'next/server';
import { DiscoveryLanguage } from '@/lib/discoveryEngine';
import { getSupabase } from '@/lib/supabase';

const VALID_LANGUAGES: DiscoveryLanguage[] = [
  'Telugu', 'Kannada', 'Tamil', 'Hindi', 'Malayalam', 'English',
];

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('host') || 'localhost:3001';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawLang = searchParams.get('language') || 'Telugu';
  const language = rawLang as DiscoveryLanguage;

  if (!VALID_LANGUAGES.includes(language)) {
    return NextResponse.json(
      { success: false, error: `Invalid language. Valid: ${VALID_LANGUAGES.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    // 1. Try to fetch from Supabase
    const { data: chart, error: chartError } = await getSupabase()
      .from('charts')
      .select('*')
      .eq('language', language)
      .eq('chart_type', 'Top 10')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    let songs: any[] = [];
    let isStale = true;
    let hasCache = false;

    if (chart && !chartError) {
      hasCache = true;
      const { data: entries } = await getSupabase()
        .from('chart_entries')
        .select('*')
        .eq('chart_id', chart.id)
        .order('rank', { ascending: true });

      if (entries && entries.length > 0) {
        songs = entries.map(e => ({
          rank: e.rank,
          isNew: e.is_new,
          songId: e.song_id,
          title: e.title,
          artist: e.artist,
          album: e.album,
          artwork: e.artwork,
          audioUrl: e.audio_url,
          duration: e.duration,
          sourceId: e.source_id,
          matchConfidence: e.match_confidence,
          compositeScore: e.score,
          status: e.status,
          playable: !!e.audio_url,
        }));
      }

      // Check if stale (older than 24 hours)
      const updatedAt = new Date(chart.updated_at).getTime();
      const now = Date.now();
      isStale = (now - updatedAt) > 24 * 60 * 60 * 1000;
    }

    // 2. If stale or no cache, trigger background worker
    if (isStale || !hasCache) {
      // Trigger worker without awaiting
      fetch(`${getBaseUrl(req)}/api/charts/worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      }).catch(err => console.error('[WORKER TRIGGER ERROR]', err));
    }

    // 3. Return appropriate response
    if (hasCache) {
      return NextResponse.json({
        success: true,
        language,
        source: 'supabase',
        status: isStale ? 'stale' : 'ready',
        data: {
          chart: {
            name: `RaagaX ${language} Top 10`,
            language,
            weekLabel: chart.period_start, // Using period_start as week label temporarily
            weekStart: chart.period_start,
            weekEnd: chart.period_end,
            collectedAt: chart.updated_at,
          },
          songs,
          newReleases: [], // Optionally fetch new releases from a different chart_type later
        },
      });
    } else {
      // No cache at all
      return NextResponse.json({
        success: true,
        language,
        source: 'none',
        status: 'updating',
        data: {
          chart: null,
          songs: [],
          newReleases: [],
        },
      });
    }

  } catch (err) {
    console.error('[CHARTS API] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({
      success: true,
      language,
      source: 'error',
      status: 'error',
      data: {
        chart: null,
        songs: [],
        newReleases: [],
      },
    });
  }
}
