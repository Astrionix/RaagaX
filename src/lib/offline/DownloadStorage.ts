import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DownloadDBSchema extends DBSchema {
  media: {
    key: string; // trackId
    value: {
      id: string; // trackId
      blob: Blob;
      mimeType: string;
      createdAt: number;
    };
  };
}

export class DownloadStorage {
  private static instance: DownloadStorage;
  private dbPromise: Promise<IDBPDatabase<DownloadDBSchema>> | null = null;

  public static getInstance(): DownloadStorage {
    if (!DownloadStorage.instance) {
      DownloadStorage.instance = new DownloadStorage();
    }
    return DownloadStorage.instance;
  }

  private getDB(): Promise<IDBPDatabase<DownloadDBSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<DownloadDBSchema>('raagax-downloads', 1, {
        upgrade(db) {
          db.createObjectStore('media', { keyPath: 'id' });
        },
      });
    }
    return this.dbPromise;
  }

  public async saveMedia(trackId: string, blob: Blob, mimeType: string): Promise<void> {
    const db = await this.getDB();
    await db.put('media', {
      id: trackId,
      blob,
      mimeType,
      createdAt: Date.now(),
    });
  }

  public async getMediaBlob(trackId: string): Promise<Blob | null> {
    const db = await this.getDB();
    const entry = await db.get('media', trackId);
    return entry ? entry.blob : null;
  }

  public async deleteMedia(trackId: string): Promise<void> {
    const db = await this.getDB();
    await db.delete('media', trackId);
  }

  public async getMediaUrl(trackId: string): Promise<string | null> {
    const blob = await this.getMediaBlob(trackId);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }
}
