import { NextRequest, NextResponse } from 'next/server';
import { YouTubeMusicEngine } from '@/lib/ytmusic/YouTubeMusicEngine';

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

  const isYtTrack = trackId.startsWith('ytm-');

  // Extract core song title (removing bracketed descriptors, remixes, video tags)
  const cleanCoreTitle = title
    .replace(/\s*[\(\[\{][^\)\]\}]*(?:bass\s*boost|remix|dj|mashup|slowed|reverb|lo-?fi|audio|video|official|lyrical|full\s+song)[^\)\]\}]*[\)\]\}]/gi, '')
    .split(/\s*[|•/-]\s*/)[0]
    .trim();

  let cleanArtist = (artist || '').replace(/Various Artists|@\w+/gi, '').split(/[,&/]/)[0].trim();
  if (!cleanArtist && title.includes('|')) {
    const parts = title.split('|').map((p) => p.trim());
    cleanArtist = parts.find((p) => /anirudh|thaman|rahman|devi|sid|arijit|shreya|keerthy|vijay|nani/i.test(p)) || '';
  }

  let plainFallbackText = '';
  let fallbackSource = 'LRCLIB';

  // 1. If it's a YouTube Music track, check official YouTube Music lyrics first
  if (isYtTrack) {
    try {
      const ytLyrics = await YouTubeMusicEngine.getInstance().getLyrics(trackId);
      if (ytLyrics && ytLyrics.trim().length > 10) {
        if (/\[\d{2}:\d{2}/.test(ytLyrics)) {
          return NextResponse.json(
            {
              status: 'ready',
              rawText: ytLyrics.trim(),
              source: 'YouTube Music (Synced)',
              synced: true,
            },
            { headers: corsHeaders }
          );
        }
        plainFallbackText = ytLyrics.trim();
        fallbackSource = 'YouTube Music';
      }
    } catch {}
  }

  // 2. PRIORITIZE LRCLIB SYNCED LYRICS (Gives exact millisecond timestamps)
  try {
    const effectiveTitle = cleanCoreTitle || cleanString(title) || title;
    const lrclibQueries = [
      // Exact track + artist + duration
      durationSec > 0 && cleanArtist
        ? `https://lrclib.net/api/get?track_name=${encodeURIComponent(effectiveTitle)}&artist_name=${encodeURIComponent(cleanArtist)}&duration=${durationSec}`
        : null,
      // Exact track + artist
      cleanArtist
        ? `https://lrclib.net/api/get?track_name=${encodeURIComponent(effectiveTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`
        : null,
      // Search by title and artist
      cleanArtist
        ? `https://lrclib.net/api/search?q=${encodeURIComponent(`${effectiveTitle} ${cleanArtist}`)}`
        : null,
      // Search by title only (crucial for regional tracks & remixes)
      `https://lrclib.net/api/search?q=${encodeURIComponent(effectiveTitle)}`,
    ].filter(Boolean) as string[];

    for (const queryUrl of lrclibQueries) {
      try {
        const res = await fetch(queryUrl, {
          headers: {
            'User-Agent': 'RaagaX-MusicApp/2.0.0 (https://raagax.com)',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(3500),
        }).catch(() => null);

        if (res && res.ok) {
          const data = await res.json();

          if (Array.isArray(data)) {
            // Find first item with synced lyrics
            const syncedItem = data.find((item: any) => item?.syncedLyrics && item.syncedLyrics.trim().length > 10);
            if (syncedItem) {
              return NextResponse.json(
                {
                  status: 'ready',
                  rawText: syncedItem.syncedLyrics,
                  source: 'LRCLIB (Synced)',
                  synced: true,
                },
                { headers: corsHeaders }
              );
            }
            if (!plainFallbackText) {
              const plainItem = data.find((item: any) => item?.plainLyrics && item.plainLyrics.trim().length > 10);
              if (plainItem) {
                plainFallbackText = plainItem.plainLyrics;
                fallbackSource = 'LRCLIB';
              }
            }
          } else if (data) {
            if (data.syncedLyrics && data.syncedLyrics.trim().length > 10) {
              return NextResponse.json(
                {
                  status: 'ready',
                  rawText: data.syncedLyrics,
                  source: 'LRCLIB (Synced)',
                  synced: true,
                },
                { headers: corsHeaders }
              );
            }
            if (!plainFallbackText && data.plainLyrics) {
              plainFallbackText = data.plainLyrics;
              fallbackSource = 'LRCLIB';
            }
          }
        }
      } catch {}
    }

    // If we have plain fallback from YouTube Music or LRCLIB, return it
    if (plainFallbackText && plainFallbackText.trim().length > 10) {
      return NextResponse.json(
        {
          status: 'ready',
          rawText: plainFallbackText,
          source: fallbackSource,
          synced: false,
        },
        { headers: corsHeaders }
      );
    }
  } catch (e) {
    console.warn('[Lyrics API] LRCLIB lookup error:', e);
  }

  // 2. FALLBACK: JioSaavn official lyrics endpoint if trackId is available
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

  // Graceful unavailable response
  return NextResponse.json(
    {
      status: 'unavailable',
      rawText: '',
      source: 'RaagaX',
    },
    { headers: corsHeaders }
  );
}
