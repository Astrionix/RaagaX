import { create } from 'zustand';
import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { LocalDatabase } from '@/lib/localDatabase';
import { DownloadManager } from '@/lib/offline/DownloadManager';
import { DownloadStorage } from '@/lib/offline/DownloadStorage';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { AtomicDownloader } from '@/lib/offline/AtomicDownloader';
import { DownloadMode, DownloadQuality, StorageEstimateInfo } from '@/lib/offline/types';
import { exportSongToDevice } from '@/lib/downloadHelper';
import { getApiUrl } from '@/lib/config/apiConfig';
import { RaagaXNativeDownload, NativeDownloadedTrack } from '@/lib/playback/native/RaagaXNativeDownload';


export type DownloadStatus = 
  | 'NOT_DOWNLOADED' 
  | 'QUEUED' 
  | 'DOWNLOADING' 
  | 'VERIFYING' 
  | 'PAUSED' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'CANCELLED';

export interface DownloadTask {
  song: Song;
  mode: DownloadMode;
  quality: string; // e.g. '320 kbps' | '192 kbps' | '128 kbps'
  status: DownloadStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  retryCount: number;
  checksum?: string;
  error?: string;
  abortController?: AbortController;
  playlistId?: string;
}

export interface PlaylistDownloadProgress {
  playlistId: string;
  playlistTitle: string;
  totalSongs: number;
  completedSongs: number;
  currentSongTitle: string;
  overallProgress: number;
  status: 'IDLE' | 'DOWNLOADING' | 'PAUSED' | 'COMPLETED';
}

export interface ExportState {
  status: 'REQUESTING' | 'DOWNLOADING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  error?: string;
}

interface DownloadStore {
  tasks: Record<string, DownloadTask>;
  exportStates: Record<string, ExportState>;
  storageInfo: StorageEstimateInfo | null;
  nativeDownloadedTracks: Record<string, NativeDownloadedTrack>;
  playlistDownloadProgress: PlaylistDownloadProgress | null;
  activeCount: number;
  maxConcurrent: number;
  wifiOnly: boolean;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  fetchStorageInfo: () => Promise<StorageEstimateInfo>;
  saveForOffline: (song: Song, quality?: string) => Promise<boolean>;
  queueDownload: (song: Song, mode?: DownloadMode, quality?: string) => void;
  retryDownload: (songId: string) => void;
  exportSong: (song: Song) => Promise<boolean>;
  pauseDownload: (songId: string) => void;
  resumeDownload: (songId: string) => void;
  cancelDownload: (songId: string) => void;
  removeDownload: (songId: string) => Promise<void>;
  downloadPlaylist: (songs: Song[], quality?: string, playlistTitle?: string, playlistId?: string) => void;
  pauseAll: () => void;
  resumeAll: () => void;
  cancelAll: () => void;
  clearStreamingCache: () => Promise<void>;
  purgeOfflineDownloads: () => Promise<void>;
  shareSongFile: (songId: string) => Promise<boolean>;

  setWifiOnly: (wifiOnly: boolean) => void;

  updateProgress: (songId: string, progress: number, downloadedBytes: number, totalBytes: number, speed?: number, eta?: number) => void;
  setStatus: (songId: string, status: DownloadStatus, error?: string) => void;
  
  isOfflineStorageEnabled: boolean;
  setOfflineStorageEnabled: (enabled: boolean) => void;
  
  isSetupModalOpen: boolean;
  setSetupModalOpen: (open: boolean) => void;
  
  isOfflineMode: boolean;
  setOfflineMode: (enabled: boolean) => void;

  offlineSettings: {
    audioQuality: '128 kbps' | '192 kbps' | '320 kbps' | 'High' | 'Standard' | 'Lossless';
    autoDeleteTemp: boolean;
    smartDownloads: boolean;
    autoDownloadPlaylists: boolean;
    autoDownloadFavorites: boolean;
    autoDownloadFollowedPlaylists: boolean;
    maxAutoDownloadsCount: number; // 0 = unlimited
    minStorageThresholdGB: number; // minimum free device storage in GB required
  };
  setOfflineSettings: (settings: Partial<DownloadStore['offlineSettings']>) => void;
  setMaxConcurrent: (count: number) => void;

  getSongDownloadStatus: (songId: string) => DownloadStatus;
  getSongDownloadInfo: (songId: string) => {
    status: DownloadStatus;
    progress: number;
    downloadedBytes: number;
    totalBytes: number;
    speedBytesPerSec?: number;
    etaSeconds?: number;
    error?: string;
    localPath?: string;
  };

  /** Apple Music-style album download status aggregation */
  getAlbumDownloadStatus: (songIds: string[]) => 'NONE' | 'PARTIAL' | 'ALL';
  /** Queues all tracks in an album for download, respecting maxConcurrent */
  downloadAlbum: (albumId: string, songs: Song[], quality?: string) => void;

