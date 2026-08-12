import { Song } from '@/types/music';
import { QueueSource } from '../queue/types';

export type PlaySource =
  | 'HOME'
  | 'SEARCH'
  | 'ALBUM'
  | 'PLAYLIST'
  | 'LIKED_SONGS'
  | 'ARTIST'
  | 'RECOMMENDATION'
  | 'AUTOPLAY'
  | 'RADIO'
  | 'QUEUE';

export interface DiscoveryOutcomeRecord {
  songId: string;
  artist: string;
  source: QueueSource | PlaySource;
  discoveredAt: number;
  outcome: 'SUCCESS' | 'FAILURE' | 'PENDING';
  completionPercentage: number;
}

const STORAGE_KEY = 'raagax_discovery_outcomes';

export class DiscoverySuccessTracker {
  private static instance: DiscoverySuccessTracker;

  private records: Map<string, DiscoveryOutcomeRecord> = new Map();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): DiscoverySuccessTracker {
    if (!DiscoverySuccessTracker.instance) {
      DiscoverySuccessTracker.instance = new DiscoverySuccessTracker();
    }
    return DiscoverySuccessTracker.instance;
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: DiscoveryOutcomeRecord[] = JSON.parse(raw);
        parsed.forEach(r => this.records.set(r.songId, r));
      }
    } catch (e) {
      console.warn('[DiscoverySuccessTracker] Could not load records:', e);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const arr = Array.from(this.records.values()).slice(-200); // Keep last 200 discovery records
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('[DiscoverySuccessTracker] Could not save records:', e);
    }
  }

  public trackRecommendationPlayed(song: Song, source: QueueSource | PlaySource) {
    if (source === 'AUTOPLAY' || source === 'RECOMMENDATION' || source === 'RADIO') {
      this.records.set(song.id, {
        songId: song.id,
        artist: song.artist || 'Unknown',
        source,
        discoveredAt: Date.now(),
        outcome: 'PENDING',
        completionPercentage: 0,
      });
      this.saveToStorage();
    }
  }

  public evaluateOutcome(songId: string, completionPercentage: number, action: 'complete' | 'skip' | 'like' | 'replay') {
    const record = this.records.get(songId);
    if (!record) return;

    record.completionPercentage = completionPercentage;

    if (action === 'like' || action === 'replay' || action === 'complete' || completionPercentage >= 0.8) {
      record.outcome = 'SUCCESS';
    } else if (action === 'skip' && completionPercentage < 0.3) {
      record.outcome = 'FAILURE';
    }

    this.records.set(songId, record);
    this.saveToStorage();
  }

  public getSuccessRate(): number {
    const list = Array.from(this.records.values()).filter(r => r.outcome !== 'PENDING');
    if (list.length === 0) return 0.5; // neutral fallback
    const successes = list.filter(r => r.outcome === 'SUCCESS').length;
    return successes / list.length;
  }
}
