import { NextResponse } from 'next/server';
import { DiscoveryQueue } from '@/lib/discovery/DiscoveryQueue';
import { PlaylistResolver } from '@/lib/discovery/PlaylistResolver';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow 5 minutes on Vercel Pro if available

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return new Response('Unauthorized', { status: 401 });
  }

  const workerId = `worker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const jobs = await DiscoveryQueue.claimJobs(10, workerId); // High-throughput batch processing
    if (jobs.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending jobs', processed: 0 });
    }

    const port = process.env.PORT || '3000';
    const host = request.headers.get('host') || `localhost:${port}`;
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${proto}://${host}`;
    const resolver = new PlaylistResolver(baseUrl);

    for (const job of jobs) {
      try {
        console.log(`[DiscoveryWorker] Processing job for ${job.playlist_id} (${job.language} - ${job.category})`);
        const liveResolved = await resolver.resolveSpotifyPlaylist(job.playlist_id);
        const sourceTrackCount = (liveResolved as any).sourceTrackCount ?? liveResolved.length;
        const resolvedCount = (liveResolved as any).uniqueMatchedTrackCount ?? liveResolved.length;

        if (liveResolved && liveResolved.length > 0) {
          await DiscoveryQueue.completeJob(job.playlist_id, true);
          console.log(`[DiscoveryWorker] Success: ${job.playlist_id}`);
        } else {
          await DiscoveryQueue.completeJob(job.playlist_id, false);
          console.warn(`[DiscoveryWorker] Failed: ${job.playlist_id} (No results)`);
        }
      } catch (err) {
        console.error(`[DiscoveryWorker] Error processing ${job.playlist_id}:`, err);
        await DiscoveryQueue.completeJob(job.playlist_id, false);
      }
    }

    return NextResponse.json({ success: true, processed: jobs.length });
  } catch (err) {
    console.error('[DiscoveryWorker] Fatal Error:', err);
    return NextResponse.json({ success: false, error: 'Worker failed' }, { status: 500 });
  }
}
