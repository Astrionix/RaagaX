import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return new Response('Unauthorized', { status: 401 });
  }

  console.log('[CleanupCron] Database cleanup process started...');
  try {
    const now = Date.now();
    const cleaned = {
      expiredSnapshotsPruned: 0,
      expiredAiRecsPruned: 0,
      listeningEventsPruned: 0,
      userEventsPruned: 0,
    };
    const errors: Record<string, string> = {};

    // 1. Prune expired recommendation snapshots (where expires_at < now)
    try {
      const { data, error } = await supabaseAdmin
        .from('recommendation_snapshots')
        .delete()
        .lt('expires_at', new Date(now).toISOString())
        .select();
      if (error) throw error;
      cleaned.expiredSnapshotsPruned = data?.length || 0;
      console.log(`[CleanupCron] Pruned ${cleaned.expiredSnapshotsPruned} recommendation snapshots`);
    } catch (err: any) {
      console.error('[CleanupCron] Failed to prune recommendation snapshots:', err);
      errors.recommendationSnapshots = err.message || 'Failed';
    }

    // 2. Prune expired AI recommendations
    try {
      const { data, error } = await supabaseAdmin
        .from('ai_recommendations')
        .delete()
        .lt('expires_at', new Date(now).toISOString())
        .select();
      if (error) throw error;
      cleaned.expiredAiRecsPruned = data?.length || 0;
      console.log(`[CleanupCron] Pruned ${cleaned.expiredAiRecsPruned} AI recommendations`);
    } catch (err: any) {
      console.error('[CleanupCron] Failed to prune AI recommendations:', err);
      errors.aiRecommendations = err.message || 'Failed';
    }

    // 3. Prune raw listening_events older than 14 days to prevent table bloat
    try {
      const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseAdmin
        .from('listening_events')
        .delete()
        .lt('created_at', fourteenDaysAgo)
        .select();
      if (error) throw error;
      cleaned.listeningEventsPruned = data?.length || 0;
      console.log(`[CleanupCron] Pruned ${cleaned.listeningEventsPruned} listening events`);
    } catch (err: any) {
      console.error('[CleanupCron] Failed to prune listening events:', err);
      errors.listeningEvents = err.message || 'Failed';
    }

    // 4. Prune raw user_events older than 14 days
    try {
      const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseAdmin
        .from('user_events')
        .delete()
        .lt('created_at', fourteenDaysAgo)
        .select();
      if (error) throw error;
      cleaned.userEventsPruned = data?.length || 0;
      console.log(`[CleanupCron] Pruned ${cleaned.userEventsPruned} user events`);
    } catch (err: any) {
      console.error('[CleanupCron] Failed to prune user events:', err);
      errors.userEvents = err.message || 'Failed';
    }

    const hasErrors = Object.keys(errors).length > 0;
    console.log(`[CleanupCron] Database cleanup process completed ${hasErrors ? 'with some failures' : 'successfully'}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cleaned,
      errors: hasErrors ? errors : undefined
    });
  } catch (err: any) {
    console.error('[CleanupCron] Fatal error in main cleanup routine:', err);
    return NextResponse.json({ success: false, error: err.message || 'Cleanup failed' }, { status: 500 });
  }
}
