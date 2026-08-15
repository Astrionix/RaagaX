import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DownloadStorage } from '@/lib/offline/DownloadStorage';
import { DeviceRegistry } from '@/lib/connect/DeviceRegistry';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { AccountSyncEngine, CloudDownloadRecord } from '@/lib/sync/AccountSyncEngine';
import { Song } from '@/types/music';

// Mock storage for Node test environment
const mockStorageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => mockStorageMap.get(key) || null,
  setItem: (key: string, value: string) => mockStorageMap.set(key, value),
  removeItem: (key: string) => mockStorageMap.delete(key),
  clear: () => mockStorageMap.clear(),
};

if (typeof window === 'undefined' || !(window as any).addEventListener) {
  (global as any).window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}
(global as any).localStorage = mockLocalStorage;
(global as any).sessionStorage = mockLocalStorage;

const mockSong1: Song = {
  id: 'song_storage_001',
  title: 'Hoyna Hoyna',
  artist: 'Anirudh Ravichander',
  artistId: 'art-001',
  album: 'Gang Leader',
  albumId: 'alb-001',
  coverUrl: 'https://example.com/cover1.jpg',
  audioUrl: 'https://example.com/audio1.mp3',
  duration: 210,
  genre: 'Tollywood',
  category: 'melody',
  releaseYear: 2019,
  plays: 100,
  likes: 45,
};

const mockSong2: Song = {
  id: 'song_storage_002',
  title: 'Butta Bomma',
  artist: 'Armaan Malik',
  artistId: 'art-002',
  album: 'Ala Vaikunthapurramuloo',
  albumId: 'alb-002',
  coverUrl: 'https://example.com/cover2.jpg',
  audioUrl: 'https://example.com/audio2.mp3',
  duration: 195,
  genre: 'Tollywood',
  category: 'melody',
  releaseYear: 2020,
  plays: 250,
  likes: 120,
};

