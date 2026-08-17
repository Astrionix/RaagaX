import { openDB, IDBPDatabase } from 'idb';

export interface PendingMutation {
  mutation_id: string;
  user_id: string;
  type: 'LIKE_SONG' | 'UNLIKE_SONG' | 'CREATE_PLAYLIST' | 'DELETE_PLAYLIST' | 'ADD_TO_PLAYLIST' | 'REMOVE_FROM_PLAYLIST' | 'UPDATE_PLAYLIST_POSITIONS' | 'SAVE_ALBUM' | 'UNSAVE_ALBUM' | 'RECORD_DOWNLOAD' | 'REMOVE_DOWNLOAD_RECORD';
  entity_id: string;
  payload?: any;
  created_at: string;
}

export class LocalDatabase {
  private static instance: LocalDatabase;
  private dbPromise: Promise<IDBPDatabase<any>> | null = null;

  private constructor() { }

  public static getInstance(): LocalDatabase {
    if (!LocalDatabase.instance) {
      LocalDatabase.instance = new LocalDatabase();
    }
    return LocalDatabase.instance;
  }

  private getDB(): Promise<IDBPDatabase<any>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB('raagax-user-data-v1', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('user_stores')) {
            db.createObjectStore('user_stores');
          }
          if (!db.objectStoreNames.contains('pending_mutations')) {
            const store = db.createObjectStore('pending_mutations', { keyPath: 'mutation_id' });
            store.createIndex('by_user', 'user_id');
          }
        },
      });
    }
    return this.dbPromise;
  }

  private getUserKey(userId: string, storeName: string): string {
    return `user:${userId || 'guest'}:${storeName}`;
  }

  public async getUserStore<T>(userId: string, storeName: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      const key = this.getUserKey(userId, storeName);
      const val = await db.get('user_stores', key);
      return val || null;
    } catch (e) {
      console.warn('[LocalDatabase] Read error:', e);
      return null;
    }
  }

  public async setUserStore<T>(userId: string, storeName: string, data: T): Promise<void> {
    try {
      const db = await this.getDB();
      const key = this.getUserKey(userId, storeName);
      await db.put('user_stores', data, key);
    } catch (e) {
      console.warn('[LocalDatabase] Write error:', e);
    }
  }

  public async addPendingMutation(mutation: PendingMutation): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('pending_mutations', mutation);
    } catch (e) {
      console.warn('[LocalDatabase] Mutation queue write error:', e);
    }
  }

  public async getPendingMutations(userId: string): Promise<PendingMutation[]> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('pending_mutations', 'readonly');
      const index = tx.store.index('by_user');
      const mutations = await index.getAll(userId);
      return mutations || [];
    } catch (e) {
      console.warn('[LocalDatabase] Mutation queue read error:', e);
      return [];
    }
  }

  public async removePendingMutation(mutationId: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete('pending_mutations', mutationId);
    } catch (e) {
      console.warn('[LocalDatabase] Mutation remove error:', e);
    }
  }
}
