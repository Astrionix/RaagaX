import { Song } from '@/types/music';
import { PlaybackSource } from '@/lib/offline/types';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { NetworkManager } from '@/lib/offline/NetworkManager';
import { QualityManager } from '@/lib/playback/QualityManager';
import { usePlayerStore } from '@/context/usePlayerStore';

export class PlaybackSourceResolver {
  private static instance: PlaybackSourceResolver;

  public static getInstance(): PlaybackSourceResolver {
    if (!PlaybackSourceResolver.instance) {
      PlaybackSourceResolver.instance = new PlaybackSourceResolver();
    }
    return PlaybackSourceResolver.instance;
  }

  public async resolvePlayableSource(song: Song): Promise<PlaybackSource | null> {
    if (!song || !song.id) {
      return null;
    }

    const networkMode = NetworkManager.getInstance().getMode();
    const isOfflineForced = networkMode === 'offline_forced';
    const isOffline = networkMode === 'offline' || isOfflineForced;

    // 1. Valid local download
    const catalog = OfflineCatalog.getInstance();
    const isDownloaded = await catalog.isDownloaded(song.id);

    if (isDownloaded) {
      return {
        type: 'offline',
        localId: song.id,
      };
    }

    // 2. If forced offline, fail here
    if (isOffline) {
      console.warn(`[PlaybackSourceResolver] Song unavailable offline: ${song.title}`);
      return null;
    }

    // 3. Fallback to network
    // Fetch video fallback if needed (e.g., if audioUrl is missing or we want to have video ready)
    let videoId: string | undefined = song.id;

    // Quality check
    const qualityDecision = await QualityManager.getInstance().getTargetQuality();
    usePlayerStore.getState().setDeliveredQuality(qualityDecision.target);

    if (song.audioUrl) {
      // Return the URL directly — JioSaavn URLs are pre-signed and cannot be
      // modified by string replacement. Quality selection happens at search time.
      return {
        type: 'remote',
        url: song.audioUrl,
        videoId: videoId,
      };
    }

    // 4. Missing remote URL
    if (videoId) {
       // We can fall back to playing YouTube audio if we don't have an audioUrl!
       return {
         type: 'remote',
         url: '',
         videoId: videoId
       };
    }

    return null;
  }
}
