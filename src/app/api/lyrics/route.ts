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
    // 1. Clean track name (strip soundtrack/regional tags like '(From ...)', '(Telugu)', etc.)
    const cleanTitle = title
      .replace(/\s*\([^)]*(?:from|soundtrack|version|original|lyric|video|telugu|hindi|tamil|audio)[^)]*\)/gi, '')
      .replace(/\s*\[[^\]]*(?:from|soundtrack|version|original|lyric|video|telugu|hindi|tamil|audio)[^\]]*\]/gi, '')
      .replace(/\s*-\s*(?:from|telugu|hindi|tamil|audio|video|soundtrack|remix).*$/gi, '')
      .trim();

    const cleanArtist = artist.split(/[,&/]/)[0].trim();

    // Strategy A: Exact lookup with cleaned title & primary artist
    const queries = [
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle || title)}&artist_name=${encodeURIComponent(cleanArtist)}`,
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(cleanArtist)}`,
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle || title} ${cleanArtist}`)}`
    ];

    for (const queryUrl of queries) {
      try {
        const res = await fetch(queryUrl, { signal: AbortSignal.timeout(3500) }).catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          let rawText = '';
          let source = 'LRCLIB';

          if (Array.isArray(data)) {
            // Search endpoint returned array
            const best = data.find((item: any) => item.syncedLyrics || item.plainLyrics);
            if (best) {
              rawText = best.syncedLyrics || best.plainLyrics || '';
            }
          } else if (data && (data.syncedLyrics || data.plainLyrics)) {
            rawText = data.syncedLyrics || data.plainLyrics || '';
          }

          if (rawText) {
            return NextResponse.json({
              status: 'ready',
              rawText,
              source
            });
          }
        }
      } catch {}
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
