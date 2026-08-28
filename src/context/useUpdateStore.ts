import { create } from 'zustand';
import { registerPlugin, Capacitor } from '@capacitor/core';

export type UpdateState =
  | 'IDLE'
  | 'CHECKING'
  | 'UP_TO_DATE'
  | 'UPDATE_AVAILABLE'
  | 'DOWNLOADING'
  | 'DOWNLOAD_PAUSED'
  | 'DOWNLOAD_FAILED'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'INSTALLING'
  | 'INSTALL_FAILED'
  | 'COMPLETED';

export interface VersionManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256: string;
  fileSize: number;
  mandatory: boolean;
  minimumSupportedVersion: number;
  releaseNotes: string[];
  releaseChannel?: 'stable' | 'beta' | 'internal';
}

interface AppVersionInfo {
  versionCode: number;
  versionName: string;
}

interface RaagaXUpdaterPlugin {
  getAppVersionInfo(): Promise<AppVersionInfo>;
  canRequestPackageInstalls(): Promise<{ granted: boolean }>;
  openInstallSettings(): Promise<void>;
  downloadApk(options: { url: string; sha256: string; fileSize?: number }): Promise<{ success: boolean; filePath: string; sha256: string }>;
  cancelDownload(): Promise<void>;
  installApk(options: { filePath: string }): Promise<{ success?: boolean; permissionRequired?: boolean }>;
}

const isAndroid = Capacitor.getPlatform() === 'android';
const RaagaXUpdater = isAndroid
  ? registerPlugin<RaagaXUpdaterPlugin>('RaagaXUpdater')
  : null;

interface UpdateStore {
  state: UpdateState;
  manifest: VersionManifest | null;
  downloadProgress: { percentage: number; downloadedBytes: number; totalBytes: number };
  error: { code: string; message: string } | null;
  installedVersion: AppVersionInfo | null;
  downloadedFilePath: string | null;
  showModal: boolean;
  isInstallPermissionRequested: boolean;
  isInitialized: boolean;

  // Actions
  init: () => Promise<void>;
  checkForUpdates: (force?: boolean) => Promise<boolean>;
  startDownload: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  installUpdate: () => Promise<void>;
  closeModal: () => void;
  openModal: () => void;
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  state: 'IDLE',
  manifest: null,
  downloadProgress: { percentage: 0, downloadedBytes: 0, totalBytes: 0 },
  error: null,
  installedVersion: null,
  downloadedFilePath: null,
  showModal: false,
  isInstallPermissionRequested: false,
  isInitialized: false,

  init: async () => {
    if (get().isInitialized) return;
    if (!isAndroid || !RaagaXUpdater) {
      set({ isInitialized: true });
      return;
    }

    try {
      const info = await RaagaXUpdater.getAppVersionInfo();
      set({ installedVersion: info });

      // Register Native Listeners
      (RaagaXUpdater as any).addListener('updateDownloadProgress', (progress: any) => {
        set({
          downloadProgress: {
            percentage: progress.percentage,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes
          }
        });
      });

      (RaagaXUpdater as any).addListener('updateStatusChanged', (data: any) => {
        if (data.status === 'VERIFYING') {
          set({ state: 'VERIFYING' });
        }
      });

      (RaagaXUpdater as any).addListener('updateError', (err: any) => {
        set({
          state: 'DOWNLOAD_FAILED',
          error: { code: err.code || 'DOWNLOAD_ERROR', message: err.message || 'Download failed' }
        });
      });

      set({ isInitialized: true });

      // Run automatic background update check on app start
      get().checkForUpdates(false).catch(() => { });

    } catch (e: any) {
      console.warn('[UpdateStore] Initialization failed:', e);
      set({ isInitialized: true });
    }
  },

