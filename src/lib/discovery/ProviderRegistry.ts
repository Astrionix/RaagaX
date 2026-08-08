import { Song } from '@/types/music';

export interface ProviderCandidate {
  id: string; // The provider's internal ID
  title: string;
  artist: string;
  album: string;
  language: string;
  coverUrl: string;
  downloadUrl?: { quality: string; url: string }[];
  duration?: number | string;
  releaseDate?: string;
  provider: string; // e.g., 'jiosaavn'
}

export interface MusicProvider {
  name: string;
  isAvailable: boolean;

  search(query: string, limit?: number): Promise<ProviderCandidate[]>;
  getChart(chartName: string, language: string, limit?: number): Promise<ProviderCandidate[]>;
  getNewReleases(language: string, limit?: number): Promise<ProviderCandidate[]>;
}

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, MusicProvider> = new Map();

  private constructor() {}

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  public register(provider: MusicProvider) {
    this.providers.set(provider.name, provider);
  }

  public getProvider(name: string): MusicProvider | undefined {
    return this.providers.get(name);
  }

  public getAllProviders(): MusicProvider[] {
    return Array.from(this.providers.values()).filter(p => p.isAvailable);
  }
}
