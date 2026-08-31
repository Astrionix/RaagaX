import { Song } from '@/types/music';
import { supabase } from '@/lib/supabase';

export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncEntityType = 'liked_song' | 'playlist' | 'playlist_item';

export interface SyncOperation {
  operationId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperationType;
  payload: any;
  createdAt: number;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  error?: string;
}

export interface LikedSongRecord {
  songId: string;
  song: Song;
  likedAt: number;
  deletedAt: number | null;
}

export interface PlaylistRecord {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface PlaylistItemRecord {
  id: string;
  playlistId: string;
  songId: string;
  song: Song;
  position: number;
  addedAt: number;
  deletedAt: number | null;
}

export class LibrarySyncEngine {
  private static instance: LibrarySyncEngine;
  private isSyncing = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.flushPendingOperations());
    }
  }

  public static getInstance(): LibrarySyncEngine {
    if (!LibrarySyncEngine.instance) {
      LibrarySyncEngine.instance = new LibrarySyncEngine();
    }
    return LibrarySyncEngine.instance;
  }

  /**
   * Local-First Like Song: Writes to IndexedDB instantly and queues sync operation
   */
  public async likeSong(song: Song): Promise<void> {
    const record: LikedSongRecord = {
      songId: song.id,
      song,
      likedAt: Date.now(),
      deletedAt: null,
    };

    // 1. Instant local write
    await this.putLocal('liked_songs', record);

    // 2. Queue sync operation
    const op: SyncOperation = {
      operationId: `op_like_${song.id}_${Date.now()}`,
      entityType: 'liked_song',
      entityId: song.id,
      operation: 'CREATE',
      payload: { song_id: song.id, song_data: song, created_at: new Date(record.likedAt).toISOString() },
      createdAt: Date.now(),
      status: 'PENDING',
    };
    await this.putLocal('sync_operations', op);

    // 3. Trigger async background flush
    this.flushPendingOperations();
  }

  /**
   * Local-First Unlike Song with Tombstone
   */
  public async unlikeSong(songId: string): Promise<void> {
    const existing = await this.getLocal<LikedSongRecord>('liked_songs', songId);
    if (existing) {
      existing.deletedAt = Date.now();
      await this.putLocal('liked_songs', existing);
    }

    const op: SyncOperation = {
      operationId: `op_unlike_${songId}_${Date.now()}`,
      entityType: 'liked_song',
      entityId: songId,
      operation: 'DELETE',
      payload: { song_id: songId, deleted_at: new Date().toISOString() },
      createdAt: Date.now(),
      status: 'PENDING',
    };
    await this.putLocal('sync_operations', op);

    this.flushPendingOperations();
  }

  /**
   * Background Reconciliation Pipeline: Flushes pending operations to Supabase
   */
  public async flushPendingOperations(): Promise<void> {
    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    if (this.isSyncing || typeof window === 'undefined' || !isOnline) return;
    this.isSyncing = true;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const pendingOps = await this.getAllLocal<SyncOperation>('sync_operations');
      const unsynced = pendingOps.filter(op => op.status === 'PENDING');

      for (const op of unsynced) {
        try {
          if (op.entityType === 'liked_song') {
            if (op.operation === 'CREATE') {
              await supabase.from('liked_songs').upsert({
                user_id: session.user.id,
                song_id: op.payload.song_id,
                created_at: op.payload.created_at,
              }, { onConflict: 'user_id,song_id' });
            } else if (op.operation === 'DELETE') {
              await supabase.from('liked_songs')
                .delete()
                .eq('user_id', session.user.id)
                .eq('song_id', op.payload.song_id);
            }
          }

          // Mark operation synced
          op.status = 'SYNCED';
          await this.putLocal('sync_operations', op);
        } catch (err: any) {
          console.warn(`[LibrarySyncEngine] Operation ${op.operationId} failed:`, err);
          op.status = 'FAILED';
          op.error = err.message;
          await this.putLocal('sync_operations', op);
        }
      }
    } catch (e) {
      console.warn('[LibrarySyncEngine] Flush failed:', e);
    } finally {
      this.isSyncing = false;
    }
  }

  // --- IndexedDB Low-Level Helpers ---
  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('RaagaX_LocalDB', 3);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async putLocal(storeName: string, item: any): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(item);
    } catch (e) {
      console.warn(`[LibrarySyncEngine] Failed putLocal ${storeName}:`, e);
    }
  }

  private async getLocal<T>(storeName: string, key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  private async getAllLocal<T>(storeName: string): Promise<T[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  }
}
