import { Song } from './music';

/**
 * A fully-typed recommendation result, designed for future API compatibility.
 * The `rawSong` field holds the underlying Song for playback; all other fields
 * are surface-level display values that can later come directly from a backend.
 */
export interface RecommendationResult {
  /** Stable unique identifier — maps to Song.id */
  id: string;
  title: string;
  artist: string;
  album: string;
  /** Full artwork URL (song cover, album cover, or fallback) */
  artwork: string;
  language: string;
  genre: string;
  /** Duration in seconds */
  duration: number;
  /** 0–100 relevance score computed by the ranking engine */
  recommendationScore: number;
  /** Human-readable reason shown in tooltips / debug ("Same artist", "Similar genre", etc.) */
  reason: string;
  /** The raw Song object for playback — never serialised to the API */
  rawSong: Song;
}

/**
 * Feedback signal types that feed back into the personalization engine.
 * Every user action on a recommendation card dispatches one of these.
 */
export type FeedbackSignal =
  | 'play'
  | 'skip'
  | 'replay'
  | 'like'
  | 'unlike'
  | 'add_to_playlist'
  | 'add_to_queue'
  | 'not_interested';

/**
 * Context passed to the recommendation engine to describe what type of
 * recommendation is being requested. Enables reuse for artist / album / playlist pages.
 */
export type RecommendationContext =
  | 'song'       // seed is a specific song (home feed "More Like What You Heard")
  | 'artist'     // seed is an artist page
  | 'album'      // seed is an album page
  | 'playlist'   // seed is a playlist page
  | 'home';      // general home-feed personalization
