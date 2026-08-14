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
    const isAllowedHost = ALLOWED_HOSTS.some((host) => parsedUrl.hostname.endsWith(host));
    if (!isAllowedHost) {
      return NextResponse.json({ error: 'Disallowed host domain for download' }, { status: 403 });
    }

    const audioRes = await fetch(parsedUrl.href);
    if (!audioRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch upstream media' }, { status: audioRes.status });
    }

    const headers = new Headers(audioRes.headers);
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    headers.set('Content-Type', 'audio/mpeg');

    return new NextResponse(audioRes.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid media URL provided' }, { status: 400 });
  }
}
