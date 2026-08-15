export type DownloadMode = 'offline_sandboxed' | 'device_export';

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

export type DownloadQuality = 'LOW' | 'HIGH' | 'VERY_HIGH';

export interface StorageEstimateInfo {
  quota: number;
  usage: number;
  available: number;
  raagaXUsed: number;
  raagaXDownloads: number;
  raagaXCache: number;
  raagaXSongCount: number;
  percentUsed: number;
  isNative: boolean;
  storageType: 'device' | 'browser';
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'tv';
  platform: string;
}

export interface TrackDownloadState {
  songId: string;
  deviceExport: {
    status: 'NOT_STARTED' | 'REQUESTING' | 'DOWNLOADING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    progress: number;
    error?: string;
  };
  offlineCache: {
    status: 'NOT_STARTED' | 'QUEUED' | 'DOWNLOADING' | 'VERIFYING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CORRUPTED';
    progress: number;
    bytesDownloaded: number;
    totalBytes?: number;
    speedBytesPerSec?: number;
    error?: string;
  };
}

export interface DownloadTask {
  id: string;
  trackId: string;
  playlistId?: string;
  albumId?: string;
  mode: DownloadMode;
  quality: DownloadQuality;
  status: DownloadStatus;
  bytesDownloaded: number;
  totalBytes?: number;
  progress: number;
  speedBytesPerSec?: number;
  checksum?: string;
  retryCount: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OfflineTrack {
  trackId: string;
  localMediaId: string; // The key used in IndexedDB or local storage
  title: string;
  artist: string;
  album?: string;
  durationMs: number;
  duration?: number;
  artworkId?: string;
  artworkUrl?: string;
  mimeType: string;
  quality: DownloadQuality;
  fileSizeBytes: number;
  checksum?: string;
  language?: string;
  leaseExpiresAt?: number;
  downloadedAt: number;
  lastPlayedAt?: number;
  playCount?: number;
  version: string; // Used for invalidation/updates
}

export type PlaybackSource =
  | {
      type: 'remote';
      url: string;
      videoId?: string; // used for YouTube fallback
      quality?: DownloadQuality;
    }
  | {
      type: 'offline';
      url: string; // Object URL or local file URI
      mediaId: string;
      localId?: string;
      quality?: DownloadQuality;
      isLocalBlob?: boolean;
    };


