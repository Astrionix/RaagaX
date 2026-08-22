import { NextRequest, NextResponse } from 'next/server';
import { JioSaavnProvider } from '@/lib/jioSaavnProvider';

export const dynamic = 'force-dynamic';

const ALLOWED_HOSTS = [
  'saavncdn.com',
  'jiosaavn.com',
  'googlevideo.com',
  'ytimg.com',
  'cloudfront.net',
  'unpkg.com',
  'pixabay.com',
  'cdn.pixabay.com',
  'akamaized.net',
  'saavn.com'
];

function isHostAllowed(hostname: string): boolean {
  return ALLOWED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export async function GET(req: NextRequest) {
  let urlStr = req.nextUrl.searchParams.get('url');
  const songId = req.nextUrl.searchParams.get('id');
  const filename = req.nextUrl.searchParams.get('name') || 'RaagaX_Track.mp3';

  // If URL not provided or placeholder, resolve by song ID
  if ((!urlStr || urlStr.includes('pixabay.com')) && songId) {
    try {
      const results = await JioSaavnProvider.getInstance().searchSongs(songId, 1);
      if (results && results.length > 0 && results[0].audioUrl) {
        urlStr = results[0].audioUrl;
      }
    } catch {}
  }

  if (!urlStr) {
    return NextResponse.json({ error: 'Missing audio URL' }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(urlStr);

    // Enforce HTTPS protocol
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are allowed' }, { status: 400 });
    }

    // Host allowlist check (SSRF protection)
    if (!isHostAllowed(parsedUrl.hostname)) {
      return NextResponse.json({ error: 'Disallowed host domain for download' }, { status: 403 });
    }

    // Pass through Range header if client requested byte range (for pause/resume)
    const clientRange = req.headers.get('range');
    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.jiosaavn.com/',
      'Origin': 'https://www.jiosaavn.com',
    };
    if (clientRange) {
      upstreamHeaders['Range'] = clientRange;
    }

    const audioRes = await fetch(parsedUrl.href, {
      headers: upstreamHeaders,
      redirect: 'follow',
    });

    if (!audioRes.ok && audioRes.status !== 206) {
      return NextResponse.json({ error: 'Failed to fetch upstream media' }, { status: audioRes.status });
    }

    // Post-redirect security check: verify final URL host
    if (audioRes.url) {
      try {
        const finalUrl = new URL(audioRes.url);
        if (!isHostAllowed(finalUrl.hostname)) {
          return NextResponse.json({ error: 'Upstream redirected to disallowed host' }, { status: 403 });
        }
      } catch {}
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    responseHeaders.set('Content-Type', audioRes.headers.get('content-type') || 'audio/mpeg');
    responseHeaders.set('Accept-Ranges', 'bytes');

    if (audioRes.headers.get('content-length')) {
      responseHeaders.set('Content-Length', audioRes.headers.get('content-length')!);
    }
    if (audioRes.headers.get('content-range')) {
      responseHeaders.set('Content-Range', audioRes.headers.get('content-range')!);
    }

    return new NextResponse(audioRes.body, {
      status: audioRes.status === 206 ? 206 : 200,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid media URL provided' }, { status: 400 });
  }
}

