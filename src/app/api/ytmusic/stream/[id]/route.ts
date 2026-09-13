import { NextRequest, NextResponse } from 'next/server';
import { YouTubeMusicEngine } from '@/lib/ytmusic/YouTubeMusicEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleStream(req, params.id, false);
}

export async function HEAD(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleStream(req, params.id, true);
}

async function resolveFallbackStreamUrl(
  videoId: string,
  providedTitle?: string,
  providedArtist?: string
): Promise<string | null> {
  try {
    let rawTitle = providedTitle || '';
    let rawAuthor = providedArtist || '';

    if (!rawTitle) {
      const res = await fetch('https://music.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'X-YouTube-Client-Name': '67',
          'X-YouTube-Client-Version': '1.20240910.01.00',
        },
        body: JSON.stringify({
          context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20240910.01.00' } },
          videoId,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        rawTitle = json?.videoDetails?.title || '';
        rawAuthor = json?.videoDetails?.author || '';
      }
    }

    if (!rawTitle) return null;

    const cleanTitle = rawTitle
      .replace(/\|.*$/g, '')
      .replace(/(\(|\[).*?(official|video|lyric|audio|4k|hd|full|song).*?(\)|\])/gi, '')
      .replace(/full video song|video song|lyrical song|official video|audio song/gi, '')
      .trim();

    const cleanAuthor = (rawAuthor || '')
      .replace(/\|.*$/g, '')
      .replace(/ - Topic$/i, '')
      .replace(/VEVO$/i, '')
      .trim();

    const candidates = [
      `${cleanTitle} ${cleanAuthor}`.trim(),
      cleanTitle,
      rawTitle.replace(/\|.*$/g, '').trim(),
    ].filter(Boolean);

    for (const q of candidates) {
      try {
        const saavnRes = await fetch(
          `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(q)}&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=1`
        );
        if (!saavnRes.ok) continue;
        const saavnJson = await saavnRes.json();
        const match = saavnJson?.results?.[0];
        const encUrl = match?.more_info?.encrypted_media_url;
        if (!encUrl) continue;

        const decRes = await fetch(
          `https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&url=${encodeURIComponent(encUrl)}&bitrate=320&_format=json&_marker=0&api_version=4&ctx=web6dot0`
        );
        if (!decRes.ok) continue;
        const decJson = await decRes.json();
        const authUrl = decJson?.auth_url_320 || decJson?.auth_url || null;
        if (authUrl) return authUrl;
      } catch {}
    }
    return null;
  } catch {
    return null;
  }
}

async function handleStream(req: NextRequest, rawId: string, isHead: boolean) {
  try {
    const videoId = (rawId || '').replace(/^ytm-/, '').trim();
    if (!videoId) {
      return new Response('Invalid video ID', { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const queryTitle = searchParams.get('title') || '';
    const queryArtist = searchParams.get('artist') || '';

    const rangeHeader = req.headers.get('range');

    const fetchStream = async (targetUrl: string) => {
      const isGoogleVideo = targetUrl.includes('googlevideo.com');
      const isSaavnCdn = targetUrl.includes('saavncdn.com');

      const headers: Record<string, string> = {
        'User-Agent': isGoogleVideo 
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
          : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
        'Accept': '*/*',
      };

      // Only send Referer/Origin for JioSaavn CDN (never for googlevideo which causes 403 blocks)
      if (isSaavnCdn) {
        headers['Referer'] = 'https://www.jiosaavn.com/';
        headers['Origin'] = 'https://www.jiosaavn.com';
      }

      if (rangeHeader) {
        headers['Range'] = rangeHeader;
      }

      return fetch(targetUrl, {
        method: isHead ? 'HEAD' : 'GET',
        headers,
      });
    };

    let streamUrl: string | null = null;
    let upstreamRes: Response | null = null;

    // Fast-path: If queryTitle is provided, resolve high-fidelity studio master (<100ms)
    if (queryTitle) {
      try {
        const studioUrl = await resolveFallbackStreamUrl(videoId, queryTitle, queryArtist);
        if (studioUrl) {
          streamUrl = studioUrl;
          upstreamRes = await fetchStream(streamUrl);
        }
      } catch (e) {
        console.warn('[API /ytmusic/stream] Studio master fast-path error:', e);
      }
    }

    // 1. Try cached or freshly resolved YouTube Music pure audio stream (<300ms)
    if (!upstreamRes || (!upstreamRes.ok && upstreamRes.status !== 206)) {
      try {
        const streamInfo = await Promise.race([
          YouTubeMusicEngine.getInstance().getAudioStreamInfo(videoId),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
        ]);
        if (streamInfo?.url) {
          streamUrl = streamInfo.url;
          upstreamRes = await fetchStream(streamUrl);
        }
      } catch (e) {
        console.warn('[API /ytmusic/stream] Direct YouTube stream error:', e);
      }
    }

    // 2. Self-Healing Retry: If upstream returned 403 or failed, invalidate cache and force-refresh fresh stream
    if (!upstreamRes || (!upstreamRes.ok && upstreamRes.status !== 206)) {
      try {
        YouTubeMusicEngine.getInstance().invalidateStream(videoId);
        const freshInfo = await Promise.race([
          YouTubeMusicEngine.getInstance().getAudioStreamInfo(videoId, true),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
        ]);
        if (freshInfo?.url && freshInfo.url !== streamUrl) {
          streamUrl = freshInfo.url;
          upstreamRes = await fetchStream(streamUrl);
        }
      } catch (e) {
        console.warn('[API /ytmusic/stream] Force refresh stream error:', e);
      }
    }

    // 3. High-fidelity audio fallback for edge environments / regional restrictions
    if (!upstreamRes || (!upstreamRes.ok && upstreamRes.status !== 206)) {
      try {
        const fallbackUrl = await resolveFallbackStreamUrl(videoId);
        if (fallbackUrl) {
          streamUrl = fallbackUrl;
          upstreamRes = await fetchStream(streamUrl);
        }
      } catch (e) {
        console.warn('[API /ytmusic/stream] Fallback stream resolution error:', e);
      }
    }

    if (!upstreamRes || (!upstreamRes.ok && upstreamRes.status !== 206)) {
      const status = upstreamRes ? upstreamRes.status : 404;
      console.warn(`[API /ytmusic/stream] Upstream audio fetch failed with status ${status} for ${videoId}`);
      return new Response('Upstream audio fetch failed', { status });
    }

    const responseHeaders = new Headers();
    const upstreamContentType = upstreamRes.headers.get('content-type') || 'audio/mp4';
    responseHeaders.set('Content-Type', upstreamContentType);
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'public, max-age=1800, immutable');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }

    if (isHead) {
      return new Response(null, {
        status: upstreamRes.status,
        headers: responseHeaders,
      });
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('[API /ytmusic/stream] Error streaming audio:', error);
    return new Response('Streaming error', { status: 500 });
  }
}
