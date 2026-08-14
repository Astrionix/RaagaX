import { OfflineTrack } from './types';
import { openDB, IDBPDatabase, DBSchema } from 'idb';

interface CatalogDBSchema extends DBSchema {
  catalog: {
    key: string; // trackId
    value: OfflineTrack;
    indexes: {
      by_artist: string;
      by_downloaded_at: number;
    };
  };
}

export class OfflineCatalog {
  private static instance: OfflineCatalog;
  private dbPromise: Promise<IDBPDatabase<CatalogDBSchema>> | null = null;

  public static getInstance(): OfflineCatalog {
    if (!OfflineCatalog.instance) {
      OfflineCatalog.instance = new OfflineCatalog();
    }
    return OfflineCatalog.instance;
  }

  private getDB(): Promise<IDBPDatabase<CatalogDBSchema>> {
    if (!this.dbPromise) {
      if (typeof indexedDB === 'undefined') {
        return Promise.reject(new Error('IndexedDB is not available in current environment'));
      }
      this.dbPromise = openDB<CatalogDBSchema>('raagax-offline-catalog', 2, {
        upgrade(db, oldVersion) {
          if (!db.objectStoreNames.contains('catalog')) {
            const store = db.createObjectStore('catalog', { keyPath: 'trackId' });
            store.createIndex('by_artist', 'artist');
            store.createIndex('by_downloaded_at', 'downloadedAt');
          }
        },
      });
    }
    return this.dbPromise;
  }

  public async addTrack(track: OfflineTrack): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('catalog', track);
    } catch (e) {
      console.warn('[OfflineCatalog] addTrack error:', e);
    }
  }

  public async removeTrack(trackId: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete('catalog', trackId);
    } catch (e) {
      console.warn('[OfflineCatalog] removeTrack error:', e);
    }
  }

  public async getTrack(trackId: string): Promise<OfflineTrack | null> {
    try {
      const db = await this.getDB();
      const track = await db.get('catalog', trackId);
      return track || null;
    } catch (e) {
      return null;
    }
  }

  public async getAllTracks(): Promise<OfflineTrack[]> {
    try {
      const db = await this.getDB();
      return db.getAll('catalog');
    } catch {
      return [];
    }
  }

  public async isDownloaded(trackId: string): Promise<boolean> {
    const track = await this.getTrack(trackId);
    if (!track) return false;
    // Check if lease is expired (e.g. 30 days without reconnecting)
    if (track.leaseExpiresAt && Date.now() > track.leaseExpiresAt) {
      return false;
    }
    return true;
  }

  public async searchOfflineTracks(query: string): Promise<OfflineTrack[]> {
    if (!query || !query.trim()) return [];
    const normalized = query.toLowerCase().trim();
    const all = await this.getAllTracks();
    return all.filter((track) => {
      const titleMatch = track.title?.toLowerCase().includes(normalized);
      const artistMatch = track.artist?.toLowerCase().includes(normalized);
      const albumMatch = track.album?.toLowerCase().includes(normalized);
      return titleMatch || artistMatch || albumMatch;
    });
  }

  public async updatePlayStats(trackId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const track = await db.get('catalog', trackId);
      if (track) {
        track.lastPlayedAt = Date.now();
        track.playCount = (track.playCount || 0) + 1;
        await db.put('catalog', track);
      }
    } catch (e) {
      console.warn('[OfflineCatalog] updatePlayStats error:', e);
    }
  }

  public async clearCatalog(): Promise<void> {
    try {
      const db = await this.getDB();
      await db.clear('catalog');
    } catch (e) {
      console.warn('[OfflineCatalog] clearCatalog error:', e);
    }
  }
}

