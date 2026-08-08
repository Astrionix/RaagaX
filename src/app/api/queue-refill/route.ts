import { NextRequest, NextResponse } from 'next/server';
import { DiscoveryEngine, DiscoveryLanguage } from '@/lib/discoveryEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const language = (body.language || 'Telugu') as DiscoveryLanguage;
    const excludeIds = Array.isArray(body.excludeIds) ? body.excludeIds : [];
    const likedIds = Array.isArray(body.likedIds) ? body.likedIds : [];
    const historyIds = Array.isArray(body.historyIds) ? body.historyIds : [];
    const count = Math.min(Number(body.count) || 20, 30);

    const host = req.headers.get('host') || 'localhost:3001';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${proto}://${host}`;

    const engine = DiscoveryEngine.getInstance(baseUrl);
    const songs = await engine.getQueueRefill(language, excludeIds, likedIds, historyIds, count);

    return NextResponse.json({
      success: true,
      data: { language, count: songs.length, songs },
    });
  } catch (err) {
    console.error('[QUEUE REFILL API]', err);
    return NextResponse.json({ success: false, error: 'Refill failed' }, { status: 500 });
  }
}
