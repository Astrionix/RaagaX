import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AtomicDownloader } from '@/lib/offline/AtomicDownloader';
import { DownloadQueue } from '@/lib/offline/DownloadQueue';
import { DownloadTask, OfflineTrack } from '@/lib/offline/types';

describe('RaagaX Offline Architecture Test Suite', () => {
  describe('1. AtomicDownloader', () => {
    it('downloads audio stream in chunks, calculates checksum, and returns validated blob', async () => {
      const mockAudioBytes = new Uint8Array([73, 68, 51, 3, 0, 0, 0, 0, 0, 0, 255, 251, 144, 100]);
      
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(mockAudioBytes.slice(0, 7));
          controller.enqueue(mockAudioBytes.slice(7));
          controller.close();
        },
      });

      const mockResponse = new Response(mockStream, {
        status: 200,
        headers: {
          'Content-Length': String(mockAudioBytes.length),
          'Content-Type': 'audio/mpeg',
        },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

      const progressUpdates: number[] = [];
      const stateUpdates: string[] = [];

      const downloader = AtomicDownloader.getInstance();
      const result = await downloader.download({
        url: 'https://saavncdn.com/test-song.mp3',
        trackId: 'track_test_123',
        quality: 'HIGH',
        onProgress: (prog) => progressUpdates.push(prog),
        onStateChange: (state) => stateUpdates.push(state),
      });

      expect(result).toBeDefined();
      expect(result.totalBytes).toBe(mockAudioBytes.length);
      expect(result.mimeType).toBe('audio/mpeg');
      expect(result.checksum).toBeDefined();
      expect(typeof result.checksum).toBe('string');
      expect(stateUpdates).toContain('CONNECTING');
      expect(stateUpdates).toContain('DOWNLOADING');
      expect(stateUpdates).toContain('VERIFYING');
      expect(stateUpdates).toContain('COMMITTING');
    });

    it('rejects empty payloads with 0 bytes', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const mockResponse = new Response(mockStream, {
        status: 200,
        headers: { 'Content-Length': '0', 'Content-Type': 'audio/mpeg' },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

      const downloader = AtomicDownloader.getInstance();
      await expect(
        downloader.download({
          url: 'https://saavncdn.com/empty.mp3',
          trackId: 'track_empty',
        })
      ).rejects.toThrow('0 bytes');
    });
  });

  describe('2. DownloadQueue Concurrency Management', () => {
    let queue: DownloadQueue;

    beforeEach(() => {
      queue = DownloadQueue.getInstance();
      // Reset queue
      const tasks = queue.getTasks();
      tasks.forEach((t) => queue.removeTask(t.id));
      queue.setMaxConcurrent(2);
    });

    it('enforces maximum 2 concurrent downloads', () => {
      expect(queue.canStartNewDownload()).toBe(true);

      const task1: DownloadTask = {
        id: 'task_1',
        trackId: 'song_1',
        mode: 'offline_sandboxed',
        quality: 'HIGH',
        status: 'queued',
        bytesDownloaded: 0,
        progress: 0,
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const task2: DownloadTask = {
        id: 'task_2',
        trackId: 'song_2',
        mode: 'offline_sandboxed',
        quality: 'HIGH',
        status: 'queued',
        bytesDownloaded: 0,
        progress: 0,
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const task3: DownloadTask = {
        id: 'task_3',
        trackId: 'song_3',
        mode: 'offline_sandboxed',
        quality: 'HIGH',
        status: 'queued',
        bytesDownloaded: 0,
        progress: 0,
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      queue.addTask(task1);
      queue.addTask(task2);
      queue.addTask(task3);

      expect(queue.getTasks().length).toBe(3);

      // Start task 1
      queue.markAsActive('task_1');
      expect(queue.canStartNewDownload()).toBe(true);

      // Start task 2
      queue.markAsActive('task_2');
      expect(queue.canStartNewDownload()).toBe(false); // Max concurrent reached

      // Finish task 1
      queue.markAsInactive('task_1');
      expect(queue.canStartNewDownload()).toBe(true); // Now task 3 can run
    });
  });

  describe('3. Offline Data Modeling', () => {
    it('structures OfflineTrack schema accurately for 30-day offline leases', () => {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      const track: OfflineTrack = {
        trackId: 'RAAGAX_TEL_999',
        localMediaId: 'RAAGAX_TEL_999',
        title: 'Naatu Naatu',
        artist: 'Rahul Sipligunj, Kaala Bhairava',
        album: 'RRR',
        duration: 216,
        durationMs: 216000,
        mimeType: 'audio/mpeg',
        quality: 'HIGH',
        fileSizeBytes: 8640000,
        checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        leaseExpiresAt: now + thirtyDaysMs,
        downloadedAt: now,
        version: '2',
      };

      expect(track.trackId).toBe('RAAGAX_TEL_999');
      expect(track.quality).toBe('HIGH');
      expect(track.leaseExpiresAt! > Date.now()).toBe(true);
      expect(track.fileSizeBytes).toBe(8640000);
    });
  });
});
