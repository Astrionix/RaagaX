import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DownloadDBSchema extends DBSchema {
  media: {
    key: string; // trackId
    value: {
      id: string; // trackId
      blob: Blob;
      mimeType: string;
      references: string[]; // e.g. ['liked_songs', 'playlist_123']
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
          if (!db.objectStoreNames.contains('media')) {
            db.createObjectStore('media', { keyPath: 'id' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  public async saveMedia(trackId: string, blob: Blob, mimeType: string, initialReference: string = 'manual'): Promise<void> {
    const db = await this.getDB();
    const existing = await db.get('media', trackId);
    const references = existing?.references ? Array.from(new Set([...existing.references, initialReference])) : [initialReference];

    await db.put('media', {
      id: trackId,
      blob,
      mimeType,
      references,
      createdAt: Date.now(),
    });
  }

  public async addReference(trackId: string, refId: string): Promise<void> {
    const db = await this.getDB();
    const entry = await db.get('media', trackId);
    if (entry) {
      const updatedRefs = Array.from(new Set([...(entry.references || []), refId]));
      await db.put('media', { ...entry, references: updatedRefs });
    }
  }

  public async removeReference(trackId: string, refId: string): Promise<boolean> {
    const db = await this.getDB();
    const entry = await db.get('media', trackId);
    if (!entry) return true;

    const remaining = (entry.references || []).filter((r) => r !== refId);
    if (remaining.length === 0) {
      await db.delete('media', trackId);
      return true; // Fully purged
    } else {
      await db.put('media', { ...entry, references: remaining });
      return false; // Still referenced by other entities
    }
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

  public async getAllDownloadedTrackIds(): Promise<string[]> {
    const db = await this.getDB();
    return db.getAllKeys('media');
  }

  public async clearAllMedia(): Promise<void> {
    const db = await this.getDB();
    await db.clear('media');
  }
}
