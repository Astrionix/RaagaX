import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { StorageEstimateInfo } from './types';

interface DownloadDBSchema extends DBSchema {
  media: {
    key: string; // trackId
    value: {
      id: string; // trackId
      blob: Blob;
      mimeType: string;
      references: string[]; // e.g. ['liked_songs', 'playlist_123']
      checksum?: string;
      quality?: string;
      sizeBytes?: number;
      createdAt: number;
    };
  };
  artwork: {
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
  private objectUrlCache: Map<string, string> = new Map();
  private artworkUrlCache: Map<string, string> = new Map();
  private downloadedTrackIdsSet: Set<string> = new Set();
  private isIdsInitialized: boolean = false;

  public static getInstance(): DownloadStorage {
    if (!DownloadStorage.instance) {
      DownloadStorage.instance = new DownloadStorage();
    }
    return DownloadStorage.instance;
  }

  private getDB(): Promise<IDBPDatabase<DownloadDBSchema>> {
    if (!this.dbPromise) {
      if (typeof indexedDB === 'undefined') {
        return Promise.reject(new Error('IndexedDB is not available in current environment'));
      }
      this.dbPromise = openDB<DownloadDBSchema>('raagax-downloads', 2, {
        upgrade(db, oldVersion) {
          if (!db.objectStoreNames.contains('media')) {
            db.createObjectStore('media', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('artwork')) {
            db.createObjectStore('artwork', { keyPath: 'id' });
          }
        },
      }).then(async (db) => {
        try {
          const keys = await db.getAllKeys('media');
          keys.forEach((k) => this.downloadedTrackIdsSet.add(String(k)));
          this.isIdsInitialized = true;
        } catch {}
        return db;
      });
    }
    return this.dbPromise;
  }

  /**
   * Fast synchronous check for downloaded track IDs
   */
  public isDownloadedSync(trackId: string): boolean {
    if (!trackId) return false;
    return this.downloadedTrackIdsSet.has(trackId);
  }

  public getDownloadedIdsSet(): Set<string> {
    return this.downloadedTrackIdsSet;
  }

  /**
   * Queries real device storage quota via navigator.storage.estimate()
   */
  public async getStorageEstimate(): Promise<StorageEstimateInfo> {
    const raagaXDownloads = await this.getTotalStorageUsed();
    const allTrackIds = await this.getAllDownloadedTrackIds();
    const raagaXSongCount = allTrackIds.length;

    let quota = 64 * 1024 * 1024 * 1024; // 64 GB fallback
    let usage = raagaXDownloads;
    let raagaXCache = 0;
    let isNative = false;

    // Detect Capacitor Android / Native environment
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      const cap = (window as any).Capacitor;
      if (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
        isNative = true;
      }
    }

    if (typeof navigator !== 'undefined' && navigator.storage) {
      try {
        if (navigator.storage.persist && navigator.storage.persisted) {
          const isPersisted = await navigator.storage.persisted();
          if (!isPersisted) {
            await navigator.storage.persist();
          }
        }

        if (navigator.storage.estimate) {
          const estimate: any = await navigator.storage.estimate();
          if (estimate.quota) quota = estimate.quota;
          if (estimate.usage) usage = estimate.usage;
          
          if (estimate.usageDetails?.caches) {
            raagaXCache = estimate.usageDetails.caches;
          } else if (estimate.usage && estimate.usage > raagaXDownloads) {
            raagaXCache = Math.max(0, estimate.usage - raagaXDownloads);
          }
        }
      } catch (err) {
        console.warn('[DownloadStorage] Failed to query navigator.storage.estimate:', err);
      }
    }

    if (raagaXCache === 0 && typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheKeys = await caches.keys();
        if (cacheKeys.length > 0) {
          raagaXCache = cacheKeys.length * 1024 * 1024 * 2;
        }
      } catch {}
    }

    const raagaXUsed = raagaXDownloads + raagaXCache;
    const available = Math.max(0, quota - usage);
    const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

    let deviceName = typeof window !== 'undefined' ? (localStorage.getItem('raagax_device_name') || 'This Device') : 'This Device';
    let deviceType: 'desktop' | 'mobile' | 'tablet' | 'tv' = 'mobile';
    let platform = 'Web';

    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent;
      if (/android/i.test(ua)) {
        platform = 'Android';
        deviceType = 'mobile';
      } else if (/ipad|tablet/i.test(ua)) {
        platform = 'Tablet';
        deviceType = 'tablet';
      } else if (/iphone|ipod/i.test(ua)) {
        platform = 'iOS';
        deviceType = 'mobile';
      } else {
        platform = 'Desktop';
        deviceType = 'desktop';
      }
    }

