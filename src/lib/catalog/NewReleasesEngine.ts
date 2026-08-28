import { Song } from '@/types/music';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { SongFormatter } from '@/lib/music/SongFormatter';

export interface CatalogSongRecord {
  id: string;
  sourceSongId?: string;
  isrc?: string;
  canonicalKey: string;
  song: Song;
  language: string;
  language_code: string;
  release_date?: string;
  release_date_source?: 'song' | 'album';
  added_at: string; // ISO 8601 String (Immutable)
  updated_at: string;
  is_new_release: boolean;
}

export interface IngestionRunReport {
  language: string;
  target: number;
  releasePagesScanned: number;
  albumsDiscovered: number;
  albumsFetched: number;
  tracksDiscovered: number;
  languageValid: number;
  releaseDateValid: number;
  duplicatesRemoved: number;
  invalid: number;
  newSongsInserted: number;
  finalUniqueSongs: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  durationMs: number;
}

export const LANGUAGE_CODE_MAP: Record<string, { language: string; language_code: string }> = {
  telugu: { language: 'Telugu', language_code: 'te' },
  te: { language: 'Telugu', language_code: 'te' },

  hindi: { language: 'Hindi', language_code: 'hi' },
  hi: { language: 'Hindi', language_code: 'hi' },

  tamil: { language: 'Tamil', language_code: 'ta' },
  ta: { language: 'Tamil', language_code: 'ta' },

  kannada: { language: 'Kannada', language_code: 'kn' },
  kn: { language: 'Kannada', language_code: 'kn' },

  malayalam: { language: 'Malayalam', language_code: 'ml' },
  ml: { language: 'Malayalam', language_code: 'ml' },

  punjabi: { language: 'Punjabi', language_code: 'pa' },
  pa: { language: 'Punjabi', language_code: 'pa' },

  bengali: { language: 'Bengali', language_code: 'bn' },
  bn: { language: 'Bengali', language_code: 'bn' },

  marathi: { language: 'Marathi', language_code: 'mr' },
  mr: { language: 'Marathi', language_code: 'mr' },

  gujarati: { language: 'Gujarati', language_code: 'gu' },
  gu: { language: 'Gujarati', language_code: 'gu' },

  bhojpuri: { language: 'Bhojpuri', language_code: 'bho' },
  bho: { language: 'Bhojpuri', language_code: 'bho' },

  haryanvi: { language: 'Haryanvi', language_code: 'har' },
  har: { language: 'Haryanvi', language_code: 'har' },

  odia: { language: 'Odia', language_code: 'or' },
  or: { language: 'Odia', language_code: 'or' },

  urdu: { language: 'Urdu', language_code: 'ur' },
  ur: { language: 'Urdu', language_code: 'ur' },

  rajasthani: { language: 'Rajasthani', language_code: 'raj' },
  raj: { language: 'Rajasthani', language_code: 'raj' },

  assamese: { language: 'Assamese', language_code: 'as' },
  as: { language: 'Assamese', language_code: 'as' },

  english: { language: 'English', language_code: 'en' },
  en: { language: 'English', language_code: 'en' },
};

export const SUPPORTED_LANGUAGES_LIST = [
  { label: 'All', code: 'all' },
  { label: 'Hindi', code: 'hi' },
  { label: 'Telugu', code: 'te' },
  { label: 'Tamil', code: 'ta' },
  { label: 'Punjabi', code: 'pa' },
  { label: 'Kannada', code: 'kn' },
  { label: 'Malayalam', code: 'ml' },
  { label: 'Bengali', code: 'bn' },
  { label: 'Marathi', code: 'mr' },
  { label: 'Gujarati', code: 'gu' },
  { label: 'Bhojpuri', code: 'bho' },
  { label: 'English', code: 'en' },
];

const STORAGE_KEY = 'raagax_advanced_catalog_v5';
// Client-side persistent new-releases cache key (v3 adds fetchedAt TTL).
// Intentionally bumped from v2 so stale entries without fetchedAt are ignored.
const NEW_RELEASES_CACHE_VERSION = 'v3';
const CLIENT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — matches server ISR TTL
const TARGET_MINIMUM_SONGS = 50;
const CURRENT_SYSTEM_YEAR = 2026;
const NEW_RELEASE_LOOKBACK_DAYS = 90; // Freshness window: up to 90 days lookback
const MAX_PAGES = 5;
const CONCURRENCY_LIMIT = 4;
const COMPILATION_REGEX = /top\s*\d+|superhits|best\s*of|greatest\s*hits|valentines?\s*day|dance\s*dhamaka|party\s*mix|mashup|evergreen|remix\s*collection|anniversary\s*special|world\s*music\s*day|hits\s*\d{4}/i;

