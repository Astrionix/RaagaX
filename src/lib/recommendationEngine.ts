import { Song } from '@/types/music';
import { supabase } from '@/lib/supabase';

export interface UserPreferences {
  artistScores: Record<string, number>;
  genreScores: Record<string, number>;
  playCounts: Record<string, number>;
  skipCounts: Record<string, number>;
  lastSongId?: string;
  lastArtist?: string;
  lastGenre?: string;
}

const STORAGE_KEY = 'raagax_user_recommendation_profile';

export class RecommendationEngine {
  private static instance: RecommendationEngine;

  private preferences: UserPreferences = {
    artistScores: {},
    genreScores: {},
    playCounts: {},
    skipCounts: {},
  };

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance) {
      RecommendationEngine.instance = new RecommendationEngine();
    }
    return RecommendationEngine.instance;
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.preferences = JSON.parse(data);
      }
    } catch (e) {
      console.warn('Could not load recommendation profile:', e);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (e) {
      console.warn('Could not save recommendation profile:', e);
    }
  }

  /**
   * Track when a song finishes or plays significantly (>30s)
   */
  public async trackPlay(song: Song) {
    const artist = song.artist || 'Unknown';
    const genre = song.genre || 'Telugu';

    this.preferences.artistScores[artist] = (this.preferences.artistScores[artist] || 0) + 10;
    this.preferences.genreScores[genre] = (this.preferences.genreScores[genre] || 0) + 5;
    this.preferences.playCounts[song.id] = (this.preferences.playCounts[song.id] || 0) + 1;

    this.preferences.lastSongId = song.id;
    this.preferences.lastArtist = artist;
    this.preferences.lastGenre = genre;

    this.saveToStorage();

    // Log to Supabase for Python Implicit Recommendation Engine
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // We don't await this to avoid blocking the main thread
        supabase.from('playback_history').insert({
          user_id: session.user.id,
          song_id: song.id,
          artist: artist,
          genre: genre,
          action: 'play'
        }).then(({ error }) => {
          if (error) console.error('Failed to log track play to Supabase:', error);
        });
      }
    } catch (e) {
      console.warn('Could not verify session for logging play:', e);
    }
  }

  /**
   * Track when a user skips a song early (<15s)
   */
  public async trackSkip(song: Song) {
    const artist = song.artist || 'Unknown';
    const genre = song.genre || 'Telugu';

    this.preferences.artistScores[artist] = Math.max(0, (this.preferences.artistScores[artist] || 0) - 5);
    this.preferences.genreScores[genre] = Math.max(0, (this.preferences.genreScores[genre] || 0) - 3);
    this.preferences.skipCounts[song.id] = (this.preferences.skipCounts[song.id] || 0) + 1;

    this.saveToStorage();

    // Log to Supabase for Python Implicit Recommendation Engine
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        supabase.from('playback_history').insert({
          user_id: session.user.id,
          song_id: song.id,
          artist: artist,
          genre: genre,
          action: 'skip'
        }).then(({ error }) => {
          if (error) console.error('Failed to log track skip to Supabase:', error);
        });
      }
    } catch (e) {
      console.warn('Could not verify session for logging skip:', e);
    }
  }

  /**
   * Calculate recommendation score for a given track based on current profile + time of day
   */
  public scoreTrack(song: Song): number {
    let score = 0;
    const artist = song.artist || '';
    const genre = song.genre || '';

    // 1. Artist preference (+10 per point)
    if (this.preferences.artistScores[artist]) {
      score += this.preferences.artistScores[artist] * 1.5;
    }

    // 2. Genre preference (+5 per point)
    if (this.preferences.genreScores[genre]) {
      score += this.preferences.genreScores[genre] * 1.2;
    }

    // 3. Time of Day Context
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      // Morning: boost Devotional, Soft, Melody
      if (['devotional', 'melody'].includes(song.category)) score += 8;
    } else if (hour >= 18 && hour < 23) {
      // Evening/Night: boost Romantic, Love, Mass Beats
      if (['love', 'mass', 'melody'].includes(song.category)) score += 8;
    }

    // 4. Boost recently played artist matches
    if (this.preferences.lastArtist && artist.includes(this.preferences.lastArtist)) {
      score += 15;
    }

    // 5. Popularity baseline
    score += (song.popularity || 50) * 0.1;

    // 6. Skip Penalty
    if (this.preferences.skipCounts[song.id]) {
      score -= this.preferences.skipCounts[song.id] * 10;
    }

    return score;
  }

  /**
   * Sort array of candidate songs by recommendation score
   */
  public rankSongs(candidates: Song[]): Song[] {
    return [...candidates].sort((a, b) => this.scoreTrack(b) - this.scoreTrack(a));
  }

  public getPreferences(): UserPreferences {
    return { ...this.preferences };
  }
}
