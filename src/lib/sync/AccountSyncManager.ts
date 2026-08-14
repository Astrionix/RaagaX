import { RaagaDB, STORES } from '@/lib/storage/IndexedDB';
import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

export interface PendingMutation {
  id: string;
  type: 'LIKE' | 'UNLIKE' | 'ADD_TO_PLAYLIST' | 'REMOVE_FROM_PLAYLIST' | 'PLAYBACK_CHECKPOINT';
  payload: any;
  createdAt: number;
}

export class AccountSyncManager {
  private static instance: AccountSyncManager;
  private isSyncing = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushPendingMutations();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  public static getInstance(): AccountSyncManager {
    if (!AccountSyncManager.instance) {
      AccountSyncManager.instance = new AccountSyncManager();
    }
    return AccountSyncManager.instance;
  }

  /**
   * Complete Account Sync Lifecycle:
   * Login -> Get Profile -> Sync Likes/Playlists -> Sync Playback Checkpoint -> Write Local Cache
   * (STRICT INVARIANT: Playback is restored in PAUSED state. NO AUTOPLAY.)
   */
  public async syncAccountState(userId: string): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const db = RaagaDB.getInstance();

      if (this.isOnline) {
        // 1. Fetch Remote Likes from Supabase
        const { data: likes, error: likesError } = await supabase
          .from('liked_songs')
          .select('song_id, created_at')
          .eq('user_id', userId);

        if (!likesError && likes) {
          const likedIds = likes.map((l: any) => l.song_id);
          usePlayerStore.getState().setLikedSongIds(likedIds);
          
          // Cache in IndexedDB under user-scoped key
          await db.put(STORES.LIKED_SONGS, {
            id: `user:${userId}:likes`,
            likedIds,
            updatedAt: Date.now(),
          });
        }

        // 2. Fetch Remote Playback Checkpoint (Last Played Song & Position)
        try {
          const { data: checkpoint, error: cpError } = await supabase
            .from('playback_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!cpError && checkpoint) {
            const updatedAtMs = new Date(checkpoint.updated_at || checkpoint.server_timestamp || 0).getTime();
            const ageMs = Date.now() - updatedAtMs;
            const isStale = ageMs > 4 * 60 * 60 * 1000; // Stale if older than 4 hours

            if (!isStale) {
              const store = usePlayerStore.getState();
              // Restore position in strictly PAUSED state
              if (checkpoint.canonical_position_ms) {
                store.setCurrentTime(checkpoint.canonical_position_ms / 1000, true);
                store.setIsPlaying(false, true);
              }
            }
          }
        } catch {}
      } else {
        // Offline Fallback: Load from IndexedDB
        const cachedLikes = await db.get<any>(STORES.LIKED_SONGS, `user:${userId}:likes`);
        if (cachedLikes?.likedIds) {
          usePlayerStore.getState().setLikedSongIds(cachedLikes.likedIds);
        }
      }

      // Flush any queued mutations created while offline
      await this.flushPendingMutations();
    } catch (e) {
      console.warn('[AccountSyncManager] Sync account state warning:', e);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Record a mutation locally & flush if online, or queue if offline.
   */
  public async queueMutation(type: PendingMutation['type'], payload: any): Promise<void> {
    const db = RaagaDB.getInstance();
    const mutation: PendingMutation = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      payload,
      createdAt: Date.now(),
    };

    await db.put(STORES.PENDING_MUTATIONS, mutation);

    if (this.isOnline) {
      await this.flushPendingMutations();
    }
  }

  /**
   * Process pending offline mutations sequentially in background.
   */
  public async flushPendingMutations(): Promise<void> {
    if (!this.isOnline) return;
    const db = RaagaDB.getInstance();

    try {
      const pending = await db.getAll<PendingMutation>(STORES.PENDING_MUTATIONS);
      if (!pending || pending.length === 0) return;

      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      for (const item of pending) {
        try {
          if (item.type === 'LIKE' && userId) {
            await supabase.from('liked_songs').upsert({
              user_id: userId,
              song_id: item.payload.songId,
              created_at: new Date(item.createdAt).toISOString(),
            }, { onConflict: 'user_id,song_id' });
          } else if (item.type === 'UNLIKE' && userId) {
            await supabase
              .from('liked_songs')
              .delete()
              .eq('user_id', userId)
              .eq('song_id', item.payload.songId);
          } else if (item.type === 'PLAYBACK_CHECKPOINT' && userId) {
            await supabase.from('playback_sessions').upsert({
              session_id: `user_sess_${userId}`,
              user_id: userId,
              song_id: item.payload.songId,
              canonical_position_ms: Math.floor(item.payload.currentTime * 1000),
              is_playing: false, // Never force autoplay on checkpoint sync
              updated_at: new Date().toISOString(),
            }, { onConflict: 'session_id' });
          }

          // Remove flushed mutation
          await db.delete(STORES.PENDING_MUTATIONS, item.id);
        } catch (err) {
          console.warn(`[AccountSyncManager] Failed to flush mutation ${item.id}:`, err);
        }
      }
    } catch (e) {
      console.warn('[AccountSyncManager] Error flushing pending mutations:', e);
    }
  }

  /**
   * Save Playback Checkpoint (Debounced every 10-15s or on pause/seek).
   */
  public savePlaybackCheckpoint(song: Song | null, currentTime: number): void {
    if (!song) return;
    this.queueMutation('PLAYBACK_CHECKPOINT', {
      songId: song.id,
      currentTime,
    });
  }
}
