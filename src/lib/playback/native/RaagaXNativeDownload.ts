/**
 * RaagaXNativeDownload
 *
 * TypeScript adapter for the native Android RaagaXDownload Capacitor plugin.
 * Manages native MP3 file downloads directly to Android's "Music/RaagaX/" folder
 * with ID3v2.3 tagging, MediaScanner indexing, and physical file verification.
 */

import { Song } from '@/types/music';

const IS_CAPACITOR_NATIVE =
  typeof window !== 'undefined' &&
  (window as any).Capacitor &&
  typeof (window as any).Capacitor.isNativePlatform === 'function' &&
  (window as any).Capacitor.isNativePlatform();

function getPlugin() {
  if (!IS_CAPACITOR_NATIVE) return null;
  const cap = (window as any).Capacitor;
  return cap?.Plugins?.RaagaXDownload ?? null;
}

export interface NativeDownloadItem {
  songId: string;
  id?: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  coverUrl?: string;
  audioUrl?: string;
  streamUrl?: string;
  quality?: string;
  duration?: number;
  source?: string;
  playlistId?: string;
}

export interface NativeDownloadedTrack {
  songId: string;
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  coverUrl: string;
  localPath: string;
  fileName: string;
  fileSize: number;
  quality: string;
  mimeType: string;
  downloadState: string;
  completedAt: number;
}

export interface NativeStorageCheckResult {
  hasSpace: boolean;
  availableBytes: number;
  totalBytes: number;
  requiredBytes: number;
  musicFolderPath: string;
  songsFolderPath?: string;
  artworkFolderPath?: string;
}

export interface NativeDownloadProgressEvent {
  trackId: string;
  songId: string;
  state: 'QUEUED' | 'DOWNLOADING' | 'VERIFYING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  error?: string;
}

export interface NativeActiveDownload {
  songId: string;
  trackId: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  coverUrl: string;
  quality: string;
  downloadState: 'QUEUED' | 'DOWNLOADING' | 'VERIFYING' | 'PAUSED' | 'FAILED';
  downloadProgress: number;
  downloadedBytes: number;
}

export interface NativeDownloadCompletedEvent {
  trackId: string;
  songId: string;
  localPath: string;
  fileName: string;
  fileSize: number;
  quality: string;
  title: string;
  artist: string;
}

