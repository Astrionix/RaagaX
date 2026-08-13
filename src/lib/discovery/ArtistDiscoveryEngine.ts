import { JioSaavnProvider } from '@/lib/jioSaavnProvider';
import { Artist, Song, Album } from '@/types/music';
import fs from 'fs';
import path from 'path';

// Seed lists for initial artist discovery
const TOP_ARTISTS_BY_LANGUAGE: Record<string, string[]> = {
  Telugu: [
    'A.R. Rahman', 'Thaman S', 'Devi Sri Prasad', 'Anirudh Ravichander',
    'G.V. Prakash Kumar', 'Mickey J. Meyer', 'M. M. Keeravani', 'Anup Rubens',
    'Hesham Abdul Wahab', 'Ram Miriyala', 'Sid Sriram'
  ],
  Kannada: [
    'Arjun Janya', 'Raghu Dixit', 'Charan Raj', 'V. Harikrishna',
    'B. Ajaneesh Loknath', 'Ravi Basrur', 'Sanjith Hegde', 'Vijay Prakash'
  ],
  Tamil: [
    'Anirudh Ravichander', 'A.R. Rahman', 'Yuvan Shankar Raja',
    'Santhosh Narayanan', 'Harris Jayaraj', 'G.V. Prakash Kumar', 'Ilayaraja'
  ],
  Hindi: [
    'Arijit Singh', 'A.R. Rahman', 'Pritam', 'Vishal-Shekhar',
    'Mithoon', 'Sachin-Jigar', 'Shreya Ghoshal', 'Amit Trivedi'
  ],
  Malayalam: [
    'Gopi Sundar', 'Shaan Rahman', 'Hesham Abdul Wahab', 'Sushin Shyam',
    'Deepak Dev', 'Rex Vijayan', 'M. Jayachandran', 'Vidyasagar'
  ],
  English: [
    'The Weeknd', 'Taylor Swift', 'Ed Sheeran', 'Dua Lipa',
    'Billie Eilish', 'Drake', 'Post Malone', 'Harry Styles'
  ]
};

// Simple in-memory cache for the server
const artistCache = new Map<string, any[]>();
const artistDetailCache = new Map<string, any>();

export class ArtistDiscoveryEngine {
  private static instance: ArtistDiscoveryEngine;
  private provider: JioSaavnProvider;
  private cacheFilePath: string;

  private constructor() {
    this.provider = JioSaavnProvider.getInstance();
    this.cacheFilePath = path.join(process.cwd(), 'src', 'lib', 'cached_artists.json');
    this.loadCacheFromFile();
  }

