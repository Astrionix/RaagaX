import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface LrcLibResponse {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');
    const title = searchParams.get('title');
    const artist = searchParams.get('artist');
    const album = searchParams.get('album');
    const durationMs = searchParams.get('durationMs');

    if (!trackId || !title || !artist) {
      return NextResponse.json({ error: 'Missing required parameters (trackId, title, artist)' }, { status: 400 });
    }

    const durationSeconds = durationMs ? Math.round(parseInt(durationMs, 10) / 1000) : undefined;

    // Build LRCLIB URL
    const lrcUrl = new URL('https://lrclib.net/api/get');
    lrcUrl.searchParams.append('track_name', title);
    lrcUrl.searchParams.append('artist_name', artist);
    if (album) {
      lrcUrl.searchParams.append('album_name', album);
    }
    if (durationSeconds) {
      lrcUrl.searchParams.append('duration', durationSeconds.toString());
    }

    const response = await fetch(lrcUrl.toString(), {
      headers: {
        'User-Agent': 'RaagaX/1.0.0 (https://github.com/your-username/RaagaX)'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ status: 'unavailable' });
      }
      return NextResponse.json({ error: 'LRCLIB API error' }, { status: response.status });
    }

    const data: LrcLibResponse = await response.json();

    // Basic Validation: Ensure we didn't get instrumental back if we expect lyrics
    if (data.instrumental && !data.plainLyrics && !data.syncedLyrics) {
       return NextResponse.json({ status: 'unavailable', reason: 'instrumental' });
    }

    if (!data.syncedLyrics && !data.plainLyrics) {
       return NextResponse.json({ status: 'unavailable' });
    }

    return NextResponse.json({
      status: 'ready',
      trackId,
      source: 'lrclib',
      type: data.syncedLyrics ? 'line-synced' : 'plain',
      rawText: data.syncedLyrics || data.plainLyrics || '',
      matchScore: 95 // In a fuller implementation, calculate Levenshtein distance between requested/returned title & artist
    });

  } catch (error) {
    console.error('Error fetching lyrics from LRCLIB:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
