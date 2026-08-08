import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = [
  'saavncdn.com',
  'jiosaavn.com',
  'cdn.pixabay.com',
];

function isAllowedAudioUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;

  const hostname = parsed.hostname.toLowerCase();
  return ALLOWED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const filename = req.nextUrl.searchParams.get('name') || 'RaagaX_Track.mp3';

  if (!url) {
    return NextResponse.json({ error: 'Missing audio URL' }, { status: 400 });
  }

  if (!isAllowedAudioUrl(url)) {
    return NextResponse.json({ error: 'Audio URL host is not allowed' }, { status: 400 });
  }

  try {
    const audioRes = await fetch(url, { redirect: 'follow' });
    if (!audioRes.ok) {
      return NextResponse.json({ error: 'Upstream audio fetch failed' }, { status: 502 });
    }

    const headers = new Headers();
    const contentLength = audioRes.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    headers.set('Content-Type', 'audio/mpeg');

    return new NextResponse(audioRes.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Unable to download audio' }, { status: 502 });
  }
}
