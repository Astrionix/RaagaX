import { NextRequest, NextResponse } from 'next/server';
import { DiscoveryEngine, DiscoveryLanguage, ResolvedSong } from '@/lib/discoveryEngine';

export const dynamic = 'force-dynamic';
// Hard cap: never wait more than 25s for discovery
const DISCOVERY_TIMEOUT_MS = 25000;

const VALID_LANGUAGES: DiscoveryLanguage[] = [
  'Telugu', 'Kannada', 'Tamil', 'Hindi', 'Malayalam', 'English',
];

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('host') || 'localhost:3001';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

function mapSong(entry: ResolvedSong, rank: number) {
  return {
    rank,
    isNew: entry.isNew,
    songId: entry.song.id,
    title: entry.song.title,
    artist: entry.song.artist,
    album: entry.song.album,
    artwork: entry.song.coverUrl,
    audioUrl: entry.song.audioUrl,
    duration: entry.song.duration,
    source: 'jiosaavn',
    sourceId: entry.sourceId,
    matchConfidence: entry.matchConfidence,
    compositeScore: entry.compositeScore,
    status: entry.status,
    playable: !!entry.song.audioUrl,
  };
}

function timeoutPromise<T>(ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(fallback), ms));
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
    const baseUrl = getBaseUrl(req);
    const engine = DiscoveryEngine.getInstance(baseUrl);

    // Run discovery with a hard timeout — never block forever
    const result = await Promise.race([
      engine.discover(language),
      timeoutPromise(DISCOVERY_TIMEOUT_MS, null),
    ]);

    if (!result) {
      // Timed out — return updating state
      return NextResponse.json({
        success: true,
        language,
        source: 'timeout',
        status: 'updating',
        data: { chart: null, songs: [], newReleases: [] },
      });
    }

    const apiStatus = result.status === 'empty' ? 'updating'
      : result.source === 'cache' ? 'ready'
      : result.status === 'ok' ? 'ready'
      : result.status === 'partial' ? 'stale'
      : 'updating';

    return NextResponse.json({
      success: true,
      language: result.language,
      source: result.source,
      status: apiStatus,
      data: {
        chart: {
          name: `RaagaX ${language} Top 10`,
          language: result.language,
          weekLabel: result.weekLabel,
          weekStart: result.weekStart,
          weekEnd: result.weekEnd,
          collectedAt: result.collectedAt,
        },
        songs: result.topChart.map((e, i) => mapSong(e, i + 1)),
        newReleases: result.newReleases.map((e, i) => mapSong(e, i + 1)),
      },
    });
  } catch (err) {
    console.error('[CHARTS API] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({
      success: true,
      language,
      source: 'error',
      status: 'error',
      data: { chart: null, songs: [], newReleases: [] },
    });
  }
}
