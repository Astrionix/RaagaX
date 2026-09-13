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

    let streamInfo = await YouTubeMusicEngine.getInstance().getAudioStreamInfo(videoId);
    if (!streamInfo || !streamInfo.url) {
      return new Response('Audio stream unavailable', { status: 404 });
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

    let upstreamRes = await fetch(streamInfo.url, {
      method: isHead ? 'HEAD' : 'GET',
      headers: upstreamHeaders,
    });

    // If upstream token expired or returned 403/410, automatically refresh stream URL once
    if (!upstreamRes.ok && upstreamRes.status !== 206 && (upstreamRes.status === 403 || upstreamRes.status === 410)) {
      console.warn(`[API /ytmusic/stream] Upstream returned status ${upstreamRes.status} for ${videoId}. Refreshing stream token...`);
      const freshInfo = await YouTubeMusicEngine.getInstance().getAudioStreamInfo(videoId, true);
      if (freshInfo?.url) {
        streamInfo = freshInfo;
        upstreamRes = await fetch(streamInfo.url, {
          method: isHead ? 'HEAD' : 'GET',
          headers: upstreamHeaders,
        });
      }
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      console.warn(`[API /ytmusic/stream] Upstream returned status ${upstreamRes.status} for ${videoId}`);
      return new Response('Upstream audio fetch failed', { status: upstreamRes.status });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', upstreamRes.headers.get('content-type') || streamInfo.mimeType || 'audio/mp4');
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
