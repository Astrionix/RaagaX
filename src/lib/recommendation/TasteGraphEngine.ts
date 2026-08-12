import { Song } from '@/types/music';

export interface UserRelationshipStrength {
  entityId: string;
  entityType: 'artist' | 'genre' | 'album' | 'composer' | 'language';
  strength: number; // 0.0 to 1.0
  lastReinforcedAt: number;
  explicitLike: boolean;
}

export interface UserMusicGraphData {
  relationships: Record<string, UserRelationshipStrength>;
  hiddenArtists: Set<string>;
  hiddenSongs: Set<string>;
  notForMeCategories: Set<string>;
  moreLikeThisArtists: Set<string>;
}

const STORAGE_KEY = 'raagax_personal_music_graph';

export class TasteGraphEngine {
  private static instance: TasteGraphEngine;

  private data: UserMusicGraphData = {
    relationships: {},
    hiddenArtists: new Set(),
    hiddenSongs: new Set(),
    notForMeCategories: new Set(),
    moreLikeThisArtists: new Set(),
  };

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): TasteGraphEngine {
    if (!TasteGraphEngine.instance) {
      TasteGraphEngine.instance = new TasteGraphEngine();
    }
    return TasteGraphEngine.instance;
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = {
          relationships: parsed.relationships || {},
          hiddenArtists: new Set(parsed.hiddenArtists || []),
          hiddenSongs: new Set(parsed.hiddenSongs || []),
          notForMeCategories: new Set(parsed.notForMeCategories || []),
          moreLikeThisArtists: new Set(parsed.moreLikeThisArtists || []),
        };
        this.applyTimeDecay();
      }
    } catch (e) {
      console.warn('[TasteGraphEngine] Could not load graph data:', e);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        relationships: this.data.relationships,
        hiddenArtists: Array.from(this.data.hiddenArtists),
        hiddenSongs: Array.from(this.data.hiddenSongs),
        notForMeCategories: Array.from(this.data.notForMeCategories),
        moreLikeThisArtists: Array.from(this.data.moreLikeThisArtists),
      }));
    } catch (e) {
      console.warn('[TasteGraphEngine] Could not save graph data:', e);
    }
  }

  /**
   * Applies time decay to unreinforced preferences so taste profiles stay dynamic
   */
  private applyTimeDecay() {
    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    for (const key in this.data.relationships) {
      const rel = this.data.relationships[key];
      const daysElapsed = (now - rel.lastReinforcedAt) / THIRTY_DAYS_MS;
      if (daysElapsed > 1) {
        // Decay strength by 5% per month of inactivity
        rel.strength = Math.max(0.1, rel.strength * Math.pow(0.95, daysElapsed));
      }
    }
  }

  public recordSignal(
    entityId: string,
    entityType: 'artist' | 'genre' | 'album' | 'composer' | 'language',
    signalWeight: number,
    isExplicit: boolean = false
  ) {
    const key = `${entityType}:${entityId}`;
    const existing = this.data.relationships[key] || {
      entityId,
      entityType,
      strength: 0.2,
      lastReinforcedAt: Date.now(),
      explicitLike: false,
    };

    const delta = isExplicit ? signalWeight * 0.2 : signalWeight * 0.05;
    existing.strength = Math.min(1.0, existing.strength + delta);
    existing.lastReinforcedAt = Date.now();
    if (isExplicit) existing.explicitLike = true;

    this.data.relationships[key] = existing;
    this.saveToStorage();
  }

  // --- Explicit User AI Feedback Channels ---

  public hideArtist(artistName: string) {
    if (artistName) {
      this.data.hiddenArtists.add(artistName.toLowerCase());
      this.saveToStorage();
    }
  }

  public hideSong(songId: string) {
    if (songId) {
      this.data.hiddenSongs.add(songId);
      this.saveToStorage();
    }
  }

  public markNotForMe(category: string) {
    if (category) {
      this.data.notForMeCategories.add(category.toLowerCase());
      this.saveToStorage();
    }
  }

  public markMoreLikeThis(artistName: string) {
    if (artistName) {
      this.data.moreLikeThisArtists.add(artistName.toLowerCase());
      this.recordSignal(artistName, 'artist', 2.0, true);
      this.saveToStorage();
    }
  }

  public isSongAllowedInRecommendations(song: Song): boolean {
    if (!song) return false;
    if (this.data.hiddenSongs.has(song.id)) return false;
    if (song.artist && this.data.hiddenArtists.has(song.artist.toLowerCase())) return false;
    if (song.category && this.data.notForMeCategories.has(song.category.toLowerCase())) return false;
    return true;
  }

  public getRelationshipScore(entityId: string, entityType: string): number {
    const key = `${entityType}:${entityId}`;
    return this.data.relationships[key]?.strength || 0;
  }

  public getGraphData() {
    return {
      ...this.data,
      hiddenArtists: Array.from(this.data.hiddenArtists),
      hiddenSongs: Array.from(this.data.hiddenSongs),
      notForMeCategories: Array.from(this.data.notForMeCategories),
      moreLikeThisArtists: Array.from(this.data.moreLikeThisArtists),
    };
  }
}
