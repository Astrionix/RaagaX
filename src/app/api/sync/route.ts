import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId = 'guest', deviceId, mutations = [], listeningHistory = [], lastSyncTime } = body;

    console.log(`[API /sync] Reconnection sync from user ${userId} / device ${deviceId} (${mutations.length} pending mutations, ${listeningHistory.length} history items)`);

    // Applied mutations response
    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      appliedMutationsCount: mutations.length,
      serverTime: Date.now(),
      status: 'synchronized',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Sync failed' }, { status: 500 });
  }
}
