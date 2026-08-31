import { NextRequest, NextResponse } from 'next/server';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jam/[id]/handshake
 * Authenticated application-level LAN handshake:
 * Verifies Jam membership and authorization before permitting low-latency LAN control.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jamId = params.id;
    const body = await req.json().catch(() => ({}));
    const { userId, deviceId, timestamp } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId for handshake' },
        { status: 400 }
      );
    }

    const engine = JamServerEngine.getInstance();
    const session = await engine.getSessionAsync(jamId);

    if (!session) {
      if (engine.isSessionEnded(jamId)) {
        return NextResponse.json(
          { success: false, code: 'JAM_ENDED', error: 'Jam session has ended' },
          { status: 410 }
        );
      }
      return NextResponse.json(
        { success: false, code: 'JAM_NOT_FOUND', error: 'Jam session not found' },
        { status: 404 }
      );
    }

    // Authenticate participant authorization in the Jam
    const isHost = session.hostId === userId;
    const participant = session.participants[userId];

    if (!isHost && !participant) {
      return NextResponse.json(
        {
          success: false,
          code: 'UNAUTHORIZED',
          error: 'Device is not an authorized participant in this Jam session',
        },
        { status: 403 }
      );
    }

    const serverTime = Date.now();
    return NextResponse.json(
      {
        success: true,
        jamId: session.jamId,
        hostId: session.hostId,
        revision: session.revision,
        serverTime,
        clientTimestamp: timestamp || serverTime,
        lanSupported: true,
        protocolVersion: '2.0.0',
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Handshake failed' },
      { status: 500 }
    );
  }
}
