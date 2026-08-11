export interface StorageStatus {
  usage: number;
  quota: number;
  available: number;
}

export class StorageManager {
  private static instance: StorageManager;
  
  // Example user preference limit in bytes (default 5GB)
  private downloadLimitBytes: number = 5 * 1024 * 1024 * 1024;

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  public setDownloadLimit(bytes: number) {
    this.downloadLimitBytes = bytes;
  }

  public getDownloadLimit(): number {
    return this.downloadLimitBytes;
  }

  public async getStorageStatus(): Promise<StorageStatus> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        
        // The effective quota is the minimum between the browser's quota and the user's limit
        const effectiveQuota = Math.min(quota, this.downloadLimitBytes);
        const available = Math.max(0, effectiveQuota - usage);
        
        return { usage, quota: effectiveQuota, available };
      } catch (err) {
        console.warn('Storage estimation failed', err);
      }
    }
    
    // Fallback if API is not supported
    return {
      usage: 0,
      quota: this.downloadLimitBytes,
      available: this.downloadLimitBytes
    };
  }

  public async canAccommodate(bytesNeeded: number): Promise<boolean> {
    const status = await this.getStorageStatus();
    return status.available >= bytesNeeded;
  }

  public async cleanupCache() {
    // Optional: implement logic to evict non-durable caches (like artworks, search results)
    // if storage is running low.
  }
}
