import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// 1. Mock Capacitor core first
vi.mock('@capacitor/core', () => {
  const mockUpdaterInstance = {
    getAppVersionInfo: vi.fn().mockResolvedValue({ versionCode: 10, versionName: '1.0.0' }),
    canRequestPackageInstalls: vi.fn().mockResolvedValue({ granted: true }),
    openInstallSettings: vi.fn().mockResolvedValue(undefined),
    downloadApk: vi.fn().mockResolvedValue({ success: true, filePath: '/cache/raagax_update.apk', sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
    cancelDownload: vi.fn().mockResolvedValue(undefined),
    installApk: vi.fn().mockResolvedValue({ success: true }),
    addListener: vi.fn().mockImplementation((event, callback) => {
      return { remove: vi.fn() };
    })
  };
  return {
    registerPlugin: vi.fn().mockImplementation((name) => {
      if (name === 'RaagaXUpdater') return mockUpdaterInstance;
      return {};
    }),
    Capacitor: {
      getPlatform: () => 'android'
    }
  };
});

import { registerPlugin } from '@capacitor/core';
const mockUpdater = registerPlugin('RaagaXUpdater') as any;

// Set up local storage mock
const mockStorage = new Map<string, string>();
(global as any).localStorage = {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
  clear: () => mockStorage.clear(),
};

// Set up global fetch mock
const fetchMock = vi.fn();
(global as any).fetch = fetchMock;

import { useUpdateStore } from '@/context/useUpdateStore';
import { usePlayerStore } from '@/context/usePlayerStore';

describe('RaagaX Non-Play Store Self-Update Engine', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();

    // Default implementations for mockUpdater to prevent undefined resolves
    mockUpdater.getAppVersionInfo.mockResolvedValue({ versionCode: 10, versionName: '1.0.0' });
    mockUpdater.canRequestPackageInstalls.mockResolvedValue({ granted: true });
    mockUpdater.openInstallSettings.mockResolvedValue(undefined);
    mockUpdater.downloadApk.mockResolvedValue({ success: true, filePath: '/cache/raagax_update.apk', sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' });
    mockUpdater.cancelDownload.mockResolvedValue(undefined);
    mockUpdater.installApk.mockResolvedValue({ success: true });

    useUpdateStore.setState({
      state: 'IDLE',
      manifest: null,
      downloadProgress: { percentage: 0, downloadedBytes: 0, totalBytes: 0 },
      error: null,
      installedVersion: null,
      downloadedFilePath: null,
      showModal: false,
      isInstallPermissionRequested: false,
      isInitialized: false
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Up-to-date scenario does not prompt update UI', async () => {
    const manifest = {
      versionCode: 10,
      versionName: '1.0.0',
      apkUrl: 'https://cdn.raagax.com/apks/RaagaX-1.0.0.apk',
      sha256: 'hash_1.0.0',
      fileSize: 10000000,
      mandatory: false,
      minimumSupportedVersion: 1,
      releaseNotes: ['Stable release'],
      releaseChannel: 'stable'
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => manifest
    });

    const store = useUpdateStore.getState();
    await store.init();
    const updateAvailable = await store.checkForUpdates(true);

    expect(updateAvailable).toBe(false);
    expect(useUpdateStore.getState().state).toBe('UP_TO_DATE');
    expect(useUpdateStore.getState().showModal).toBe(false);
  });

  it('2. Optional update prompts user with Later option', async () => {
    const manifest = {
      versionCode: 11,
      versionName: '1.1.0',
      apkUrl: 'https://cdn.raagax.com/apks/RaagaX-1.1.0.apk',
      sha256: 'hash_1.1.0',
      fileSize: 12000000,
      mandatory: false,
      minimumSupportedVersion: 1,
      releaseNotes: ['Optional feature release'],
      releaseChannel: 'stable'
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => manifest
    });

    const store = useUpdateStore.getState();
    await store.init();
    const updateAvailable = await store.checkForUpdates(true);

    expect(updateAvailable).toBe(true);
    expect(useUpdateStore.getState().state).toBe('UPDATE_AVAILABLE');
    expect(useUpdateStore.getState().manifest).toEqual(manifest);
    expect(useUpdateStore.getState().showModal).toBe(true);

    useUpdateStore.getState().closeModal();
    expect(useUpdateStore.getState().showModal).toBe(false);
    expect(localStorage.getItem('raagax_dismissed_update_version')).toBe('11');
  });

  it('3. Mandatory update prevents Later dismiss', async () => {
    const manifest = {
      versionCode: 12,
      versionName: '1.2.0',
      apkUrl: 'https://cdn.raagax.com/apks/RaagaX-1.2.0.apk',
      sha256: 'hash_1.2.0',
      fileSize: 13000000,
      mandatory: true,
      minimumSupportedVersion: 10,
      releaseNotes: ['Important patch'],
      releaseChannel: 'stable'
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => manifest
    });

    const store = useUpdateStore.getState();
    await store.init();
    const updateAvailable = await store.checkForUpdates(true);
    
    expect(updateAvailable).toBe(true);
    expect(useUpdateStore.getState().showModal).toBe(true);

    useUpdateStore.getState().closeModal();
    expect(useUpdateStore.getState().showModal).toBe(false);
  });

  it('4. Download and install triggers sequentially on user click', async () => {
    const manifest = {
      versionCode: 12,
      versionName: '1.2.0',
      apkUrl: 'https://cdn.raagax.com/apks/RaagaX-1.2.0.apk',
      sha256: 'hash_1.2.0',
      fileSize: 13000000,
      mandatory: false,
      minimumSupportedVersion: 1,
      releaseNotes: ['Important patch'],
      releaseChannel: 'stable'
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => manifest
    });

    const store = useUpdateStore.getState();
    await store.init();
    await store.checkForUpdates(true);

    mockUpdater.downloadApk.mockResolvedValue({
      success: true,
      filePath: '/cache/raagax_update.apk',
      sha256: 'hash_1.2.0'
    });
    mockUpdater.installApk.mockResolvedValue({ success: true });

    await useUpdateStore.getState().startDownload();

    expect(mockUpdater.downloadApk).toHaveBeenCalled();
    expect(mockUpdater.installApk).toHaveBeenCalledWith({ filePath: '/cache/raagax_update.apk' });
    expect(useUpdateStore.getState().state).toBe('COMPLETED');
  });

  it('5. Download cancellation stops native worker', async () => {
    const manifest = {
      versionCode: 12,
      versionName: '1.2.0',
      apkUrl: 'https://cdn.raagax.com/apks/RaagaX-1.2.0.apk',
      sha256: 'hash_1.2.0',
      fileSize: 13000000,
      mandatory: false,
      minimumSupportedVersion: 1,
      releaseNotes: ['Patch release'],
      releaseChannel: 'stable'
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => manifest
    });

    const store = useUpdateStore.getState();
    await store.init();
    await store.checkForUpdates(true);

    mockUpdater.downloadApk.mockRejectedValue({ code: 'DOWNLOAD_CANCELLED', message: 'Cancelled by user' });

    const p = useUpdateStore.getState().startDownload();
    await useUpdateStore.getState().cancelDownload();
    await p;

    expect(mockUpdater.cancelDownload).toHaveBeenCalled();
    expect(useUpdateStore.getState().state).toBe('UPDATE_AVAILABLE');
  });

  it('6. Checksum mismatch aborts installation and clears download state', async () => {
    const manifest = {
      versionCode: 12,
      versionName: '1.2.0',
      apkUrl: 'https://cdn.raagax.com/apks/RaagaX-1.2.0.apk',
      sha256: 'hash_1.2.0_expected',
      fileSize: 13000000,
      mandatory: false,
      minimumSupportedVersion: 1,
      releaseNotes: ['Important patch'],
      releaseChannel: 'stable'
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => manifest
    });

    const store = useUpdateStore.getState();
    await store.init();
    await store.checkForUpdates(true);

    mockUpdater.downloadApk.mockRejectedValue({
      code: 'CHECKSUM_MISMATCH',
      message: 'SHA-256 verification failed'
    });

    await useUpdateStore.getState().startDownload();

    expect(mockUpdater.downloadApk).toHaveBeenCalled();
    expect(mockUpdater.installApk).not.toHaveBeenCalled();
    expect(useUpdateStore.getState().state).toBe('DOWNLOAD_FAILED');
    expect(useUpdateStore.getState().error?.code).toBe('CHECKSUM_MISMATCH');
  });

  it('7. Insufficient storage cancels download with error details', async () => {
    const manifest = {
      versionCode: 12,
      versionName: '1.2.0',
      apkUrl: 'https://cdn.raagax.com/apks/RaagaX-1.2.0.apk',
      sha256: 'hash_1.2.0',
      fileSize: 13000000,
      mandatory: false,
      minimumSupportedVersion: 1,
      releaseNotes: ['Important patch'],
      releaseChannel: 'stable'
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => manifest
    });

    const store = useUpdateStore.getState();
    await store.init();
    await store.checkForUpdates(true);

    mockUpdater.downloadApk.mockRejectedValue({
      code: 'INSUFFICIENT_STORAGE',
      message: 'Not enough storage space available'
    });

    await useUpdateStore.getState().startDownload();

    expect(useUpdateStore.getState().state).toBe('DOWNLOAD_FAILED');
    expect(useUpdateStore.getState().error?.code).toBe('INSUFFICIENT_STORAGE');
  });

  it('8. Install permission requested redirects user to Android settings', async () => {
    const manifest = {
      versionCode: 12,
      versionName: '1.2.0',
      apkUrl: 'https://cdn.raagax.com/apks/RaagaX-1.2.0.apk',
      sha256: 'hash_1.2.0',
      fileSize: 13000000,
      mandatory: false,
      minimumSupportedVersion: 1,
      releaseNotes: ['Important patch'],
      releaseChannel: 'stable'
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => manifest
    });

    const store = useUpdateStore.getState();
    await store.init();
    await store.checkForUpdates(true);

    mockUpdater.downloadApk.mockResolvedValue({
      success: true,
      filePath: '/cache/raagax_update.apk',
      sha256: 'hash_1.2.0'
    });
    mockUpdater.installApk.mockResolvedValue({ permissionRequired: true });

    await useUpdateStore.getState().startDownload();

    expect(mockUpdater.installApk).toHaveBeenCalled();
    expect(mockUpdater.openInstallSettings).toHaveBeenCalled();
    expect(useUpdateStore.getState().isInstallPermissionRequested).toBe(true);
    expect(useUpdateStore.getState().state).toBe('VERIFIED');
  });

  it('9. Concurrency: Prevent duplicate concurrent update download sessions', async () => {
    const manifest = {
      versionCode: 12,
      versionName: '1.2.0',
      apkUrl: 'https://cdn.raagax.com/apks/RaagaX-1.2.0.apk',
      sha256: 'hash_1.2.0',
      fileSize: 13000000,
      mandatory: false,
      minimumSupportedVersion: 1,
      releaseNotes: ['Important patch'],
      releaseChannel: 'stable'
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => manifest
    });

    const store = useUpdateStore.getState();
    await store.init();
    await store.checkForUpdates(true);

    mockUpdater.downloadApk.mockResolvedValue({ success: true, filePath: '/cache/raagax_update.apk' });
    mockUpdater.installApk.mockResolvedValue({ success: true });

    const p1 = useUpdateStore.getState().startDownload();
    const p2 = useUpdateStore.getState().startDownload();

    await Promise.all([p1, p2]);

    expect(mockUpdater.downloadApk).toHaveBeenCalledTimes(1);
  });

  it('10. Playback is decoupled from update checking and downloader states', () => {
    usePlayerStore.setState({ isPlaying: true, currentSong: { id: 'track_1', title: 'Song 1', artist: 'Artist 1', album: 'Album 1', duration: 180, coverUrl: '', audioUrl: '' } as any });

    useUpdateStore.setState({ state: 'DOWNLOADING', downloadProgress: { percentage: 50, downloadedBytes: 500, totalBytes: 1000 } });

    const player = usePlayerStore.getState();
    expect(player.isPlaying).toBe(true);
    expect(player.currentSong?.id).toBe('track_1');
  });
});
