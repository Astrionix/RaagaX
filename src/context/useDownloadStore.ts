import { create } from 'zustand';
import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { LocalDatabase } from '@/lib/localDatabase';
import { DownloadManager } from '@/lib/offline/DownloadManager';
import { DownloadStorage } from '@/lib/offline/DownloadStorage';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { AtomicDownloader } from '@/lib/offline/AtomicDownloader';
import { DownloadMode, DownloadQuality, StorageEstimateInfo, TrackDownloadState } from '@/lib/offline/types';
import { exportSongToDevice } from '@/lib/downloadHelper';

export type DownloadStatus = 'queued' | 'downloading' | 'verifying' | 'paused' | 'completed' | 'error' | 'cancelled';

export interface DownloadTask {
  song: Song;
  mode: DownloadMode;
  quality: DownloadQuality;
  status: DownloadStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec?: number;
  retryCount: number;
  checksum?: string;
  error?: string;
  abortController?: AbortController;
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
  activeCount: number;
  maxConcurrent: number;
  wifiOnly: boolean;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  fetchStorageInfo: () => Promise<StorageEstimateInfo>;
  saveForOffline: (song: Song) => Promise<boolean>;
  queueDownload: (song: Song, mode?: DownloadMode) => void;
  exportSong: (song: Song) => Promise<boolean>;
  pauseDownload: (songId: string) => void;
  resumeDownload: (songId: string) => void;
  cancelDownload: (songId: string) => void;
  removeDownload: (songId: string) => Promise<void>;
  downloadPlaylist: (songs: Song[]) => void;
  pauseAll: () => void;
  resumeAll: () => void;
  cancelAll: () => void;
  clearStreamingCache: () => Promise<void>;
  purgeOfflineDownloads: () => Promise<void>;

  setWifiOnly: (wifiOnly: boolean) => void;

  updateProgress: (songId: string, progress: number, downloadedBytes: number, totalBytes: number, speed?: number) => void;
  setStatus: (songId: string, status: DownloadStatus, error?: string) => void;
  
  isOfflineStorageEnabled: boolean;
  setOfflineStorageEnabled: (enabled: boolean) => void;
  
  isSetupModalOpen: boolean;
  setSetupModalOpen: (open: boolean) => void;
  
  isOfflineMode: boolean;
  setOfflineMode: (enabled: boolean) => void;

  offlineSettings: {
    audioQuality: 'High' | 'Standard' | 'Lossless';
    autoDeleteTemp: boolean;
    smartDownloads: boolean;
  };
  setOfflineSettings: (settings: Partial<DownloadStore['offlineSettings']>) => void;
  setMaxConcurrent: (count: number) => void;

  _processQueue: () => void;
  _persistTasks: () => void;
  syncDownloadedIds: () => Promise<void>;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  tasks: {},
  exportStates: {},
  storageInfo: null,
  activeCount: 0,
  maxConcurrent: 2,
  wifiOnly: false,
  isHydrated: false,
  isOfflineStorageEnabled: true,
  isSetupModalOpen: false,
  isOfflineMode: false,
  offlineSettings: {
    audioQuality: 'High',
    autoDeleteTemp: false,
    smartDownloads: false,
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
    DownloadManager.getInstance();
  },

  fetchStorageInfo: async () => {
    try {
      const info = await DownloadStorage.getInstance().getStorageEstimate();
      set({ storageInfo: info });
      return info;
    } catch (e) {
      const fallback: StorageEstimateInfo = {
        quota: 64 * 1024 * 1024 * 1024,
        usage: 0,
        available: 64 * 1024 * 1024 * 1024,
        raagaXUsed: 0,
        percentUsed: 0
      };
      set({ storageInfo: fallback });
      return fallback;
    }
  },

  syncDownloadedIds: async () => {
    try {
      const catalog = OfflineCatalog.getInstance();
      const allTracks = await catalog.getAllTracks();
      const ids = allTracks.map(t => t.trackId);
      usePlayerStore.setState({ downloadedSongIds: ids });
      await get().fetchStorageInfo();
    } catch {}
  },

  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const db = LocalDatabase.getInstance();
      const savedTasks = await db.loadDownloadTasks();
      
      const hydratedTasks: Record<string, DownloadTask> = {};
      Object.keys(savedTasks).forEach(id => {
        const task = savedTasks[id];
        if (task.status === 'downloading' || task.status === 'verifying') {
          task.status = 'paused';
        }
        hydratedTasks[id] = task;
      });

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

