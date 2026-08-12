import { QueueItem } from './types';
import { Song } from '@/types/music';

export class CooldownManager {
  private static instance: CooldownManager;

  private constructor() {}

  public static getInstance(): CooldownManager {
    if (!CooldownManager.instance) {
      CooldownManager.instance = new CooldownManager();
    }
    return CooldownManager.instance;
  }

  /**
   * Enforces controlled diversity by checking if an artist appeared in the recent N items.
   * Default minimum distance: 3 tracks.
   */
  public isArtistInCooldown(artistName: string, recentQueueItems: QueueItem[], minSpacing: number = 3): boolean {
    if (!artistName || recentQueueItems.length === 0) return false;
    const recentSlices = recentQueueItems.slice(-minSpacing);
    return recentSlices.some(item => item?.song?.artist && item.song.artist.toLowerCase() === artistName.toLowerCase());
  }

  /**
   * Prevents consecutive album dumping in discovery modes.
   */
  public isAlbumInCooldown(albumName: string, recentQueueItems: QueueItem[], minSpacing: number = 2): boolean {
    if (!albumName || recentQueueItems.length === 0) return false;
    const recentSlices = recentQueueItems.slice(-minSpacing);
    return recentSlices.some(item => item?.song?.album && item.song.album.toLowerCase() === albumName.toLowerCase());
  }

  /**
   * Filters candidate list to enforce cooldowns for seamless curated feel.
   */
  public filterWithCooldowns(candidates: Song[], recentQueueItems: QueueItem[]): Song[] {
    return candidates.filter(song => {
      if (song.artist && this.isArtistInCooldown(song.artist, recentQueueItems, 3)) {
        return false;
      }
      if (song.album && this.isAlbumInCooldown(song.album, recentQueueItems, 2)) {
        return false;
      }
      return true;
    });
  }
}
