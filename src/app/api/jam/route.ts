import { NextRequest, NextResponse } from 'next/server';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      hostId = `user_${Date.now().toString(36)}`,
      hostName = 'RaagaX Listener',
      hostAvatar,
      jamName,
      initialSong,
      initialQueue,
      deviceType,
    } = body;

    const engine = JamServerEngine.getInstance();
    const { session, event } = engine.createSession({
      hostId,
      hostName,
      hostAvatar,
      jamName,
      initialSong,
      initialQueue,
      deviceType,
    });

    return NextResponse.json({
      success: true,
      jamId: session.jamId,
      session,
      event,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create Jam session' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    serverTime: Date.now(),
    message: 'RaagaX Authoritative Jam Service is Active',
  });
}
