import { create } from 'zustand';
import { Song } from '@/types/music';
import { downloadSongFile, removeCachedSong } from '@/lib/downloadHelper';
import { usePlayerStore } from '@/context/usePlayerStore';
import { LocalDatabase } from '@/lib/localDatabase';

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';

export interface DownloadTask {
  song: Song;
  status: DownloadStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  retryCount: number;
  error?: string;
  abortController?: AbortController;
}

interface DownloadStore {
  tasks: Record<string, DownloadTask>;
  activeCount: number;
  maxConcurrent: number;
  wifiOnly: boolean;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  queueDownload: (song: Song) => void;
  pauseDownload: (songId: string) => void;
  resumeDownload: (songId: string) => void;
  cancelDownload: (songId: string) => void;
  removeDownload: (songId: string) => void;
  downloadPlaylist: (songs: Song[]) => void;
  pauseAll: () => void;
  resumeAll: () => void;
  cancelAll: () => void;

  setWifiOnly: (wifiOnly: boolean) => void;

  updateProgress: (songId: string, progress: number, downloadedBytes: number, totalBytes: number) => void;
  setStatus: (songId: string, status: DownloadStatus, error?: string) => void;
  
  isOfflineStorageEnabled: boolean;
  setOfflineStorageEnabled: (enabled: boolean) => void;
  
  isSetupModalOpen: boolean;
  setSetupModalOpen: (open: boolean) => void;
  
  isOfflineMode: boolean;
  setOfflineMode: (enabled: boolean) => void;

  offlineSettings: {
    audioQuality: 'High' | 'Standard';
    autoDeleteTemp: boolean;
    smartDownloads: boolean;
  };
  setOfflineSettings: (settings: Partial<DownloadStore['offlineSettings']>) => void;
  setMaxConcurrent: (count: number) => void;

  _processQueue: () => void;
  _persistTasks: () => void;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  tasks: {},
  activeCount: 0,
  maxConcurrent: 3,
  wifiOnly: false,
  isHydrated: false,
  isOfflineStorageEnabled: false,
  isSetupModalOpen: false,
  isOfflineMode: false,
  offlineSettings: {
    audioQuality: 'High',
    autoDeleteTemp: false,
    smartDownloads: false,
  },

  setOfflineStorageEnabled: (enabled) => { set({ isOfflineStorageEnabled: enabled }); get()._persistTasks(); },
  setSetupModalOpen: (open) => set({ isSetupModalOpen: open }),
  setOfflineMode: (enabled) => { set({ isOfflineMode: enabled }); get()._persistTasks(); },
  setOfflineSettings: (settings) => { set((state) => ({ offlineSettings: { ...state.offlineSettings, ...settings } })); get()._persistTasks(); },
  setMaxConcurrent: (count) => set({ maxConcurrent: count }),

  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const db = LocalDatabase.getInstance();
      const savedTasks = await db.loadDownloadTasks();
      
      const hydratedTasks: Record<string, DownloadTask> = {};
      Object.keys(savedTasks).forEach(id => {
        const task = savedTasks[id];
        // If it was downloading, reset to paused to recover gracefully
        if (task.status === 'downloading') {
          task.status = 'paused';
        }
        hydratedTasks[id] = task;
      });

