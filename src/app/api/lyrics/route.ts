import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

function cleanString(str: string): string {
  return (str || '')
    .replace(/\s*\([^)]*(?:from|soundtrack|version|original|lyric|video|telugu|hindi|tamil|audio|remix|feat|ft\.)[^)]*\)/gi, '')
    .replace(/\s*\[[^\]]*(?:from|soundtrack|version|original|lyric|video|telugu|hindi|tamil|audio|remix|feat|ft\.)[^\]]*\]/gi, '')
    .replace(/\s*-\s*(?:from|telugu|hindi|tamil|audio|video|soundtrack|remix).*$/gi, '')
    .trim();
}

function decodeHtmlEntities(s: string): string {
  return (s || '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]*>/g, '');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trackId = searchParams.get('trackId') || '';
  const title = searchParams.get('title') || '';
  const artist = searchParams.get('artist') || '';
  const durationMsStr = searchParams.get('durationMs') || '';
  const durationSec = durationMsStr ? Math.round(parseInt(durationMsStr) / 1000) : 0;

  if (!trackId && !title) {
    return NextResponse.json(
      { status: 'unavailable', rawText: '', message: 'Missing trackId or title parameter' },
      { status: 400, headers: corsHeaders }
    );
  }

  // 1. Try JioSaavn official lyrics endpoint if trackId is available
  if (trackId && !trackId.startsWith('song-') && !trackId.startsWith('local-')) {
    try {
      const saavnLyricsUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&ctx=web6dot0&api_version=4&_format=json&lyrics_id=${encodeURIComponent(trackId)}`;
      const saavnRes = await fetch(saavnLyricsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(3500),
      }).catch(() => null);

      if (saavnRes && saavnRes.ok) {
        const saavnJson = await saavnRes.json();
        if (saavnJson && saavnJson.lyrics) {
          const rawText = decodeHtmlEntities(saavnJson.lyrics);
          if (rawText && rawText.trim().length > 10) {
            return NextResponse.json(
              {
                status: 'ready',
                rawText,
                source: 'JioSaavn',
                synced: false,
              },
              { headers: corsHeaders }
            );
          }
        }
      }
    } catch (err) {
      console.warn('[Lyrics API] JioSaavn lyrics lookup failed:', err);
    }
  }

  // 2. Try LRCLIB for synced & plain lyrics
  try {
    const cleanTitle = cleanString(title);
    const cleanArtist = artist.split(/[,&/]/)[0].trim();

    const lrclibQueries = [
      // Exact track + artist + duration
      durationSec > 0 
        ? `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle || title)}&artist_name=${encodeURIComponent(cleanArtist)}&duration=${durationSec}`
        : null,
      // Exact track + artist
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle || title)}&artist_name=${encodeURIComponent(cleanArtist)}`,
      // Raw track + artist
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(cleanArtist)}`,
      // Search fallback
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle || title} ${cleanArtist}`)}`,
      // Search by title only
      `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle || title)}`
    ].filter(Boolean) as string[];

    for (const queryUrl of lrclibQueries) {
      try {
        const res = await fetch(queryUrl, {
          headers: {
            'User-Agent': 'RaagaX-MusicApp/2.0.0 (https://raagax.com)',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(3000),
        }).catch(() => null);

        if (res && res.ok) {
          const data = await res.json();
          let rawText = '';
          let isSynced = false;

          if (Array.isArray(data)) {
            // Pick best match from search results
            const best = data.find((item: any) => item.syncedLyrics) || data.find((item: any) => item.plainLyrics);
            if (best) {
              rawText = best.syncedLyrics || best.plainLyrics || '';
              isSynced = Boolean(best.syncedLyrics);
            }
          } else if (data) {
            rawText = data.syncedLyrics || data.plainLyrics || '';
            isSynced = Boolean(data.syncedLyrics);
          }

          if (rawText && rawText.trim().length > 10) {
            return NextResponse.json(
              {
                status: 'ready',
                rawText,
                source: 'LRCLIB',
                synced: isSynced,
              },
              { headers: corsHeaders }
            );
          }
        }
      } catch {}
    }
  } catch (e) {
    console.warn('[Lyrics API] LRCLIB lookup error:', e);
  }

  // Graceful unavailable response with CORS headers
  return NextResponse.json(
    {
      status: 'unavailable',
      rawText: '',
      source: 'RaagaX',
    },
    { headers: corsHeaders }
  );
}