      set({ tasks: hydratedTasks, isHydrated: true });
      await get().syncDownloadedIds();
      get()._processQueue();
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
    DownloadManager.getInstance().setWifiOnly(wifiOnly);
    if (wifiOnly && typeof navigator !== 'undefined') {
      const conn = (navigator as any).connection;
      if (conn && conn.type !== 'wifi' && conn.type !== 'ethernet' && conn.type !== 'unknown') {
        get().pauseAll();
      }
    }
  },

  /**
   * Mode A: In-App Offline Playback Storage with Pre-Check & Atomic Verification
   */
  saveForOffline: async (song: Song): Promise<boolean> => {
    if (!song || !song.id) return false;
    
    // Check if already downloaded
    const alreadyDownloaded = usePlayerStore.getState().downloadedSongIds.includes(song.id);
    if (alreadyDownloaded) return true;

    // Check device storage availability
    const quotaCheck = await DownloadStorage.getInstance().checkStorageAvailable(10 * 1024 * 1024);
    if (!quotaCheck.hasSpace) {
      get().setStatus(song.id, 'error', 'Not enough device storage available');
      return false;
    }

    get().queueDownload(song, 'offline_sandboxed');
    return true;
  },

  /**
   * Mode B: Standalone File Export to Device OS
   */
  exportSong: async (song: Song) => {
    if (!song || !song.id) return false;
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

  queueDownload: (song, mode = 'offline_sandboxed') => {
    const { tasks, _processQueue, _persistTasks } = get();
    if (!song || !song.id) return;

    if (mode === 'offline_sandboxed' && usePlayerStore.getState().downloadedSongIds.includes(song.id)) {
      return;
    }
    if (tasks[song.id] && ['downloading', 'queued', 'completed', 'verifying'].includes(tasks[song.id].status)) {
      return;
    }

    set((state) => ({
      tasks: {
        ...state.tasks,
        [song.id]: { 
          song, 
          mode,
          quality: 'HIGH',
          status: 'queued', 
          progress: 0, 
          downloadedBytes: 0, 
          totalBytes: 0, 
          retryCount: 0 
        }
      }
    }));
    _persistTasks();
    _processQueue();
  },

  downloadPlaylist: (songs) => {
    const state = get();
    const downloadedIds = usePlayerStore.getState().downloadedSongIds;
    
    let newTasks = { ...state.tasks };
    let added = false;

    songs.forEach(song => {
      if (!song || !song.id) return;
      if (downloadedIds.includes(song.id)) return;
      if (newTasks[song.id] && ['downloading', 'queued', 'completed', 'verifying'].includes(newTasks[song.id].status)) return;
      
      newTasks[song.id] = { 
        song, 
        mode: 'offline_sandboxed',
        quality: 'HIGH',
        status: 'queued', 
        progress: 0, 
        downloadedBytes: 0, 
        totalBytes: 0, 
        retryCount: 0 
      };
      added = true;
    });

    if (added) {
      set({ tasks: newTasks });
      state._persistTasks();
      state._processQueue();
    }
  },

  pauseDownload: (songId) => {
    const task = get().tasks[songId];
    if (task && (task.status === 'downloading' || task.status === 'verifying')) {
      if (task.abortController) {
        task.abortController.abort();
      }
      set((state) => ({
        tasks: { ...state.tasks, [songId]: { ...task, status: 'paused', abortController: undefined } },
        activeCount: Math.max(0, state.activeCount - 1)
      }));
      get()._persistTasks();
      get()._processQueue();
    } else if (task && task.status === 'queued') {
      set((state) => ({
        tasks: { ...state.tasks, [songId]: { ...task, status: 'paused' } }
      }));
      get()._persistTasks();
    }
  },

  resumeDownload: (songId) => {
    const task = get().tasks[songId];
    if (task && (task.status === 'paused' || task.status === 'error')) {
      set((state) => ({
        tasks: { ...state.tasks, [songId]: { ...task, status: 'queued', retryCount: 0, error: undefined } }
      }));
      get()._persistTasks();
      get()._processQueue();
    }
  },

  cancelDownload: (songId) => {
    const task = get().tasks[songId];
    if (task) {
      if ((task.status === 'downloading' || task.status === 'verifying') && task.abortController) {
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
      await DownloadStorage.getInstance().deleteMedia(songId);
      await OfflineCatalog.getInstance().removeTrack(songId);
    } catch {}

    usePlayerStore.setState(state => ({
      downloadedSongIds: state.downloadedSongIds.filter(id => id !== songId)
    }));
    await get().fetchStorageInfo();
  },

  pauseAll: () => {
    const tasks = { ...get().tasks };
    Object.keys(tasks).forEach(id => {
      const task = tasks[id];
      if (task.status === 'downloading' || task.status === 'verifying') {
        if (task.abortController) task.abortController.abort();
        task.status = 'paused';
        task.abortController = undefined;
      } else if (task.status === 'queued') {
        task.status = 'paused';
      }
    });
    set({ tasks, activeCount: 0 });
    get()._persistTasks();
  },

  resumeAll: () => {
    const tasks = { ...get().tasks };
    Object.keys(tasks).forEach(id => {
      const task = tasks[id];
      if (task.status === 'paused' || task.status === 'error') {
        task.status = 'queued';
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
      await DownloadStorage.getInstance().clearAllMedia();
      await OfflineCatalog.getInstance().clearCatalog();
    } catch {}
    
    usePlayerStore.setState({ downloadedSongIds: [] });
    set({ tasks: {}, activeCount: 0 });
    get()._persistTasks();
    await get().fetchStorageInfo();
    console.log('[DownloadStore] All offline downloads purged.');
  },

  cancelAll: () => {
    const tasks = { ...get().tasks };
    Object.keys(tasks).forEach(id => {
      const task = tasks[id];
      if (task.status === 'downloading' && task.abortController) {
        task.abortController.abort();
      }
      delete tasks[id];
    });
    set({ tasks, activeCount: 0 });
    get()._persistTasks();
    get()._processQueue();
  },

  updateProgress: (songId, progress, downloadedBytes, totalBytes, speed) => {
    set((state) => {
      const task = state.tasks[songId];
      if (!task) return state;
      return {
        tasks: { 
          ...state.tasks, 
          [songId]: { 
            ...task, 
            progress, 
            downloadedBytes, 
            totalBytes,
            speedBytesPerSec: speed !== undefined ? speed : task.speedBytesPerSec 
          } 
        }
      };
    });
  },

  setStatus: (songId, status, error) => {
    set((state) => {
      const task = state.tasks[songId];
      if (!task) return state;
      return {
        tasks: { ...state.tasks, [songId]: { ...task, status, error: error || task.error } }
      };
    });
    get()._persistTasks();
  },

  _processQueue: () => {
    const state = get();
    const { tasks, activeCount, maxConcurrent, updateProgress, setStatus } = state;

    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      return;
    }

    if (activeCount >= maxConcurrent) return;

    const nextTaskId = Object.keys(tasks).find(id => tasks[id].status === 'queued');
    if (!nextTaskId) return;

    const task = tasks[nextTaskId];
    const abortController = new AbortController();

    set((s) => ({
      activeCount: s.activeCount + 1,
      tasks: { ...s.tasks, [nextTaskId]: { ...task, status: 'downloading', abortController } }
    }));

    const downloader = AtomicDownloader.getInstance();

    const sanitizeName = (str: string) => str.replace(/[/\\?%*:|"<>]/g, '').trim();
    const filename = `${sanitizeName(task.song.title)} - ${sanitizeName(task.song.artist || 'Artist')}.mp3`;
    
    let targetUrl = task.song.audioUrl;
    if (!targetUrl || targetUrl.includes('pixabay.com')) {
      targetUrl = `/api/download?id=${encodeURIComponent(task.song.id)}&name=${encodeURIComponent(filename)}`;
    } else {
      targetUrl = `/api/download?url=${encodeURIComponent(targetUrl)}&name=${encodeURIComponent(filename)}`;
    }

    downloader.download({
      url: targetUrl,
      trackId: task.song.id,
      quality: task.quality,
      startOffset: task.downloadedBytes > 0 ? task.downloadedBytes : 0,
      signal: abortController.signal,
      onProgress: (progress: number, downloadedBytes: number, totalBytes: number, speed: number) => {
        updateProgress(nextTaskId, progress, downloadedBytes, totalBytes, speed);
      },
      onStateChange: (downloadState: string) => {
        if (downloadState === 'VERIFYING') {
          setStatus(nextTaskId, 'verifying');
        }
      }
    }).then(async (result: any) => {
      if (task.mode === 'device_export') {
        if (typeof document !== 'undefined') {
          const exportUrl = URL.createObjectURL(result.blob);
          const anchor = document.createElement('a');
          anchor.href = exportUrl;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          setTimeout(() => {
            document.body.removeChild(anchor);
            URL.revokeObjectURL(exportUrl);
          }, 1500);
        }
      } else {
        await DownloadStorage.getInstance().saveMedia(
          task.song.id, 
          result.blob, 
          result.mimeType, 
          'liked_songs',
          { checksum: result.checksum, quality: task.quality }
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
          quality: task.quality,
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

        // Cloud sync: record download metadata in user's cloud account
        try {
          const { AccountSyncEngine } = await import('@/lib/sync/AccountSyncEngine');
          const { useAuthStore } = await import('@/context/useAuthStore');
          const activeUserId = useAuthStore.getState().user?.id || 'guest';
          await AccountSyncEngine.getInstance().recordCloudDownload(activeUserId, task.song);
        } catch (e) {
          console.warn('[useDownloadStore] Cloud download record sync deferred:', e);
        }
      }

      setStatus(nextTaskId, 'completed');
      
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
      if (currentTask && currentTask.status !== 'paused' && currentTask.status !== 'cancelled') {
        if (currentTask.retryCount < 3) {
          const nextRetry = currentTask.retryCount + 1;
          const delay = nextRetry * 1500;
          set((s) => ({
            activeCount: Math.max(0, s.activeCount - 1),
            tasks: { 
              ...s.tasks, 
              [nextTaskId]: { 
                ...currentTask, 
                status: 'queued', 
                retryCount: nextRetry,
                error: `Retrying (${nextRetry}/3)...` 
              } 
            }
          }));
          setTimeout(() => get()._processQueue(), delay);
        } else {
          setStatus(nextTaskId, 'error', err.message || 'Download failed after 3 attempts');
          set((s) => ({ activeCount: Math.max(0, s.activeCount - 1) }));
          get()._processQueue();
        }
      }
    });

    get()._processQueue();
  }
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