  private loadCacheFromFile() {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const data = fs.readFileSync(this.cacheFilePath, 'utf-8');
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          for (const [key, value] of Object.entries(parsed)) {
            artistCache.set(key, value as any[]);
          }
        }
      }
    } catch (e) {
      console.error('Error loading artist cache from file:', e);
    }
  }

  private saveCacheToFile() {
    try {
      const obj = Object.fromEntries(artistCache);
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving artist cache to file:', e);
    }
  }

  public static getInstance(): ArtistDiscoveryEngine {
    if (!ArtistDiscoveryEngine.instance) {
      ArtistDiscoveryEngine.instance = new ArtistDiscoveryEngine();
    }
    return ArtistDiscoveryEngine.instance;
  }

  /**
   * Discovers and verifies artists for a given language.
   * Uses caching to ensure fast responses.
   */
  public async getArtistsForLanguage(language: string, limit = 8): Promise<any[]> {
    if (artistCache.has(language)) {
      const cached = artistCache.get(language);
      if (cached && cached.length >= 5) {
        return cached.slice(0, limit);
      }
    }

    const seeds = TOP_ARTISTS_BY_LANGUAGE[language] || TOP_ARTISTS_BY_LANGUAGE['Hindi'];
    const verifiedArtists: any[] = [];
    const seenIds = new Set<string>();

    for (const seedName of seeds) {
      if (verifiedArtists.length >= limit) break;

      try {
        const searchResults = await this.provider.searchArtists(seedName, 3);
        if (!searchResults || searchResults.length === 0) continue;

        // Try to verify the first good match
        for (const candidate of searchResults) {
          if (seenIds.has(candidate.id)) continue;
          
          const details = await this.provider.getArtistDetails(candidate.id, 10, 10);
          if (!details) continue;

          // Verification logic:
          // Must have albums and songs
          const topSongs = details.topSongs || [];
          const topAlbums = details.topAlbums || [];

          if (topSongs.length > 0 && topAlbums.length > 0) {
            // Verified!
            const artistObj = {
              id: details.id,
              name: details.name,
              imageUrl: this.getBestImageUrl(details.image),
              language: language,
              followerCount: details.followerCount || 0,
              isVerified: details.isVerified || false,
              bio: this.extractBio(details.bio),
              topSongs: this.mapSaavnSongs(topSongs),
              topAlbums: this.mapSaavnAlbums(topAlbums)
            };

            verifiedArtists.push(artistObj);
            seenIds.add(details.id);
            artistDetailCache.set(details.id, artistObj); // Cache for detail view
            break; // Move to next seed
          }
        }
      } catch (e) {
        console.error(`Error verifying artist ${seedName}:`, e);
      }
    }

    if (verifiedArtists.length > 0) {
      artistCache.set(language, verifiedArtists);
      this.saveCacheToFile();
    }
    
    return verifiedArtists;
  }

  public async getArtistById(artistId: string): Promise<any | null> {
    if (artistDetailCache.has(artistId)) {
      return artistDetailCache.get(artistId);
    }

    try {
      const details = await this.provider.getArtistDetails(artistId, 20, 20);
      if (details) {
        const artistObj = {
          id: details.id,
          name: details.name,
          imageUrl: this.getBestImageUrl(details.image),
          followerCount: details.followerCount || 0,
          isVerified: details.isVerified || false,
          bio: this.extractBio(details.bio),
          topSongs: this.mapSaavnSongs(details.topSongs || []),
          topAlbums: this.mapSaavnAlbums(details.topAlbums || [])
        };
        artistDetailCache.set(artistId, artistObj);
        return artistObj;
      }
    } catch (e) {
      console.error(`Error fetching artist ${artistId}:`, e);
    }
    
    return null;
  }

  private getBestImageUrl(imageArray: any[] | string): string {
    if (typeof imageArray === 'string') return imageArray.replace('http://', 'https://');
    if (Array.isArray(imageArray) && imageArray.length > 0) {
      const best = imageArray.find(i => i.quality === '500x500') || imageArray[imageArray.length - 1];
      return best?.url ? best.url.replace('http://', 'https://') : '';
    }
    return '/app-icon.png';
  }

  private extractBio(bioArray: any[]): string {
    if (!Array.isArray(bioArray) || bioArray.length === 0) return '';
    const intro = bioArray.find(b => b.title === 'Introduction' || b.sequence === 1);
    return intro ? intro.text : bioArray[0].text;
  }

  private mapSaavnSongs(tracks: any[]): Song[] {
    return tracks.map((track, idx) => {
      // Basic mapping, assuming jioSaavnProvider logic
      const title = track.name || track.title || 'Unknown';
      const artist = track.primaryArtists || 'Unknown Artist';
      let coverUrl = '/app-icon.png';
      if (Array.isArray(track.image)) {
        const hi = track.image.find((i: any) => i.quality === '500x500') || track.image[track.image.length - 1];
        if (hi?.url) coverUrl = hi.url.replace('http://', 'https://');
      }

      let audioUrl = '';
      if (Array.isArray(track.downloadUrl)) {
        const best = track.downloadUrl.find((a: any) => a.quality === '320kbps') || track.downloadUrl[track.downloadUrl.length - 1];
        if (best?.url) audioUrl = best.url;
      }

      return {
        id: track.id,
        title,
        artist,
        artistId: track.primaryArtistsId || '',
        album: track.album?.name || '',
        albumId: track.album?.id || '',
        duration: parseInt(track.duration) || 210,
        coverUrl,
        audioUrl,
        genre: track.language ? `${track.language.toUpperCase()} HITS` : 'HITS',
        category: 'latest_telugu' as const,
        releaseYear: parseInt(track.year) || new Date().getFullYear(),
        plays: 0,
        likes: 0,
        audioQuality: '24-bit FLAC' as const,
      } as Song;
    });
  }

  private mapSaavnAlbums(albums: any[]): Album[] {
    return albums.map(album => {
      let coverUrl = '/app-icon.png';
      if (Array.isArray(album.image)) {
        const hi = album.image.find((i: any) => i.quality === '500x500') || album.image[album.image.length - 1];
        if (hi?.url) coverUrl = hi.url.replace('http://', 'https://');
      }

      return {
        id: album.id,
        title: album.name || album.title || 'Unknown Album',
        artist: album.primaryArtists || '',
        artistId: '',
        coverUrl,
        releaseYear: parseInt(album.year) || new Date().getFullYear(),
        songIds: [],
        genre: album.language ? album.language.toUpperCase() : 'MUSIC',
        totalDuration: 0,
        trackCount: parseInt(album.songCount) || 0
      } as any;
    });
  }
}
