import { openDB, IDBPDatabase } from 'idb';
import { LyricsData } from './LyricsTypes';

const DB_NAME = 'RaagaX_LyricsDB';
const STORE_NAME = 'lyrics';

export class LyricsCache {
  private static instance: LyricsCache;
  private dbPromise: Promise<IDBPDatabase | null>;

  private constructor() {
    this.dbPromise = this.initDB();
  }

  public static getInstance(): LyricsCache {
    if (!LyricsCache.instance) {
      LyricsCache.instance = new LyricsCache();
    }
    return LyricsCache.instance;
  }

  private async initDB(): Promise<IDBPDatabase | null> {
    if (typeof window === 'undefined') return null;
    
    try {
      return await openDB(DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'trackId' });
          }
        },
      });
    } catch (e) {
      console.warn('Failed to initialize Lyrics IndexedDB', e);
      return null;
    }
  }

  public async getLyrics(trackId: string): Promise<LyricsData | null> {
    try {
      const db = await this.dbPromise;
      if (!db) return null;
      
      const data = await db.get(STORE_NAME, trackId);
      return data as LyricsData || null;
    } catch (e) {
      console.error('Failed to read from LyricsCache', e);
      return null;
    }
  }

  public async saveLyrics(data: LyricsData): Promise<void> {
    try {
      const db = await this.dbPromise;
      if (!db) return;
      
      await db.put(STORE_NAME, {
        ...data,
        cachedAt: Date.now()
      });
    } catch (e) {
      console.error('Failed to save to LyricsCache', e);
    }
  }

  public async clearCache(): Promise<void> {
    try {
      const db = await this.dbPromise;
      if (!db) return;
      
      await db.clear(STORE_NAME);
    } catch (e) {
      console.error('Failed to clear LyricsCache', e);
    }
  }
}