  _processQueue: () => void;
  _persistTasks: () => void;
  syncDownloadedIds: () => Promise<void>;
  verifyPhysicalFiles: () => Promise<void>;
  /**
   * syncNativeQueueState — polls Android Room DB for active downloads and reconciles
   * the JS task map. Fixes tasks that are stuck in QUEUED due to missed broadcasts
   * (timing races, navigation, or hydration ordering).
   */
  syncNativeQueueState: () => Promise<void>;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  tasks: {},
  exportStates: {},
  storageInfo: null,
  nativeDownloadedTracks: {},
  playlistDownloadProgress: null,
  activeCount: 0,
  maxConcurrent: 2,
  wifiOnly: false,
  isHydrated: false,
  isOfflineStorageEnabled: true,
  isSetupModalOpen: false,
  isOfflineMode: false,
  offlineSettings: {
    audioQuality: '320 kbps',
    autoDeleteTemp: false,
    smartDownloads: false,
    autoDownloadPlaylists: false,
    autoDownloadFavorites: false,
    autoDownloadFollowedPlaylists: false,
    maxAutoDownloadsCount: 0,
    minStorageThresholdGB: 2,
  },

  setOfflineStorageEnabled: (enabled) => { set({ isOfflineStorageEnabled: enabled }); get()._persistTasks(); },
  setSetupModalOpen: (open) => set({ isSetupModalOpen: open }),
  setOfflineMode: (enabled) => { 
    set({ isOfflineMode: enabled }); 
    usePlayerStore.getState().setNetworkMode(enabled ? 'offline_forced' : 'online');
    get()._persistTasks(); 
  },
  setOfflineSettings: (settings) => { set((state) => ({ offlineSettings: { ...state.offlineSettings, ...settings } })); get()._persistTasks(); },
  setMaxConcurrent: (count) => {
    set({ maxConcurrent: count });
  },

  fetchStorageInfo: async () => {
    try {
      if (RaagaXNativeDownload.isNative()) {
        const nativeStorage = await RaagaXNativeDownload.checkStorage(15 * 1024 * 1024);
        const allTracks = await RaagaXNativeDownload.getDownloadedTracks();
        const downloadsSize = allTracks.reduce((sum, t) => sum + (t.fileSize || 0), 0);

        const info: StorageEstimateInfo = {
          quota: nativeStorage.totalBytes,
          usage: nativeStorage.totalBytes - nativeStorage.availableBytes,
          available: nativeStorage.availableBytes,
          raagaXUsed: downloadsSize,
          raagaXDownloads: downloadsSize,
          raagaXCache: 12 * 1024 * 1024,
          raagaXSongCount: allTracks.length,
          percentUsed: nativeStorage.totalBytes > 0 ? Math.round(((nativeStorage.totalBytes - nativeStorage.availableBytes) / nativeStorage.totalBytes) * 100) : 0,
          isNative: true,
          storageType: 'device',
          deviceName: 'Android Device (Music/RaagaX)',
          deviceType: 'mobile',
          platform: 'Android',
        };
        set({ storageInfo: info });
        return info;
      }

      const info = await DownloadStorage.getInstance().getStorageEstimate();
      set({ storageInfo: info });
      return info;
    } catch (e) {
      const fallback: StorageEstimateInfo = {
        quota: 64 * 1024 * 1024 * 1024,
        usage: 0,
        available: 64 * 1024 * 1024 * 1024,
        raagaXUsed: 0,
        raagaXDownloads: 0,
        raagaXCache: 0,
        raagaXSongCount: 0,
        percentUsed: 0,
        isNative: false,
        storageType: 'browser',
        deviceName: 'Current Device',
        deviceType: 'desktop',
        platform: 'Web',
      };
      set({ storageInfo: fallback });
      return fallback;
    }
  },

  /**
   * Anti-Stale Sync: Verifies that physical MP3 files actually exist on disk in Music/RaagaX/.
   * If a user deleted a file externally, removes it from downloadedSongIds so no broken entries remain.
   */
  verifyPhysicalFiles: async () => {
    try {
      if (RaagaXNativeDownload.isNative()) {
        const verifiedIds = await RaagaXNativeDownload.verifyAndSyncLibrary();
        const nativeTracks = await RaagaXNativeDownload.getDownloadedTracks();
        const trackMap: Record<string, NativeDownloadedTrack> = {};
        nativeTracks.forEach(t => { trackMap[t.songId] = t; });

        set({ nativeDownloadedTracks: trackMap });
        usePlayerStore.setState({ downloadedSongIds: verifiedIds });
        await get().fetchStorageInfo();
        return;
      }

      // Web/PWA verification
      const catalog = OfflineCatalog.getInstance();
      const allTracks = await catalog.getAllTracks();
      const ids = allTracks.map(t => t.trackId);
      usePlayerStore.setState({ downloadedSongIds: ids });
      await get().fetchStorageInfo();
    } catch (e) {
      console.warn('[useDownloadStore] verifyPhysicalFiles error:', e);
    }
  },

  syncDownloadedIds: async () => {
    await get().verifyPhysicalFiles();
  },

