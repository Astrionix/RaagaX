import { Song } from '@/types/music';

export type LifecyclePhase = 'BOOTSTRAP' | 'EARLY' | 'DEVELOPING' | 'MATURE';
export type ConfidenceMode = 'LOW' | 'MEDIUM' | 'HIGH';

export interface LifecycleCompositionRatios {
  personalized: number;
  popular: number;
  newRelease: number;
  adjacent: number;
  exploration: number;
}

export interface UserLifecycleData {
  phase: LifecyclePhase;
  confidenceMode: ConfidenceMode;
  totalMeaningfulPlays: number;
  totalSkips: number;
  totalLikes: number;
  firstPlayAt: number | null;
  selectedLanguages: string[];
  selectedMoods: string[];
  selectedArtists: string[];
  sessionPlayCount: number;
  sessionSkipCount: number;
  recentSessionCategories: string[];
  sessionIntentCategory: string | null;
}

const STORAGE_KEY = 'raagax_user_lifecycle_state';

export class UserLifecycleManager {
  private static instance: UserLifecycleManager;

  private data: UserLifecycleData = {
    phase: 'BOOTSTRAP',
    confidenceMode: 'MEDIUM',
    totalMeaningfulPlays: 0,
    totalSkips: 0,
    totalLikes: 0,
    firstPlayAt: null,
    selectedLanguages: [],
    selectedMoods: ['Melodies', 'Love'],
    selectedArtists: [],
    sessionPlayCount: 0,
    sessionSkipCount: 0,
    recentSessionCategories: [],
    sessionIntentCategory: null,
  };

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): UserLifecycleManager {
    if (!UserLifecycleManager.instance) {
      UserLifecycleManager.instance = new UserLifecycleManager();
    }
    return UserLifecycleManager.instance;
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = {
          ...this.data,
          ...parsed,
          recentSessionCategories: [],
          sessionPlayCount: 0,
          sessionSkipCount: 0,
          sessionIntentCategory: null,
        };
        this.evaluatePhase();
      }
    } catch (e) {
      console.warn('[UserLifecycleManager] Could not load stored state:', e);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        phase: this.data.phase,
        confidenceMode: this.data.confidenceMode,
        totalMeaningfulPlays: this.data.totalMeaningfulPlays,
        totalSkips: this.data.totalSkips,
        totalLikes: this.data.totalLikes,
        firstPlayAt: this.data.firstPlayAt,
        selectedLanguages: this.data.selectedLanguages,
        selectedMoods: this.data.selectedMoods,
        selectedArtists: this.data.selectedArtists,
      }));
    } catch (e) {
      console.warn('[UserLifecycleManager] Could not save state:', e);
    }
  }

  public bootstrapFromOnboarding(languages: string[], moods: string[], artists: string[]) {
    this.data.selectedLanguages = languages ?? [];
    this.data.selectedMoods = moods.length > 0 ? moods : ['Melodies', 'Love'];
    this.data.selectedArtists = artists;
    this.evaluatePhase();
    this.saveToStorage();
  }

  public setSelectedLanguages(languages: string[]) {
    this.data.selectedLanguages = languages ?? [];
    this.saveToStorage();
  }

  public getRecommendationContext(): { selectedLanguages: string[]; hasBehavior: boolean; phase: LifecyclePhase } {
    const hasBehavior = this.data.totalMeaningfulPlays > 0 || this.data.totalLikes > 0;
    return {
      selectedLanguages: this.data.selectedLanguages,
      hasBehavior,
      phase: this.data.phase,
    };
  }

  public evaluatePhase() {
    const plays = this.data.totalMeaningfulPlays;
    if (plays < 10) {
      this.data.phase = 'BOOTSTRAP';
    } else if (plays < 30) {
      this.data.phase = 'EARLY';
    } else if (plays < 100) {
      this.data.phase = 'DEVELOPING';
    } else {
      this.data.phase = 'MATURE';
    }

    // Evaluate Confidence Mode
    const sessionTotal = this.data.sessionPlayCount + this.data.sessionSkipCount;
    if (sessionTotal >= 5) {
      const skipRate = this.data.sessionSkipCount / sessionTotal;
      if (skipRate > 0.6) {
        this.data.confidenceMode = 'LOW';
      } else if (skipRate < 0.2 && this.data.totalLikes >= 3) {
        this.data.confidenceMode = 'HIGH';
      } else {
        this.data.confidenceMode = 'MEDIUM';
      }
    } else {
      this.data.confidenceMode = 'MEDIUM';
    }
  }

  public trackEngagement(
    song: Song,
    action: 'play' | 'skip' | 'complete' | 'like' | 'replay',
    playedDurationSec: number,
    completionPercentage: number
  ) {
    if (!this.data.firstPlayAt) {
      this.data.firstPlayAt = Date.now();
    }

    if (action === 'skip') {
      this.data.totalSkips++;
      this.data.sessionSkipCount++;
    } else if (action === 'like') {
      this.data.totalLikes++;
    } else if (completionPercentage >= 0.4 || action === 'complete' || action === 'replay') {
      this.data.totalMeaningfulPlays++;
      this.data.sessionPlayCount++;
    }

    // Session Intent Detection
    if (song.category || song.genre) {
      const cat = song.category || song.genre || '';
      this.data.recentSessionCategories.push(cat);
      if (this.data.recentSessionCategories.length > 10) {
        this.data.recentSessionCategories.shift();
      }

      // Check for 3+ consecutive matching categories
      const len = this.data.recentSessionCategories.length;
      if (len >= 3) {
        const last3 = this.data.recentSessionCategories.slice(len - 3);
        if (last3[0] === last3[1] && last3[1] === last3[2]) {
          this.data.sessionIntentCategory = last3[0];
        }
      }
    }

    this.evaluatePhase();
    this.saveToStorage();
  }

  public getCompositionRatios(): LifecycleCompositionRatios {
    if (this.data.confidenceMode === 'LOW') {
      return { personalized: 0.40, popular: 0.15, newRelease: 0.15, adjacent: 0.15, exploration: 0.15 };
    }
    if (this.data.confidenceMode === 'HIGH') {
      return { personalized: 0.70, popular: 0.10, newRelease: 0.10, adjacent: 0.05, exploration: 0.05 };
    }

    switch (this.data.phase) {
      case 'BOOTSTRAP':
        return { personalized: 0.40, popular: 0.25, newRelease: 0.15, adjacent: 0.10, exploration: 0.10 };
      case 'EARLY':
        return { personalized: 0.55, popular: 0.20, newRelease: 0.10, adjacent: 0.10, exploration: 0.05 };
      case 'DEVELOPING':
        return { personalized: 0.65, popular: 0.15, newRelease: 0.10, adjacent: 0.05, exploration: 0.05 };
      case 'MATURE':
      default:
        return { personalized: 0.70, popular: 0.10, newRelease: 0.10, adjacent: 0.05, exploration: 0.05 };
    }
  }

  public calculateSkipPenalty(skippedAtSec: number): { artistPenalty: number; genrePenalty: number } {
    if (skippedAtSec < 3) {
      return { artistPenalty: -5.0, genrePenalty: -3.0 }; // Immediate skip: strong negative
    }
    if (skippedAtSec < 40) {
      return { artistPenalty: -2.0, genrePenalty: -1.5 }; // Early skip: moderate negative
    }
    return { artistPenalty: -0.5, genrePenalty: -0.2 }; // Late skip: minor adjustment
  }

  public getData(): UserLifecycleData {
    return { ...this.data };
  }
}
