import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AtomicDownloader } from '@/lib/offline/AtomicDownloader';
import { DownloadStorage } from '@/lib/offline/DownloadStorage';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { useDownloadStore } from '@/context/useDownloadStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

const mockSong: Song = {
  id: 'test_song_123',
  title: 'Test Telugu Track',
  artist: 'Test Artist',
  artistId: 'art-123',
  album: 'Test Album',
  albumId: 'alb-123',
  coverUrl: 'https://example.com/cover.jpg',
  audioUrl: 'https://saavncdn.com/test.mp3',
  duration: 210,
  genre: 'Tollywood',
  category: 'melody',
  releaseYear: 2026,
  plays: 10,
  likes: 5,
};

describe('RaagaX Production Download & Offline Architecture Tests', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      downloadedSongIds: [],
      likedSongIds: ['test_song_123'],
      queue: [],
    });
    useDownloadStore.setState({
      tasks: {},
      exportStates: {},
      activeCount: 0,
    });
  });

  // Test 1: AtomicDownloader computes SHA-256 and streams into verified Blob
  it('Test 1: AtomicDownloader streams audio into chunked buffer, computes SHA-256, and returns verified payload', async () => {
    const mockAudioData = new Uint8Array([73, 68, 51, 3, 0, 0, 0, 0, 0, 35, 255, 251, 144, 100]); // Mock MP3 buffer
    const mockResponse = new Response(mockAudioData, {
      status: 200,
      headers: {
        'content-type': 'audio/mpeg',
        'content-length': String(mockAudioData.length),
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as any);

    const downloader = AtomicDownloader.getInstance();
    const result = await downloader.download({
      url: 'https://saavncdn.com/test.mp3',
      trackId: 'test_song_123',
    });

    expect(result.blob).toBeDefined();
    expect(result.mimeType).toBe('audio/mpeg');
    expect(result.totalBytes).toBe(mockAudioData.length);
    expect(result.checksum).toBeTruthy();
    expect(typeof result.checksum).toBe('string');
  });

  // Test 2: Mode A (Save Offline) vs Mode B (Device Export) state separation
  it('Test 2: Mode A (saveForOffline) and Mode B (exportSong) operate with completely independent state machines', async () => {
    const downloadStore = useDownloadStore.getState();

    // Trigger Mode B export
    const exportPromise = downloadStore.exportSong(mockSong);
    expect(useDownloadStore.getState().exportStates[mockSong.id]?.status).toBe('DOWNLOADING');

    // Trigger Mode A saveForOffline
    await downloadStore.saveForOffline(mockSong);
    expect(useDownloadStore.getState().tasks[mockSong.id]?.mode).toBe('offline_sandboxed');
    expect(['queued', 'downloading']).toContain(useDownloadStore.getState().tasks[mockSong.id]?.status);

    // Verify playerStore downloadedSongIds is NOT optimistically marked before completion
    expect(usePlayerStore.getState().downloadedSongIds.includes(mockSong.id)).toBe(false);
  });

  // Test 3: Storage quota pre-check prevents download if device is full
  it('Test 3: checkStorageAvailable checks free storage quota and safely rejects download if full', async () => {
    const storage = DownloadStorage.getInstance();
    vi.spyOn(storage, 'getStorageEstimate').mockResolvedValueOnce({
      quota: 100 * 1024 * 1024,
      usage: 95 * 1024 * 1024,
      available: 5 * 1024 * 1024, // Only 5MB free (less than 10MB + 20MB buffer)
      raagaXUsed: 20 * 1024 * 1024,
      raagaXDownloads: 18 * 1024 * 1024,
      raagaXCache: 2 * 1024 * 1024,
      raagaXSongCount: 12,
      percentUsed: 95,
      isNative: false,
      storageType: 'browser',
      deviceName: 'Test Browser',
      deviceType: 'desktop',
      platform: 'web',
    });

    const check = await storage.checkStorageAvailable(10 * 1024 * 1024);
    expect(check.hasSpace).toBe(false);
    expect(check.availableBytes).toBe(5 * 1024 * 1024);
  });

  // Test 4: Removing offline download deletes local media but preserves Liked Songs and Playlists
  it('Test 4: removeDownload deletes offline media record but preserves user Liked Songs', async () => {
    usePlayerStore.setState({
      downloadedSongIds: [mockSong.id],
      likedSongIds: [mockSong.id],
    });

    const downloadStore = useDownloadStore.getState();
    await downloadStore.removeDownload(mockSong.id);

    // Downloaded ID removed
    expect(usePlayerStore.getState().downloadedSongIds.includes(mockSong.id)).toBe(false);
    // Liked Song preserved
    expect(usePlayerStore.getState().likedSongIds.includes(mockSong.id)).toBe(true);
  });
});
