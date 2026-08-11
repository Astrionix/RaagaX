export interface TasteProfile {
  topArtists: Map<string, number>;
  topLanguages: Map<string, number>;
  likedTracks: Set<string>;
  dislikedTracks: Set<string>;
}

export class TasteProfileManager {
  private static instance: TasteProfileManager;
  
  private profile: TasteProfile = {
    topArtists: new Map(),
    topLanguages: new Map(),
    likedTracks: new Set(),
    dislikedTracks: new Set()
  };

  public static getInstance(): TasteProfileManager {
    if (!TasteProfileManager.instance) {
      TasteProfileManager.instance = new TasteProfileManager();
      TasteProfileManager.instance.loadLocal();
    }
    return TasteProfileManager.instance;
  }

  private constructor() {}

  private loadLocal() {
    if (typeof window === 'undefined') return;
    try {
      const data = localStorage.getItem('raagax_taste_profile');
      if (data) {
        const parsed = JSON.parse(data);
        this.profile = {
          topArtists: new Map(Object.entries(parsed.topArtists || {})),
          topLanguages: new Map(Object.entries(parsed.topLanguages || {})),
          likedTracks: new Set(parsed.likedTracks || []),
          dislikedTracks: new Set(parsed.dislikedTracks || [])
        };
      }
    } catch (e) {
      console.error('Failed to load taste profile', e);
    }
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      const data = {
        topArtists: Object.fromEntries(this.profile.topArtists),
        topLanguages: Object.fromEntries(this.profile.topLanguages),
        likedTracks: Array.from(this.profile.likedTracks),
        dislikedTracks: Array.from(this.profile.dislikedTracks)
      };
      localStorage.setItem('raagax_taste_profile', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save taste profile', e);
    }
  }

  public recordPlay(artist: string, language: string, weight: number = 1.0) {
    if (artist) {
      const current = this.profile.topArtists.get(artist) || 0;
      this.profile.topArtists.set(artist, current + weight);
    }
    if (language) {
      const currentLang = this.profile.topLanguages.get(language) || 0;
      this.profile.topLanguages.set(language, currentLang + weight);
    }
    
    // Apply decay occasionally to prevent one-time binges from dominating forever
    if (Math.random() < 0.1) {
       this.applyDecay();
    }
    
    this.persist();
  }
  
  private applyDecay() {
     const decayFactor = 0.95;
     for (const [key, val] of this.profile.topArtists.entries()) {
         this.profile.topArtists.set(key, val * decayFactor);
     }
  }

  public recordSkip(artist: string) {
    if (artist) {
      const current = this.profile.topArtists.get(artist) || 0;
      this.profile.topArtists.set(artist, Math.max(0, current - 0.5));
      this.persist();
    }
  }
  
  public getProfile(): TasteProfile {
    return this.profile;
  }
}
