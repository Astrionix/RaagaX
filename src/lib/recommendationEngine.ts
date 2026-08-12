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
   * Unified telemetry tracker for high-resolution behavioral data
   */
  public async trackEngagement(
    song: Song, 
    action: 'play' | 'skip' | 'complete',
    durationSec: number,
    completionPercentage: number,
    context: string = 'home',
    skippedAtSec?: number
  ) {
    const artist = song.artist || 'Unknown';
    const genre = song.genre || 'Telugu';

    // Update UserLifecycleManager
    try {
      const { UserLifecycleManager } = await import('@/lib/lifecycle/UserLifecycleManager');
      UserLifecycleManager.getInstance().trackEngagement(song, action, durationSec, completionPercentage);
    } catch {}

    // Update Local Preferences
    if (action === 'skip') {
      let artistPenalty = -5;
      let genrePenalty = -3;
      if (skippedAtSec !== undefined) {
        try {
          const { UserLifecycleManager } = await import('@/lib/lifecycle/UserLifecycleManager');
          const p = UserLifecycleManager.getInstance().calculateSkipPenalty(skippedAtSec);
          artistPenalty = p.artistPenalty;
          genrePenalty = p.genrePenalty;
        } catch {}
      }
      this.preferences.artistScores[artist] = Math.max(0, (this.preferences.artistScores[artist] || 0) + artistPenalty);
      this.preferences.genreScores[genre] = Math.max(0, (this.preferences.genreScores[genre] || 0) + genrePenalty);
      this.preferences.skipCounts[song.id] = (this.preferences.skipCounts[song.id] || 0) + 1;
    } else {
      let artistWeight = 10;
      let genreWeight = 5;
      if (completionPercentage >= 0.8) {
        artistWeight = 15; genreWeight = 8;
      } else if (completionPercentage < 0.5) {
        artistWeight = 2; genreWeight = 1;
      }

      this.preferences.artistScores[artist] = (this.preferences.artistScores[artist] || 0) + artistWeight;
      this.preferences.genreScores[genre] = (this.preferences.genreScores[genre] || 0) + genreWeight;
      this.preferences.playCounts[song.id] = (this.preferences.playCounts[song.id] || 0) + 1;
    }

    this.preferences.lastSongId = song.id;
    this.preferences.lastArtist = artist;
    this.preferences.lastGenre = genre;
    this.saveToStorage();

    // Log to Supabase High-Res Telemetry
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Upsert song to canonical_songs to satisfy foreign key constraints
        await supabase.from('canonical_songs').upsert({
          id: song.id,
          title: song.title,
          artist: artist,
          album: song.album,
          duration: Number(song.duration) || 0,
          cover_url: song.coverUrl || null
        }, { onConflict: 'id' });

        supabase.from('listening_events').insert({
          user_id: session.user.id,
          song_id: song.id,
          event_type: action === 'complete' ? 'complete' : action,
          position_ms: Math.floor(durationSec * 1000),
          device_id: typeof window !== 'undefined' ? localStorage.getItem('raagax_device_id') : null
        }).then(({ error }) => {
          if (error) console.error('Failed to log telemetry:', error);
        });
      }
    } catch (e) {
      console.warn('Could not verify session for logging telemetry:', e);
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