    return {
      quota,
      usage,
      available,
      raagaXUsed,
      raagaXDownloads,
      raagaXCache,
      raagaXSongCount,
      percentUsed: Math.min(100, Math.max(0, percentUsed)),
      isNative,
      storageType: isNative ? 'device' : 'browser',
      deviceName,
      deviceType,
      platform,
    };
  }

  public async checkStorageAvailable(requiredBytes: number = 10 * 1024 * 1024): Promise<{ hasSpace: boolean; availableBytes: number }> {
    const estimate = await this.getStorageEstimate();
    const safeBuffer = 20 * 1024 * 1024;
    const hasSpace = estimate.available >= (requiredBytes + safeBuffer);
    return {
      hasSpace,
      availableBytes: estimate.available,
    };
  }

  public async saveMedia(
    trackId: string, 
    blob: Blob, 
    mimeType: string, 
    initialReference: string = 'manual',
    extra?: { checksum?: string; quality?: string }
  ): Promise<void> {
    try {
      const db = await this.getDB();
      const existing = await db.get('media', trackId);
      const references = existing?.references 
        ? Array.from(new Set([...existing.references, initialReference])) 
        : [initialReference];

      if (this.objectUrlCache.has(trackId)) {
        try {
          URL.revokeObjectURL(this.objectUrlCache.get(trackId)!);
        } catch {}
        this.objectUrlCache.delete(trackId);
      }

      await db.put('media', {
        id: trackId,
        blob,
        mimeType,
        references,
        checksum: extra?.checksum,
        quality: extra?.quality,
        sizeBytes: blob.size,
        createdAt: Date.now(),
      });

      this.downloadedTrackIdsSet.add(trackId);
    } catch (err) {
      console.error(`[DownloadStorage] Failed to save media for ${trackId}:`, err);
      throw err;
    }
  }

  public async saveArtwork(trackId: string, blob: Blob, mimeType = 'image/jpeg'): Promise<void> {
    try {
      const db = await this.getDB();
      if (this.artworkUrlCache.has(trackId)) {
        try { URL.revokeObjectURL(this.artworkUrlCache.get(trackId)!); } catch {}
        this.artworkUrlCache.delete(trackId);
      }
      await db.put('artwork', {
        id: trackId,
        blob,
        mimeType,
        createdAt: Date.now(),
      });
    } catch (e) {
      console.warn(`[DownloadStorage] Failed to save artwork for ${trackId}:`, e);
    }
  }

  public async getArtworkBlob(trackId: string): Promise<Blob | null> {
    try {
      const db = await this.getDB();
      const entry = await db.get('artwork', trackId);
      return entry ? entry.blob : null;
    } catch {
      return null;
    }
  }

  public async getArtworkUrl(trackId: string): Promise<string | null> {
    if (this.artworkUrlCache.has(trackId)) {
      return this.artworkUrlCache.get(trackId)!;
    }
    const blob = await this.getArtworkBlob(trackId);
    if (!blob) return null;
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      const url = URL.createObjectURL(blob);
      this.artworkUrlCache.set(trackId, url);
      return url;
    }
    return null;
  }

  public async hasMedia(trackId: string): Promise<boolean> {
    if (this.downloadedTrackIdsSet.has(trackId)) return true;
    try {
      const db = await this.getDB();
      const count = await db.count('media', trackId);
      if (count > 0) {
        this.downloadedTrackIdsSet.add(trackId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async addReference(trackId: string, refId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const entry = await db.get('media', trackId);
      if (entry) {
        const updatedRefs = Array.from(new Set([...(entry.references || []), refId]));
        await db.put('media', { ...entry, references: updatedRefs });
      }
    } catch (e) {
      console.warn('[DownloadStorage] addReference error:', e);
    }
  }

  public async removeReference(trackId: string, refId: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      const entry = await db.get('media', trackId);
      if (!entry) return true;

      const remaining = (entry.references || []).filter((r) => r !== refId);
      if (remaining.length === 0) {
        await this.deleteMedia(trackId);
        return true;
      } else {
        await db.put('media', { ...entry, references: remaining });
        return false;
      }
    } catch (e) {
      console.warn('[DownloadStorage] removeReference error:', e);
      return true;
    }
  }

  public async getMediaBlob(trackId: string): Promise<Blob | null> {
    try {
      const db = await this.getDB();
      const entry = await db.get('media', trackId);
      return entry ? entry.blob : null;
    } catch {
      return null;
    }
  }

  public async deleteMedia(trackId: string): Promise<void> {
    this.downloadedTrackIdsSet.delete(trackId);
    if (this.objectUrlCache.has(trackId)) {
      const url = this.objectUrlCache.get(trackId)!;
      this.objectUrlCache.delete(trackId);
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch {}
      }, 5000);
    }
    if (this.artworkUrlCache.has(trackId)) {
      const artUrl = this.artworkUrlCache.get(trackId)!;
      this.artworkUrlCache.delete(trackId);
      setTimeout(() => {
        try { URL.revokeObjectURL(artUrl); } catch {}
      }, 5000);
    }
    try {
      const db = await this.getDB();
      await db.delete('media', trackId);
      await db.delete('artwork', trackId);
    } catch (e) {
      console.warn('[DownloadStorage] deleteMedia error:', e);
    }
  }

  public async getMediaUrl(trackId: string): Promise<string | null> {
    if (this.objectUrlCache.has(trackId)) {
      return this.objectUrlCache.get(trackId)!;
    }

    const blob = await this.getMediaBlob(trackId);
    if (!blob) return null;

    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      const url = URL.createObjectURL(blob);
      this.objectUrlCache.set(trackId, url);
      return url;
    }
    return null;
  }

  public async getAllDownloadedTrackIds(): Promise<string[]> {
    try {
      const db = await this.getDB();
      const keys = await db.getAllKeys('media');
      const strKeys = keys.map((k) => String(k));
      strKeys.forEach((k) => this.downloadedTrackIdsSet.add(k));
      return strKeys;
    } catch {
      return Array.from(this.downloadedTrackIdsSet);
    }
  }

  public async getTotalStorageUsed(): Promise<number> {
    try {
      const db = await this.getDB();
      const allMedia = await db.getAll('media');
      return allMedia.reduce((acc, entry) => acc + (entry.sizeBytes || entry.blob?.size || 0), 0);
    } catch {
      return 0;
    }
  }

  public async clearAllMedia(): Promise<void> {
    this.downloadedTrackIdsSet.clear();
    this.objectUrlCache.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch {}
    });
    this.objectUrlCache.clear();
    this.artworkUrlCache.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch {}
    });
    this.artworkUrlCache.clear();
    try {
      const db = await this.getDB();
      await db.clear('media');
      await db.clear('artwork');
    } catch (e) {
      console.warn('[DownloadStorage] clearAllMedia error:', e);
    }
  }
}
