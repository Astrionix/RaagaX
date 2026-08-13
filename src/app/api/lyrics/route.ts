import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trackId = searchParams.get('trackId') || '';
  const title = searchParams.get('title') || '';
  const artist = searchParams.get('artist') || '';

  if (!trackId && !title) {
    return NextResponse.json({ status: 'unavailable', rawText: '', message: 'Missing parameters' }, { status: 400 });
  }

  try {
    // Try fetching synced LRC lyrics from LRCLIB free open lyrics API
    const lrclibUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist.split(',')[0])}`;
    const res = await fetch(lrclibUrl, { signal: AbortSignal.timeout(3000) }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      const rawText = data.syncedLyrics || data.plainLyrics || '';
      if (rawText) {
        return NextResponse.json({
          status: 'ready',
          rawText,
          source: 'LRCLIB'
        });
      }
    }
  } catch (e) {
    console.warn('[Lyrics API] Fetch error:', e);
  }

  return NextResponse.json({
    status: 'unavailable',
    rawText: '',
    source: 'RaagaX'
  });
}
