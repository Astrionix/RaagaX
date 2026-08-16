'use client';

/**
 * RequestDeduplicator — Coalesces identical concurrent promises and handles
 * aborting obsolete/stale search queries to prevent UI race conditions.
 */
export class RequestDeduplicator {
  private static instance: RequestDeduplicator;
  private pendingRequests = new Map<string, Promise<any>>();
  private abortControllers = new Map<string, AbortController>();

  private constructor() {}

  public static getInstance(): RequestDeduplicator {
    if (!RequestDeduplicator.instance) {
      RequestDeduplicator.instance = new RequestDeduplicator();
    }
    return RequestDeduplicator.instance;
  }

  /**
   * Deduplicates identical concurrent fetch/resolver operations
   */
  public async dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    const promise = fetcher().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Aborts previous request with the same channel ID (e.g. 'search_query')
   * and returns a fresh AbortSignal
   */
  public getAbortSignal(channel: string): AbortSignal {
    if (this.abortControllers.has(channel)) {
      try {
        this.abortControllers.get(channel)?.abort();
      } catch {}
    }

    const controller = new AbortController();
    this.abortControllers.set(channel, controller);
    return controller.signal;
  }

  /**
   * Generates tiered CDN artwork URLs (thumb: 150px, medium: 300px, large: 500px)
   */
  public static getOptimizedArtworkUrl(url?: string, size: 'thumb' | 'medium' | 'large' = 'medium'): string {
    if (!url || url.includes('/null/') || url.includes('null/null')) {
      return '/app-icon.png';
    }

    let targetSize = '500x500';
    if (size === 'thumb') targetSize = '150x150';
    else if (size === 'medium') targetSize = '300x300';
    else if (size === 'large') targetSize = '500x500';

    return url
      .replace('http://', 'https://')
      .replace(/150x150|50x50|300x300|500x500/g, targetSize);
  }
}
