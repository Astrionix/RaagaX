import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const trackId = params.id;

  try {
    const body = await req.json();
    const { bytesDownloaded, checksum, deviceId } = body;

    // Log completion telemetry
    console.log(`[API /downloads/complete] Track ${trackId} downloaded successfully by device ${deviceId || 'unknown'} (${bytesDownloaded} bytes, checksum: ${checksum})`);

    return NextResponse.json({
      success: true,
      trackId,
      registered: true,
      completedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to complete download registration' }, { status: 500 });
  }
}
