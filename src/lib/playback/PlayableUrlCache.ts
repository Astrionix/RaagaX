/**
 * PlayableUrlCache — Ultra-Fast Audio Stream & URL Cache
 *
 * Provides sub-millisecond URL resolution for playback and queue preloading.
 * Stores resolved audio URLs with TTL/expiration tracking and persistent backing.
 */

export interface PlayableUrlCacheEntry {
  songId: string;
  url: string;
  candidates: string[];
  type: 'offline' | 'remote';
  quality?: string;
  expiresAt: number;
  resolvedAt: number;
  isLocalBlob?: boolean;
}

export class PlayableUrlCache {
  private static instance: PlayableUrlCache;
  private memoryCache: Map<string, PlayableUrlCacheEntry> = new Map();
  private readonly DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
  private readonly STORAGE_KEY = 'raagax_playable_url_cache';

  private constructor() {
    this.hydrateFromStorage();
  }

  public static getInstance(): PlayableUrlCache {
    if (!PlayableUrlCache.instance) {
      PlayableUrlCache.instance = new PlayableUrlCache();
    }
    return PlayableUrlCache.instance;
  }

  private hydrateFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const parsed: Record<string, PlayableUrlCacheEntry> = JSON.parse(raw);
      const now = Date.now();
      for (const [id, entry] of Object.entries(parsed)) {
        if (entry && entry.expiresAt > now && !entry.isLocalBlob) {
          this.memoryCache.set(id, entry);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }

  private persistToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const now = Date.now();
      const validEntries: Record<string, PlayableUrlCacheEntry> = {};
      let count = 0;
      for (const [id, entry] of this.memoryCache.entries()) {
        if (entry.expiresAt > now && !entry.isLocalBlob && count < 100) {
          validEntries[id] = entry;
          count++;
        }
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validEntries));
    } catch {
      // Ignore storage quota errors
    }
  }

  /**
   * Fast synchronous cache lookup (0ms latency)
   */
  public get(songId: string): PlayableUrlCacheEntry | null {
    if (!songId) return null;
    const entry = this.memoryCache.get(songId);
    if (!entry) return null;

    // Check expiration
    if (Date.now() >= entry.expiresAt) {
      this.memoryCache.delete(songId);
      return null;
    }

    // On non-native platforms (Web/Desktop), ignore any media3_cache:// or Android file:// protocols
    if (typeof window !== 'undefined' && !(window as any).Capacitor?.isNativePlatform?.()) {
      if (entry.url && (entry.url.includes('media3_cache') || entry.url.startsWith('media3://') || entry.url.startsWith('file://'))) {
        this.memoryCache.delete(songId);
        return null;
      }
    }

    return entry;
  }

  /**
   * Store resolved URL entry in memory and persist
   */
  public set(
    songId: string,
    url: string,
    candidates: string[] = [],
    type: 'offline' | 'remote' = 'remote',
    ttlMs: number = this.DEFAULT_TTL_MS,
    isLocalBlob: boolean = false
  ) {
    if (!songId || !url) return;
    const now = Date.now();
    const entry: PlayableUrlCacheEntry = {
      songId,
      url,
      candidates: candidates.length > 0 ? candidates : [url],
      type,
      expiresAt: now + ttlMs,
      resolvedAt: now,
      isLocalBlob,
    };

    this.memoryCache.set(songId, entry);

    if (!isLocalBlob) {
      this.persistToStorage();
    }
  }

  public isExpiringSoon(songId: string, thresholdMs = 15 * 60 * 1000): boolean {
    const entry = this.memoryCache.get(songId);
    if (!entry) return true;
    return Date.now() + thresholdMs >= entry.expiresAt;
  }

  public invalidate(songId: string) {
    if (!songId) return;
    this.memoryCache.delete(songId);
    this.persistToStorage();
  }

  public clear() {
    this.memoryCache.clear();
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(this.STORAGE_KEY); } catch {}
    }
  }
}
