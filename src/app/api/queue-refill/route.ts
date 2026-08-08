import { NextRequest, NextResponse } from 'next/server';
import { CandidateGenerator } from '@/lib/recommendation/CandidateGenerator';
import { Ranker } from '@/lib/recommendation/Ranker';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const language = body.language || 'Telugu';
    const historyIds = Array.isArray(body.historyIds) ? body.historyIds : [];
    const likedIds = Array.isArray(body.likedIds) ? body.likedIds : [];
    const count = Math.min(Number(body.count) || 20, 30);
    const currentSong = body.currentSong || null;
    const lastArtists = Array.isArray(body.lastArtists) ? body.lastArtists : [];

    // Stage 1: Candidate Generation
    const candidates = await CandidateGenerator.generateCandidates(
      currentSong,
      historyIds,
      likedIds,
      language,
      100 // Generate 100 candidates to rank
    );

    // Stage 2: Ranking & Diversity Filtering
    let rankedSongs = Ranker.rankCandidates(candidates, lastArtists, count);

    // Fallback if CandidateGenerator returns 0 (e.g., db is empty or disconnected)
    if (rankedSongs.length === 0) {
      const { DiscoveryEngine } = await import('@/lib/discoveryEngine');
      const host = req.headers.get('host') || 'localhost:3001';
      const proto = req.headers.get('x-forwarded-proto') || 'http';
      const baseUrl = `${proto}://${host}`;
      const engine = DiscoveryEngine.getInstance(baseUrl);
      const fallbackSongs = await engine.getQueueRefill(language, historyIds, likedIds, historyIds, count);
      rankedSongs = fallbackSongs.map(song => ({
        ...song,
        candidateSource: 'fresh',
        baseScore: 0.5
      }));
    }

    return NextResponse.json({
      success: true,
      data: { language, count: rankedSongs.length, songs: rankedSongs },
    });
  } catch (err) {
    console.error('[QUEUE REFILL API]', err);
    return NextResponse.json({ success: false, error: 'Refill failed' }, { status: 500 });
  }
}
