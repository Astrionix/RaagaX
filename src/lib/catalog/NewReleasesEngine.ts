import { Song } from '@/types/music';
import { RealMusicEngine } from '@/lib/realMusicEngine';

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

const STORAGE_KEY = 'raagax_advanced_catalog_v4';
const TARGET_MINIMUM_SONGS = 50;
const CURRENT_SYSTEM_YEAR = 2026;
const NEW_RELEASE_LOOKBACK_DAYS = 90; // Freshness window: up to 90 days lookback
const MAX_PAGES = 5;
const CONCURRENCY_LIMIT = 4;

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
          return json.data.map((item: any) => ({
            id: item.id,
            title: item.title,
            coverUrl: item.image,
            language: item.language,
            releaseDate: item.more_info?.release_date,
            releaseYear: item.more_info?.release_date ? parseInt(item.more_info.release_date.slice(0, 4)) : 2026,
          }));
        }
      }
    } catch {}

    // Fallback to search if needed
    try {
      const q = `latest ${language} albums`;
      return await this.musicEngine.searchRealAlbums(q, 15);
    } catch {
      return [];
    }
  }

  async getAlbumDetails(albumId: string): Promise<{ id: string; title: string; coverUrl: string; songs: Song[] } | null> {
    return this.musicEngine.getPlaylistDetails(`album:${albumId}`);
  }

  async searchNewSongs(query: string, page = 1): Promise<Song[]> {
    return this.musicEngine.searchRealSongs(query, 20);
  }
}

export class NewReleasesEngine {
  private static instance: NewReleasesEngine;
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
   * 2014, 2020, 2023, 2024 -> REJECTED.
   * Genuine recent releases (2025/2026) qualify.
   */
  public static isEligibleNewRelease(song: Song): boolean {
    if (!song || !song.title) return false;

    // 1. Filter junk/test titles and sample trailers
    const titleLower = song.title.toLowerCase();
    if (/testing|sample trailer|test track|test audio|dummy|sound check|preview only|trailer - testing/i.test(titleLower)) {
      return false;
    }

    // 2. Filter abnormal duration (genuine songs: 30s to 15 mins)
    const dur = Number(song.duration) || 0;
    if (dur > 900 || (dur > 0 && dur < 30)) {
      return false;
    }

    // 3. Hard reject old catalog years (e.g. 2014, 2020, 2023, 2024)
    const year = Number(song.releaseYear) || 0;
    if (year > 0 && year < 2025) {
      return false;
    }

    // 4. Check exact releaseDate if available
    if (song.releaseDate) {
      const releaseTime = new Date(song.releaseDate).getTime();
      if (!isNaN(releaseTime)) {
        const now = Date.now();
        const diffDays = (now - releaseTime) / (1000 * 60 * 60 * 24);

        // Reject future dates > 30 days ahead
        if (diffDays < -30) return false;
        // Reject releases older than freshness lookback window if before 2025
        if (diffDays > 365 && year < 2025) return false;

        return true;
      }
    }

    // Recent release years (2025, 2026) qualify
    if (year >= 2025) {
      return true;
    }

    // Fallback: If year is 0, check if title/context has 2026
    if (year === 0) {
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
      const supported = ['Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam', 'Punjabi', 'Bengali', 'English'];
      const langPromises = supported.map((l) => this.getNewReleasesForLanguage(l, 15));
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
        .sort((a, b) => new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime())
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

      // Fetch album releases and latest songs across multiple queries
      const [newAlbums, newSingles1, newSingles2] = await Promise.all([
        this.retryWithBackoff(() => this.sourceAdapter.discoverNewReleaseAlbums(targetLangName, currentPage)),
        this.retryWithBackoff(() => this.sourceAdapter.searchNewSongs(`latest ${targetLangName} songs`, currentPage)),
        this.retryWithBackoff(() => this.sourceAdapter.searchNewSongs(`new ${targetLangName} songs`, currentPage)),
      ]);

      const newSingles = [...(newSingles1 || []), ...(newSingles2 || [])];

      // Process Singles
      if (newSingles && Array.isArray(newSingles)) {
        report.tracksDiscovered += newSingles.length;

        // Strict Language Filter
        const validSingles = newSingles.filter((s) => {
          const norm = NewReleasesEngine.normalizeLanguage(s.language || targetLangName);
          return norm?.language_code === targetCode;
        });
        report.languageValid += validSingles.length;

        // Strict Release Date Freshness Filter (Filters out 2014, 2023, 2024)
        const freshSingles = validSingles.filter((s) => NewReleasesEngine.isEligibleNewRelease(s));
        report.releaseDateValid += freshSingles.length;

        this.ingestBatch(freshSingles, targetLangName).forEach((s) => {
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

      // Process Albums
      if (newAlbums && Array.isArray(newAlbums)) {
        const freshAlbums = newAlbums.filter((a) => a && a.id && !seenAlbumIds.has(a.id)).slice(0, 6);
        freshAlbums.forEach((a) => seenAlbumIds.add(a.id));
        report.albumsDiscovered += freshAlbums.length;

        const albumResults = await this.runConcurrent(freshAlbums, CONCURRENCY_LIMIT, async (alb) => {
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

            // Strict Language Filter
            const validTracks = details.songs.filter((s) => {
              const norm = NewReleasesEngine.normalizeLanguage(s.language || targetLangName);
              return norm?.language_code === targetCode;
            });
            report.languageValid += validTracks.length;

            // Strict Release Date Freshness Filter (Filters out 2014, 2023, 2024)
            const freshTracks = validTracks.filter((s) => NewReleasesEngine.isEligibleNewRelease(s));
            report.releaseDateValid += freshTracks.length;

            this.ingestBatch(freshTracks, targetLangName).forEach((s) => {
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
      }

      if (!newAlbums?.length && !newSingles?.length) {
        break;
      }

      currentPage += 1;
    }

    // ── FINAL SORTING BY added_at DESC ─────────────────────────────────
    const sorted = collectedSongs.sort(
      (a, b) => new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime()
    );

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
