/**
 * ArtistImageResolver — Centralized Real Artist Image Resolution Engine
 *
 * Priority:
 * 1. Shared In-Memory & LocalStorage Cache (instant O(1))
 * 2. Existing valid artist image on object
 * 3. Music Provider Catalog & Seed Dictionary (JioSaavn / cached_artists.json)
 * 4. Server-Side Open Verification API (/api/artist/image-search)
 * 5. Default RaagaX Artist Placeholder
 */

import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { getApiUrl } from '@/lib/config/apiConfig';

export interface CachedArtistImage {
  artistId: string;
  artistName: string;
  imageUrl: string;
  source: 'provider' | 'trusted_metadata' | 'google' | 'fallback';
  resolvedAt: number;
  expiresAt: number;
}

export interface ResolveArtistOptions {
  id?: string;
  name: string;
  existingImageUrl?: string;
  language?: string;
}

const CACHE_KEY = 'raagax_artist_image_cache_v1';
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const DEFAULT_PLACEHOLDER = '/app-icon.png';

// Normalize artist name for exact, case-insensitive key lookup
export function normalizeArtistKey(name: string, id?: string): string {
  const cleanName = (name || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  if (cleanName && cleanName !== 'artist' && cleanName !== 'unknown') {
    return `name:${cleanName}`;
  }
  if (id && id.trim() && id !== 'unknown' && id !== 'artist') {
    const cleanId = id.toLowerCase().replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_');
    return `id:${cleanId}`;
  }
  return `name:${cleanName || 'unknown'}`;
}

export class ArtistImageResolver {
  private static instance: ArtistImageResolver;
  private memoryCache = new Map<string, CachedArtistImage>();
  private inflightRequests = new Map<string, Promise<string>>();
  private isLoaded = false;

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): ArtistImageResolver {
    if (!ArtistImageResolver.instance) {
      ArtistImageResolver.instance = new ArtistImageResolver();
    }
    return ArtistImageResolver.instance;
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed: Record<string, CachedArtistImage> = JSON.parse(raw);
        const now = Date.now();
        for (const [k, v] of Object.entries(parsed)) {
          if (v && v.expiresAt > now) {
            this.memoryCache.set(k, v);
          }
        }
      }
    } catch {}
    this.isLoaded = true;
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const obj: Record<string, CachedArtistImage> = {};
      const entries = Array.from(this.memoryCache.entries())
        .filter(([, v]) => v && v.expiresAt > Date.now())
        .slice(-100); // Keep only top 100 recent artists in storage
      for (const [k, v] of entries) {
        obj[k] = v;
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch {}
  }

  /**
   * Synchronous cached lookup for zero-latency initial UI render.
   */
  public getCachedImageUrl(name: string, id?: string): string | null {
    if (!name && !id) return null;
    const key = normalizeArtistKey(name || '', id);
    const cached = this.memoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.imageUrl;
    }

    // Fuzzy check popular artists synchronously
    const cleanQuery = (name || id || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (cleanQuery) {
      const popular = POPULAR_ARTISTS.find((a) => {
        const cleanA = a.name.toLowerCase().replace(/[^\w\s]/g, '').trim();
        return cleanA === cleanQuery || (id && (a.id === id || cleanA === id.toLowerCase().replace(/[^\w\s]/g, '').trim()));
      });
      if (popular && popular.image) return popular.image;
    }

    return null;
  }

  /**
   * Main asynchronous image resolver with multi-tier fallback.
   */
  public async resolveArtistImage(options: ResolveArtistOptions): Promise<string> {
    const { id, name, existingImageUrl, language } = options;
    if (!name && !id) return DEFAULT_PLACEHOLDER;

    const artistName = (name || '').trim();
    const key = normalizeArtistKey(artistName, id);

    // ── Tier 1: Check Memory / Local Cache ─────────────────────────────────────
    const cached = this.memoryCache.get(key);
    if (cached && cached.expiresAt > Date.now() && cached.imageUrl) {
      return cached.imageUrl;
    }

    // Deduplicate in-flight requests for the same artist
    if (this.inflightRequests.has(key)) {
      return this.inflightRequests.get(key)!;
    }

    const resolvePromise = (async () => {
      // ── Tier 2: Existing Valid Image Validation ──────────────────────────────
      if (existingImageUrl && this.isValidImageUrl(existingImageUrl)) {
        const cleanUrl = existingImageUrl.replace('http://', 'https://');
        this.cacheResult(key, id || '', artistName, cleanUrl, 'provider');
        return cleanUrl;
      }

      // ── Tier 3: Curated & Known Popular Artists Catalog (Fuzzy Matched) ───────
      const cleanQuery = (artistName || id || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
      const knownArtist = POPULAR_ARTISTS.find((a) => {
        const cleanKnown = a.name.toLowerCase().replace(/[^\w\s]/g, '').trim();
        return cleanKnown === cleanQuery || (id && (a.id === id || cleanKnown === id.toLowerCase().replace(/[^\w\s]/g, '').trim()));
      });
      if (knownArtist && knownArtist.image) {
        this.cacheResult(key, id || knownArtist.id, artistName, knownArtist.image, 'trusted_metadata');
        return knownArtist.image;
      }

      // ── Tier 4: Server-Side Verified Open API / Google Fallback ──────────────
      if (typeof window !== 'undefined' && navigator.onLine) {
        try {
          const params = new URLSearchParams();
          params.set('name', artistName);
          if (id) params.set('id', id);
          if (language) params.set('lang', language);

          const res = await fetch(getApiUrl(`/api/artist/image-search?${params.toString()}`), {
            signal: AbortSignal.timeout(4500),
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.success && data?.imageUrl && this.isValidImageUrl(data.imageUrl)) {
              this.cacheResult(key, id || '', artistName, data.imageUrl, data.source || 'trusted_metadata');
              return data.imageUrl;
            }
          }
        } catch (e) {
          // Network error or timeout — fallback gracefully
        }
      }

      // ── Tier 5: Default RaagaX Placeholder ──────────────────────────────────
      return DEFAULT_PLACEHOLDER;
    })();

    this.inflightRequests.set(key, resolvePromise);

    try {
      const result = await resolvePromise;
      return result;
    } finally {
      this.inflightRequests.delete(key);
    }
  }

  /**
   * Marks a failed image URL as broken, purging it from cache.
   */
  public markImageFailed(name: string, id?: string, failedUrl?: string): void {
    const key = normalizeArtistKey(name, id);
    const cached = this.memoryCache.get(key);
    if (cached && (!failedUrl || cached.imageUrl === failedUrl)) {
      this.memoryCache.delete(key);
      this.saveToStorage();
    }
  }

  private cacheResult(
    key: string,
    artistId: string,
    artistName: string,
    imageUrl: string,
    source: 'provider' | 'trusted_metadata' | 'google' | 'fallback'
  ): void {
    const entry: CachedArtistImage = {
      artistId,
      artistName,
      imageUrl,
      source,
      resolvedAt: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    this.memoryCache.set(key, entry);
    this.saveToStorage();
  }

  private isValidImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const clean = url.trim().toLowerCase();
    if (clean === '/app-icon.png' || clean.includes('/null/') || clean.length < 10) return false;
    return clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('/');
  }
}