  checkForUpdates: async (force = false) => {
    if (!isAndroid || !RaagaXUpdater) {
      set({ state: 'UP_TO_DATE' });
      return false;
    }

    try {
      let installed = get().installedVersion;
      if (!installed) {
        installed = await RaagaXUpdater.getAppVersionInfo();
        set({ installedVersion: installed });
      }

      // Checking interval guard: 6 hours
      const now = Date.now();
      const lastCheckStr = localStorage.getItem('raagax_last_update_check');
      const lastCheck = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;
      const cachedManifestStr = localStorage.getItem('raagax_cached_update_manifest');

      if (!force && (now - lastCheck < 6 * 60 * 60 * 1000) && cachedManifestStr) {
        try {
          const cachedManifest = JSON.parse(cachedManifestStr) as VersionManifest;
          if (cachedManifest.versionCode > installed.versionCode) {
            set({
              state: 'UPDATE_AVAILABLE',
              manifest: cachedManifest,
              error: null
            });
            const isMandatory = cachedManifest.mandatory || installed.versionCode < cachedManifest.minimumSupportedVersion;
            const dismissedVersion = localStorage.getItem('raagax_dismissed_update_version');
            if (isMandatory || dismissedVersion !== cachedManifest.versionCode.toString()) {
              set({ showModal: true });
            }
            return true;
          } else {
            set({ state: 'UP_TO_DATE', manifest: null });
            return false;
          }
        } catch { }
      }

      set({ state: 'CHECKING', error: null });

      const response = await fetch('/api/app/version', {
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const manifest = (await response.json()) as VersionManifest;

      // Rollout channel safety check
      const channel = manifest.releaseChannel || 'stable';
      if (channel !== 'stable') {
        // Safe default: only stable releases are served to production clients
        set({ state: 'UP_TO_DATE', manifest: null });
        return false;
      }

      localStorage.setItem('raagax_last_update_check', now.toString());
      localStorage.setItem('raagax_cached_update_manifest', JSON.stringify(manifest));

      if (manifest.versionCode > installed.versionCode) {
        set({
          state: 'UPDATE_AVAILABLE',
          manifest,
          error: null
        });

        const isMandatory = manifest.mandatory || installed.versionCode < manifest.minimumSupportedVersion;
        const dismissedVersion = localStorage.getItem('raagax_dismissed_update_version');

        if (isMandatory || dismissedVersion !== manifest.versionCode.toString()) {
          set({ showModal: true });
        }
        return true;
      } else {
        set({ state: 'UP_TO_DATE', manifest: null });
        return false;
      }

    } catch (e: any) {
      console.warn('[UpdateStore] Check for updates failed:', e);
      // Fallback: stay on idle or up-to-date, never crash
      set({ state: 'IDLE', error: { code: 'CHECK_FAILED', message: e.message || 'Connection failed' } });
      return false;
    }
  },

  startDownload: async () => {
    const { manifest, state } = get();
    if (!manifest || !RaagaXUpdater) return;
    if (state === 'DOWNLOADING' || state === 'VERIFYING' || state === 'INSTALLING') return;

    set({
      state: 'DOWNLOADING',
      downloadProgress: { percentage: 0, downloadedBytes: 0, totalBytes: manifest.fileSize },
      error: null,
      downloadedFilePath: null
    });

    try {
      const result = await RaagaXUpdater.downloadApk({
        url: manifest.apkUrl,
        sha256: manifest.sha256,
        fileSize: manifest.fileSize
      });

      if (result && result.success) {
        set({
          state: 'VERIFIED',
          downloadedFilePath: result.filePath,
          error: null
        });
        // Auto trigger install flow on download success
        await get().installUpdate();
      }
    } catch (e: any) {
      if (e.code === 'DOWNLOAD_CANCELLED') {
        set({ state: 'UPDATE_AVAILABLE' });
      } else {
        set({
          state: 'DOWNLOAD_FAILED',
          error: { code: e.code || 'DOWNLOAD_ERROR', message: e.message || 'Download failed' }
        });
      }
    }
  },

  cancelDownload: async () => {
    if (!RaagaXUpdater) return;
    try {
      await RaagaXUpdater.cancelDownload();
      set({ state: 'UPDATE_AVAILABLE' });
    } catch { }
  },

  installUpdate: async () => {
    const { downloadedFilePath, state } = get();
    if (!downloadedFilePath || !RaagaXUpdater) return;
    if (state === 'INSTALLING') return;

    set({ state: 'INSTALLING', error: null });

    try {
      const result = await RaagaXUpdater.installApk({ filePath: downloadedFilePath });
      if (result && result.permissionRequired) {
        set({ state: 'VERIFIED', isInstallPermissionRequested: true });
        // Ask settings flow
        await RaagaXUpdater.openInstallSettings();
      } else {
        set({ state: 'COMPLETED' });
      }
    } catch (e: any) {
      set({
        state: 'INSTALL_FAILED',
        error: { code: e.code || 'INSTALL_ERROR', message: e.message || 'Installation failed' }
      });
    }
  },

  closeModal: () => {
    const { manifest } = get();
    if (manifest) {
      // Record dismissal to avoid repeatedly showing same update dialog on every navigation
      localStorage.setItem('raagax_dismissed_update_version', manifest.versionCode.toString());
    }
    set({ showModal: false });
  },

  openModal: () => {
    set({ showModal: true });
  }
}));

// Initialize Update Listener on client load
if (typeof window !== 'undefined') {
  useUpdateStore.getState().init().catch(() => { });
}
