import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    // 1. Prune expired recommendation snapshots (where expires_at < now)
    const { data: prunedSnapshots } = await supabaseAdmin
      .from('recommendation_snapshots')
      .delete()
      .lt('expires_at', new Date(now).toISOString())
      .select();

    // 2. Prune expired AI recommendations
    const { data: prunedAiRecs } = await supabaseAdmin
      .from('ai_recommendations')
      .delete()
      .lt('expires_at', new Date(now).toISOString())
      .select();

    // 3. Prune old processed command idempotency records older than 1 day
    const { data: prunedCommands } = await supabaseAdmin
      .from('processed_commands')
      .delete()
      .lt('processed_at', oneDayAgo)
      .select();

    // 4. Prune raw listening_events older than 14 days to prevent table bloat
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: prunedListeningEvents } = await supabaseAdmin
      .from('listening_events')
      .delete()
      .lt('created_at', fourteenDaysAgo)
      .select();

    // 5. Prune raw user_events older than 14 days
    const { data: prunedUserEvents } = await supabaseAdmin
      .from('user_events')
      .delete()
      .lt('created_at', fourteenDaysAgo)
      .select();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cleaned: {
        expiredSnapshotsPruned: prunedSnapshots?.length || 0,
        expiredAiRecsPruned: prunedAiRecs?.length || 0,
        processedCommandsPruned: prunedCommands?.length || 0,
        listeningEventsPruned: prunedListeningEvents?.length || 0,
        userEventsPruned: prunedUserEvents?.length || 0
      }
    });
  } catch (err: any) {
    console.error('[CleanupCron] Fatal error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Cleanup failed' }, { status: 500 });
  }
}
