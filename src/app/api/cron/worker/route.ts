import { NextResponse } from 'next/server';
import { DiscoveryQueue } from '@/lib/discovery/DiscoveryQueue';
import { PlaylistResolver } from '@/lib/discovery/PlaylistResolver';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow 5 minutes on Vercel Pro if available

export async function GET(request: Request) {
  // To prevent unauthorized triggering, in production you'd check a secret header
  // e.g. const authHeader = request.headers.get('authorization');
  
  try {
    const jobs = await DiscoveryQueue.claimJobs(2); // Claim up to 2 jobs at a time to prevent timeout
    if (jobs.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending jobs' });
    }

    const host = request.headers.get('host') || 'localhost:3001';
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${proto}://${host}`;
    const resolver = new PlaylistResolver(baseUrl);

    for (const job of jobs) {
      try {
        console.log(`[DiscoveryWorker] Processing job for ${job.playlist_id} (${job.language} - ${job.category})`);
        const liveResolved = await resolver.resolveSpotifyPlaylist(job.playlist_id, 100);
        
        if (liveResolved && liveResolved.length > 0) {
          const expiresAt = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
          await supabaseAdmin.from('spotify_playlist_cache').upsert({
            playlist_id: job.playlist_id,
            playlist_name: job.category,
            language: job.language,
            data: liveResolved,
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
          }, { onConflict: 'playlist_id' });
          
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
