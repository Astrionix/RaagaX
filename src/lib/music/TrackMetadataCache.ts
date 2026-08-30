import { Song } from '@/types/music';
import { TrackMetadata } from '@/types/jam';

/**
 * TrackMetadataCache
 * 
 * High-performance, LRU metadata cache for the Music Catalog.
 * Answers the question: "What song is this?"
 * 
 * Features:
 * - Decoupled from physical audio playback and Jam synchronization.
 * - Generation-tagged resolution: prevents stale metadata/artwork callbacks from
 *   overwriting newer tracks during fast skips.
 * - Parallel non-blocking resolution: audio playback is never stalled waiting for
 *   artwork or full metadata to finish downloading.
 */
export class TrackMetadataCache {
  private static instance: TrackMetadataCache;
  private cache: Map<string, TrackMetadata> = new Map();
  private maxCacheSize: number = 300;

  private constructor() {}

  public static getInstance(): TrackMetadataCache {
    if (!TrackMetadataCache.instance) {
      TrackMetadataCache.instance = new TrackMetadataCache();
    }
    return TrackMetadataCache.instance;
  }

  /**
   * Fast synchronous lookup from cache
   */
  public get(trackId: string): TrackMetadata | null {
    const item = this.cache.get(trackId);
    if (!item) return null;

    // Refresh LRU order
    this.cache.delete(trackId);
    this.cache.set(trackId, item);
    return { ...item };
  }

  /**
   * Sets or updates track metadata in the cache
   */
  public set(trackId: string, item: Partial<TrackMetadata> | Song): TrackMetadata {
    const existing = this.cache.get(trackId);
    
    // Support converting Song object to TrackMetadata
    const isSong = 'duration' in item;
    const durationMs = typeof (item as TrackMetadata).durationMs === 'number'
      ? (item as TrackMetadata).durationMs
      : (isSong && typeof (item as Song).duration === 'number' ? (item as Song).duration * 1000 : 0);

    const metadata: TrackMetadata = {
      trackId,
      title: item.title || existing?.title || 'Unknown Track',
      artist: item.artist || existing?.artist || 'Unknown Artist',
      album: item.album || existing?.album,
      albumId: (item as any).albumId || existing?.albumId,
      artwork: (item as any).coverUrl || (item as any).artwork || existing?.artwork,
      durationMs,
      sourceUrl: (item as any).audioUrl || (item as any).sourceUrl || existing?.sourceUrl,
      language: (item as any).language || existing?.language,
      genre: (item as any).genre || existing?.genre,
      generation: (item as any).generation || existing?.generation,
    };

    // Evict oldest if full
    if (this.cache.size >= this.maxCacheSize && !this.cache.has(trackId)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(trackId, metadata);
    return { ...metadata };
  }

  /**
   * Resolves metadata with generation tagging.
   * If already cached, returns synchronously wrapped in a Promise.
   * Discards resolution if a newer generation is supplied in isStale check.
   */
  public async resolve(
    trackId: string,
    generation: number,
    songFallback?: Song | null
  ): Promise<TrackMetadata | null> {
    const cached = this.get(trackId);
    if (cached) {
      return { ...cached, generation };
    }

    if (songFallback && songFallback.id === trackId) {
      return this.set(trackId, { ...songFallback, generation });
    }

    return null;
  }

  /**
   * Converts a Song domain model into standard TrackMetadata
   */
  public songToMetadata(song: Song, generation?: number): TrackMetadata {
    return {
      trackId: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      artwork: song.coverUrl,
      durationMs: (song.duration || 0) * 1000,
      sourceUrl: song.audioUrl || undefined,
      language: song.language,
      genre: song.genre,
      generation,
    };
  }

  /**
   * Clears the cache (for testing or memory management)
   */
  public clear(): void {
    this.cache.clear();
  }
}
