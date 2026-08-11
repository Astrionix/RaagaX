import { supabaseAdmin } from '@/lib/supabaseAdmin';

export interface DiscoveryJob {
  playlist_id: string;
  language: string;
  category: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  locked_at: string | null;
  attempts: number;
}

export class DiscoveryQueue {
  /**
   * Enqueues a job only if it's not already pending or processing.
   * Prevents simultaneous discovery pipelines for the same playlist.
   */
  static async enqueue(playlistId: string, language: string, category: string): Promise<boolean> {
    try {
      // 1. Check if job already exists and is active
      const { data: existing } = await supabaseAdmin
        .from('discovery_jobs')
        .select('status, locked_at')
        .eq('playlist_id', playlistId)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'processing' || existing.status === 'pending') {
          // If locked > 15 mins ago, consider it dead and allow re-queue
          if (existing.locked_at) {
            const lockedTime = new Date(existing.locked_at).getTime();
            if (Date.now() - lockedTime < 15 * 60 * 1000) {
              return false; // Job is actively being processed, do nothing
            }
          } else {
            return false; // Job is pending in queue
          }
        }
      }

      // 2. Insert or update job to pending
      await supabaseAdmin.from('discovery_jobs').upsert({
        playlist_id: playlistId,
        language,
        category,
        status: 'pending',
        locked_at: null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'playlist_id' });

      // Trigger the background worker without blocking
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
      fetch(`${baseUrl}/api/cron/worker`).catch(() => {});

      return true;
    } catch (err) {
      console.error('[DiscoveryQueue] Failed to enqueue:', err);
      return false;
    }
  }

  /**
   * Claims up to a certain number of jobs for a worker.
   */
  static async claimJobs(limit = 2): Promise<DiscoveryJob[]> {
    try {
      // Find pending jobs
      const { data: pending } = await supabaseAdmin
        .from('discovery_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (!pending || pending.length === 0) return [];

      const claimed: DiscoveryJob[] = [];
      const now = new Date().toISOString();

      // Lock them
      for (const job of pending) {
        const { data: updated } = await supabaseAdmin
          .from('discovery_jobs')
          .update({
            status: 'processing',
            locked_at: now,
            updated_at: now,
            attempts: job.attempts + 1
          })
          .eq('playlist_id', job.playlist_id)
          .eq('status', 'pending')
          .select()
          .single();

        if (updated) {
          claimed.push(updated as DiscoveryJob);
        }
      }

      return claimed;
    } catch (err) {
      console.error('[DiscoveryQueue] Failed to claim jobs:', err);
      return [];
    }
  }

  /**
   * Marks a job as completed or failed
   */
  static async completeJob(playlistId: string, success: boolean) {
    try {
      await supabaseAdmin
        .from('discovery_jobs')
        .update({
          status: success ? 'completed' : 'failed',
          locked_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('playlist_id', playlistId);
    } catch (err) {
      console.error('[DiscoveryQueue] Failed to complete job:', err);
    }
  }
}
