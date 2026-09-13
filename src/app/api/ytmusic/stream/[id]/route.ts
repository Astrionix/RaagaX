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

async function resolveFallbackStreamUrl(videoId: string): Promise<string | null> {
  try {
    const res = await fetch('https://music.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'X-YouTube-Client-Name': '67',
        'X-YouTube-Client-Version': '1.20240910.01.00',
      },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20240910.01.00' } },
        videoId,
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const title = json?.videoDetails?.title || '';
    const author = json?.videoDetails?.author || '';
    if (!title) return null;

    const query = `${title} ${author}`.trim();
    const saavnRes = await fetch(
      `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(query)}&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=1`
    );
    if (!saavnRes.ok) return null;
    const saavnJson = await saavnRes.json();
    const match = saavnJson?.results?.[0];
    if (!match?.more_info?.encrypted_media_url) return null;

    const encUrl = match.more_info.encrypted_media_url;
    const decRes = await fetch(
      `https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&url=${encodeURIComponent(encUrl)}&bitrate=320&_format=json&_marker=0&api_version=4&ctx=web6dot0`
    );
    if (!decRes.ok) return null;
    const decJson = await decRes.json();
    return decJson?.auth_url || decJson?.auth_url_320 || null;
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

    let streamUrl: string | null = null;
    let mimeType = 'audio/mp4';

    try {
      const streamInfo = await YouTubeMusicEngine.getInstance().getAudioStreamInfo(videoId);
      if (streamInfo?.url) {
        streamUrl = streamInfo.url;
        mimeType = streamInfo.mimeType || 'audio/mp4';
      }
    } catch (e) {
      console.warn('[API /ytmusic/stream] YouTubeMusicEngine resolution error:', e);
    }

    // Fall back to high-fidelity 320kbps stream resolution if YouTube proxy is unavailable or timed out
    if (!streamUrl) {
      console.log(`[API /ytmusic/stream] Fallback stream resolution active for video: ${videoId}`);
      streamUrl = await resolveFallbackStreamUrl(videoId);
    }

    if (!streamUrl) {
      return new Response('Audio stream unavailable', { status: 404 });
    }

    // If fallback audio URL is an external HTTPS CDN URL, return a 302 redirect for zero-latency browser playback
    if (streamUrl.startsWith('https://web.saavncdn.com') || streamUrl.startsWith('https://aac.saavncdn.com') || streamUrl.includes('saavncdn.com')) {
      return NextResponse.redirect(streamUrl, { status: 302 });
    }

    const rangeHeader = req.headers.get('range');
    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com',
      'Accept': '*/*',
    };
    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader;
    }

    let upstreamRes = await fetch(streamUrl, {
      method: isHead ? 'HEAD' : 'GET',
      headers: upstreamHeaders,
    });

    // If upstream token expired or returned 403/410, automatically refresh stream URL once
    if (!upstreamRes.ok && upstreamRes.status !== 206 && (upstreamRes.status === 403 || upstreamRes.status === 410)) {
      console.warn(`[API /ytmusic/stream] Upstream returned status ${upstreamRes.status} for ${videoId}. Refreshing stream token...`);
      const freshInfo = await YouTubeMusicEngine.getInstance().getAudioStreamInfo(videoId, true);
      if (freshInfo?.url) {
        streamUrl = freshInfo.url;
        upstreamRes = await fetch(streamUrl, {
          method: isHead ? 'HEAD' : 'GET',
          headers: upstreamHeaders,
        });
      } else {
        const fallbackUrl = await resolveFallbackStreamUrl(videoId);
        if (fallbackUrl) {
          return NextResponse.redirect(fallbackUrl, { status: 302 });
        }
      }
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      console.warn(`[API /ytmusic/stream] Upstream returned status ${upstreamRes.status} for ${videoId}`);
      return new Response('Upstream audio fetch failed', { status: upstreamRes.status });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', upstreamRes.headers.get('content-type') || mimeType);
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'public, max-age=7200, immutable');

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
