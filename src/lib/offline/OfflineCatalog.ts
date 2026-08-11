import { OfflineTrack } from './types';
import { openDB, IDBPDatabase, DBSchema } from 'idb';

interface CatalogDBSchema extends DBSchema {
  catalog: {
    key: string; // trackId
    value: OfflineTrack;
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
      this.dbPromise = openDB<CatalogDBSchema>('raagax-offline-catalog', 1, {
        upgrade(db) {
          db.createObjectStore('catalog', { keyPath: 'trackId' });
        },
      });
    }
    return this.dbPromise;
  }

  public async addTrack(track: OfflineTrack): Promise<void> {
    const db = await this.getDB();
    await db.put('catalog', track);
  }

  public async removeTrack(trackId: string): Promise<void> {
    const db = await this.getDB();
    await db.delete('catalog', trackId);
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
    const db = await this.getDB();
    return db.getAll('catalog');
  }

  public async isDownloaded(trackId: string): Promise<boolean> {
    const track = await this.getTrack(trackId);
    return track !== null;
  }
}
