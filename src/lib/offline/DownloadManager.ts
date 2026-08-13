import { DownloadQueue } from './DownloadQueue';
import { DownloadStorage } from './DownloadStorage';
import { StorageManager } from './StorageManager';
import { OfflineCatalog } from './OfflineCatalog';
import { DownloadTask, OfflineTrack } from './types';
import { NetworkManager } from './NetworkManager';
import { Song } from '@/types/music';

export class DownloadManager {
  private static instance: DownloadManager;
  private queue = DownloadQueue.getInstance();
  private storage = DownloadStorage.getInstance();
  private catalog = OfflineCatalog.getInstance();
  private storageManager = StorageManager.getInstance();
  private networkManager = NetworkManager.getInstance();
  
  // Track metadata for active tasks
  private songMetadataMap: Map<string, Song> = new Map();
  // Track aborted fetch controllers
  private abortControllers: Map<string, AbortController> = new Map();

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

  public async downloadSong(song: Song, contextRef: string = 'liked_songs') {
    if (this.queue.getTaskByTrackId(song.id)) return;

    if (await this.catalog.isDownloaded(song.id)) {
      await this.storage.addReference(song.id, contextRef);
      return;
    }

    this.songMetadataMap.set(song.id, song);

    const task: DownloadTask = {
      id: crypto.randomUUID(),
      trackId: song.id,
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

  private pauseAllActiveDownloads() {
    const tasks = this.queue.getTasks().filter(t => t.status === 'downloading');
    for (const task of tasks) {
      this.pauseDownload(task.id);
    }
  }

  public pauseDownload(taskId: string) {
    const task = this.queue.getTask(taskId);
    if (!task || task.status !== 'downloading') return;

    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(taskId);
    }

    this.queue.updateTask(taskId, { status: 'paused' });
    this.queue.markAsInactive(taskId);
    this.processNextInQueue();
  }

  public cancelDownload(taskId: string) {
    this.pauseDownload(taskId);
    const task = this.queue.getTask(taskId);
    if (task) {
      this.queue.removeTask(taskId);
    }
  }

  private async processNextInQueue() {
    if (!this.networkManager.isOnline()) return;

    while (this.queue.canStartNewDownload()) {
      const nextTask = this.queue.getNextPendingTask();
      if (!nextTask) break;

      this.queue.updateTask(nextTask.id, { status: 'downloading' });
      this.queue.markAsActive(nextTask.id);
      
      this.executeDownload(nextTask).catch(err => {
        console.error('[DownloadManager] Download failed', err);
        this.queue.markAsInactive(nextTask.id);
        this.queue.updateTask(nextTask.id, { status: 'failed' });
        this.processNextInQueue();
      });
    }
  }

  private async executeDownload(task: DownloadTask) {
    const controller = new AbortController();
    this.abortControllers.set(task.id, controller);

    try {
      const song = this.songMetadataMap.get(task.trackId);
      const targetUrl = song?.audioUrl || `/api/download?id=${task.trackId}`;

      const res = await fetch(targetUrl, { 
        signal: controller.signal 
      });

      if (!res.ok) throw new Error('Failed to fetch audio stream for download');
      if (!res.body) throw new Error('No body returned from audio endpoint');

      const contentLength = Number(res.headers.get('Content-Length')) || 0;
      this.queue.updateTask(task.id, { totalBytes: contentLength });

      const mimeType = res.headers.get('Content-Type') || 'audio/mpeg';
      const blob = await res.blob();

      // Check quota
      if (!(await this.storageManager.canAccommodate(blob.size))) {
        throw new Error('Storage quota exceeded');
      }

      await this.storage.saveMedia(task.trackId, blob, mimeType, 'liked_songs');

      const trackMeta: OfflineTrack = {
        trackId: task.trackId,
        localMediaId: task.trackId,
        title: song?.title || `Track ${task.trackId}`,
        artist: song?.artist || 'Unknown',
        album: song?.album,
        artworkUrl: song?.coverUrl,
        duration: song?.duration || 0,
        durationMs: (song?.duration || 0) * 1000,
        downloadedAt: Date.now(),
        version: '1'
      };

      await this.catalog.addTrack(trackMeta);

      this.queue.updateTask(task.id, { 
        status: 'completed', 
        progress: 100, 
        bytesDownloaded: blob.size 
      });
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log(`Download ${task.id} paused`);
        return;
      }
      throw err;
    } finally {
      this.abortControllers.delete(task.id);
      this.queue.markAsInactive(task.id);
      this.processNextInQueue();
    }
  }
}
