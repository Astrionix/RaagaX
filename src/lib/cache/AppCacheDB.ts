import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { Song } from '@/types/music';

interface CachedItem<T> {
  key: string;
  data: T;
  createdAt: number;
  expiresAt: number;
  lastAccessedAt: number;
}

interface AppCacheDBSchema extends DBSchema {
  tracks: {
    key: string;
    value: CachedItem<Song>;
    indexes: { 'by-access': number; 'by-expiry': number };
  };
  search_cache: {
    key: string;
    value: CachedItem<any>;
    indexes: { 'by-access': number; 'by-expiry': number };
  };
  recommendations_cache: {
    key: string;
    value: CachedItem<any>;
    indexes: { 'by-access': number; 'by-expiry': number };
  };
  general_cache: {
    key: string;
    value: CachedItem<any>;
    indexes: { 'by-access': number; 'by-expiry': number };
  };
}

export type AppStoreName = 'tracks' | 'search_cache' | 'recommendations_cache' | 'general_cache';

export class AppCacheDB {
  private static instance: AppCacheDB;
  private dbPromise: Promise<IDBPDatabase<AppCacheDBSchema>> | null = null;
  private memoryL1Cache = new Map<string, { data: any; expiresAt: number }>();
  private readonly MAX_TRACKS = 500;
  private readonly MAX_SEARCH = 100;
  private readonly MAX_RECS = 50;

  private constructor() {}

  public static getInstance(): AppCacheDB {
    if (!AppCacheDB.instance) {
      AppCacheDB.instance = new AppCacheDB();
    }
    return AppCacheDB.instance;
  }

  private getDB(): Promise<IDBPDatabase<AppCacheDBSchema>> | null {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return null;

    if (!this.dbPromise) {
      this.dbPromise = openDB<AppCacheDBSchema>('raagax-app-cache-v1', 1, {
        upgrade(db) {
          const stores: AppStoreName[] = [
            'tracks',
            'search_cache',
            'recommendations_cache',
            'general_cache',
          ];
          for (const storeName of stores) {
            if (!db.objectStoreNames.contains(storeName)) {
              const store = db.createObjectStore(storeName, { keyPath: 'key' });
              store.createIndex('by-access', 'lastAccessedAt');
              store.createIndex('by-expiry', 'expiresAt');
            }
          }
        },
      });
    }
    return this.dbPromise;
  }

  // ── 1. TRACKS CACHE (L1 Memory + L2 IndexedDB) ───────────────────────────
  public async getTrack(id: string): Promise<Song | null> {
    if (!id) return null;
    const memKey = `track:${id}`;
    const mem = this.memoryL1Cache.get(memKey);
    const now = Date.now();

    if (mem && mem.expiresAt > now) {
      return mem.data as Song;
    }

    try {
      const dbPromise = this.getDB();
      if (!dbPromise) return null;
      const db = await dbPromise;
      const cached = await db.get('tracks', id);
      if (!cached) return null;

      if (cached.expiresAt <= now) {
        await db.delete('tracks', id);
        return null;
      }

      // Update access time & L1 cache
      cached.lastAccessedAt = now;
      db.put('tracks', cached).catch(() => {});
      this.memoryL1Cache.set(memKey, { data: cached.data, expiresAt: cached.expiresAt });
      return cached.data;
    } catch {
      return null;
    }
  }

  public async setTrack(song: Song, ttlMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!song || !song.id) return;
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const item: CachedItem<Song> = {
      key: song.id,
      data: song,
      createdAt: now,
      expiresAt,
      lastAccessedAt: now,
    };

    this.memoryL1Cache.set(`track:${song.id}`, { data: song, expiresAt });