export interface MusicSourceAdapter {
  discoverNewReleaseAlbums(language: string, page?: number): Promise<any[]>;
  getAlbumDetails(albumId: string): Promise<{ id: string; title: string; coverUrl: string; songs: Song[] } | null>;
  searchNewSongs(query: string, page?: number): Promise<Song[]>;
}

export class DefaultJioSaavnSourceAdapter implements MusicSourceAdapter {
  private musicEngine = RealMusicEngine.getInstance();

  async discoverNewReleaseAlbums(language: string, page = 1): Promise<any[]> {
    try {
      const { getApiBaseUrl } = await import('@/lib/config/apiConfig');
      const localBase = `${getApiBaseUrl().replace(/\/+$/, '')}/api`;
      
      const res = await fetch(
        `${localBase}/browse/new-releases?language=${encodeURIComponent(language.toLowerCase())}&page=${page}&limit=30`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          return json.data.map((item: any) => {
            const rawTitle = item.title ? SongFormatter.decodeHtml(item.title) : 'Untitled';
            return {
              id: item.id,
              title: SongFormatter.cleanAlbumTitle(rawTitle) || rawTitle,
              coverUrl: item.image ? item.image.replace('150x150', '500x500') : '/app-icon.png',
              language: item.language,
              type: item.type || 'album',
              rawItem: item,
              releaseDate: item.more_info?.release_date || (item.year ? `${item.year}-01-01` : undefined),
              releaseYear: item.more_info?.release_date ? parseInt(item.more_info.release_date.slice(0, 4)) : (item.year ? parseInt(item.year) : 2026),
            };
          });
        }
      }
    } catch (err) {
      console.warn('[DefaultJioSaavnSourceAdapter] Failed to fetch new releases:', err);
    }
    return [];
  }

  async getAlbumDetails(albumId: string): Promise<{ id: string; title: string; coverUrl: string; songs: Song[] } | null> {
    return this.musicEngine.getPlaylistDetails(`album:${albumId}`);
  }

  async searchNewSongs(query: string, page = 1): Promise<Song[]> {
    // Return empty to avoid generic keyword search injecting compilation albums
    return [];
  }
}

export class NewReleasesEngine {
  private static instance: NewReleasesEngine;
  private static languageCache = new Map<string, { songs: Song[]; fetchedAt: number }>();
  private static inFlightRequests = new Map<string, Promise<Song[]>>();

  private memoryRegistry = new Map<string, CatalogSongRecord>();
  private albumCache = new Map<string, { fetchedAt: number; data: any }>();
  private initialized = false;
  private sourceAdapter: MusicSourceAdapter = new DefaultJioSaavnSourceAdapter();

  public static getInstance(): NewReleasesEngine {
    if (!NewReleasesEngine.instance) {
      NewReleasesEngine.instance = new NewReleasesEngine();
    }
    return NewReleasesEngine.instance;
  }

