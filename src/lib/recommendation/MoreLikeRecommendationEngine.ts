'use client';

import { Song } from '@/types/music';
import { RecommendationResult, FeedbackSignal, RecommendationContext } from '@/types/recommendation';
import { PersonalizationEngine } from '@/lib/recommendation/PersonalizationEngine';
import { SongUniquenessEngine } from '@/lib/music/SongUniquenessEngine';
import { RecommendationAnalytics } from '@/lib/recommendations/RecommendationAnalytics';

/**
 * MoreLikeRecommendationEngine
 *
 * A reusable, pure-logic engine that wraps PersonalizationEngine to generate
 * typed RecommendationResult[] for the "More Like What You Heard" shelf (and
 * similar recommendation surfaces like artist pages, album pages, and playlist
 * pages via the `context` parameter).
 *
 * Architecture note:
 * - This class is intentionally UI-free. It can be unit-tested independently.
 * - UI components call `getRecommendations()` and `recordFeedback()`.
 * - All heavy personalization logic lives in PersonalizationEngine.
 */
export class MoreLikeRecommendationEngine {
  private static instance: MoreLikeRecommendationEngine;

  // Session-level "not interested" set for immediate UI filtering without
  // waiting for PersonalizationEngine to reload its persisted set.
  private notInterestedThisSession = new Set<string>();

  private constructor() {}

  public static getInstance(): MoreLikeRecommendationEngine {
    if (!MoreLikeRecommendationEngine.instance) {
      MoreLikeRecommendationEngine.instance = new MoreLikeRecommendationEngine();
    }
    return MoreLikeRecommendationEngine.instance;
  }