  /**
   * syncNativeQueueState — polls Android Room DB for all active (non-COMPLETED) downloads
   * and overlays the real state onto the JS task map.
   *
   * This is the definitive fix for Root Causes 1, 2, and 5:
   *   - Ensures tasks that received no broadcasts (timing race) are corrected.
   *   - Creates placeholder tasks for songs whose broadcasts arrived before JS listeners.
   *   - Corrects DOWNLOADING tasks that were wrongly reset to PAUSED on restart.
   */
  syncNativeQueueState: async () => {
    if (!RaagaXNativeDownload.isNative()) return;
    console.log('[DownloadManager] syncNativeQueueState() — reconciling JS tasks with Android Room DB');
    try {
      const activeDownloads = await RaagaXNativeDownload.getActiveDownloads();
      if (activeDownloads.length === 0) {
        console.log('[DownloadManager] syncNativeQueueState() — no active downloads in DB');
        return;
      }

      set((state) => {
        const updatedTasks = { ...state.tasks };
        for (const dl of activeDownloads) {
          const status = (dl.downloadState || 'QUEUED') as DownloadStatus;
          const existingTask = updatedTasks[dl.songId];

          if (existingTask) {
            // Update existing task with real native state (overrides optimistic DOWNLOADING if wrong)
            updatedTasks[dl.songId] = {
              ...existingTask,
              status,
              progress: dl.downloadProgress || existingTask.progress,
              song: {
                ...existingTask.song,
                title: dl.title || existingTask.song.title,
                artist: dl.artist || existingTask.song.artist,
                coverUrl: dl.artworkUrl || existingTask.song.coverUrl,
              },
            };
          } else if (['QUEUED', 'DOWNLOADING', 'VERIFYING', 'PAUSED', 'FAILED'].includes(status)) {
            // Create missing task from native DB data (broadcast was missed entirely)
            const minimalSong: Song = {
              id: dl.songId,
              title: dl.title || dl.songId,
              artist: dl.artist || '',
              album: dl.album || '',
              audioUrl: '',
              coverUrl: dl.artworkUrl || '',
              duration: 0,
              genre: '',
              category: 'melody',
              releaseYear: new Date().getFullYear(),
              plays: 0,
              likes: 0,
              artistId: `art-${dl.songId}`,
              albumId: `alb-${dl.songId}`,
            };
            updatedTasks[dl.songId] = {
              song: minimalSong,
              mode: 'offline_sandboxed',
              quality: dl.quality || '320 kbps',
              status,
              progress: dl.downloadProgress || 0,
              downloadedBytes: dl.downloadedBytes || 0,
              totalBytes: 0,
              retryCount: 0,
            };
          }
        }
        console.log('[DownloadManager] syncNativeQueueState() — reconciled', activeDownloads.length, 'active downloads');
        return { tasks: updatedTasks };
      });
    } catch (e) {
      console.warn('[DownloadManager] syncNativeQueueState error:', e);
    }
  },
  getSongDownloadStatus: (songId: string) => {
    if (!songId) return 'NOT_DOWNLOADED';
    const state = get();
    const task = state.tasks[songId];
    if (task) {
      if (task.status === 'COMPLETED') return 'COMPLETED';
      if (task.status === 'DOWNLOADING') return 'DOWNLOADING';
      if (task.status === 'QUEUED') return 'QUEUED';
      if (task.status === 'VERIFYING') return 'DOWNLOADING';
      if (task.status === 'PAUSED') return 'PAUSED';
      if (task.status === 'FAILED') return 'FAILED';
    }
    if (usePlayerStore.getState().downloadedSongIds.includes(songId) || !!state.nativeDownloadedTracks[songId]) {
      return 'COMPLETED';
    }
    return 'NOT_DOWNLOADED';
  },

  getSongDownloadInfo: (songId: string) => {
    const state = get();
    const task = state.tasks[songId];
    const isDownloaded = usePlayerStore.getState().downloadedSongIds.includes(songId) || !!state.nativeDownloadedTracks[songId];
    const nativeTrack = state.nativeDownloadedTracks[songId];
    
    if (task) {
      return {
        status: task.status,
        progress: task.progress,
        downloadedBytes: task.downloadedBytes,
        totalBytes: task.totalBytes,
        speedBytesPerSec: task.speedBytesPerSec,
        etaSeconds: task.etaSeconds,
        error: task.error,
        localPath: nativeTrack?.localPath,
      };
    }

    if (isDownloaded) {
      return {
        status: 'COMPLETED',
        progress: 100,
        downloadedBytes: nativeTrack?.fileSize || 0,
        totalBytes: nativeTrack?.fileSize || 0,
        localPath: nativeTrack?.localPath,
      };
    }

    return {
      status: 'NOT_DOWNLOADED',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
    };
  },

  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      if (typeof window !== 'undefined') {
        const storedEnabled = localStorage.getItem('isOfflineStorageEnabled');
        if (storedEnabled !== null) set({ isOfflineStorageEnabled: storedEnabled === 'true' });

        const storedMode = localStorage.getItem('isOfflineMode');
        if (storedMode !== null) set({ isOfflineMode: storedMode === 'true' });

        const storedSettings = localStorage.getItem('offlineSettings');
        if (storedSettings) {
          try {
            set({ offlineSettings: JSON.parse(storedSettings) });
          } catch (e) {}
        }
      }

      // Setup Native Download Event Listeners
      if (RaagaXNativeDownload.isNative()) {
        RaagaXNativeDownload.addDownloadProgressListener((ev) => {
          get().updateProgress(ev.songId, ev.progress, ev.downloadedBytes, ev.totalBytes, ev.speedBytesPerSec, ev.etaSeconds);
          const stateNormalized: DownloadStatus = ev.state as DownloadStatus;
          get().setStatus(ev.songId, stateNormalized, ev.error);

          // Update playlist overall progress if active
          const pl = get().playlistDownloadProgress;
          if (pl && pl.status === 'DOWNLOADING') {
            set({
              playlistDownloadProgress: {
                ...pl,
                currentSongTitle: get().tasks[ev.songId]?.song?.title || pl.currentSongTitle,
              }
            });
          }
        });

        RaagaXNativeDownload.addDownloadCompletedListener((ev) => {
          get().setStatus(ev.songId, 'COMPLETED');
          usePlayerStore.setState(s => ({
            downloadedSongIds: [...new Set([...s.downloadedSongIds, ev.songId])],
            cloudDownloadedSongIds: [...new Set([...s.cloudDownloadedSongIds, ev.songId])]
          }));
          get().verifyPhysicalFiles();

          // Increment playlist completed count if active
          const pl = get().playlistDownloadProgress;
          if (pl && pl.status === 'DOWNLOADING') {
            const nextCompleted = pl.completedSongs + 1;
            const overallPct = Math.round((nextCompleted / pl.totalSongs) * 100);
            set({
              playlistDownloadProgress: {
                ...pl,
                completedSongs: nextCompleted,
                overallProgress: overallPct,
                status: nextCompleted >= pl.totalSongs ? 'COMPLETED' : 'DOWNLOADING'
              }
            });
          }

          // Clean up completed task from active queue after brief transition
          setTimeout(() => {
            set((s) => {
              const newTasks = { ...s.tasks };
              delete newTasks[ev.songId];
              return { tasks: newTasks };
            });
            get()._persistTasks();
          }, 2000);
        });
      }