  /**
   * Synchronously get cached new releases for a language (0ms instant render).
   */
  public getCachedSongs(language: string = 'Telugu'): Song[] | null {
    const cleanLang = (language || 'Telugu').trim().toLowerCase();

    // 1. Check in-memory cache (30-min TTL)
    const mem = NewReleasesEngine.languageCache.get(cleanLang);
    if (mem && Array.isArray(mem.songs) && mem.songs.length > 0) {
      // Even if stale, return existing songs so UI renders immediately;
      // fetchNewReleases() will revalidate in the background.
      return mem.songs;
    }

    // 2. Check persistent localStorage cache (v3 format with fetchedAt)
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`raagax_new_releases_${NEW_RELEASES_CACHE_VERSION}_${cleanLang}`);
        if (raw) {
          const parsed = JSON.parse(raw) as { songs: Song[]; fetchedAt: number };
          if (parsed && Array.isArray(parsed.songs) && parsed.songs.length > 0) {
            // Populate memory cache with persisted data regardless of age
            // (age determines whether background revalidation fires, not whether we show data)
            NewReleasesEngine.languageCache.set(cleanLang, {
              songs: parsed.songs,
              fetchedAt: parsed.fetchedAt ?? 0,
            });
            return parsed.songs;
          }
        }
      } catch {}
    }

    return null;
  }

  /**
   * Authoritative Unified Fetcher:
   * - Request deduplication (single in-flight promise per language)
   * - Deterministic normalization and sorting
   * - Persistent and memory caching
   */
  public async fetchNewReleases(language: string = 'Telugu', limit = 50, forceRefresh = false): Promise<Song[]> {
    const cleanLang = (language || 'Telugu').trim().toLowerCase();

    // If cache is fresh (< 30 mins) and not forceRefresh, return immediately
    if (!forceRefresh) {
      const mem = NewReleasesEngine.languageCache.get(cleanLang);
      if (mem && Date.now() - mem.fetchedAt < CLIENT_CACHE_TTL_MS && mem.songs.length > 0) {
        return mem.songs;
      }
    }

    // Request deduplication
    if (NewReleasesEngine.inFlightRequests.has(cleanLang)) {
      return NewReleasesEngine.inFlightRequests.get(cleanLang)!;
    }

    const fetchPromise = (async () => {
      try {
        let songs: Song[] = [];

        // Tier 1: Try server API route
        try {
          const { getApiUrl } = await import('@/lib/config/apiConfig');
          const apiUrl = getApiUrl(`/api/home/new-releases?lang=${encodeURIComponent(language)}&limit=${limit}`);
          const res = await fetch(apiUrl, { signal: AbortSignal.timeout(6000) });
          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
              songs = json.data.map((s: any) => ({
                id: s.id,
                title: SongFormatter.cleanSongTitle(s.title || s.name),
                artist: s.artist || s.artists?.primary?.[0]?.name || 'Various Artists',
                artistId: s.artistId || s.artists?.primary?.[0]?.id || 'unknown',
                album: SongFormatter.cleanAlbumTitle(s.album || s.title),
                albumId: s.albumId || 'unknown',
                duration: Number(s.duration) || 210,
                coverUrl: s.coverUrl || s.image?.find?.((i: any) => i.quality === '500x500')?.url || s.image?.[s.image?.length - 1]?.url || '/app-icon.png',
                audioUrl: s.audioUrl || s.downloadUrl?.find?.((d: any) => d.quality === '320kbps')?.url || s.downloadUrl?.[s.downloadUrl?.length - 1]?.url || '',
                genre: s.genre || `${language} Hits`,
                category: 'global_trending' as const,
                releaseYear: Number(s.releaseYear || s.year) || 2026,
                releaseDate: s.releaseDate,
                plays: Number(s.plays || s.playCount) || 0,
                likes: Number(s.likes) || 0,
              }));
            }
          }
        } catch {}

        // Tier 2: Internal catalog ingestion loop if API is unavailable (static export / offline)
        if (songs.length === 0) {
          songs = await this.getNewReleasesForLanguage(language, limit);
        }

        if (songs.length > 0) {
          // Canonical deduplication
          const seenKeys = new Set<string>();
          const unique = songs.filter((s) => {
            const key = NewReleasesEngine.generateCanonicalKey(s.title, s.artist, s.album);
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          });

          // Strict deterministic date sorting + stable ID tie-breaker
          const sorted = unique.sort((a, b) => {
            const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
            const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
            if (dateB !== dateA) return dateB - dateA;
            return a.id.localeCompare(b.id);
          });

          const finalResult = sorted.slice(0, limit);

          // Update memory cache
          NewReleasesEngine.languageCache.set(cleanLang, {
            songs: finalResult,
            fetchedAt: Date.now(),
          });

          // Update persistent cache (v3 format: { songs, fetchedAt })
          if (typeof window !== 'undefined') {
            try {
              const payload = { songs: finalResult, fetchedAt: Date.now() };
              localStorage.setItem(
                `raagax_new_releases_${NEW_RELEASES_CACHE_VERSION}_${cleanLang}`,
                JSON.stringify(payload)
              );
            } catch {}
          }

          return finalResult;
        }

        // Return cached songs if network failed
        const cachedFallback = this.getCachedSongs(language);
        return cachedFallback || [];
      } finally {
        NewReleasesEngine.inFlightRequests.delete(cleanLang);
      }
    })();

    NewReleasesEngine.inFlightRequests.set(cleanLang, fetchPromise);
    return fetchPromise;
  }

  public setSourceAdapter(adapter: MusicSourceAdapter): void {
    this.sourceAdapter = adapter;
  }

  /**
   * Strictly validate and normalize a language identifier to verified metadata.
   */
  public static normalizeLanguage(raw: string | undefined): { language: string; language_code: string } | null {
    if (!raw) return null;
    const clean = raw.trim().toLowerCase();
    return LANGUAGE_CODE_MAP[clean] || null;
  }

  /**
   * Strong Canonical Identity Normalization
   * Normalizes titles and removes version tags like (From "Movie"), (Remix), [Official Video]
   */
  public static generateCanonicalKey(title: string, artist: string, album?: string): string {
    const cleanText = (str: string) => {
      return (str || '')
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '') // remove parentheticals like (From "Movie"), (Remix)
        .replace(/[-–—_]/g, ' ')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normTitle = cleanText(title);
    const firstArtist = (artist || '').split(/[,&/]/)[0];
    const normArtist = cleanText(firstArtist);

    return `${normTitle}:::${normArtist}`;
  }

  /**
   * RELEASE DATE FRESHNESS VALIDATOR
   * CRITICAL RULE:
   * Uses `release_date` / `releaseYear` to determine whether something qualifies as a New Release.
   * Compilations, old catalog songs (2025, 2024, 2023) -> REJECTED.
   * Genuine recent releases (2026) qualify.
   */
  public static isEligibleNewRelease(song: Song): boolean {
    if (!song || !song.title) return false;

    // 1. Filter junk/test titles and sample trailers
    const titleLower = song.title.toLowerCase();
    if (/testing|sample trailer|test track|test audio|dummy|sound check|preview only|trailer - testing/i.test(titleLower)) {
      return false;
    }

    // 2. Filter compilation albums and re-packages
    if (COMPILATION_REGEX.test(`${song.title} ${song.album || ''}`)) {
      return false;
    }

    // 3. Filter abnormal duration (genuine songs: 30s to 15 mins)
    const dur = Number(song.duration) || 0;
    if (dur > 900 || (dur > 0 && dur < 30)) {
      return false;
    }

    // 4. Hard reject old catalog years (e.g. 2025, 2024, 2023, 2020)
    const year = Number(song.releaseYear) || 0;
    if (year > 0 && year < 2026) {
      return false;
    }

    // 5. Check exact releaseDate if available
    if (song.releaseDate) {
      const releaseTime = new Date(song.releaseDate).getTime();
      if (!isNaN(releaseTime)) {
        const now = Date.now();
        const diffDays = (now - releaseTime) / (1000 * 60 * 60 * 24);

        // Reject future dates > 30 days ahead
        if (diffDays < -30) return false;
        // Reject releases older than freshness lookback window
        if (diffDays > NEW_RELEASE_LOOKBACK_DAYS) return false;

        return true;
      }
    }

    // Recent release year 2026 qualifies
    if (year >= 2026) {
      return true;
    }

    return false;
  }

  private loadPersistedRegistry(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((rec: CatalogSongRecord) => {
              if (rec && rec.id && rec.added_at && rec.song) {
                // Purge junk records on load
                if (NewReleasesEngine.isEligibleNewRelease(rec.song)) {
                  this.memoryRegistry.set(rec.id, rec);
                  if (rec.canonicalKey) {
                    this.memoryRegistry.set(rec.canonicalKey, rec);
                  }
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn('[NewReleasesEngine] Failed to load catalog storage:', err);
      }
    }
  }

  private persistRegistry(): void {
    if (typeof window === 'undefined') return;
    try {
      const uniqueRecords: CatalogSongRecord[] = [];
      const seenIds = new Set<string>();

      for (const rec of this.memoryRegistry.values()) {
        if (!seenIds.has(rec.id)) {
          seenIds.add(rec.id);
          uniqueRecords.push(rec);
        }
      }

      const trimmed = uniqueRecords
        .sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime())
        .slice(0, 1500);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (err) {
      console.warn('[NewReleasesEngine] Failed to save catalog storage:', err);
    }
  }

  /**
   * Ingest a song entity into the catalog.
   * `added_at` is IMMUTABLE after first discovery.
   */
  public ingestSong(song: Song, forcedLanguage?: string): Song {
    this.loadPersistedRegistry();

    const langInfo =
      NewReleasesEngine.normalizeLanguage(forcedLanguage) ||
      NewReleasesEngine.normalizeLanguage(song.language) ||
      NewReleasesEngine.normalizeLanguage(song.genre?.split(' ')?.[0]);

    const language = langInfo?.language || 'Telugu';
    const language_code = langInfo?.language_code || 'te';
    const is_new_release = NewReleasesEngine.isEligibleNewRelease(song);

    const canonicalKey = NewReleasesEngine.generateCanonicalKey(song.title, song.artist, song.album);
    const existingById = this.memoryRegistry.get(song.id);
    const existingByKey = this.memoryRegistry.get(canonicalKey);
    const existing = existingById || existingByKey;

    if (existing) {
      // PRESERVE original immutable added_at
      const updatedSong: Song = {
        ...song,
        language,
        language_code,
        languageCode: language_code,
        added_at: existing.added_at,
        addedAt: existing.added_at,
      };

      existing.song = updatedSong;
      existing.is_new_release = is_new_release;
      existing.updated_at = new Date().toISOString();
      this.memoryRegistry.set(song.id, existing);
      this.memoryRegistry.set(canonicalKey, existing);
      return updatedSong;
    }

    // New discovery timestamp
    const added_at = song.added_at || new Date().toISOString();

    const stampedSong: Song = {
      ...song,
      language,
      language_code,
      languageCode: language_code,
      added_at,
      addedAt: added_at,
    };

    const newRecord: CatalogSongRecord = {
      id: song.id,
      sourceSongId: song.id,
      canonicalKey,
      song: stampedSong,
      language,
      language_code,
      release_date: song.releaseDate,
      added_at,
      updated_at: added_at,
      is_new_release,
    };

    this.memoryRegistry.set(song.id, newRecord);
    this.memoryRegistry.set(canonicalKey, newRecord);
    this.persistRegistry();

    return stampedSong;
  }

  public ingestBatch(songs: Song[], language?: string): Song[] {
    return songs.map((s, idx) => {
      let songToIngest = s;
      if (!s.added_at) {
        const timestampOffset = idx * 30000;
        const staggered = new Date(Date.now() - timestampOffset).toISOString();
        songToIngest = { ...s, added_at: staggered, addedAt: staggered };
      }
      return this.ingestSong(songToIngest, language);
    });
  }

  private async runConcurrent<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];
    const queue = [...items];
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item !== undefined) {
          try {
            const res = await fn(item);
            results.push(res);
          } catch (e) {}
        }
      }
    });
    await Promise.all(workers);
    return results;
  }

  private async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T | null> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === maxRetries) return null;
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
    return null;
  }

  /**
   * ROBUST ADVANCED MULTILINGUAL NEW RELEASES DISCOVERY
   * Step 1: Discover candidates across albums + singles.
   * Step 2: STRICT Language Filter (ZERO cross-language pollution).
   * Step 3: ACTUAL Release Date Freshness Check (Filters out 2014, 2023, 2024).
   * Step 4: Canonical Identity Deduplication.
   * Step 5: ORDER BY `added_at DESC`.
   */
  public async getNewReleasesForLanguage(
    selectedLanguage: string = 'Telugu',
    targetLimit = TARGET_MINIMUM_SONGS
  ): Promise<Song[]> {
    const startTime = Date.now();
    this.loadPersistedRegistry();

    const isAll = selectedLanguage.toLowerCase() === 'all';
    const targetNorm = NewReleasesEngine.normalizeLanguage(selectedLanguage);
    const targetCode = isAll ? 'all' : (targetNorm?.language_code || 'te');
    const targetLangName = isAll ? 'All' : (targetNorm?.language || 'Telugu');

    const report: IngestionRunReport = {
      language: targetLangName,
      target: targetLimit,
      releasePagesScanned: 0,
      albumsDiscovered: 0,
      albumsFetched: 0,
      tracksDiscovered: 0,
      languageValid: 0,
      releaseDateValid: 0,
      duplicatesRemoved: 0,
      invalid: 0,
      newSongsInserted: 0,
      finalUniqueSongs: 0,
      status: 'SUCCESS',
      durationMs: 0,
    };

    if (isAll) {
      const supported = ['Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam', 'Punjabi', 'Bengali', 'Marathi', 'Gujarati', 'Bhojpuri', 'English'];
      const langPromises = supported.map((l) => this.getNewReleasesForLanguage(l, 10));
      const res = await Promise.allSettled(langPromises);

      const allMerged: Song[] = [];
      res.forEach((r) => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          allMerged.push(...r.value);
        }
      });

      const seenKeys = new Set<string>();
      const unique = allMerged.filter((s) => {
        const key = NewReleasesEngine.generateCanonicalKey(s.title, s.artist, s.album);
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });

      return unique
        .sort((a, b) => {
          const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
          const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
          if (dateB !== dateA) return dateB - dateA;
          return new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime();
        })
        .slice(0, targetLimit);
    }

    // ── STAGE 1 & 2: MULTI-PAGE ALBUM & SINGLE DISCOVERY LOOP ──────────
    const collectedSongs: Song[] = [];
    const seenAlbumIds = new Set<string>();
    const seenSongKeys = new Set<string>();

    // 1. Check existing stored valid new releases in memory registry
    for (const rec of this.memoryRegistry.values()) {
      if (rec.language_code === targetCode && rec.is_new_release) {
        if (!seenSongKeys.has(rec.canonicalKey)) {
          seenSongKeys.add(rec.canonicalKey);
          collectedSongs.push(rec.song);
        }
      }
    }

    let currentPage = 1;

    while (collectedSongs.length < targetLimit && currentPage <= MAX_PAGES) {
      report.releasePagesScanned += 1;

      // Fetch official verified new releases from JioSaavn
      const newItems = await this.retryWithBackoff(() => this.sourceAdapter.discoverNewReleaseAlbums(targetLangName, currentPage));

      if (!newItems || !Array.isArray(newItems) || newItems.length === 0) {
        break;
      }

      // 1. Process Single Releases directly
      const singleItems = newItems.filter((item) => item.type === 'song' && item.rawItem);
      const rawSingles: Song[] = singleItems.map((a) => {
        const it = a.rawItem;
        const pa = it.more_info?.artistMap?.primary_artists || [];
        const artist = pa.length > 0
          ? pa.map((art: any) => SongFormatter.decodeHtml(art.name)).join(', ')
          : SongFormatter.decodeHtml(it.subtitle || it.more_info?.singers || 'Various Artists');
        const rawTitle = it.title ? SongFormatter.decodeHtml(it.title) : 'Untitled';
        const rawAlbum = it.more_info?.album ? SongFormatter.decodeHtml(it.more_info.album) : rawTitle;
        const title = SongFormatter.cleanSongTitle(rawTitle);
        const album = SongFormatter.cleanAlbumTitle(rawAlbum, rawTitle) || title;
        const releaseDate = it.more_info?.release_date || a.releaseDate;
        const releaseYear = a.releaseYear || (releaseDate ? parseInt(releaseDate.slice(0, 4)) : 2026);
        const coverUrl = it.image ? it.image.replace('150x150', '500x500') : (a.coverUrl || '/app-icon.png');

        return {
          id: it.id,
          title,
          artist,
          artistId: pa[0]?.id || `art-${it.id}`,
          album,
          albumId: it.more_info?.album_id || `alb-${it.id}`,
          duration: parseInt(it.more_info?.duration) || 210,
          coverUrl,
          audioUrl: '',
          genre: `${targetLangName.toUpperCase()} HITS`,
          language: targetLangName,
          language_code: targetCode,
          category: 'latest_telugu' as const,
          releaseYear,
          releaseDate,
          plays: parseInt(it.play_count) || 100000,
          likes: 15000,
          downloads: 5000,
          audioQuality: '24-bit FLAC' as const,
          bitrate: '320 kbps',
          sampleRate: '48 kHz',
          codec: 'AAC HQ Stream',
          lyrics: [],
          credits: { composer: artist, lyricist: 'RaagaX Catalog', singers: [artist], label: it.more_info?.label || 'Aditya Music / Sony' }
        } as Song;
      });

      if (rawSingles.length > 0) {
        report.tracksDiscovered += rawSingles.length;
        const validSingles = rawSingles.filter((s) => {
          const norm = NewReleasesEngine.normalizeLanguage(s.language || targetLangName);
          return norm?.language_code === targetCode && NewReleasesEngine.isEligibleNewRelease(s);
        });

        this.ingestBatch(validSingles, targetLangName).forEach((s) => {
          const key = NewReleasesEngine.generateCanonicalKey(s.title, s.artist, s.album);
          if (!seenSongKeys.has(key)) {
            seenSongKeys.add(key);
            collectedSongs.push(s);
            report.newSongsInserted += 1;
          } else {
            report.duplicatesRemoved += 1;
          }
        });
      }

      // 2. Process Album Releases (Fetch tracks with inherited album release date)
      const albumItems = newItems.filter((a) => (a.type === 'album' || !a.type) && a.id && !seenAlbumIds.has(a.id));
      albumItems.forEach((a) => seenAlbumIds.add(a.id));
      report.albumsDiscovered += albumItems.length;

      const albumResults = await this.runConcurrent(albumItems.slice(0, 10), CONCURRENCY_LIMIT, async (alb) => {
        const cached = this.albumCache.get(alb.id);
        if (cached && Date.now() - cached.fetchedAt < 3600000) {
          return cached.data;
        }

        const details = await this.retryWithBackoff(() => this.sourceAdapter.getAlbumDetails(alb.id));
        if (details) {
          this.albumCache.set(alb.id, { fetchedAt: Date.now(), data: details });
        }
        return details;
      });

      report.albumsFetched += albumResults.filter(Boolean).length;

      for (const details of albumResults) {
        if (details && Array.isArray(details.songs)) {
          report.tracksDiscovered += details.songs.length;

          // Strict Language & Freshness Filter
          const validTracks = details.songs.filter((s) => {
            const norm = NewReleasesEngine.normalizeLanguage(s.language || targetLangName);
            return norm?.language_code === targetCode && NewReleasesEngine.isEligibleNewRelease(s);
          });

          this.ingestBatch(validTracks, targetLangName).forEach((s) => {
            const key = NewReleasesEngine.generateCanonicalKey(s.title, s.artist, s.album);
            if (!seenSongKeys.has(key)) {
              seenSongKeys.add(key);
              collectedSongs.push(s);
              report.newSongsInserted += 1;
            } else {
              report.duplicatesRemoved += 1;
            }
          });
        }
      }

      currentPage += 1;
    }

    // ── FINAL SORTING BY releaseDate DESC then added_at DESC ───────────
    const sorted = collectedSongs.sort((a, b) => {
      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      return new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime();
    });

    report.finalUniqueSongs = sorted.length;
    report.durationMs = Date.now() - startTime;
    this.persistRegistry();

    console.log(`[NewReleasesEngine] Ingestion Run Report for ${targetLangName}:`, report);

    return sorted.slice(0, targetLimit);
  }

  public async getUnifiedNewReleases(limit = TARGET_MINIMUM_SONGS): Promise<Song[]> {
    return this.getNewReleasesForLanguage('all', limit);
  }

  /**
   * Human-readable Release Date Badge
   * Formats actual release date (e.g. "Telugu • Released today", "Telugu • Released Aug 18", "Telugu • 2026")
   * NEVER displays false "Added today" for release information.
   */
  public static getReleaseDateBadge(song: Song): string {
    const lang = song.language || 'Music';
    const year = song.releaseYear || 2026;

    if (!song.releaseDate) {
      return `${lang} • ${year}`;
    }

    const releaseDate = new Date(song.releaseDate);
    const now = new Date();

    if (isNaN(releaseDate.getTime())) {
      return `${lang} • ${year}`;
    }

    const isToday =
      releaseDate.getDate() === now.getDate() &&
      releaseDate.getMonth() === now.getMonth() &&
      releaseDate.getFullYear() === now.getFullYear();

    if (isToday) {
      return `${lang} • Released today`;
    }

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      releaseDate.getDate() === yesterday.getDate() &&
      releaseDate.getMonth() === yesterday.getMonth() &&
      releaseDate.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `${lang} • Released yesterday`;
    }

    const diffDays = Math.floor((now.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 30) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthStr = monthNames[releaseDate.getMonth()];
      const dayStr = releaseDate.getDate();
      return `${lang} • Released ${monthStr} ${dayStr}`;
    }

    return `${lang} • ${year}`;
  }

  public static getAddedAtBadge(song: Song): string {
    return NewReleasesEngine.getReleaseDateBadge(song);
  }
}
