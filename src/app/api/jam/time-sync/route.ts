import { NextRequest, NextResponse } from 'next/server';
import { TimeSyncPing, TimeSyncResponse } from '@/types/jam';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const serverReceiveTime = Date.now();
  let clientSendTime = serverReceiveTime;

  try {
    const body: TimeSyncPing = await req.json().catch(() => ({ clientSendTime: serverReceiveTime }));
    if (body?.clientSendTime && typeof body.clientSendTime === 'number') {
      clientSendTime = body.clientSendTime;
    }
  } catch {}

  const serverSendTime = Date.now();
  const response: TimeSyncResponse = {
    clientSendTime,
    serverReceiveTime,
    serverSendTime,
  };

  return NextResponse.json(response);
}

export async function GET() {
  const now = Date.now();
  return NextResponse.json({
    clientSendTime: now,
    serverReceiveTime: now,
    serverSendTime: now,
  });
}
