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

  const cleanTitle = cleanString(title);
  const cleanArtist = artist.split(/[,&/]/)[0].trim();

  // 1. TIER 1: LRCLIB SYNCED LYRICS (Pinpoint millisecond timestamps)
  try {
    const lrclibQueries = [
      durationSec > 0 
        ? `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle || title)}&artist_name=${encodeURIComponent(cleanArtist)}&duration=${durationSec}`
        : null,
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle || title)}&artist_name=${encodeURIComponent(cleanArtist)}`,
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(cleanArtist)}`,
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle || title} ${cleanArtist}`)}`,
      `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle || title)}`
    ].filter(Boolean) as string[];

    let plainFallbackText = '';

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
              if (plainItem) plainFallbackText = plainItem.plainLyrics;
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
            }
          }
        }
      } catch {}
    }

    if (plainFallbackText && plainFallbackText.trim().length > 10) {
      return NextResponse.json(
        {
          status: 'ready',
          rawText: plainFallbackText,
          source: 'LRCLIB',
          synced: false,
        },
        { headers: corsHeaders }
      );
    }
  } catch (e) {
    console.warn('[Lyrics API] LRCLIB lookup error:', e);
  }

  // 2. TIER 2: NETEASE CLOUD MUSIC SYNCED LYRICS (Massive catalog of synced Asian & International tracks)
  try {
    const neteaseSearchUrl = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(`${cleanTitle || title} ${cleanArtist}`)}&type=1&offset=0&limit=3`;
    const searchRes = await fetch(neteaseSearchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.163.com/',
      },
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

    if (searchRes && searchRes.ok) {
      const searchData = await searchRes.json();
      const songId = searchData?.result?.songs?.[0]?.id;
      if (songId) {
        const lyricRes = await fetch(`https://music.163.com/api/song/lyric?os=pc&id=${songId}&lv=-1&kv=-1&tv=-1`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://music.163.com/',
          },
          signal: AbortSignal.timeout(3000),
        }).catch(() => null);

        if (lyricRes && lyricRes.ok) {
          const lyricData = await lyricRes.json();
          const lrc = lyricData?.lrc?.lyric;
          if (lrc && lrc.includes('[') && lrc.trim().length > 15) {
            return NextResponse.json(
              {
                status: 'ready',
                rawText: lrc,
                source: 'Netease (Synced)',
                synced: true,
              },
              { headers: corsHeaders }
            );
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Lyrics API] Netease provider error:', err);
  }

  // 3. TIER 3: JIOSAAVN OFFICIAL LYRICS ENDPOINT WITH GEO-UNLOCK & EXPLICIT HEADERS
  try {
    const saavnHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'X-Forwarded-For': '49.36.0.1',
      'X-Real-IP': '49.36.0.1',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Cookie': 'explicit_content=1; gdpr_acceptance=true; L=english,telugu,hindi,tamil,kannada,malayalam;',
    };

    let jioLyricsId = trackId && !trackId.startsWith('song-') && !trackId.startsWith('local-') ? trackId : null;

    // Helper to fetch lyrics by lyrics_id
    const fetchSaavnLyrics = async (id: string) => {
      const saavnLyricsUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&ctx=web6dot0&api_version=4&_format=json&lyrics_id=${encodeURIComponent(id)}`;
      const res = await fetch(saavnLyricsUrl, { headers: saavnHeaders, signal: AbortSignal.timeout(3500) }).catch(() => null);
      if (res && res.ok) {
        const json = await res.json();
        if (json && json.lyrics) {
          const rawText = decodeHtmlEntities(json.lyrics);
          if (rawText && rawText.trim().length > 10) return rawText;
        }
      }
      return null;
    };

    // 3a. Try direct lyrics_id with trackId
    if (jioLyricsId) {
      const directLyrics = await fetchSaavnLyrics(jioLyricsId);
      if (directLyrics) {
        return NextResponse.json(
          { status: 'ready', rawText: directLyrics, source: 'JioSaavn', synced: false },
          { headers: corsHeaders }
        );
      }

      // 3b. Query song details to extract explicit more_info.lyrics_id
      try {
        const detailUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=${encodeURIComponent(jioLyricsId)}&_format=json`;
        const detailRes = await fetch(detailUrl, { headers: saavnHeaders, signal: AbortSignal.timeout(3000) }).catch(() => null);
        if (detailRes && detailRes.ok) {
          const detailJson = await detailRes.json();
          const songObj = detailJson?.[jioLyricsId] || Object.values(detailJson || {})[0] as any;
          const extractedId = songObj?.more_info?.lyrics_id || (songObj?.more_info?.has_lyrics === 'true' ? songObj?.id : null);
          if (extractedId && extractedId !== jioLyricsId) {
            const resolvedLyrics = await fetchSaavnLyrics(extractedId);
            if (resolvedLyrics) {
              return NextResponse.json(
                { status: 'ready', rawText: resolvedLyrics, source: 'JioSaavn', synced: false },
                { headers: corsHeaders }
              );
            }
          }
        }
      } catch {}
    }

    // 3c. Fallback search on JioSaavn for tracks without direct pid match
    const searchQuery = `${cleanTitle || title} ${cleanArtist}`.trim();
    if (searchQuery.length > 2) {
      try {
        const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(searchQuery)}&_format=json&p=1&n=3`;
        const searchRes = await fetch(searchUrl, { headers: saavnHeaders, signal: AbortSignal.timeout(3000) }).catch(() => null);
        if (searchRes && searchRes.ok) {
          const searchJson = await searchRes.json();
          const results = searchJson?.results || [];
          for (const item of results) {
            const candidateId = item?.more_info?.lyrics_id || (item?.more_info?.has_lyrics === 'true' ? item.id : null);
            if (candidateId) {
              const foundLyrics = await fetchSaavnLyrics(candidateId);
              if (foundLyrics) {
                return NextResponse.json(
                  { status: 'ready', rawText: foundLyrics, source: 'JioSaavn', synced: false },
                  { headers: corsHeaders }
                );
              }
            }
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[Lyrics API] JioSaavn lyrics lookup failed:', err);
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
