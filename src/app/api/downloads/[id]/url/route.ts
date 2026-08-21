import { NextRequest, NextResponse } from 'next/server';
import { RealMusicEngine } from '@/lib/realMusicEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const trackId = params.id;
  const token = req.nextUrl.searchParams.get('token');

  if (!trackId) {
    return NextResponse.json({ success: false, error: 'Missing trackId' }, { status: 400 });
  }

  // Token verification
  if (token) {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const parts = decoded.split(':');
      if (parts.length >= 3) {
        const leaseExpiresAt = parseInt(parts[2], 10);
        if (Date.now() > leaseExpiresAt) {
          return NextResponse.json({ success: false, error: 'Download authorization token has expired' }, { status: 401 });
        }
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid download token' }, { status: 401 });
    }
  }

  try {
    const { JioSaavnProvider } = await import('@/lib/jioSaavnProvider');
    const provider = JioSaavnProvider.getInstance();
    const songs = await provider.searchSongs(trackId, 1);
    const audioUrl = songs[0]?.audioUrl;

    if (!audioUrl) {
      return NextResponse.json({ success: false, error: 'Upstream audio stream not found' }, { status: 404 });
    }

    const rangeHeader = req.headers.get('range');
    const upstreamHeaders = new Headers();
    if (rangeHeader) {
      upstreamHeaders.set('Range', rangeHeader);
    }

    const audioRes = await fetch(audioUrl, { headers: upstreamHeaders });
    if (!audioRes.ok && audioRes.status !== 206) {
      return NextResponse.json({ success: false, error: 'Failed to fetch upstream media' }, { status: audioRes.status });
    }

    const responseHeaders = new Headers(audioRes.headers);
    responseHeaders.set('Content-Type', 'audio/mpeg');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'public, max-age=86400, immutable');

    return new NextResponse(audioRes.body, {
      status: audioRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Stream delivery failed' }, { status: 500 });
  }
}
