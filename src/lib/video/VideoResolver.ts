import { Song } from '@/types/music';

export interface ResolvedVideoInfo {
  available: boolean;
  videoId?: string;
  title?: string;
  thumbnail?: string;
  embedUrl?: string;
  /** Seconds the video intro plays before the song starts.
   *  video_position = audio_position + offsetSec
   *  audio_position = video_position - offsetSec */
  offsetSec: number;
  matchStatus?: 'verified' | 'auto' | 'unverified';
}

/**
 * VideoResolver — Verified-First Architecture
 *
 * Priority order for determining if a song has a video:
 *  1. song.matchedVideo (curator/pipeline-verified explicit mapping) → SHOW button
 *  2. song.sources.youtube.videoId (embedded in JioSaavn metadata)   → SHOW button (auto)
 *  3. Anything else                                                   → DO NOT show button
 *
 * We intentionally DO NOT do fuzzy YouTube title+artist search at playback time,
 * because that can match covers, remixes, lyric videos, live performances, etc.
 */
export class VideoResolver {
  private static instance: VideoResolver;
  private cache = new Map<string, ResolvedVideoInfo>();

  private constructor() {}

  public static getInstance(): VideoResolver {
    if (!VideoResolver.instance) {
      VideoResolver.instance = new VideoResolver();
    }
    return VideoResolver.instance;
  }

  private cacheKey(song: Song): string {
    return song.id || `${song.title}_${song.artist}`.toLowerCase().trim();
  }

  public getCached(song: Song): ResolvedVideoInfo | null {
    return this.cache.get(this.cacheKey(song)) ?? null;
  }

  /**
   * Resolves the verified video for a song.
   * Returns { available: false } if no verified mapping exists — caller must NOT show a video switch button.
   */
  public async resolve(song: Song): Promise<ResolvedVideoInfo> {
    if (!song) return { available: false, offsetSec: 0 };

    const key = this.cacheKey(song);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const result = this.resolveSync(song);
    this.cache.set(key, result);
    return result;
  }

  /**
   * Synchronous resolve — use when you need an immediate answer without async.
   */
  public resolveSync(song: Song): ResolvedVideoInfo {
    if (!song) return { available: false, offsetSec: 0 };

    // ── PRIORITY 1: Explicit curator/pipeline verified mapping ─────────────────
    if (song.matchedVideo?.videoId && song.matchedVideo.videoId.length === 11) {
      const mv = song.matchedVideo;
      const result: ResolvedVideoInfo = {
        available: true,
        videoId: mv.videoId,
        thumbnail: `https://i.ytimg.com/vi/${mv.videoId}/hqdefault.jpg`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${mv.videoId}`,
        offsetSec: mv.offsetSec ?? 0,
        matchStatus: mv.matchStatus,
      };
      return result;
    }

    // ── PRIORITY 2: JioSaavn embedded YouTube videoId (auto-matched by metadata) ──
    const embeddedVideoId = song.sources?.youtube?.videoId;
    if (embeddedVideoId && embeddedVideoId.length === 11) {
      const result: ResolvedVideoInfo = {
        available: true,
        videoId: embeddedVideoId,
        thumbnail: `https://i.ytimg.com/vi/${embeddedVideoId}/hqdefault.jpg`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${embeddedVideoId}`,
        offsetSec: 0,
        matchStatus: 'auto',
      };
      return result;
    }

    // ── No verified mapping — do not show video option ─────────────────────────
    return { available: false, offsetSec: 0 };
  }

  /** Pre-warm the cache for a song (call during queue preloading). */
  public preload(song: Song) {
    if (!song) return;
    const key = this.cacheKey(song);
    if (!this.cache.has(key)) {
      this.cache.set(key, this.resolveSync(song));
    }
  }

  /** Clear cache for a specific song (e.g. after matchedVideo is updated). */
  public invalidate(song: Song) {
    this.cache.delete(this.cacheKey(song));
  }
}
