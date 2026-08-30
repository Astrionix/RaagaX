import { NextRequest, NextResponse } from 'next/server';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jamId = params.id;
    const body = await req.json();
    const {
      userId = `user_${Date.now().toString(36)}`,
      displayName = 'Jam Guest',
      avatarUrl,
      deviceType = 'web',
    } = body;

    const engine = JamServerEngine.getInstance();
    const result = await engine.joinSessionAsync(jamId, {
      userId,
      displayName,
      avatarUrl,
      deviceType,
    });

    if (!result.success) {
      if (engine.isSessionEnded(jamId)) {
        return NextResponse.json(
          { success: false, code: 'JAM_ENDED', error: 'Jam session has ended' },
          { status: 410 }
        );
      }
      return NextResponse.json(
        { success: false, code: 'JAM_NOT_FOUND', error: result.error || 'Jam session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session: result.session,
      serverTime: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: err?.message || 'Failed to join Jam' },
      { status: 500 }
    );
  }
}