      const db = LocalDatabase.getInstance();
      const savedTasks = await db.loadDownloadTasks();
      
      const hydratedTasks: Record<string, DownloadTask> = {};
      Object.keys(savedTasks).forEach(id => {
        const task = savedTasks[id];
        // On native Android: WorkManager handles recovery automatically via recoverStuckDownloads()
        // so we preserve the existing state rather than resetting to PAUSED.
        // On Web/PWA: browser doesn't persist in-progress downloads, so reset to PAUSED.
        if (!RaagaXNativeDownload.isNative()) {
          if (task.status === 'DOWNLOADING' || task.status === 'VERIFYING') {
            task.status = 'PAUSED';
          }
        }
        hydratedTasks[id] = task;
      });

      set({ tasks: hydratedTasks, isHydrated: true });
      await get().verifyPhysicalFiles();

      if (RaagaXNativeDownload.isNative()) {
        // On native: sync real states from Android Room DB to fix any stuck QUEUED tasks
        // caused by timing races between WorkManager, BroadcastReceiver, and JS hydration.
        console.log('[DownloadManager] hydrate() → calling syncNativeQueueState()');
        await get().syncNativeQueueState();
      } else {
        get()._processQueue();
      }
    } catch (e) {
      set({ isHydrated: true });
    }
  },

  _persistTasks: () => {
    const db = LocalDatabase.getInstance();
    const state = get();
    db.saveDownloadTasks(state.tasks);
    if (typeof window !== 'undefined') {
      localStorage.setItem('isOfflineStorageEnabled', String(state.isOfflineStorageEnabled));
      localStorage.setItem('isOfflineMode', String(state.isOfflineMode));
      localStorage.setItem('offlineSettings', JSON.stringify(state.offlineSettings));
    }
  },

  setWifiOnly: (wifiOnly) => {
    set({ wifiOnly });
    if (RaagaXNativeDownload.isNative()) {
      RaagaXNativeDownload.setWifiOnly(wifiOnly);
    }
    DownloadManager.getInstance().setWifiOnly(wifiOnly);
    if (wifiOnly && typeof navigator !== 'undefined') {
      const conn = (navigator as any).connection;
      if (conn && conn.type !== 'wifi' && conn.type !== 'ethernet' && conn.type !== 'unknown') {
        get().pauseAll();
      }
    }
  },

  saveForOffline: async (song: Song, quality?: string): Promise<boolean> => {
    if (!song || !song.id) return false;
    const targetQuality = quality || get().offlineSettings.audioQuality || '320 kbps';
    
    // Check if already verified on device
    const alreadyDownloaded = usePlayerStore.getState().downloadedSongIds.includes(song.id);
    if (alreadyDownloaded) return true;

    // Check device storage availability
    if (RaagaXNativeDownload.isNative()) {
      const storage = await RaagaXNativeDownload.checkStorage(15 * 1024 * 1024);
      if (!storage.hasSpace) {
        get().setStatus(song.id, 'FAILED', `Not enough storage. Required: 15 MB, Available: ${Math.round(storage.availableBytes / (1024 * 1024))} MB. Free some storage and try again.`);
        usePlayerStore.getState().setToastMessage(`Not enough storage. Required: 15 MB, Available: ${Math.round(storage.availableBytes / (1024 * 1024))} MB`);
        return false;
      }
    } else {
      const quotaCheck = await DownloadStorage.getInstance().checkStorageAvailable(10 * 1024 * 1024);
      if (!quotaCheck.hasSpace) {
        get().setStatus(song.id, 'FAILED', 'Not enough device storage available');
        return false;
      }
    }

    get().queueDownload(song, 'offline_sandboxed', targetQuality);
    return true;
  },

  exportSong: async (song: Song) => {
    if (!song || !song.id) return false;

    // If native Android, native download already places standard MP3 into Music/RaagaX/
    if (RaagaXNativeDownload.isNative()) {
      const success = await get().saveForOffline(song, '320 kbps');
      if (success) {
        usePlayerStore.getState().setToastMessage(`Saving "${song.title}" directly to Music/RaagaX folder`);
      }
      return success;
    }

    set((s) => ({
      exportStates: {
        ...s.exportStates,
        [song.id]: { status: 'DOWNLOADING', progress: 50 }
      }
    }));

    try {
      const success = await exportSongToDevice(song);
      set((s) => ({
        exportStates: {
          ...s.exportStates,
          [song.id]: { status: success ? 'COMPLETED' : 'FAILED', progress: success ? 100 : 0 }
        }
      }));
      setTimeout(() => {
        set((s) => {
          const next = { ...s.exportStates };
          delete next[song.id];
          return { exportStates: next };
        });
      }, 4000);
      return success;
    } catch (e: any) {
      set((s) => ({
        exportStates: {
          ...s.exportStates,
          [song.id]: { status: 'FAILED', progress: 0, error: e.message }
        }
      }));
      return false;
    }
  },

  queueDownload: (song, mode = 'offline_sandboxed', quality = '320 kbps') => {
    const { tasks, _processQueue, _persistTasks } = get();
    if (!song || !song.id) return;

    if (usePlayerStore.getState().downloadedSongIds.includes(song.id)) {
      return;
    }
    if (tasks[song.id] && ['DOWNLOADING', 'QUEUED', 'COMPLETED', 'VERIFYING'].includes(tasks[song.id].status)) {
      return;
    }

    const newTask: DownloadTask = { 
      song, 
      mode,
      quality,
      status: 'QUEUED', 
      progress: 0, 
      downloadedBytes: 0, 
      totalBytes: 0, 
      retryCount: 0 
    };

    set((state) => ({
      tasks: {
        ...state.tasks,
        [song.id]: newTask
      }
    }));

    // If native Android, delegate immediately to RaagaXNativeDownload WorkManager
    if (RaagaXNativeDownload.isNative()) {
      console.log('[DownloadManager] addDownload(' + song.id + ') → delegating to WorkManager');
      RaagaXNativeDownload.downloadTrack({
        songId: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album || 'RaagaX Music',
        artworkUrl: song.coverUrl || '',
        streamUrl: song.audioUrl || '',
        quality,
        duration: song.duration || 180,
      }).then(() => {
        // Optimistically transition QUEUED → DOWNLOADING after WorkManager accepts the job.
        // The real state will be confirmed by the DOWNLOAD_PROGRESS broadcast from the Worker.
        // This fixes Root Cause 1: _processQueue() no-op means task never transitions on native.
        console.log('[DownloadManager] job persisted → transitioning ' + song.id + ' QUEUED → DOWNLOADING (optimistic)');
        set((s) => {
          const task = s.tasks[song.id];
          if (!task || task.status !== 'QUEUED') return s;
          return { tasks: { ...s.tasks, [song.id]: { ...task, status: 'DOWNLOADING' } } };
        });
      }).catch(err => {
        console.error('[DownloadManager] downloadTrack error for ' + song.id + ':', err);
        get().setStatus(song.id, 'FAILED', err.message);
      });
      _persistTasks();
      return;
    }

    _persistTasks();
    _processQueue();
  },

  retryDownload: (songId: string) => {
    const task = get().tasks[songId];
    if (!task) return;
    console.log('[DownloadManager] Retrying download for songId:', songId);
    get().setStatus(songId, 'QUEUED', undefined);
    if (RaagaXNativeDownload.isNative()) {
      get().queueDownload(task.song, task.mode, task.quality);
    } else {
      get()._processQueue();
    }
  },

  downloadPlaylist: (songs, quality = '320 kbps', playlistTitle = 'Playlist', playlistId = 'pl_custom') => {
    const state = get();
    const downloadedIds = usePlayerStore.getState().downloadedSongIds;
    const toDownload = songs.filter(s => s && s.id && !downloadedIds.includes(s.id));
    
    if (toDownload.length === 0) {
      usePlayerStore.getState().setToastMessage('All songs in this playlist are already downloaded.');
      return;
    }

    // Set Playlist Progress Banner State
    set({
      playlistDownloadProgress: {
        playlistId,
        playlistTitle,
        totalSongs: toDownload.length,
        completedSongs: 0,
        currentSongTitle: toDownload[0].title,
        overallProgress: 0,
        status: 'DOWNLOADING'
      }
    });

    // Native Android WorkManager batch download
    if (RaagaXNativeDownload.isNative()) {
      RaagaXNativeDownload.downloadPlaylist(toDownload, quality).then((queuedCount) => {
        usePlayerStore.getState().setToastMessage(`Queued ${queuedCount} songs to download to Music/RaagaX`);
        // Optimistically set first song to DOWNLOADING, rest remain QUEUED
        // WorkManager will start them sequentially; broadcasts will confirm real states.
        set((s) => {
          const updatedTasks = { ...s.tasks };
          let firstFound = false;
          for (const song of toDownload) {
            if (updatedTasks[song.id] && updatedTasks[song.id].status === 'QUEUED') {
              if (!firstFound) {
                updatedTasks[song.id] = { ...updatedTasks[song.id], status: 'DOWNLOADING' };
                firstFound = true;
              }
            }
          }
          return { tasks: updatedTasks };
        });
      }).catch(err => {
        usePlayerStore.getState().setToastMessage(`Playlist download failed: ${err.message}`);
      });

      const newTasks = { ...state.tasks };
      toDownload.forEach(song => {
        newTasks[song.id] = {
          song,
          mode: 'offline_sandboxed',
          quality,
          status: 'QUEUED',
          progress: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          retryCount: 0,
          playlistId,
        };
      });
      set({ tasks: newTasks });
      state._persistTasks();
      return;
    }

    // Web Fallback queueing
    let newTasks = { ...state.tasks };
    toDownload.forEach(song => {
      newTasks[song.id] = { 
        song, 
        mode: 'offline_sandboxed',
        quality,
        status: 'QUEUED', 
        progress: 0, 
        downloadedBytes: 0, 
        totalBytes: 0, 
        retryCount: 0,
        playlistId,
      };
    });

    set({ tasks: newTasks });
    state._persistTasks();
    state._processQueue();
  },

  pauseDownload: (songId) => {
    if (RaagaXNativeDownload.isNative()) {
      RaagaXNativeDownload.pauseDownload(songId);
    }
    const task = get().tasks[songId];
    if (task && (task.status === 'DOWNLOADING' || task.status === 'VERIFYING')) {
      if (task.abortController) {
        task.abortController.abort();
      }
      set((state) => ({
        tasks: { ...state.tasks, [songId]: { ...task, status: 'PAUSED', abortController: undefined } },
        activeCount: Math.max(0, state.activeCount - 1)
      }));
      get()._persistTasks();
      get()._processQueue();
    } else if (task && task.status === 'QUEUED') {
      set((state) => ({
        tasks: { ...state.tasks, [songId]: { ...task, status: 'PAUSED' } }
      }));
      get()._persistTasks();
    }
  },

  resumeDownload: (songId) => {
    if (RaagaXNativeDownload.isNative()) {
      RaagaXNativeDownload.resumeDownload(songId);
    }
    const task = get().tasks[songId];
    if (task && (task.status === 'PAUSED' || task.status === 'FAILED')) {
      set((state) => ({
        tasks: { ...state.tasks, [songId]: { ...task, status: 'QUEUED', retryCount: 0, error: undefined } }
      }));
      get()._persistTasks();
      get()._processQueue();
    }
  },

  cancelDownload: (songId) => {
    if (RaagaXNativeDownload.isNative()) {
      RaagaXNativeDownload.cancelDownload(songId);
    }
    const task = get().tasks[songId];
    if (task) {
      if ((task.status === 'DOWNLOADING' || task.status === 'VERIFYING') && task.abortController) {
        task.abortController.abort();
        set((state) => ({ activeCount: Math.max(0, state.activeCount - 1) }));
      }
      set((state) => {
        const newTasks = { ...state.tasks };
        delete newTasks[songId];
        return { tasks: newTasks };
      });
      get()._persistTasks();
      get()._processQueue();
    }
  },

  removeDownload: async (songId) => {
    get().cancelDownload(songId);
    
    try {
      if (RaagaXNativeDownload.isNative()) {
        await RaagaXNativeDownload.removeDownload(songId);
      } else {
        await DownloadStorage.getInstance().deleteMedia(songId);
        await OfflineCatalog.getInstance().removeTrack(songId);
      }
    } catch {}

    usePlayerStore.setState(state => ({
      downloadedSongIds: state.downloadedSongIds.filter(id => id !== songId)
    }));
    await get().verifyPhysicalFiles();
  },

  pauseAll: () => {
    if (RaagaXNativeDownload.isNative()) {
      RaagaXNativeDownload.pauseAll();
    }
    const tasks = { ...get().tasks };
    Object.keys(tasks).forEach(id => {
      const task = tasks[id];
      if (task.status === 'DOWNLOADING' || task.status === 'VERIFYING') {
        if (task.abortController) task.abortController.abort();
        task.status = 'PAUSED';
        task.abortController = undefined;
      } else if (task.status === 'QUEUED') {
        task.status = 'PAUSED';
      }
    });
    set({ tasks, activeCount: 0 });
    get()._persistTasks();
  },

  resumeAll: () => {
    if (RaagaXNativeDownload.isNative()) {
      RaagaXNativeDownload.resumeAll();
    }
    const tasks = { ...get().tasks };
    Object.keys(tasks).forEach(id => {
      const task = tasks[id];
      if (task.status === 'PAUSED' || task.status === 'FAILED') {
        task.status = 'QUEUED';
        task.retryCount = 0;
        task.error = undefined;
      }
    });
    set({ tasks });
    get()._persistTasks();
    get()._processQueue();
  },

  clearStreamingCache: async () => {
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          if (key.includes('streaming') || key.includes('temp') || key.includes('pre-cache')) {
            await caches.delete(key);
          }
        }
        console.log('[DownloadStore] Streaming cache cleared.');
        await get().fetchStorageInfo();
      } catch (err) {
        console.error('[DownloadStore] Failed to clear streaming cache:', err);
      }
    }
  },

  purgeOfflineDownloads: async () => {
    get().cancelAll();
    try {
      if (RaagaXNativeDownload.isNative()) {
        const all = await RaagaXNativeDownload.getDownloadedTracks();
        for (const t of all) {
          await RaagaXNativeDownload.removeDownload(t.songId);
        }
      } else {
        await DownloadStorage.getInstance().clearAllMedia();
        await OfflineCatalog.getInstance().clearCatalog();
      }
    } catch {}
    
    usePlayerStore.setState({ downloadedSongIds: [] });
    set({ tasks: {}, activeCount: 0, nativeDownloadedTracks: {} });
    get()._persistTasks();
    await get().fetchStorageInfo();
    console.log('[DownloadStore] All offline downloads purged.');
  },

  cancelAll: () => {
    if (RaagaXNativeDownload.isNative()) {
      RaagaXNativeDownload.cancelAll();
    }
    const tasks = { ...get().tasks };
    Object.keys(tasks).forEach(id => {
      const task = tasks[id];
      if (task.status === 'DOWNLOADING' && task.abortController) {
        task.abortController.abort();
      }
      delete tasks[id];
    });
    set({ tasks, activeCount: 0, playlistDownloadProgress: null });
    get()._persistTasks();
    get()._processQueue();
  },

  shareSongFile: async (songId: string): Promise<boolean> => {
    if (RaagaXNativeDownload.isNative()) {
      return await RaagaXNativeDownload.shareSongFile(songId);
    }
    return false;
  },

  updateProgress: (songId, progress, downloadedBytes, totalBytes, speed, eta) => {
    set((state) => {
      const task = state.tasks[songId];
      if (!task) {
        // Root Cause 2 fix: broadcast arrived for a song not in the JS store
        // (navigation/hydration race). Create a minimal placeholder so progress is tracked.
        console.warn('[DownloadManager] updateProgress: unknown songId', songId, '— creating placeholder task');
        const minimalSong: Song = {
          id: songId, title: songId, artist: '', album: '', audioUrl: '', coverUrl: '',
          duration: 0, genre: '', category: 'melody', releaseYear: new Date().getFullYear(),
          plays: 0, likes: 0, artistId: `art-${songId}`, albumId: `alb-${songId}`,
        };
        return {
          tasks: {
            ...state.tasks,
            [songId]: {
              song: minimalSong, mode: 'offline_sandboxed', quality: '320 kbps',
              status: 'DOWNLOADING', progress, downloadedBytes, totalBytes,
              speedBytesPerSec: speed, etaSeconds: eta, retryCount: 0,
            }
          }
        };
      }
      return {
        tasks: { 
          ...state.tasks, 
          [songId]: { 
            ...task, 
            progress, 
            downloadedBytes, 
            totalBytes, 
            speedBytesPerSec: speed !== undefined ? speed : task.speedBytesPerSec,
            etaSeconds: eta !== undefined ? eta : task.etaSeconds,
          } 
        }
      };
    });
  },

  setStatus: (songId, status, error) => {
    set((state) => {
      const task = state.tasks[songId];
      if (!task) {
        // Root Cause 2 fix: broadcast arrived for a song not in the JS store.
        // Only create placeholders for meaningful mid-download states, not QUEUED
        // (QUEUED tasks always come with the full Song object via queueDownload).
        if (status === 'DOWNLOADING' || status === 'VERIFYING' || status === 'COMPLETED' || status === 'FAILED') {
          console.warn('[DownloadManager] setStatus: unknown songId', songId, '→', status, '— creating placeholder');
          const minimalSong: Song = {
            id: songId, title: songId, artist: '', album: '', audioUrl: '', coverUrl: '',
            duration: 0, genre: '', category: 'melody', releaseYear: new Date().getFullYear(),
            plays: 0, likes: 0, artistId: `art-${songId}`, albumId: `alb-${songId}`,
          };
          return {
            tasks: {
              ...state.tasks,
              [songId]: {
                song: minimalSong, mode: 'offline_sandboxed', quality: '320 kbps',
                status, progress: status === 'COMPLETED' ? 100 : 0,
                downloadedBytes: 0, totalBytes: 0, retryCount: 0, error,
              }
            }
          };
        }
        return state;
      }
      return {
        tasks: { ...state.tasks, [songId]: { ...task, status, error: error || task.error } }
      };
    });
    get()._persistTasks();
  },

  _processQueue: () => {
    // If native Android, WorkManager processes queue natively in background
    if (RaagaXNativeDownload.isNative()) return;

    const state = get();
    const { tasks, activeCount, maxConcurrent, updateProgress, setStatus } = state;

    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      return;
    }

    if (activeCount >= maxConcurrent) return;

    const nextTaskId = Object.keys(tasks).find(id => tasks[id].status === 'QUEUED');
    if (!nextTaskId) return;

    const task = tasks[nextTaskId];
    const abortController = new AbortController();

    set((s) => ({
      activeCount: s.activeCount + 1,
      tasks: { ...s.tasks, [nextTaskId]: { ...task, status: 'DOWNLOADING', abortController } }
    }));

    const downloader = AtomicDownloader.getInstance();

    const sanitizeName = (str: string) => str.replace(/[/\\?%*:|"<>]/g, '').trim();
    const filename = `${sanitizeName(task.song.title)} - ${sanitizeName(task.song.artist || 'Artist')}.mp3`;
    
    let targetUrl = task.song.audioUrl;
    if (!targetUrl || targetUrl.includes('pixabay.com')) {
      targetUrl = getApiUrl(`/api/download?id=${encodeURIComponent(task.song.id)}&name=${encodeURIComponent(filename)}`);
    } else {
      targetUrl = getApiUrl(`/api/download?url=${encodeURIComponent(targetUrl)}&name=${encodeURIComponent(filename)}`);
    }

    downloader.download({
      url: targetUrl,
      trackId: task.song.id,
      quality: (task.quality as DownloadQuality) || 'HIGH',
      startOffset: task.downloadedBytes > 0 ? task.downloadedBytes : 0,
      signal: abortController.signal,
      onProgress: (progress: number, downloadedBytes: number, totalBytes: number, speed: number) => {
        updateProgress(nextTaskId, progress, downloadedBytes, totalBytes, speed);
      },
      onStateChange: (downloadState: string) => {
        if (downloadState === 'VERIFYING') {
          setStatus(nextTaskId, 'VERIFYING');
        }
      }
    }).then(async (result: any) => {
      await DownloadStorage.getInstance().saveMedia(
        task.song.id, 
        result.blob, 
        result.mimeType, 
        'liked_songs',
        { checksum: result.checksum, quality: (task.quality as DownloadQuality) || 'HIGH' }
      );

      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      await OfflineCatalog.getInstance().addTrack({
        trackId: task.song.id,
        localMediaId: task.song.id,
        title: task.song.title,
        artist: task.song.artist || 'Unknown Artist',
        album: task.song.album,
        artworkUrl: task.song.coverUrl,
        duration: task.song.duration || 0,
        durationMs: (task.song.duration || 0) * 1000,
        mimeType: result.mimeType,
        quality: (task.quality as DownloadQuality) || 'HIGH',
        fileSizeBytes: result.totalBytes,
        checksum: result.checksum,
        leaseExpiresAt: Date.now() + thirtyDaysMs,
        downloadedAt: Date.now(),
        version: '2'
      });

      usePlayerStore.setState(s => ({
        downloadedSongIds: [...new Set([...s.downloadedSongIds, nextTaskId])],
        cloudDownloadedSongIds: [...new Set([...s.cloudDownloadedSongIds, nextTaskId])]
      }));
      await get().fetchStorageInfo();

      setStatus(nextTaskId, 'COMPLETED');

      setTimeout(() => {
        set((s) => {
          const newTasks = { ...s.tasks };
          delete newTasks[nextTaskId];
          return { tasks: newTasks };
        });
        get()._persistTasks();
      }, 2500);

      set((s) => ({ activeCount: Math.max(0, s.activeCount - 1) }));
      get()._processQueue();
    }).catch((err: any) => {
      if (err.name === 'AbortError') {
        set((s) => ({ activeCount: Math.max(0, s.activeCount - 1) }));
        get()._processQueue();
        return;
      }

      const currentTask = get().tasks[nextTaskId];
      if (currentTask && currentTask.status !== 'PAUSED' && currentTask.status !== 'CANCELLED') {
        if (currentTask.retryCount < 3) {
          const nextRetry = currentTask.retryCount + 1;
          const delay = nextRetry * 1500;
          set((s) => ({
            activeCount: Math.max(0, s.activeCount - 1),
            tasks: { 
              ...s.tasks, 
              [nextTaskId]: { 
                ...currentTask, 
                status: 'QUEUED', 
                retryCount: nextRetry,
                error: `Retrying (${nextRetry}/3)...` 
              } 
            }
          }));
          setTimeout(() => get()._processQueue(), delay);
        } else {
          setStatus(nextTaskId, 'FAILED', err.message || 'Download failed after 3 attempts');
          set((s) => ({ activeCount: Math.max(0, s.activeCount - 1) }));
          get()._processQueue();
        }
      }
    });

    get()._processQueue();
  },

  /**
   * getAlbumDownloadStatus — aggregates per-track states into a single album-level status.
   * Returns: 'NONE' | 'PARTIAL' | 'ALL'
   */
  getAlbumDownloadStatus: (songIds: string[]): 'NONE' | 'PARTIAL' | 'ALL' => {
    if (!songIds || songIds.length === 0) return 'NONE';
    const downloadedIds = usePlayerStore.getState().downloadedSongIds;
    const tasks = get().tasks;
    let completed = 0;
    for (const id of songIds) {
      if (downloadedIds.includes(id)) { completed++; continue; }
      const t = tasks[id];
      if (t && t.status === 'COMPLETED') completed++;
    }
    if (completed === 0) return 'NONE';
    if (completed === songIds.length) return 'ALL';
    return 'PARTIAL';
  },

  /**
   * downloadAlbum — sequentially queues all tracks in an album, respecting maxConcurrent.
   * Skips already-downloaded songs. Updates playlistDownloadProgress as a proxy for album progress.
   */
  downloadAlbum: (albumId: string, songs: Song[], quality?: string) => {
    const targetQuality = quality || get().offlineSettings.audioQuality || '320 kbps';
    const downloadedIds = usePlayerStore.getState().downloadedSongIds;
    const tasks = get().tasks;

    const toDownload = songs.filter((s) => {
      if (!s?.id) return false;
      if (downloadedIds.includes(s.id)) return false;
      const t = tasks[s.id];
      if (t && ['DOWNLOADING', 'QUEUED', 'COMPLETED', 'VERIFYING'].includes(t.status)) return false;
      return true;
    });

    if (toDownload.length === 0) {
      usePlayerStore.getState().setToastMessage('All tracks already downloaded');
      return;
    }

    const albumTitle = songs[0]?.album || 'Album';
    set({
      playlistDownloadProgress: {
        playlistId: `album-${albumId}`,
        playlistTitle: albumTitle,
        totalSongs: toDownload.length,
        completedSongs: 0,
        currentSongTitle: toDownload[0]?.title || '',
        overallProgress: 0,
        status: 'DOWNLOADING',
      }
    });

    // Queue each track — _processQueue enforces maxConcurrent (default: 2)
    toDownload.forEach((song) => {
      get().queueDownload(song, 'offline_sandboxed', targetQuality);
    });

    usePlayerStore.getState().setToastMessage(`Downloading ${toDownload.length} tracks from "${albumTitle}"`);
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    console.log('[DownloadManager] Device went offline.');
    useDownloadStore.getState().pauseAll();
    usePlayerStore.getState().setNetworkMode('offline');
  });

  window.addEventListener('online', () => {
    console.log('[DownloadManager] Device came online.');
    usePlayerStore.getState().setNetworkMode('online');
    useDownloadStore.getState().resumeAll();
  });
}
