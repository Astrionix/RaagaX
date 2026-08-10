import { Song } from '@/types/music';
import { getCachedAudioUrl } from '@/lib/downloadHelper';
import { useDownloadStore } from '@/context/useDownloadStore';
import { OfflineEntitlementEngine } from '@/lib/offlineEntitlementEngine';

export type PlaybackSource =
  | { type: 'offline'; uri: string; trackId: string; quality: string }
  | { type: 'network'; uri: string; trackId: string; quality: string }
  | { type: 'unavailable'; trackId: string; reason: string };

export class PlaybackSourceResolver {
  private static instance: PlaybackSourceResolver;

  public static getInstance(): PlaybackSourceResolver {
    if (!PlaybackSourceResolver.instance) {
      PlaybackSourceResolver.instance = new PlaybackSourceResolver();
    }
    return PlaybackSourceResolver.instance;
  }

  /**
   * Resolves the playable audio source for a song based on device storage, entitlement status,
   * and offline mode settings.
   */
  public async resolvePlayableSource(song: Song): Promise<PlaybackSource> {
    if (!song || !song.id) {
      return { type: 'unavailable', trackId: '', reason: 'Invalid track data' };
    }

    const downloadState = useDownloadStore.getState();
    const isOfflineMode = downloadState.isOfflineMode;

    // Check if the song has an authorized offline copy saved locally
    const cachedUrl = song.audioUrl ? await getCachedAudioUrl(song.audioUrl) : null;

    if (cachedUrl) {
      // Verify entitlement authorization
      const isEntitled = await OfflineEntitlementEngine.getInstance().isEntitlementValid();
      if (isEntitled) {
        return {
          type: 'offline',
          uri: cachedUrl,
          trackId: song.id,
          quality: downloadState.offlineSettings.audioQuality || 'High'
        };
      } else {
        console.warn(`[PlaybackSourceResolver] Offline entitlement expired for ${song.title}`);
      }
    }

    // If device is in explicit Offline Mode and no valid local copy exists
    if (isOfflineMode || (typeof window !== 'undefined' && !window.navigator.onLine)) {
      return {
        type: 'unavailable',
        trackId: song.id,
        reason: 'Song unavailable in Offline Mode'
      };
    }

    // Fallback to Network Source
    if (song.audioUrl) {
      return {
        type: 'network',
        uri: song.audioUrl,
        trackId: song.id,
        quality: downloadState.offlineSettings.audioQuality || 'High'
      };
    }

    return {
      type: 'unavailable',
      trackId: song.id,
      reason: 'No streaming audio URL available'
    };
  }
}