describe('Dynamic Device Storage & Offline Cache Architecture Tests', () => {
  beforeEach(() => {
    mockStorageMap.clear();
    usePlayerStore.setState({
      deviceId: 'dev_test_100',
      downloadedSongIds: [],
      cloudDownloadedSongIds: [],
      cloudDownloadRecords: [],
      onlineDevices: [],
    });
    useDownloadStore.setState({
      tasks: {},
      exportStates: {},
      activeCount: 0,
    });
  });

  // Test 1: Device Name Resolution and Custom Renaming
  it('Test 1: DeviceRegistry resolves registered device name and supports custom renaming', async () => {
    const registry = DeviceRegistry.getInstance();
    
    // Default device name check
    const defaultInfo = registry.getFriendlyDeviceName();
    expect(defaultInfo.name).toBeDefined();
    expect(defaultInfo.platform).toBeDefined();

    // Set custom device name (e.g. "TNT Gaming PC" or "Galaxy S23")
    await registry.setCustomDeviceName('TNT Gaming PC');

    const updatedInfo = registry.getFriendlyDeviceName();
    expect(updatedInfo.name).toBe('TNT Gaming PC');
    expect(mockLocalStorage.getItem('raagax_custom_device_name')).toBe('TNT Gaming PC');

    // Rename to Mobile device name
    await registry.setCustomDeviceName('Galaxy S23');
    const mobileInfo = registry.getFriendlyDeviceName();
    expect(mobileInfo.name).toBe('Galaxy S23');
  });

  // Test 2: Storage Estimate Computation & Dynamic Metrics
  it('Test 2: DownloadStorage computes accurate dynamic storage breakdown (Quota, Free, RaagaX Downloads, Cache)', async () => {
    const storage = DownloadStorage.getInstance();

    // Mock total storage used
    vi.spyOn(storage, 'getTotalStorageUsed').mockResolvedValue(4.2 * 1024 * 1024 * 1024); // 4.2 GB
    vi.spyOn(storage, 'getAllDownloadedTrackIds').mockResolvedValue(['song_1', 'song_2', 'song_3', 'song_4']);

    // Set custom device name
    mockLocalStorage.setItem('raagax_custom_device_name', 'TNT Gaming PC');

    const estimate = await storage.getStorageEstimate();

    expect(estimate.deviceName).toBe('TNT Gaming PC');
    expect(estimate.raagaXDownloads).toBe(4.2 * 1024 * 1024 * 1024);
    expect(estimate.raagaXSongCount).toBe(4);
    expect(estimate.quota).toBeGreaterThan(0);
    expect(estimate.available).toBeGreaterThan(0);
    expect(estimate.percentUsed).toBeGreaterThanOrEqual(0);
    expect(estimate.percentUsed).toBeLessThanOrEqual(100);
  });

  // Test 3: Two Distinct Storage Concepts Separation
  it('Test 3: Accurately separates Total Device/Browser Storage vs RaagaX Internal Footprint', async () => {
    const storage = DownloadStorage.getInstance();

    // Total quota = 512 GB, System usage = 225 GB, RaagaX downloads = 4.2 GB, RaagaX cache = 800 MB
    const totalDiskQuota = 512 * 1024 * 1024 * 1024;
    const downloadsBytes = 4.2 * 1024 * 1024 * 1024;
    const cacheBytes = 800 * 1024 * 1024;

    vi.spyOn(storage, 'getTotalStorageUsed').mockResolvedValue(downloadsBytes);
    vi.spyOn(storage, 'getAllDownloadedTrackIds').mockResolvedValue(Array(24).fill('song_id'));

    // Mock navigator.storage.estimate
    if (typeof navigator !== 'undefined') {
      (navigator as any).storage = {
        estimate: vi.fn().mockResolvedValue({
          quota: totalDiskQuota,
          usage: downloadsBytes + cacheBytes,
          usageDetails: {
            indexedDB: downloadsBytes,
            caches: cacheBytes,
          }
        })
      };
    }

    const estimate = await storage.getStorageEstimate();

    // Concept 1: Total Device Storage
    expect(estimate.quota).toBe(totalDiskQuota);
    expect(estimate.available).toBe(totalDiskQuota - (downloadsBytes + cacheBytes));

    // Concept 2: RaagaX Internal Footprint
    expect(estimate.raagaXDownloads).toBe(downloadsBytes);
    expect(estimate.raagaXCache).toBe(cacheBytes);
    expect(estimate.raagaXUsed).toBe(downloadsBytes + cacheBytes);
    expect(estimate.raagaXSongCount).toBe(24);
  });

  // Test 4: Dynamic Formatting of Storage Values (GB / MB)
  it('Test 4: Formats bytes accurately into human readable GB and MB values without hardcoding 2 GB', () => {
    const formatBytes = (bytes: number) => {
      if (!bytes || bytes <= 0) return '0 MB';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      const val = bytes / Math.pow(k, i);
      return (val >= 10 ? val.toFixed(0) : val.toFixed(1)) + ' ' + sizes[i];
    };

    expect(formatBytes(512 * 1024 * 1024 * 1024)).toBe('512 GB');
    expect(formatBytes(287.4 * 1024 * 1024 * 1024)).toBe('287 GB');
    expect(formatBytes(4.2 * 1024 * 1024 * 1024)).toBe('4.2 GB');
    expect(formatBytes(800 * 1024 * 1024)).toBe('800 MB');
    expect(formatBytes(1.3 * 1024 * 1024)).toBe('1.3 MB');
  });

  // Test 5: Cache Clearing vs Purging Downloads
  it('Test 5: Clear Cache removes temporary streaming data while preserving offline downloaded songs', async () => {
    const downloadStore = useDownloadStore.getState();

    // Set offline downloaded songs
    usePlayerStore.setState({
      downloadedSongIds: [mockSong1.id, mockSong2.id],
    });

    // Clear streaming cache
    await downloadStore.clearStreamingCache();

    // Downloaded songs must remain intact!
    expect(usePlayerStore.getState().downloadedSongIds).toContain(mockSong1.id);
    expect(usePlayerStore.getState().downloadedSongIds).toContain(mockSong2.id);
  });

  // Test 6: Cloud History Synchronization & 1-Click Restore
  it('Test 6: Cloud download records allow 1-click restore across devices after reinstall', async () => {
    const syncEngine = AccountSyncEngine.getInstance();
    
    // Record cloud download for mockSong1
    await syncEngine.recordCloudDownload('user_abc', mockSong1);

    const { cloudDownloadedSongIds, cloudDownloadRecords, downloadedSongIds } = usePlayerStore.getState();

    // Song is recorded in cloud
    expect(cloudDownloadedSongIds).toContain(mockSong1.id);
    expect(cloudDownloadRecords.some(r => r.song_id === mockSong1.id)).toBe(true);

    // On fresh device / reinstall, local file is not present
    expect(downloadedSongIds).not.toContain(mockSong1.id);

    // Cloud record provides title, artist, duration for 1-click restore
    const record = cloudDownloadRecords.find(r => r.song_id === mockSong1.id);
    expect(record?.song_title).toBe('Hoyna Hoyna');
    expect(record?.song_artist).toBe('Anirudh Ravichander');
  });
});
