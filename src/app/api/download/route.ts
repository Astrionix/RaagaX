import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const filename = req.nextUrl.searchParams.get('name') || 'RaagaX_Track.mp3';

  if (!url) {
    return NextResponse.json({ error: 'Missing audio URL' }, { status: 400 });
  }

  try {
    const audioRes = await fetch(url);
    if (!audioRes.ok) {
      return NextResponse.redirect(url);
    }

    const headers = new Headers(audioRes.headers);
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    headers.set('Content-Type', 'audio/mpeg');

    return new NextResponse(audioRes.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.redirect(url);
  }
}
