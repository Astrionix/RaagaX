import { NextRequest, NextResponse } from 'next/server';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jam/code/[code]
 * Resolves a 5-6 character restricted-alphabet join code (e.g. 7K29P) to an active JamSession
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const rawCode = params.code;
    if (!rawCode || rawCode.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Invalid Join Code format' },
        { status: 400 }
      );
    }

    const engine = JamServerEngine.getInstance();
    const session = engine.resolveJoinCode(rawCode);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No active Jam Party found for this code' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      jamId: session.jamId,
      joinCode: session.joinCode,
      name: session.name,
      hostName: session.hostName,
      currentSong: session.currentSong,
      participantCount: Object.keys(session.participants).length,
      session,
    });
  } catch (error: any) {
    console.error('[API /api/jam/code] Error resolving join code:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to resolve join code' },
      { status: 500 }
    );
  }
}
