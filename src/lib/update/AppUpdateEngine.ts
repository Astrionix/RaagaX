import { apiFetch } from '@/common/helpers/fetch.helper';

export interface ReleaseManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256?: string;
  fileSize?: number;
  releaseDate?: string;
  mandatory?: boolean;
  minimumSupportedVersion?: number;
  releaseChannel?: string;
  releaseNotes?: string[];
}

export type UpdateStateListener = (state: {
  isUpdateAvailable: boolean;
  manifest: ReleaseManifest | null;
  isDownloading: boolean;
  downloadProgress: number;
  isModalOpen: boolean;
}) => void;

// Current hardcoded fallback version code for client app runtime
export const CURRENT_APP_VERSION_CODE = 11;
export const CURRENT_APP_VERSION_NAME = '1.2.7';

export class AppUpdateEngine {
  private static instance: AppUpdateEngine;

  private isUpdateAvailable: boolean = false;
  private manifest: ReleaseManifest | null = null;
  private isDownloading: boolean = false;
  private downloadProgress: number = 0;
  private isModalOpen: boolean = false;
  private currentVersionCode: number = CURRENT_APP_VERSION_CODE;

  private listeners: Set<UpdateStateListener> = new Set();
  private checkTimer: any = null;

  public static getInstance(): AppUpdateEngine {
    if (!AppUpdateEngine.instance) {
      AppUpdateEngine.instance = new AppUpdateEngine();
    }
    return AppUpdateEngine.instance;
  }

  private constructor() {
    this.initNativeVersionDetection();
  }

  private async initNativeVersionDetection() {
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      try {
        const { App } = await import('@capacitor/app');
        const info = await App.getInfo();
        if (info && info.build) {
          const parsedBuild = parseInt(info.build, 10);
          if (!isNaN(parsedBuild) && parsedBuild > 0) {
            this.currentVersionCode = parsedBuild;
          }
        }
      } catch (err) {
        console.warn('[AppUpdateEngine] Native version detection fallback used:', err);
      }
    }
  }

  public subscribe(listener: UpdateStateListener): () => void {
    this.listeners.add(listener);
    // Send immediate snapshot
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const snap = this.getSnapshot();
    for (const fn of this.listeners) {
      fn(snap);
    }
  }

  public getSnapshot() {
    return {
      isUpdateAvailable: this.isUpdateAvailable,
      manifest: this.manifest,
      isDownloading: this.isDownloading,
      downloadProgress: this.downloadProgress,
      isModalOpen: this.isModalOpen,
    };
  }

  public getCurrentVersionCode(): number {
    return this.currentVersionCode;
  }

  public setModalOpen(open: boolean) {
    this.isModalOpen = open;
    this.notify();
  }

  /**
   * Checks the server for latest release manifest and compares versionCode
   */
  public async checkForUpdates(): Promise<boolean> {
    try {
      await this.initNativeVersionDetection();

      // Fetch latest release manifest from server route
      const response = await fetch('/api/app/version', { cache: 'no-store' });
      if (!response.ok) return false;

      const manifest: ReleaseManifest = await response.json();
      if (!manifest || !manifest.versionCode) return false;

      this.manifest = manifest;
      // Compare remote versionCode with running app versionCode
      const updateReady = manifest.versionCode > this.currentVersionCode;
      this.isUpdateAvailable = updateReady;

      if (updateReady) {
        console.log(`[AppUpdateEngine] 🚀 Update available! Current: v${this.currentVersionCode} | Server: v${manifest.versionCode} (${manifest.versionName})`);
      } else {
        console.log(`[AppUpdateEngine] App is up to date (v${this.currentVersionCode}).`);
      }

      this.notify();
      return updateReady;
    } catch (e) {
      console.warn('[AppUpdateEngine] Version check failed:', e);
      return false;
    }
  }

  /**
   * Start periodic update check loop on app launch
   */
  public startPeriodicCheck(intervalMs = 300000) {
    this.checkForUpdates();
    if (this.checkTimer) clearInterval(this.checkTimer);
    this.checkTimer = setInterval(() => {
      this.checkForUpdates();
    }, intervalMs);
  }

  /**
   * Download latest APK with live progress tracking and trigger Android installation
   */
  public async downloadAndInstallUpdate(): Promise<void> {
    if (!this.manifest || this.isDownloading) return;

    const downloadUrl = this.manifest.apkUrl || '/releases/RaagaX-latest.apk';
    this.isDownloading = true;
    this.downloadProgress = 5;
    this.notify();

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Download HTTP error! Status: ${response.status}`);
      }

      const totalBytes = parseInt(response.headers.get('content-length') || '0', 10) || (this.manifest.fileSize || 14000000);
      const reader = response.body?.getReader();

      let receivedBytes = 0;
      const chunks: BlobPart[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            receivedBytes += value.length;
            const progressPct = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
            this.downloadProgress = progressPct;
            this.notify();
          }
        }
      }

      this.downloadProgress = 100;
      this.notify();

      // Combine chunks into Blob
      const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
      const blobUrl = URL.createObjectURL(blob);

      // On Android native app, trigger direct file download / open
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
        try {
          const anchor = document.createElement('a');
          anchor.href = downloadUrl;
          anchor.download = `RaagaX-v${this.manifest.versionName}.apk`;
          anchor.target = '_blank';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        } catch {
          window.location.href = downloadUrl;
        }
      } else {
        // Web browser / Desktop: Download file directly
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = `RaagaX-v${this.manifest.versionName}.apk`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      }
    } catch (err: any) {
      console.error('[AppUpdateEngine] Download failed:', err);
      // Fallback: direct window location redirect to download endpoint
      window.location.href = downloadUrl;
    } finally {
      setTimeout(() => {
        this.isDownloading = false;
        this.downloadProgress = 0;
        this.notify();
      }, 3000);
    }
  }
}
