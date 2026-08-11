import { Song } from '@/types/music';
import { PlaybackSource } from '@/lib/offline/types';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { NetworkManager } from '@/lib/offline/NetworkManager';
import { QualityManager } from '@/lib/playback/QualityManager';
import { RealMusicEngine } from '@/lib/realMusicEngine';
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

    // 1. Valid local download check
    const catalog = OfflineCatalog.getInstance();
    const isDownloaded = await catalog.isDownloaded(song.id);

    if (isDownloaded) {
      return {
        type: 'offline',
        localId: song.id,
      };
    }

    // 2. If forced offline and not downloaded, fail cleanly
    if (isOffline) {
      console.warn(`[PlaybackSourceResolver] Song unavailable offline: ${song.title}`);
      return null;
    }

    // Quality check
    const qualityDecision = await QualityManager.getInstance().getTargetQuality();
    usePlayerStore.getState().setDeliveredQuality(qualityDecision.target);

    // 3. Direct valid HTTPS audioUrl check
    let validAudioUrl = song.audioUrl ? song.audioUrl.replace('http://', 'https://') : '';
    const isPixabay = validAudioUrl.includes('pixabay.com');

    if (!validAudioUrl || isPixabay) {
      // Perform live dynamic JioSaavn stream lookup for the track
      try {
        const query = `${song.title} ${song.artist}`.trim();
        console.log(`[PlaybackSourceResolver] Resolving real JioSaavn audio URL for: "${query}"`);
        const realSongs = await RealMusicEngine.getInstance().searchRealSongs(query, 1);
        
        if (realSongs.length > 0 && realSongs[0].audioUrl && !realSongs[0].audioUrl.includes('pixabay.com')) {
          validAudioUrl = realSongs[0].audioUrl.replace('http://', 'https://');
          song.audioUrl = validAudioUrl;
          if (realSongs[0].coverUrl) {
            song.coverUrl = realSongs[0].coverUrl.replace('http://', 'https://');
          }
        }
      } catch (err) {
        console.warn(`[PlaybackSourceResolver] Failed live JioSaavn stream resolution for "${song.title}":`, err);
      }
    }

    if (validAudioUrl && !validAudioUrl.includes('pixabay.com')) {
      return {
        type: 'remote',
        url: validAudioUrl,
        videoId: song.id,
      };
    }

    return null;
  }
}
