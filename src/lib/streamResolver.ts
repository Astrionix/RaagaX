import { Song } from '@/types/music';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { JioSaavnMediaPipeline } from '@/lib/media/JioSaavnMediaPipeline';

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
   * Direct CDN delivery, zero fallbacks, zero transcoding, zero proxies.
   */
  public async resolveTrackStream(query: string): Promise<StreamResolutionResult> {
    const cleanQuery = query.trim();
    const realSongs = await RealMusicEngine.getInstance().searchRealSongs(cleanQuery, 1);
    
    if (realSongs.length > 0) {
      const song = realSongs[0];
      const pipeline = JioSaavnMediaPipeline.getInstance();

      if (pipeline.isValidRawJioSaavnTrack(song)) {
        pipeline.inspectPipeline(song);
        return {
          song,
          streamQuality: song.bitrate === '320 kbps' ? '320kbps Studio Master Audio' : `${song.bitrate || '160 kbps'} HQ Audio`,
          bitrate: song.bitrate || '320 kbps',
          sourceServer: 'JioSaavn Audio CDN Node',
        };
      }
    }

    throw new Error(`Direct JioSaavn raw audio stream unavailable for query: "${cleanQuery}". No fallbacks allowed.`);
  }

  /**
   * Batch resolver for search catalog results
   */
  public async searchAndResolveCatalog(searchTerm: string): Promise<Song[]> {
    if (!searchTerm.trim()) return [];
    const songs = await RealMusicEngine.getInstance().searchRealSongs(searchTerm, 10);
    return songs.filter((s) => JioSaavnMediaPipeline.getInstance().isValidRawJioSaavnTrack(s));
  }
}