      // Load offline settings
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
    if (wifiOnly && typeof navigator !== 'undefined') {
      // Very basic wifi check, navigator.connection is experimental
      const conn = (navigator as any).connection;
      if (conn && conn.type !== 'wifi' && conn.type !== 'ethernet' && conn.type !== 'unknown') {
        get().pauseAll();
      }
    }
  },

  queueDownload: (song) => {
    const { tasks, _processQueue, _persistTasks } = get();
    if (usePlayerStore.getState().downloadedSongIds.includes(song.id)) return;
    if (tasks[song.id] && ['downloading', 'queued', 'completed'].includes(tasks[song.id].status)) return;

    set((state) => ({
      tasks: {
        ...state.tasks,
        [song.id]: { 
          song, status: 'queued', progress: 0, 
          downloadedBytes: 0, totalBytes: 0, retryCount: 0 
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
      if (downloadedIds.includes(song.id)) return;
      if (newTasks[song.id] && ['downloading', 'queued', 'completed'].includes(newTasks[song.id].status)) return;
      
      newTasks[song.id] = { 
        song, status: 'queued', progress: 0, 
        downloadedBytes: 0, totalBytes: 0, retryCount: 0 
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
    if (task && task.status === 'downloading') {
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
      if (task.status === 'downloading' && task.abortController) {
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

  removeDownload: (songId) => {
    get().cancelDownload(songId);
    
    // Remove from local cache
    const songInQueue = usePlayerStore.getState().queue.find(s => s.id === songId);
    if (songInQueue) removeCachedSong(songInQueue);

    // Update player store
    usePlayerStore.setState(state => ({
      downloadedSongIds: state.downloadedSongIds.filter(id => id !== songId)
    }));
  },

  pauseAll: () => {
    const tasks = { ...get().tasks };
    let activeChanged = false;
    Object.keys(tasks).forEach(id => {
      const task = tasks[id];
      if (task.status === 'downloading') {
        if (task.abortController) task.abortController.abort();
        task.status = 'paused';
        task.abortController = undefined;
        activeChanged = true;
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

  cancelAll: () => {
    const tasks = { ...get().tasks };
    let activeChanged = false;
    Object.keys(tasks).forEach(id => {
      const task = tasks[id];
      if (task.status === 'downloading') {
        if (task.abortController) task.abortController.abort();
        activeChanged = true;
      }
      delete tasks[id];
    });
    set({ tasks, activeCount: 0 });
    get()._persistTasks();
    get()._processQueue();
  },

  updateProgress: (songId, progress, downloadedBytes, totalBytes) => {
    set((state) => {
      const task = state.tasks[songId];
      if (!task) return state;
      return {
        tasks: { ...state.tasks, [songId]: { ...task, progress, downloadedBytes, totalBytes } }
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
      return; // Handled by network listeners
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

    downloadSongFile(
      task.song, 
      abortController.signal, 
      (progress, downloadedBytes, totalBytes) => updateProgress(nextTaskId, progress, downloadedBytes, totalBytes),
      task.downloadedBytes // Resume offset
    ).then((success) => {
      if (success) {
        setStatus(nextTaskId, 'completed');
        usePlayerStore.setState(s => ({
          downloadedSongIds: [...new Set([...s.downloadedSongIds, nextTaskId])]
        }));
        
        // Let it disappear from queue after completion
        setTimeout(() => {
          set((s) => {
            const newTasks = { ...s.tasks };
            delete newTasks[nextTaskId];
            return { tasks: newTasks };
          });
          get()._persistTasks();
        }, 3000);
      }
      set((s) => ({ activeCount: Math.max(0, s.activeCount - 1) }));
      get()._processQueue();
    }).catch((err) => {
      if (err.name === 'AbortError') {
         // It was paused/cancelled, do not error out
         set((s) => ({ activeCount: Math.max(0, s.activeCount - 1) }));
         get()._processQueue();
         return;
      }
      
      // Exponential Backoff Retry Logic
      const currentTask = get().tasks[nextTaskId];
      if (currentTask && currentTask.status !== 'paused' && currentTask.status !== 'cancelled') {
        if (currentTask.retryCount < 3) {
           const nextRetry = currentTask.retryCount + 1;
           const delay = nextRetry === 1 ? 1000 : nextRetry === 2 ? 3000 : 8000;
           
           console.warn(`[DownloadManager] Download failed for ${task.song.title}, retrying in ${delay}ms...`);
           
           set((s) => ({
             activeCount: Math.max(0, s.activeCount - 1),
             tasks: { ...s.tasks, [nextTaskId]: { ...currentTask, status: 'queued', retryCount: nextRetry } }
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

// Setup Network Listeners
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    console.log('[DownloadManager] Device went offline. Pausing downloads.');
    useDownloadStore.getState().pauseAll();
  });

  window.addEventListener('online', () => {
    console.log('[DownloadManager] Device came online. Resuming downloads.');
    useDownloadStore.getState().resumeAll();
  });
}
