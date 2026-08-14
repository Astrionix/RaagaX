import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const trackId = params.id;

  if (!trackId) {
    return NextResponse.json({ success: false, error: 'Missing trackId' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    trackId,
    isAvailable: true,
    supportedQualities: ['LOW', 'HIGH', 'VERY_HIGH'],
    formats: [
      { quality: 'LOW', bitrate: 96, mimeType: 'audio/mpeg' },
      { quality: 'HIGH', bitrate: 320, mimeType: 'audio/mpeg' },
      { quality: 'VERY_HIGH', bitrate: 320, mimeType: 'audio/mpeg' },
    ],
    drmRequired: false,
    offlineAllowed: true,
  });
}
