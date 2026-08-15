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
}

export class DownloadStorage {
  private static instance: DownloadStorage;
  private dbPromise: Promise<IDBPDatabase<DownloadDBSchema>> | null = null;
  private objectUrlCache: Map<string, string> = new Map();

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

  /**
   * Queries real device storage quota via navigator.storage.estimate()
   * and calculates available free space vs RaagaX offline media usage and stream cache.
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
        // Automatically request persistent storage permission to unlock full disk allocation (up to 60% of total drive)
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
          
          // Check Chromium usageDetails
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

    // If cache was not determined via estimate.usageDetails, check CacheStorage directly
    if (raagaXCache === 0 && typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheKeys = await caches.keys();
        // A minimal approximate estimation if caches exist
        if (cacheKeys.length > 0) {
          raagaXCache = cacheKeys.length * 1024 * 1024 * 2; // ~2MB average per cache
        }
      } catch {}
    }

    const raagaXUsed = raagaXDownloads + raagaXCache;
    const available = Math.max(0, quota - usage);
    const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

    // Device identification
    let deviceName = 'My Device';
    let deviceType: 'desktop' | 'mobile' | 'tablet' | 'tv' = 'desktop';
    let platform = 'Web';

    try {
      const { DeviceRegistry } = await import('@/lib/connect/DeviceRegistry');
      const friendly = DeviceRegistry.getInstance().getFriendlyDeviceName();
      deviceName = friendly.name;
      deviceType = friendly.type;
      platform = friendly.platform;
    } catch {
      if (typeof window !== 'undefined') {
        const custom = localStorage.getItem('raagax_custom_device_name') || localStorage.getItem('raagax_device_name');
        if (custom) deviceName = custom;
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

  /**
   * Pre-checks if the device has adequate free storage before starting a download.
   */
  public async checkStorageAvailable(requiredBytes: number = 10 * 1024 * 1024): Promise<{ hasSpace: boolean; availableBytes: number }> {
    const estimate = await this.getStorageEstimate();
    // Keep a safe buffer of 20MB
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

      // Revoke any previous cached object URL
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
    } catch (err) {
      console.error(`[DownloadStorage] Failed to save media for ${trackId}:`, err);
      throw err;
    }
  }

  public async hasMedia(trackId: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      const count = await db.count('media', trackId);
      return count > 0;
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
        return true; // Fully purged
      } else {
        await db.put('media', { ...entry, references: remaining });
        return false; // Still referenced by other entities
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
    if (this.objectUrlCache.has(trackId)) {
      try {
        URL.revokeObjectURL(this.objectUrlCache.get(trackId)!);
      } catch {}
      this.objectUrlCache.delete(trackId);
    }
    try {
      const db = await this.getDB();
      await db.delete('media', trackId);
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
      return db.getAllKeys('media');
    } catch {
      return [];
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
    this.objectUrlCache.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch {}
    });
    this.objectUrlCache.clear();
    try {
      const db = await this.getDB();
      await db.clear('media');
    } catch (e) {
      console.warn('[DownloadStorage] clearAllMedia error:', e);
    }
  }
}


