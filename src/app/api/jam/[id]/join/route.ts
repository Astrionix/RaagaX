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
    const result = engine.joinSession(jamId, {
      userId,
      displayName,
      avatarUrl,
      deviceType,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      session: result.session,
      serverTime: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to join Jam' },
      { status: 500 }
    );
  }
}