export const RaagaXNativeDownload = {
  isNative(): boolean {
    return IS_CAPACITOR_NATIVE && getPlugin() !== null;
  },

  async downloadTrack(item: NativeDownloadItem): Promise<boolean> {
    const plugin = getPlugin();
    if (!plugin) return false;
    try {
      const res = await plugin.downloadTrack({
        songId: item.songId || item.id,
        title: item.title,
        artist: item.artist,
        album: item.album || 'RaagaX Music',
        artworkUrl: item.artworkUrl || item.coverUrl || '',
        streamUrl: item.streamUrl || item.audioUrl || '',
        quality: item.quality || '320 kbps',
        duration: item.duration || 180,
      });
      return Boolean(res?.success);
    } catch (e) {
      console.error('[RaagaXNativeDownload] downloadTrack error:', e);
      throw e;
    }
  },

  async downloadPlaylist(songs: Song[], quality: string = '320 kbps'): Promise<number> {
    const plugin = getPlugin();
    if (!plugin || !songs || songs.length === 0) return 0;
    try {
      const payload = songs.map((s) => ({
        id: s.id,
        songId: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album || 'RaagaX Music',
        coverUrl: s.coverUrl || '',
        audioUrl: s.audioUrl || '',
        duration: s.duration || 180,
      }));

      const res = await plugin.downloadPlaylist({
        songs: payload,
        quality,
      });
      return res?.queuedCount || 0;
    } catch (e) {
      console.error('[RaagaXNativeDownload] downloadPlaylist error:', e);
      throw e;
    }
  },

  async pauseDownload(songId: string): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.pauseDownload({ songId });
  },

  async resumeDownload(songId: string): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.resumeDownload({ songId });
  },

  async cancelDownload(songId: string): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.cancelDownload({ songId });
  },

  async pauseAll(): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.pauseAll();
  },

  async resumeAll(): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.resumeAll();
  },

  async cancelAll(): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.cancelAll();
  },

  async removeDownload(songId: string): Promise<boolean> {
    const plugin = getPlugin();
    if (!plugin) return false;
    try {
      const res = await plugin.removeDownload({ songId });
      return Boolean(res?.success);
    } catch (e) {
      console.error('[RaagaXNativeDownload] removeDownload error:', e);
      return false;
    }
  },

  async getDownloadedTracks(): Promise<NativeDownloadedTrack[]> {
    const plugin = getPlugin();
    if (!plugin) return [];
    try {
      const res = await plugin.getDownloadedTracks();
      return res?.tracks || [];
    } catch (e) {
      console.error('[RaagaXNativeDownload] getDownloadedTracks error:', e);
      return [];
    }
  },

  /**
   * Returns all currently active (QUEUED, DOWNLOADING, VERIFYING, PAUSED, FAILED) entries
   * from the Android Room DB. Used by useDownloadStore.syncNativeQueueState() to reconcile
   * JS task state after hydration, navigation, or when broadcasts were missed.
   */
  async getActiveDownloads(): Promise<NativeActiveDownload[]> {
    const plugin = getPlugin();
    if (!plugin) return [];
    try {
      const res = await plugin.getActiveDownloads();
      return res?.downloads || [];
    } catch (e) {
      console.error('[RaagaXNativeDownload] getActiveDownloads error:', e);
      return [];
    }
  },

  async checkStorage(requiredBytes: number = 15 * 1024 * 1024): Promise<NativeStorageCheckResult> {
    const plugin = getPlugin();
    if (!plugin) {
      return {
        hasSpace: true,
        availableBytes: 64 * 1024 * 1024 * 1024,
        totalBytes: 128 * 1024 * 1024 * 1024,
        requiredBytes,
        musicFolderPath: 'Music/RaagaX',
      };
    }
    try {
      const res = await plugin.checkStorage({ requiredBytes });
      return {
        hasSpace: res?.hasSpace ?? true,
        availableBytes: res?.availableBytes ?? (64 * 1024 * 1024 * 1024),
        totalBytes: res?.totalBytes ?? (128 * 1024 * 1024 * 1024),
        requiredBytes: res?.requiredBytes ?? requiredBytes,
        musicFolderPath: res?.musicFolderPath ?? 'Music/RaagaX',
      };
    } catch {
      return {
        hasSpace: true,
        availableBytes: 64 * 1024 * 1024 * 1024,
        totalBytes: 128 * 1024 * 1024 * 1024,
        requiredBytes,
        musicFolderPath: 'Music/RaagaX',
      };
    }
  },

  async verifyAndSyncLibrary(): Promise<string[]> {
    const plugin = getPlugin();
    if (!plugin) return [];
    try {
      const res = await plugin.verifyAndSyncLibrary();
      return res?.verifiedSongIds || [];
    } catch (e) {
      console.error('[RaagaXNativeDownload] verifyAndSyncLibrary error:', e);
      return [];
    }
  },

  async shareSongFile(songId: string): Promise<boolean> {
    const plugin = getPlugin();
    if (!plugin) return false;
    try {
      const res = await plugin.shareSongFile({ songId });
      return Boolean(res?.success);
    } catch (e) {
      console.error('[RaagaXNativeDownload] shareSongFile error:', e);
      return false;
    }
  },

  async getPreference<T = any>(key: string, defaultValue?: T): Promise<T> {
    const plugin = getPlugin();
    if (!plugin) return defaultValue as T;
    try {
      const res = await plugin.getPreference({ key, defaultValue });
      return res?.exists ? (res.value as T) : (defaultValue as T);
    } catch {
      return defaultValue as T;
    }
  },

  async setPreference(key: string, value: any): Promise<boolean> {
    const plugin = getPlugin();
    if (!plugin) return false;
    try {
      const res = await plugin.setPreference({ key, value });
      return Boolean(res?.success);
    } catch {
      return false;
    }
  },

  async setWifiOnly(wifiOnly: boolean): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    try {
      await plugin.setWifiOnly({ wifiOnly });
    } catch (e) {
      console.warn('[RaagaXNativeDownload] setWifiOnly error:', e);
    }
  },

  addDownloadProgressListener(callback: (event: NativeDownloadProgressEvent) => void): () => void {
    const plugin = getPlugin();
    if (!plugin) return () => {};
    const handle = plugin.addListener('downloadProgress', callback);
    return () => {
      handle.then((h: any) => h.remove?.());
    };
  },

  addDownloadCompletedListener(callback: (event: NativeDownloadCompletedEvent) => void): () => void {
    const plugin = getPlugin();
    if (!plugin) return () => {};
    const handle = plugin.addListener('downloadCompleted', callback);
    return () => {
      handle.then((h: any) => h.remove?.());
    };
  },
};
