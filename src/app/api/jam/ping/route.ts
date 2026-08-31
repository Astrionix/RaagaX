import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jam/ping
 * Ultra-low-latency LAN probe endpoint for measuring real-time RTT and verifying reachability.
 */
export async function GET(_req: NextRequest) {
  const timestamp = Date.now();
  return NextResponse.json(
    {
      ok: true,
      timestamp,
      protocolVersion: '2.0.0',
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'X-RaagaX-Protocol': '2.0.0',
      },
    }
  );
}

/**
 * POST /api/jam/ping
 * Echoes client send timestamp for precise symmetric RTT calculation.
 */
export async function POST(req: NextRequest) {
  const serverReceiveTime = Date.now();
  let clientSendTime = serverReceiveTime;

  try {
    const body = await req.json().catch(() => ({ clientSendTime: serverReceiveTime }));
    if (body?.clientSendTime && typeof body.clientSendTime === 'number') {
      clientSendTime = body.clientSendTime;
    }
  } catch {}

  const serverSendTime = Date.now();
  return NextResponse.json(
    {
      ok: true,
      clientSendTime,
      serverReceiveTime,
      serverSendTime,
      protocolVersion: '2.0.0',
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}
