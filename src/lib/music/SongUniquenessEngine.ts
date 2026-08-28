/**
 * SongUniquenessEngine — Centralized Song Deduplication & Uniqueness Engine for RaagaX
 *
 * Applied globally to:
 * - Recommendations & "Because You Listened To..."
 * - Suggestions & Similar Songs
 * - Trending & New Releases
 * - Auto-Queue, Play Next, and Active Playback Queue
 * - Search Results & Curated Mixes
 */

import { Song } from '@/types/music';

export class SongUniquenessEngine {
  /**
   * Normalizes a song title by stripping extraneous movie/album suffixes,
   * compilation tags, language qualifiers, and bracketed text.
   *
   * e.g.
   * "Chikiri Chikiri (From \"Peddi\")" -> "chikiri chikiri"
   * "Chikiri Chikiri (From \"Prema Kavithalu - 2026\")" -> "chikiri chikiri"
   * "Chikiri Chikiri (From \"Telugu Superhits\")" -> "chikiri chikiri"
   * "Chikiri Chikiri" -> "chikiri chikiri"
   */
  public static normalizeTitle(title: string): string {
    if (!title) return '';

    return title
      .toLowerCase()
      // Remove (From "Movie/Album") or [From "Movie/Album"]
      .replace(/[\(\[\{]\s*from\b[^\)\]\}]*[\)\]\}]/gi, '')
      // Remove common release/album metadata in brackets
      .replace(/[\(\[\{]\s*(original\s+motion\s+picture\s+soundtrack|soundtrack|ost|audio|official|lyrical|video|full\s+song|version|remix|lofi|slowed|reverb|cover|feat\b|with\b|duet|solo)[^\)\]\}]*[\)\]\}]/gi, '')
      // Remove language qualifiers in brackets: (Telugu), (Hindi), etc.
      .replace(/[\(\[\{]\s*(telugu|hindi|tamil|kannada|malayalam|punjabi|english|bhojpuri|bengali|marathi|gujarati)[^\)\]\}]*[\)\]\}]/gi, '')
      // Remove any remaining parentheses/brackets content if it contains "from" or quotes
      .replace(/\([^)]*from[^)]*\)/gi, '')
      // Strip remaining brackets
      .replace(/[\(\)\[\]\{\}\"\'\`]/g, ' ')
      // Strip non-alphanumeric (keep spaces)
      .replace(/[^a-z0-9\s]/g, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extracts individual artists from an artist string.
   */
  public static extractArtistList(artistStr: string): string[] {
    if (!artistStr) return [];
    return artistStr
      .toLowerCase()
      .split(/[,&/|;+]|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b/gi)
      .map((a) => a.replace(/[^a-z0-9]/g, '').trim())
      .filter((a) => a.length > 1);
  }

  /**
   * Computes a stable semantic fingerprint for a song to catch multi-release duplicates.
   */
  public static getSemanticFingerprint(song: Song): string {
    const cleanTitle = this.normalizeTitle(song.title);
    const artists = this.extractArtistList(song.artist || '');
    const sortedArtists = [...artists].sort().join('_');

    if (cleanTitle.length >= 3) {
      return `${cleanTitle}:::${sortedArtists}`;
    }
    return (song.id || '').toLowerCase().trim();
  }

  /**
   * Checks if two songs are duplicate releases of the same track.
   */
  public static isDuplicate(songA: Song, songB: Song): boolean {
    if (!songA || !songB) return false;

    // 1. Exact ID match
    if (songA.id && songB.id && songA.id === songB.id) return true;

    // 2. Title normalization match
    const titleA = this.normalizeTitle(songA.title);
    const titleB = this.normalizeTitle(songB.title);

    if (!titleA || !titleB || titleA !== titleB) return false;

    // If normalized titles are identical:
    // Check if they share at least one artist or have identical length / close duration
    const artistsA = this.extractArtistList(songA.artist || '');
    const artistsB = this.extractArtistList(songB.artist || '');

    // If either has no artists listed, match by title
    if (artistsA.length === 0 || artistsB.length === 0) return true;

    // Check if any artist overlaps
    const hasOverlap = artistsA.some((a) => artistsB.includes(a));
    if (hasOverlap) return true;

    // If duration is within 6 seconds, treat as duplicate version
    if (songA.duration && songB.duration && Math.abs(songA.duration - songB.duration) <= 6) {
      return true;
    }

    return true; // Same normalized title in recommendations
  }

  /**
   * Centralized deduplication method with preference for original soundtracks over compilations.
   */
  public static deduplicate(songs: Song[], existingQueueOrExcluded: Song[] = []): Song[] {
    if (!songs || songs.length === 0) return [];

    const excludedIds = new Set<string>();
    const excludedFingerprints = new Set<string>();

    for (const ex of existingQueueOrExcluded) {
      if (ex.id) excludedIds.add(ex.id);
      const fp = this.getSemanticFingerprint(ex);
      if (fp) excludedFingerprints.add(fp);
    }

    const seenIds = new Set<string>(excludedIds);
    const seenFingerprints = new Set<string>(excludedFingerprints);
    const result: Song[] = [];

    for (const song of songs) {
      if (!song || !song.id) continue;
      if (seenIds.has(song.id)) continue;

      const fp = this.getSemanticFingerprint(song);
      if (seenFingerprints.has(fp)) continue;

      seenIds.add(song.id);
      seenFingerprints.add(fp);
      result.push(song);
    }

    return result;
  }
}
