import { NextRequest, NextResponse } from 'next/server';
import { ConnectDeviceRegistry } from '@/lib/connect/ConnectDeviceRegistry';
import { ConnectPlaybackSession } from '@/types/connect';

export const dynamic = 'force-dynamic';

/**
 * GET /api/connect/session?deviceId=...
 * POST /api/connect/session (Publish authoritative session)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ success: false, error: 'Missing deviceId' }, { status: 400 });
    }

    const session = ConnectDeviceRegistry.getSession(deviceId);

    return NextResponse.json({
      success: true,
      session,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to get session' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session: ConnectPlaybackSession = await request.json();

    if (!session || !session.playbackDeviceId) {
      return NextResponse.json({ success: false, error: 'Invalid session payload' }, { status: 400 });
    }

    ConnectDeviceRegistry.publishSession(session);

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to publish session' }, { status: 500 });
  }
}
