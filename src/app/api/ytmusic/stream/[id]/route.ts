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

async function handleStream(req: NextRequest, rawId: string, isHead: boolean) {
  try {
    const videoId = (rawId || '').replace(/^ytm-/, '').trim();
    if (!videoId) {
      return new Response('Invalid video ID', { status: 400 });
    }

    const rangeHeader = req.headers.get('range');

    const fetchStream = async (targetUrl: string) => {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'Accept': '*/*',
      };

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
    let debugInfo = '';

    // 1. Resolve exact YouTube audio stream for this specific videoId
    const t0 = Date.now();
    try {
      const streamInfo = await Promise.race([
        YouTubeMusicEngine.getInstance().getAudioStreamInfo(videoId),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 7000)),
      ]);
      const elapsed1 = Date.now() - t0;
      if (streamInfo?.url) {
        streamUrl = streamInfo.url;
        upstreamRes = await fetchStream(streamUrl);
        debugInfo += `[t1=${elapsed1}ms,url=ok,up=${upstreamRes.status}]`;
      } else {
        debugInfo += `[t1=${elapsed1}ms,url=null]`;
      }
    } catch (e: any) {
      debugInfo += `[t1_err=${e?.message || e}]`;
      console.warn('[API /ytmusic/stream] Direct YouTube stream error:', e);
    }

    // 2. Self-Healing Retry: Invalidate cache and retry for this exact videoId if upstream returned non-200/206
    if (!upstreamRes || (!upstreamRes.ok && upstreamRes.status !== 206)) {
      const t1 = Date.now();
      try {
        YouTubeMusicEngine.getInstance().invalidateStream(videoId);
        const freshInfo = await Promise.race([
          YouTubeMusicEngine.getInstance().getAudioStreamInfo(videoId, true),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 7000)),
        ]);
        const elapsed2 = Date.now() - t1;
        if (freshInfo?.url && freshInfo.url !== streamUrl) {
          streamUrl = freshInfo.url;
          upstreamRes = await fetchStream(streamUrl);
          debugInfo += `[t2=${elapsed2}ms,url=ok,up=${upstreamRes.status}]`;
        } else {
          debugInfo += `[t2=${elapsed2}ms,url=${freshInfo?.url ? 'same' : 'null'}]`;
        }
      } catch (e: any) {
        debugInfo += `[t2_err=${e?.message || e}]`;
        console.warn('[API /ytmusic/stream] Force refresh stream error:', e);
      }
    }

    if (!upstreamRes || (!upstreamRes.ok && upstreamRes.status !== 206)) {
      const status = upstreamRes ? upstreamRes.status : 404;
      console.warn(`[API /ytmusic/stream] Upstream audio fetch failed with status ${status} for ${videoId}: ${debugInfo}`);
      return new Response(`Upstream audio fetch failed: ${debugInfo}`, { 
        status,
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          'X-Stream-Diag': debugInfo,
          'Access-Control-Allow-Origin': '*',
        }
      });
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
