import { MusicProvider, ProviderCandidate, ProviderRegistry } from './ProviderRegistry';

const LOCAL_API_BASE = process.env.NEXT_PUBLIC_LOCAL_API_BASE || 'http://localhost:3001/api';

export class JioSaavnProvider implements MusicProvider {
  name = 'jiosaavn';
  isAvailable = true;

  private async fetchFromProxy(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${LOCAL_API_BASE}${endpoint}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      console.error(`JioSaavnProvider Error [${endpoint}]:`, e);
      return null;
    }
  }

  private mapToCandidate(song: any): ProviderCandidate {
    const primaryArtist = song.artists?.primary?.[0]?.name
      || song.artists?.all?.[0]?.name
      || 'Unknown Artist';

    return {
      id: song.id,
      title: song.name || song.title,
      artist: primaryArtist,
      album: song.album?.name || '',
      language: song.language || 'telugu',
      coverUrl: song.image?.[2]?.url || song.image?.[0]?.url || '',
      downloadUrl: song.downloadUrl,
      duration: song.duration,
      releaseDate: song.releaseDate || song.year,
      provider: this.name
    };
  }

  async search(query: string, limit = 15): Promise<ProviderCandidate[]> {
    const data = await this.fetchFromProxy(`/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`);
    if (!data?.success || !data?.data?.results) return [];

    return data.data.results.map((song: any) => this.mapToCandidate(song));
  }

  async getChart(chartName: string, language: string, limit = 20): Promise<ProviderCandidate[]> {
    // JioSaavn unofficial API doesn't always have reliable chart endpoints, 
    // so we map chart requests to search queries as an adapter pattern.
    return this.search(`Top ${language} Hits`, limit);
  }

  async getNewReleases(language: string, limit = 15): Promise<ProviderCandidate[]> {
    return this.search(`New ${language} Songs`, limit);
  }
}

// Auto-register
ProviderRegistry.getInstance().register(new JioSaavnProvider());
