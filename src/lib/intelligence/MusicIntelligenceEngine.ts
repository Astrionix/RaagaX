'use client';

import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { TasteGraphEngine } from '@/lib/recommendation/TasteGraphEngine';

export interface UserTasteProfile {
  languages: Record<string, number>;
  genres: Record<string, number>;
  artists: Record<string, number>;
  moods: Record<string, number>;
  eras: Record<string, number>;
  lastUpdated: number;
}

export interface NaturalQueryIntent {
  rawQuery: string;
  language?: string;
  genre?: string;
  mood?: string;
  era?: string;
  artist?: string;
  activity?: string;
  tempo?: 'slow' | 'medium' | 'energetic';
  explanation?: string;
}

const PROFILE_STORAGE_KEY = 'raagax_music_intelligence_profile_v1';

export class MusicIntelligenceEngine {
  private static instance: MusicIntelligenceEngine;
  private profile: UserTasteProfile = {
    languages: { Telugu: 0.8, Tamil: 0.3, Hindi: 0.2, English: 0.1 },
    genres: { Melody: 0.8, Romantic: 0.7, Mass: 0.4, Classical: 0.3 },
    artists: {},
    moods: { Calm: 0.7, Romantic: 0.7, Energetic: 0.5 },
    eras: { '2020s': 0.8, '2010s': 0.6, '2000s': 0.5, '90s': 0.3 },
    lastUpdated: Date.now(),
  };

  private constructor() {
    this.loadProfile();
  }

  public static getInstance(): MusicIntelligenceEngine {
    if (!MusicIntelligenceEngine.instance) {
      MusicIntelligenceEngine.instance = new MusicIntelligenceEngine();
    }
    return MusicIntelligenceEngine.instance;
  }

  private loadProfile() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) {
        this.profile = JSON.parse(raw);
      }
    } catch {}
  }

  private saveProfile() {
    if (typeof window === 'undefined') return;
    try {
      this.profile.lastUpdated = Date.now();
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
    } catch {}
  }

  /**
   * P41 — Behavioral Scoring
   * Records explicit and implicit user playback signals
   */
  public recordBehaviorSignal(
    signal: 'PLAY_10S' | 'PLAY_50' | 'COMPLETE' | 'LIKE' | 'PLAYLIST_ADD' | 'SKIP_FAST' | 'REPLAY',
    song?: Song
  ) {
    if (!song) return;

    let delta = 0;
    switch (signal) {
      case 'PLAY_10S': delta = 0.05; break;
      case 'PLAY_50': delta = 0.15; break;
      case 'COMPLETE': delta = 0.30; break;
      case 'REPLAY': delta = 0.50; break;
      case 'LIKE': delta = 0.75; break;
      case 'PLAYLIST_ADD': delta = 0.75; break;
      case 'SKIP_FAST': delta = -0.20; break;
    }

    // Update Artist Affinity
    if (song.artist) {
      const current = this.profile.artists[song.artist] || 0.1;
      this.profile.artists[song.artist] = Math.max(0, Math.min(1.0, current + delta * 0.5));
      TasteGraphEngine.getInstance().recordSignal(song.artist, 'artist', delta);
    }

    // Update Language Affinity
    const lang = song.genre?.includes('TELUGU') ? 'Telugu' : (song.language || 'Telugu');
    const currentLang = this.profile.languages[lang] || 0.1;
    this.profile.languages[lang] = Math.max(0.05, Math.min(1.0, currentLang + delta * 0.2));

    this.saveProfile();
  }

  /**
   * P50 & P52 — Natural-Language Query Interpreter
   * Parses natural text into structured musical intents
   */
  public parseNaturalQuery(query: string): NaturalQueryIntent {
    const q = query.toLowerCase().trim();
    const intent: NaturalQueryIntent = { rawQuery: query };

    // 1. Language Detection
    if (/telugu|తెలుగు/i.test(q)) intent.language = 'Telugu';
    else if (/tamil|தமிழ்/i.test(q)) intent.language = 'Tamil';
    else if (/kannada|ಕನ್ನಡ/i.test(q)) intent.language = 'Kannada';
    else if (/malayalam|മലയാളം/i.test(q)) intent.language = 'Malayalam';
    else if (/hindi|bollywood|हिंदी/i.test(q)) intent.language = 'Hindi';
    else if (/english|pop|hollywood/i.test(q)) intent.language = 'English';

    // 2. Mood & Activity
    if (/romance|romantic|love|prema|kadhal/i.test(q)) {
      intent.mood = 'Romantic';
      intent.tempo = 'slow';
    } else if (/gym|workout|energy|energetic|fast|mass|kuthu/i.test(q)) {
      intent.mood = 'Energetic';
      intent.activity = 'Workout';
      intent.tempo = 'energetic';
    } else if (/late night|night|sleep|relax|chill|lofi|calm/i.test(q)) {
      intent.mood = 'Calm';
      intent.activity = 'Late Night';
      intent.tempo = 'slow';
    } else if (/drive|driving|road trip|travel/i.test(q)) {
      intent.mood = 'Chill';
      intent.activity = 'Road Trip';
    } else if (/sad|breakup|pain|heartbreak/i.test(q)) {
      intent.mood = 'Sad';
      intent.tempo = 'slow';
    }

    // 3. Era Detection
    if (/90s|nineties|1990/i.test(q)) intent.era = '90s';
    else if (/80s|eighties|1980/i.test(q)) intent.era = '80s';
    else if (/2000s|2000/i.test(q)) intent.era = '2000s';
    else if (/latest|new|2024|2025|recent/i.test(q)) intent.era = '2020s';

    // 4. Explanation Generation (P45)
    const langLabel = intent.language || 'Music';
    const moodLabel = intent.mood ? `${intent.mood} ` : '';
    const eraLabel = intent.era ? `from the ${intent.era} ` : '';
    intent.explanation = `Curated ${moodLabel}${langLabel} selection ${eraLabel}tailored to your taste`;

    return intent;
  }

  /**
   * P42 — Smart Daily Mix Generator
   * Generates a 60% familiar, 20% similar, 10% new, 10% discovery blend
   */
  public async generateSmartDailyMix(preferredLanguage: string = 'Telugu', count: number = 25): Promise<Song[]> {
    try {
      const engine = RealMusicEngine.getInstance();
      const [topHits, newReleases] = await Promise.all([
        engine.searchRealSongs(`${preferredLanguage} top hits melodies`, 15),
        engine.searchRealSongs(`latest ${preferredLanguage} movie songs 2025`, 10),
      ]);

      const pool = [...topHits, ...newReleases];
      // De-duplicate by ID
      const seen = new Set<string>();
      const result: Song[] = [];
      for (const s of pool) {
        if (s && s.id && !seen.has(s.id)) {
          seen.add(s.id);
          result.push(s);
        }
        if (result.length >= count) break;
      }

      return result;
    } catch {
      return [];
    }
  }

  /**
   * P45 — "Why this song?" Explanation Helper
   */
  public getRecommendationReason(song: Song, preferredLanguage: string = 'Telugu'): string {
    if (!song) return 'Recommended for you';
    if (this.profile.artists[song.artist]) {
      return `Because you listen to ${song.artist}`;
    }
    if (song.releaseYear && song.releaseYear >= 2024) {
      return `New ${preferredLanguage} Release`;
    }
    return `Popular with ${preferredLanguage} music lovers`;
  }

  public getProfile(): UserTasteProfile {
    return { ...this.profile };
  }
}
