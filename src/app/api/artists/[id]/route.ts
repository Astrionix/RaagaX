import { NextRequest, NextResponse } from 'next/server';
import { apiApp } from '@/api-app';
import { YouTubeMusicEngine } from '@/lib/ytmusic/YouTubeMusicEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const artistId = params?.id || '';
  if (artistId.startsWith('art-ytm-')) {
    try {
      const ytArtist = await YouTubeMusicEngine.getInstance().getArtistDetails(artistId);
      if (ytArtist) {
        return NextResponse.json({ success: true, data: ytArtist });
      }
    } catch (err) {
      console.warn('[API /artists/[id]] Error fetching YouTube Music artist details:', err);
    }
  }

  return apiApp.fetch(req);
}

export async function POST(req: Request) {
  return apiApp.fetch(req);
}