    try {
      const dbPromise = this.getDB();
      if (!dbPromise) return;
      const db = await dbPromise;
      await db.put('tracks', item);
      this.pruneStore('tracks', this.MAX_TRACKS).catch(() => {});
    } catch {}
  }

  // ── 2. SEARCH CACHE ───────────────────────────────────────────────────────
  public async getSearchResult<T = any>(query: string): Promise<T | null> {
    const key = query.trim().toLowerCase();
    if (!key) return null;
    const mem = this.memoryL1Cache.get(`search:${key}`);
    const now = Date.now();

    if (mem && mem.expiresAt > now) {
      return mem.data as T;
    }

    try {
      const dbPromise = this.getDB();
      if (!dbPromise) return null;
      const db = await dbPromise;
      const cached = await db.get('search_cache', key);
      if (!cached) return null;

      if (cached.expiresAt <= now) {
        await db.delete('search_cache', key);
        return null;
      }

      cached.lastAccessedAt = now;
      db.put('search_cache', cached).catch(() => {});
      this.memoryL1Cache.set(`search:${key}`, { data: cached.data, expiresAt: cached.expiresAt });
      return cached.data as T;
    } catch {
      return null;
    }
  }

  public async setSearchResult<T = any>(query: string, data: T, ttlMs: number = 60 * 60 * 1000): Promise<void> {
    const key = query.trim().toLowerCase();
    if (!key) return;
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const item: CachedItem<T> = {
      key,
      data,
      createdAt: now,
      expiresAt,
      lastAccessedAt: now,
    };

    this.memoryL1Cache.set(`search:${key}`, { data, expiresAt });

    try {
      const dbPromise = this.getDB();
      if (!dbPromise) return;
      const db = await dbPromise;
      await db.put('search_cache', item);
      this.pruneStore('search_cache', this.MAX_SEARCH).catch(() => {});
    } catch {}
  }

  // ── 3. RECOMMENDATIONS CACHE ──────────────────────────────────────────────
  public async getRecommendations<T = any>(cacheKey: string): Promise<T | null> {
    const key = cacheKey.trim().toLowerCase();
    const mem = this.memoryL1Cache.get(`rec:${key}`);
    const now = Date.now();

    if (mem && mem.expiresAt > now) {
      return mem.data as T;
    }

    try {
      const dbPromise = this.getDB();
      if (!dbPromise) return null;
      const db = await dbPromise;
      const cached = await db.get('recommendations_cache', key);
      if (!cached) return null;

      if (cached.expiresAt <= now) {
        await db.delete('recommendations_cache', key);
        return null;
      }

      cached.lastAccessedAt = now;
      db.put('recommendations_cache', cached).catch(() => {});
      this.memoryL1Cache.set(`rec:${key}`, { data: cached.data, expiresAt: cached.expiresAt });
      return cached.data as T;
    } catch {
      return null;
    }
  }

  public async setRecommendations<T = any>(cacheKey: string, data: T, ttlMs: number = 30 * 60 * 1000): Promise<void> {
    const key = cacheKey.trim().toLowerCase();
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const item: CachedItem<T> = {
      key,
      data,
      createdAt: now,
      expiresAt,
      lastAccessedAt: now,
    };

    this.memoryL1Cache.set(`rec:${key}`, { data, expiresAt });

    try {
      const dbPromise = this.getDB();
      if (!dbPromise) return;
      const db = await dbPromise;
      await db.put('recommendations_cache', item);
      this.pruneStore('recommendations_cache', this.MAX_RECS).catch(() => {});
    } catch {}
  }

  // ── 4. LRU & TTL PRUNING ───────────────────────────────────────────────────
  private async pruneStore(storeName: AppStoreName, maxEntries: number): Promise<void> {
    try {
      const dbPromise = this.getDB();
      if (!dbPromise) return;
      const db = await dbPromise;
      const count = await db.count(storeName);
      if (count <= maxEntries) return;

      // Delete expired entries first
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.store;
      const expiryIndex = store.index('by-expiry');
      const now = Date.now();
      let cursor = await expiryIndex.openCursor();
      while (cursor && cursor.value.expiresAt <= now) {
        await cursor.delete();
        cursor = await cursor.continue();
      }

      // If still over limit, delete oldest accessed (LRU)
      const currentCount = await db.count(storeName);
      if (currentCount > maxEntries) {
        const excess = currentCount - maxEntries;
        const accessIndex = store.index('by-access');
        let lruCursor = await accessIndex.openCursor();
        let deleted = 0;
        while (lruCursor && deleted < excess) {
          await lruCursor.delete();
          deleted++;
          lruCursor = await lruCursor.continue();
        }
      }
      await tx.done;
    } catch {}
  }

  // ── 5. STORAGE DIAGNOSTICS HELPER ──────────────────────────────────────────
  public async getDiagnostics(): Promise<{
    localStorageBytes: number;
    indexedDbTrackCount: number;
    indexedDbSearchCount: number;
    indexedDbRecsCount: number;
    memoryCacheCount: number;
  }> {
    let localStorageBytes = 0;
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        const v = localStorage.getItem(k) || '';
        localStorageBytes += (k.length + v.length) * 2;
      }
    }

    let indexedDbTrackCount = 0;
    let indexedDbSearchCount = 0;
    let indexedDbRecsCount = 0;

    try {
      const dbPromise = this.getDB();
      if (dbPromise) {
        const db = await dbPromise;
        indexedDbTrackCount = await db.count('tracks');
        indexedDbSearchCount = await db.count('search_cache');
        indexedDbRecsCount = await db.count('recommendations_cache');
      }
    } catch {}

    return {
      localStorageBytes,
      indexedDbTrackCount,
      indexedDbSearchCount,
      indexedDbRecsCount,
      memoryCacheCount: this.memoryL1Cache.size,
    };
  }
}
