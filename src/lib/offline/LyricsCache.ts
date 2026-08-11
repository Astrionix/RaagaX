import { openDB, IDBPDatabase, DBSchema } from 'idb';

interface LyricsDBSchema extends DBSchema {
  lyrics: {
    key: string; // trackId
    value: {
      id: string; // trackId
      lyrics: string;
      synced: boolean;
      timestamp: number;
    };
  };
}

export class LyricsCache {
  private static instance: LyricsCache;
  private dbPromise: Promise<IDBPDatabase<LyricsDBSchema>> | null = null;

  public static getInstance(): LyricsCache {
    if (!LyricsCache.instance) {
      LyricsCache.instance = new LyricsCache();
    }
    return LyricsCache.instance;
  }

  private getDB(): Promise<IDBPDatabase<LyricsDBSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<LyricsDBSchema>('raagax-lyrics-cache', 1, {
        upgrade(db) {
          db.createObjectStore('lyrics', { keyPath: 'id' });
        },
      });
    }
    return this.dbPromise;
  }

  public async cacheLyrics(trackId: string, lyrics: string, synced: boolean = true): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('lyrics', {
        id: trackId,
        lyrics,
        synced,
        timestamp: Date.now()
      });
    } catch (e) {
      console.warn('[LyricsCache] Failed to cache lyrics', e);
    }
  }

  public async getLyrics(trackId: string): Promise<{ lyrics: string; synced: boolean } | null> {
    try {
      const db = await this.getDB();
      const entry = await db.get('lyrics', trackId);
      if (entry) {
        return { lyrics: entry.lyrics, synced: entry.synced };
      }
    } catch (e) {
      console.warn('[LyricsCache] Failed to read lyrics from cache', e);
    }
    return null;
  }
}
