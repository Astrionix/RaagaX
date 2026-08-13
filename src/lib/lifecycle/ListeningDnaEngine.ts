import { Song } from '@/types/music';

export type UserPersonalityType = 
  | 'ALBUM_EXPLORER'
  | 'HIT_LISTENER'
  | 'DISCOVERY_LISTENER'
  | 'REPEAT_LISTENER'
  | 'MOOD_LISTENER'
  | 'BACKGROUND_LISTENER';

export interface ListeningDna {
  languageDistribution: Record<string, number>; // e.g. { Telugu: 65, Hindi: 20, Tamil: 15 }
  genreDistribution: Record<string, number>;    // e.g. { Melody: 40, Love: 30, Mass: 30 }
  artistDistribution: Record<string, number>;   // e.g. { "Sid Sriram": 25, "Anirudh": 20 }
  eraDistribution: Record<string, number>;      // e.g. { "2020s": 60, "2010s": 30, "Classics": 10 }
  personalityType: UserPersonalityType;
  noveltyTolerance: number; // 0.0 (comfort-seeker) to 1.0 (high discovery)
  timeOfDayContext: 'morning' | 'afternoon' | 'evening' | 'night';
}

const STORAGE_KEY = 'raagax_listening_dna';

export class ListeningDnaEngine {
  private static instance: ListeningDnaEngine;

  private dna: ListeningDna = {
    languageDistribution: {},
    genreDistribution: { Melody: 50, Love: 50 },
    artistDistribution: {},
    eraDistribution: { '2020s': 80, '2010s': 20 },
    personalityType: 'DISCOVERY_LISTENER',
    noveltyTolerance: 0.5,
    timeOfDayContext: 'evening',
  };

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): ListeningDnaEngine {
    if (!ListeningDnaEngine.instance) {
      ListeningDnaEngine.instance = new ListeningDnaEngine();
    }
    return ListeningDnaEngine.instance;
  }

  public setInitialLanguages(languages: string[]) {
    if (!languages || languages.length === 0) return;
    const share = Math.round(100 / languages.length);
    const dist: Record<string, number> = {};
    languages.forEach(l => { dist[l] = share; });
    this.dna.languageDistribution = dist;
    this.saveToStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.dna = { ...this.dna, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('[ListeningDnaEngine] Could not load DNA:', e);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.dna));
    } catch (e) {
      console.warn('[ListeningDnaEngine] Could not save DNA:', e);
    }
  }

  public getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  public recordTrackPlay(song: Song, playedPercentage: number, isReplay: boolean = false, isExplicitSearch: boolean = false) {
    const lang = (song as any).language || (song as any).languageId || song.genre?.split(' ')[0] || '';
    const artist = song.artist || 'Unknown';
    const era = song.releaseYear ? (song.releaseYear >= 2020 ? '2020s' : song.releaseYear >= 2010 ? '2010s' : 'Classics') : '2020s';

    const weight = isReplay ? 3.0 : isExplicitSearch ? 2.5 : playedPercentage >= 0.8 ? 1.5 : 0.5;

    // Update Distributions
    if (lang) {
      this.incrementDistribution('languageDistribution', lang, weight);
    }
    this.incrementDistribution('artistDistribution', artist, weight);
    this.incrementDistribution('eraDistribution', era, weight);

    if (song.category) {
      this.incrementDistribution('genreDistribution', song.category, weight);
    }

    // Update Personality Type
    if (isReplay) {
      this.dna.personalityType = 'REPEAT_LISTENER';
    } else if (playedPercentage < 0.3) {
      this.dna.noveltyTolerance = Math.max(0.1, this.dna.noveltyTolerance - 0.05);
    } else if (playedPercentage >= 0.8) {
      this.dna.noveltyTolerance = Math.min(1.0, this.dna.noveltyTolerance + 0.02);
    }

    this.dna.timeOfDayContext = this.getTimeOfDay();
    this.saveToStorage();
  }

  private incrementDistribution(key: 'languageDistribution' | 'genreDistribution' | 'artistDistribution' | 'eraDistribution', itemKey: string, weight: number) {
    const current = this.dna[key][itemKey] || 0;
    this.dna[key][itemKey] = current + weight;

    // Normalize to percentages
    const total = Object.values(this.dna[key]).reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (const k in this.dna[key]) {
        this.dna[key][k] = Math.round((this.dna[key][k] / total) * 100);
      }
    }
  }

  public getDna(): ListeningDna {
    return {
      ...this.dna,
      timeOfDayContext: this.getTimeOfDay()
    };
  }
}
