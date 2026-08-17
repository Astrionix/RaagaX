import { DownloadQueue } from './DownloadQueue';
import { DownloadStorage } from './DownloadStorage';
import { StorageManager } from './StorageManager';
import { OfflineCatalog } from './OfflineCatalog';
import { AtomicDownloader } from './AtomicDownloader';
import { DownloadTask, OfflineTrack, DownloadQuality, DownloadMode } from './types';
import { NetworkManager } from './NetworkManager';
import { Song } from '@/types/music';
import { getApiUrl } from '@/lib/config/apiConfig';

export class DownloadManager {
  private static instance: DownloadManager;
  private queue = DownloadQueue.getInstance();
  private storage = DownloadStorage.getInstance();
  private catalog = OfflineCatalog.getInstance();
  private storageManager = StorageManager.getInstance();
  private networkManager = NetworkManager.getInstance();
  private atomicDownloader = AtomicDownloader.getInstance();
  
  // Track metadata for active tasks
  private songMetadataMap: Map<string, Song> = new Map();
  // Track aborted fetch controllers
  private abortControllers: Map<string, AbortController> = new Map();
  private wifiOnly: boolean = false;

  public static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }

  private constructor() {
    this.queue.subscribe(() => {
      this.processNextInQueue();
    });

    this.networkManager.subscribe((mode) => {
      if (mode === 'offline' || mode === 'offline_forced') {
        this.pauseAllActiveDownloads();
      } else {
        this.processNextInQueue();
      }
    });
  }

  public setWifiOnly(enabled: boolean) {
    this.wifiOnly = enabled;
  }

  public isWifiOnly(): boolean {
    return this.wifiOnly;
  }

  public async downloadSong(
    song: Song, 
    mode: DownloadMode = 'offline_sandboxed',
    quality: DownloadQuality = 'HIGH',
    contextRef: string = 'liked_songs'
  ) {
    if (!song || !song.id) return;

    if (this.queue.getTaskByTrackId(song.id)) return;

    if (mode === 'offline_sandboxed' && (await this.catalog.isDownloaded(song.id))) {
      await this.storage.addReference(song.id, contextRef);
      return;
    }

    this.songMetadataMap.set(song.id, song);

    const task: DownloadTask = {
      id: crypto.randomUUID ? crypto.randomUUID() : `task_${Date.now()}_${song.id}`,
      trackId: song.id,
      mode,
      quality,
      status: 'queued',
      bytesDownloaded: 0,
      progress: 0,
      retryCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.queue.addTask(task);
  }

  public async removeSongDownload(songId: string, contextRef: string = 'liked_songs'): Promise<boolean> {
    const isFullyPurged = await this.storage.removeReference(songId, contextRef);
    if (isFullyPurged) {
      await this.catalog.removeTrack(songId);
    }
    return isFullyPurged;
  }

  public pauseAllActiveDownloads() {
    const tasks = this.queue.getTasks().filter(t => t.status === 'downloading');
    for (const task of tasks) {
      this.pauseDownload(task.id);
    }
  }

  public resumeAllDownloads() {
    const tasks = this.queue.getTasks().filter(t => t.status === 'paused' || t.status === 'failed');
    for (const task of tasks) {
      this.resumeDownload(task.id);
    }
  }

  public pauseDownload(taskId: string) {
    const task = this.queue.getTask(taskId);
    if (!task) return;

    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(taskId);
    }

    this.queue.updateTask(taskId, { status: 'paused' });
    this.queue.markAsInactive(taskId);
    this.processNextInQueue();
  }

  public resumeDownload(taskId: string) {
    const task = this.queue.getTask(taskId);
    if (!task) return;

    this.queue.updateTask(taskId, { status: 'queued', error: undefined });
    this.processNextInQueue();
  }

  public cancelDownload(taskId: string) {
    this.pauseDownload(taskId);
    const task = this.queue.getTask(taskId);
    if (task) {
      this.queue.removeTask(taskId);
    }
  }

  public async cancelAll() {
    const tasks = this.queue.getTasks();
    for (const task of tasks) {
      this.cancelDownload(task.id);
    }
  }

  private async processNextInQueue() {
    if (!this.networkManager.isOnline()) return;

    while (this.queue.canStartNewDownload()) {
      const nextTask = this.queue.getNextPendingTask();
      if (!nextTask) break;

      this.queue.updateTask(nextTask.id, { status: 'downloading' });
      this.queue.markAsActive(nextTask.id);
      
      this.executeDownload(nextTask).catch((err) => {
        if (err.name === 'AbortError') return;

        console.error('[DownloadManager] Download failed', err);
        this.queue.markAsInactive(nextTask.id);

        if (nextTask.retryCount < 3) {
          const nextRetry = nextTask.retryCount + 1;
          const delay = nextRetry * 1500;
          this.queue.updateTask(nextTask.id, { 
            status: 'queued', 
            retryCount: nextRetry,
            error: `Retrying (${nextRetry}/3): ${err.message || 'Error'}` 
          });
          setTimeout(() => this.processNextInQueue(), delay);
        } else {
          this.queue.updateTask(nextTask.id, { 
            status: 'failed', 
            error: err.message || 'Download failed after 3 attempts' 
          });
          this.processNextInQueue();
        }
      });
    }
  }

  private async executeDownload(task: DownloadTask) {
    const controller = new AbortController();
    this.abortControllers.set(task.id, controller);

    try {
      const song = this.songMetadataMap.get(task.trackId);
      const sanitizeName = (str: string) => str.replace(/[/\\?%*:|"<>]/g, '').trim();
      const filename = song ? `${sanitizeName(song.title)} - ${sanitizeName(song.artist || 'Artist')}.mp3` : 'RaagaX_Track.mp3';

      let targetUrl = song?.audioUrl;
      if (!targetUrl || targetUrl.includes('pixabay.com')) {
        targetUrl = getApiUrl(`/api/download?id=${encodeURIComponent(task.trackId)}&name=${encodeURIComponent(filename)}`);
      } else {
        targetUrl = getApiUrl(`/api/download?url=${encodeURIComponent(targetUrl)}&name=${encodeURIComponent(filename)}`);
      }

      // Step 1: Execute atomic chunked download with validation
      const downloadResult = await this.atomicDownloader.download({
        url: targetUrl,
        trackId: task.trackId,
        quality: task.quality,
        startOffset: task.bytesDownloaded > 0 ? task.bytesDownloaded : 0,
        signal: controller.signal,
        onProgress: (progress, downloadedBytes, totalBytes, speed) => {
          this.queue.updateTask(task.id, {
            progress,
            bytesDownloaded: downloadedBytes,
            totalBytes,
            speedBytesPerSec: speed,
          });
        },
        onStateChange: (state) => {
          if (state === 'VERIFYING') {
            this.queue.updateTask(task.id, { status: 'verifying' });
          }
        },
      });

      // Step 2: Mode A (Sandboxed Offline Storage) vs Mode B (Device Export)
      if (task.mode === 'device_export') {
        // Mode B: Export as standard MP3 file to device storage
        if (typeof document !== 'undefined') {
          const exportUrl = URL.createObjectURL(downloadResult.blob);
          const anchor = document.createElement('a');
          anchor.href = exportUrl;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          setTimeout(() => {
            document.body.removeChild(anchor);
            URL.revokeObjectURL(exportUrl);
          }, 1000);
        }
      } else {
        // Mode A: App-specific offline protected storage
        // Check storage accommodation
        if (!(await this.storageManager.canAccommodate(downloadResult.totalBytes))) {
          throw new Error('Device storage quota exceeded');
        }

        // Commit to sandboxed local storage
        await this.storage.saveMedia(
          task.trackId, 
          downloadResult.blob, 
          downloadResult.mimeType, 
          'liked_songs',
          { checksum: downloadResult.checksum, quality: task.quality }
        );

        // Commit rich metadata to Offline Catalog
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const trackMeta: OfflineTrack = {
          trackId: task.trackId,
          localMediaId: task.trackId,
          title: song?.title || `Track ${task.trackId}`,
          artist: song?.artist || 'Unknown Artist',
          album: song?.album,
          artworkUrl: song?.coverUrl,
          duration: song?.duration || 0,
          durationMs: (song?.duration || 0) * 1000,
          mimeType: downloadResult.mimeType,
          quality: task.quality,
          fileSizeBytes: downloadResult.totalBytes,
          checksum: downloadResult.checksum,
          leaseExpiresAt: Date.now() + thirtyDaysMs,
          downloadedAt: Date.now(),
          version: '2'
        };

        await this.catalog.addTrack(trackMeta);
      }

      this.queue.updateTask(task.id, { 
        status: 'completed', 
        progress: 100, 
        bytesDownloaded: downloadResult.totalBytes,
        checksum: downloadResult.checksum 
      });
      
    } finally {
      this.abortControllers.delete(task.id);
      this.queue.markAsInactive(task.id);
      this.processNextInQueue();
    }
  }
}

