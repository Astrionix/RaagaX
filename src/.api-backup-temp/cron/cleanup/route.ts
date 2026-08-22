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
    const fifteenMinsAgo = new Date(now - 15 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Release stale processing locks (>15 min) back to pending
    const { data: unlockedJobs } = await supabaseAdmin
      .from('discovery_jobs')
      .update({
        status: 'pending',
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString()
      })
      .eq('status', 'processing')
      .lt('locked_at', fifteenMinsAgo)
      .select();

    // 2. Prune obsolete dead-letter jobs older than 30 days
    const { data: prunedJobs } = await supabaseAdmin
      .from('discovery_jobs')
      .delete()
      .eq('status', 'dead_letter')
      .lt('updated_at', thirtyDaysAgo)
      .select();

    // 3. Prune expired recommendation snapshots (where expires_at < now)
    const { data: prunedSnapshots } = await supabaseAdmin
      .from('recommendation_snapshots')
      .delete()
      .lt('expires_at', new Date(now).toISOString())
      .select();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cleaned: {
        staleLocksUnlocked: unlockedJobs?.length || 0,
        deadLetterJobsPruned: prunedJobs?.length || 0,
        expiredSnapshotsPruned: prunedSnapshots?.length || 0
      }
    });
  } catch (err: any) {
    console.error('[CleanupCron] Fatal error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Cleanup failed' }, { status: 500 });
  }
}
