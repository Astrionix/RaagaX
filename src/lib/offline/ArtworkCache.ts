import { openDB, IDBPDatabase, DBSchema } from 'idb';

interface ArtworkDBSchema extends DBSchema {
  artwork: {
    key: string; // artworkId or url
    value: {
      id: string;
      blob: Blob;
      mimeType: string;
      timestamp: number;
    };
  };
}

export class ArtworkCache {
  private static instance: ArtworkCache;
  private dbPromise: Promise<IDBPDatabase<ArtworkDBSchema>> | null = null;
  private objectUrls = new Map<string, string>();

  public static getInstance(): ArtworkCache {
    if (!ArtworkCache.instance) {
      ArtworkCache.instance = new ArtworkCache();
    }
    return ArtworkCache.instance;
  }

  private getDB(): Promise<IDBPDatabase<ArtworkDBSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<ArtworkDBSchema>('raagax-artwork-cache', 1, {
        upgrade(db) {
          db.createObjectStore('artwork', { keyPath: 'id' });
        },
      });
    }
    return this.dbPromise;
  }

  public async cacheArtwork(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      
      const blob = await response.blob();
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      
      const db = await this.getDB();
      await db.put('artwork', {
        id: url,
        blob,
        mimeType,
        timestamp: Date.now()
      });
    } catch (e) {
      console.warn('[ArtworkCache] Failed to cache artwork', e);
    }
  }

  public async getArtworkUrl(url: string): Promise<string> {
    if (this.objectUrls.has(url)) {
      return this.objectUrls.get(url)!;
    }

    try {
      const db = await this.getDB();
      const entry = await db.get('artwork', url);
      
      if (entry && entry.blob) {
        const objectUrl = URL.createObjectURL(entry.blob);
        this.objectUrls.set(url, objectUrl);
        return objectUrl;
      }
    } catch (e) {
      console.warn('[ArtworkCache] Failed to load artwork from cache', e);
    }

    // Fallback to original remote URL if not cached
    return url;
  }

  public releaseUrls() {
    for (const objectUrl of this.objectUrls.values()) {
      URL.revokeObjectURL(objectUrl);
    }
    this.objectUrls.clear();
  }
}