  /**
   * Fetch and rank recommendations for a given seed song.
   *
   * @param seedSong      - The currently playing (or selected) song used as the recommendation seed.
   * @param excludeIds    - Song IDs to explicitly exclude (e.g., the seed itself, current queue).
   * @param limit         - Maximum number of recommendations to return.
   * @param context       - The recommendation surface context (song | artist | album | playlist | home).
   * @param userId        - Optional user ID for personalisation.
   */
  public async getRecommendations(
    seedSong: Song,
    excludeIds: string[] = [],
    limit = 20,
    context: RecommendationContext = 'song',
    userId = 'guest'
  ): Promise<RecommendationResult[]> {
    if (!seedSong?.id) return [];

    const engine = PersonalizationEngine.getInstance();

    // Fetch contextual raw songs from PersonalizationEngine
    const rawSongs = await engine.getContextualRecommendations(seedSong, userId, limit + 10);

    // Build exclusion set: seed song + caller-provided IDs + not-interested songs
    const notInterestedSet = engine.getNotInterestedSet();
    const excludeSet = new Set<string>([
      seedSong.id,
      ...excludeIds,
      ...Array.from(this.notInterestedThisSession),
      ...Array.from(notInterestedSet),
    ]);

    // Filter exclusions
    const eligible = rawSongs.filter((s) => !excludeSet.has(s.id));

    // De-duplicate by canonical title+artist identity
    const deduplicated = SongUniquenessEngine.deduplicate(eligible, []);

    // Map to typed RecommendationResult
    const results: RecommendationResult[] = deduplicated.slice(0, limit).map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album || '',
      artwork: song.coverUrl || song.albumCoverUrl || song.songCoverUrl || '/app-icon.png',
      language: song.language || '',
      genre: song.genre || '',
      duration: song.duration || 0,
      recommendationScore: this.deriveScore(song, seedSong),
      reason: this.deriveReason(song, seedSong),
      rawSong: song,
    }));

    return results;
  }

  /**
   * Record a user feedback signal for a recommendation.
   * Routes signals to both PersonalizationEngine (for taste profile) and
   * RecommendationAnalytics (for detailed reporting).
   */
  public recordFeedback(signal: FeedbackSignal, song: Song): void {
    if (!song) return;

    const engine = PersonalizationEngine.getInstance();
    const analytics = RecommendationAnalytics.getInstance();

    switch (signal) {
      case 'play':
        engine.trackEngagement(song, 'play', 0, 0, 'recommendation').catch(() => {});
        break;

      case 'skip':
        engine.trackEngagement(song, 'skip', 0, 0, 'recommendation').catch(() => {});
        analytics.recordPlaybackSignal(song, 10); // < 15% completion → early skip
        break;

      case 'replay':
        engine.trackEngagement(song, 'complete', 0, 1.0, 'recommendation').catch(() => {});
        analytics.recordPlaybackSignal(song, 100);
        break;

      case 'like':
        engine.trackEngagement(song, 'like', 0, 0, 'recommendation').catch(() => {});
        analytics.recordInteractionSignal('LIKE', {
          artistName: song.artist,
          genre: song.genre,
          language: song.language,
        });
        break;

      case 'unlike':
        engine.trackEngagement(song, 'unlike', 0, 0, 'recommendation').catch(() => {});
        break;

      case 'add_to_playlist':
        engine.trackEngagement(song, 'playlist_add', 0, 0, 'recommendation').catch(() => {});
        analytics.recordInteractionSignal('PLAYLIST_ADD', {
          artistName: song.artist,
          genre: song.genre,
          language: song.language,
        });
        break;

      case 'add_to_queue':
        engine.trackEngagement(song, 'play', 0, 0, 'recommendation').catch(() => {});
        break;

      case 'not_interested':
        this.notInterestedThisSession.add(song.id);
        engine.markNotInterested(song.id);
        break;
    }
  }

  /**
   * Check whether a song ID has been marked as not-interested in this session.
   */
  public isNotInterested(songId: string): boolean {
    return this.notInterestedThisSession.has(songId);
  }

  /**
   * Shuffle an array of recommendations while avoiding back-to-back repeats
   * from the same artist (Fisher-Yates with artist diversity enforcement).
   */
  public shuffle(results: RecommendationResult[]): RecommendationResult[] {
    const arr = [...results];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    // Post-shuffle: enforce no two consecutive same-artist tracks
    for (let i = 1; i < arr.length - 1; i++) {
      const prev = arr[i - 1].artist?.split(/[,&/]/)[0].trim().toLowerCase();
      const curr = arr[i].artist?.split(/[,&/]/)[0].trim().toLowerCase();
      if (prev === curr) {
        // Swap current with a different-artist candidate further ahead
        for (let j = i + 1; j < arr.length; j++) {
          const next = arr[j].artist?.split(/[,&/]/)[0].trim().toLowerCase();
          if (next !== prev) {
            [arr[i], arr[j]] = [arr[j], arr[i]];
            break;
          }
        }
      }
    }

    return arr;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private deriveScore(song: Song, seed: Song): number {
    let score = 50; // baseline

    const seedArtist = (seed.artist || '').split(/[,&/]/)[0].trim().toLowerCase();
    const songArtist = (song.artist || '').split(/[,&/]/)[0].trim().toLowerCase();

    if (songArtist === seedArtist) score += 30;
    if (song.language && song.language === seed.language) score += 20;
    if (song.genre && song.genre === seed.genre) score += 10;
    if (song.album && song.album === seed.album) score += 5;

    // Popularity boost (normalized 0-100 → 0-10)
    const pop = Math.min(100, Math.max(0, song.popularity || song.plays || 50));
    score += pop / 10;

    return Math.min(100, Math.round(score));
  }

  private deriveReason(song: Song, seed: Song): string {
    const seedArtist = (seed.artist || '').split(/[,&/]/)[0].trim().toLowerCase();
    const songArtist = (song.artist || '').split(/[,&/]/)[0].trim().toLowerCase();

    if (songArtist === seedArtist) return `More from ${song.artist.split(/[,&/]/)[0].trim()}`;
    if (song.album && song.album === seed.album) return `From the same album`;
    if (song.language && song.language === seed.language) return `Same language`;
    if (song.genre && song.genre === seed.genre) return `Similar genre`;
    return 'Recommended for you';
  }
}
