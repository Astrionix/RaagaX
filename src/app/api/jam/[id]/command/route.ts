import { NextRequest, NextResponse } from 'next/server';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamCommand } from '@/types/jam';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jamId = params.id;
    const body = await req.json();
    const {
      userId,
      action,
      payload,
      requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      expectedRevision,
    } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required userId or action' },
        { status: 400 }
      );
    }

    const command: JamCommand = {
      commandId: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      jamId,
      userId,
      action,
      payload,
      requestId,
      expectedRevision,
    };

    const engine = JamServerEngine.getInstance();
    const result = engine.executeCommand(command);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      session: result.session,
      event: result.event,
      serverTime: Date.now(),
      isIdempotentReplay: result.isIdempotentReplay,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process Jam command' },
      { status: 500 }
    );
  }
}
