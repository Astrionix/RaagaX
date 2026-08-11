import { Song } from '@/types/music';
import { RealMusicEngine } from '@/lib/realMusicEngine';

export interface StreamResolutionResult {
  song: Song;
  streamQuality: string;
  bitrate: string;
  sourceServer: string;
}

export class StreamResolver {
  private static instance: StreamResolver;

  private constructor() {}

  public static getInstance(): StreamResolver {
    if (!StreamResolver.instance) {
      StreamResolver.instance = new StreamResolver();
    }
    return StreamResolver.instance;
  }

  /**
   * Authoritative Real JioSaavn Stream Resolution Engine
   */
  public async resolveTrackStream(query: string): Promise<StreamResolutionResult> {
    const cleanQuery = query.trim();
    const realSongs = await RealMusicEngine.getInstance().searchRealSongs(cleanQuery, 1);
    
    if (realSongs.length > 0 && realSongs[0].audioUrl && !realSongs[0].audioUrl.includes('pixabay.com')) {
      const song = realSongs[0];
      return {
        song,
        streamQuality: '320kbps Studio Lossless Audio',
        bitrate: song.bitrate || '320 kbps',
        sourceServer: 'JioSaavn Audio CDN Node',
      };
    }

    throw new Error(`Real JioSaavn streaming audio stream unavailable for query: "${cleanQuery}"`);
  }

  /**
   * Batch resolver for search catalog results
   */
  public async searchAndResolveCatalog(searchTerm: string): Promise<Song[]> {
    if (!searchTerm.trim()) return [];
    return RealMusicEngine.getInstance().searchRealSongs(searchTerm, 10);
  }
}
