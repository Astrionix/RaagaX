import { Song } from '@/types/music';
import { useDownloadStore } from '@/context/useDownloadStore';
import { DownloadStorage } from './DownloadStorage';
import { OfflineCatalog } from './OfflineCatalog';

export interface SmartDownloadRuleContext {
  trigger: 'PLAYLIST_ADD' | 'FAVORITE_ADD' | 'FOLLOWED_PLAYLIST_UPDATE' | 'TOP_FREQUENT_CACHING';
  playlistId?: string;
  isFollowedPlaylist?: boolean;
}

/**
 * SmartDownloadEngine
 * Centralized evaluator for intelligent automatic download rules.
 * Evaluates triggers (Playlists, Favorites, Followed Playlists, Smart Cache) against
 * user preferences, device storage thresholds, and download limits before delegating
 * directly to the existing DownloadManager.
 */
export class SmartDownloadEngine {
  private static instance: SmartDownloadEngine;

  public static getInstance(): SmartDownloadEngine {
    if (!SmartDownloadEngine.instance) {
      SmartDownloadEngine.instance = new SmartDownloadEngine();
    }
    return SmartDownloadEngine.instance;
  }

  /**
   * Evaluates whether a track should be automatically downloaded based on active Smart Rules.
   */
  public async evaluateAndDownload(song: Song, context: SmartDownloadRuleContext): Promise<boolean> {
    if (!song || !song.id) return false;

    const { offlineSettings, saveForOffline } = useDownloadStore.getState();

    // Rule 1: Check trigger eligibility against user settings
    let isRuleEnabled = false;

    switch (context.trigger) {
      case 'PLAYLIST_ADD':
        isRuleEnabled = context.isFollowedPlaylist 
          ? !!offlineSettings.autoDownloadFollowedPlaylists 
          : !!offlineSettings.autoDownloadPlaylists;
        break;

      case 'FAVORITE_ADD':
        isRuleEnabled = !!offlineSettings.autoDownloadFavorites;
        break;

      case 'FOLLOWED_PLAYLIST_UPDATE':
        isRuleEnabled = !!offlineSettings.autoDownloadFollowedPlaylists;
        break;

      case 'TOP_FREQUENT_CACHING':
        isRuleEnabled = !!offlineSettings.smartDownloads;
        break;
    }

    if (!isRuleEnabled) return false;

    // Rule 2: Check if already downloaded locally (Prevent duplicates)
    const isAlreadyOffline = await OfflineCatalog.getInstance().isDownloaded(song.id);
    if (isAlreadyOffline) {
      return false; // Skip redundant download
    }

    // Rule 3: Check max automatic downloads cap (if configured)
    if (offlineSettings.maxAutoDownloadsCount && offlineSettings.maxAutoDownloadsCount > 0) {
      const allDownloaded = await OfflineCatalog.getInstance().getAllTracks();
      if (allDownloaded.length >= offlineSettings.maxAutoDownloadsCount) {
        console.log(`[SmartDownloadEngine] Max auto-downloads cap reached (${allDownloaded.length}/${offlineSettings.maxAutoDownloadsCount})`);
        return false;
      }
    }

    // Rule 4: Dynamic device storage threshold check
    const minFreeBytes = (offlineSettings.minStorageThresholdGB || 2) * 1024 * 1024 * 1024;
    const storageEstimate = await DownloadStorage.getInstance().getStorageEstimate();
    if (storageEstimate.available < minFreeBytes) {
      console.warn(`[SmartDownloadEngine] Insufficient device storage for smart download. Available: ${(storageEstimate.available / (1024*1024*1024)).toFixed(2)} GB, Required min threshold: ${offlineSettings.minStorageThresholdGB || 2} GB`);
      return false;
    }

    // Rule 5: Delegate to centralized DownloadManager via saveForOffline
    return await saveForOffline(song);
  }

  /**
   * Batch evaluate multiple tracks (e.g. for newly added songs in followed playlists)
   */
  public async evaluateBatch(songs: Song[], context: SmartDownloadRuleContext): Promise<number> {
    let queuedCount = 0;
    for (const song of songs) {
      const queued = await this.evaluateAndDownload(song, context);
      if (queued) queuedCount++;
    }
    return queuedCount;
  }
}
