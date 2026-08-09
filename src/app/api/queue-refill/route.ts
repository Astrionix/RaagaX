import { NextRequest, NextResponse } from 'next/server';
import { DiscoveryEngine } from '@/lib/discoveryEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const language = body.language || 'Telugu';
    const historyIds = Array.isArray(body.historyIds) ? body.historyIds : [];
    const likedIds = Array.isArray(body.likedIds) ? body.likedIds : [];
    const count = Math.min(Number(body.count) || 20, 30);
    const excludeIds = Array.isArray(body.excludeIds) ? body.excludeIds : [];
    const playbackContext = body.playbackContext || null;

    const host = req.headers.get('host') || 'localhost:3001';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${proto}://${host}`;
    const engine = DiscoveryEngine.getInstance(baseUrl);

    // If context has a seed song, push it to historyIds to prioritize it for recommendations
    if (playbackContext && playbackContext.seedSongId) {
      if (!historyIds.includes(playbackContext.seedSongId)) {
         historyIds.unshift(playbackContext.seedSongId);
      }
    }

    // Use DiscoveryEngine which guarantees real, playable audio URLs from the provider
    const songs = await engine.getQueueRefill(language, excludeIds, likedIds, historyIds, count);

    const safeSongs = songs.map(song => ({
      ...song,
      candidateSource: 'autoplay',
      baseScore: 1.0
    }));

    return NextResponse.json({
      success: true,
      data: { language, count: safeSongs.length, songs: safeSongs },
    });
  } catch (err) {
    console.error('[QUEUE REFILL API]', err);
    return NextResponse.json({ success: false, error: 'Refill failed' }, { status: 500 });
  }
}
