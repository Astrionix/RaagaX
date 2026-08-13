import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retry_wait' | 'dead_letter';

export interface DiscoveryJob {
  playlist_id: string;
  language: string;
  category: string;
  status: JobStatus;
  locked_at: string | null;
  locked_by: string | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
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
        .select('status, locked_at, attempts')
        .eq('playlist_id', playlistId)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'processing' || existing.status === 'pending') {
          // If locked > 15 mins ago, consider lease expired and allow claim/re-queue
          if (existing.locked_at) {
            const lockedTime = new Date(existing.locked_at).getTime();
            if (Date.now() - lockedTime < 15 * 60 * 1000) {
              return false; // Active lease held by worker, skip
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
        locked_by: null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'playlist_id' });

      // Trigger background worker asynchronously
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
      fetch(`${baseUrl}/api/cron/worker`).catch(() => {});

      return true;
    } catch (err) {
      console.error('[DiscoveryQueue] Failed to enqueue:', err);
      return false;
    }
  }

  /**
   * Claims up to a certain number of jobs atomically for a worker lease.
   */
  static async claimJobs(limit = 10, workerId: string = `worker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`): Promise<DiscoveryJob[]> {
    try {
      // Find pending or lease-expired jobs
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: candidates } = await supabaseAdmin
        .from('discovery_jobs')
        .select('*')
        .or(`status.eq.pending,and(status.eq.processing,locked_at.lt.${fifteenMinsAgo})`)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (!candidates || candidates.length === 0) return [];

      const claimed: DiscoveryJob[] = [];
      const now = new Date().toISOString();

      // Lock each job atomically
      for (const job of candidates) {
        const nextAttempts = (job.attempts || 0) + 1;
        if (nextAttempts > 3) {
          // Move to dead letter if exceeded 3 attempts
          await supabaseAdmin.from('discovery_jobs').update({
            status: 'dead_letter',
            locked_at: null,
            locked_by: null,
            updated_at: now
          }).eq('playlist_id', job.playlist_id);
          continue;
        }

        const { data: updated } = await supabaseAdmin
          .from('discovery_jobs')
          .update({
            status: 'processing',
            locked_at: now,
            locked_by: workerId,
            updated_at: now,
            attempts: nextAttempts
          })
          .eq('playlist_id', job.playlist_id)
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
   * Marks a job as completed or handles 3-strike retry logic.
   */
  static async completeJob(playlistId: string, success: boolean, errorMessage?: string) {
    try {
      const now = new Date().toISOString();
      if (success) {
        await supabaseAdmin
          .from('discovery_jobs')
          .update({
            status: 'completed',
            locked_at: null,
            locked_by: null,
            last_error: null,
            updated_at: now
          })
          .eq('playlist_id', playlistId);
      } else {
        const { data: current } = await supabaseAdmin
          .from('discovery_jobs')
          .select('attempts')
          .eq('playlist_id', playlistId)
          .single();

        const attempts = current?.attempts || 1;
        const newStatus: JobStatus = attempts >= 3 ? 'dead_letter' : 'retry_wait';

        await supabaseAdmin
          .from('discovery_jobs')
          .update({
            status: newStatus,
            locked_at: null,
            locked_by: null,
            last_error: errorMessage || 'Execution failed',
            updated_at: now
          })
          .eq('playlist_id', playlistId);
      }
    } catch (err) {
      console.error('[DiscoveryQueue] Failed to complete job:', err);
    }
  }
}
