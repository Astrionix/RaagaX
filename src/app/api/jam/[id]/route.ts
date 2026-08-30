import { NextRequest, NextResponse } from 'next/server';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jamId = params.id;
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

    return NextResponse.json({
      success: true,
      jamId: session.jamId,
      status: session.status || 'ACTIVE',
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt || session.updatedAt,
      expiresAt: session.expiresAt,
      hostUserId: session.hostId,
      revision: session.revision,
      participantCount: Object.keys(session.participants).length,
      session,
      serverTime: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: err?.message || 'Failed to fetch Jam session' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jamId = params.id;
    const body = await req.json();
    const userId = body.userId;

    const engine = JamServerEngine.getInstance();
    const result = engine.executeCommand({
      commandId: `cmd_${Date.now()}`,
      jamId,
      userId,
      action: 'END_SESSION',
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Jam session ended' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to end Jam session' },
      { status: 500 }
    );
  }
}
