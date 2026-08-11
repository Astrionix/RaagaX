export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DownloadTask {
  id: string;
  trackId: string;
  playlistId?: string;
  albumId?: string;
  status: DownloadStatus;
  bytesDownloaded: number;
  totalBytes?: number;
  progress: number;
  retryCount: number;
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
  artworkId?: string;
  downloadedAt: number;
  version: string; // Used for invalidation/updates
}

export type PlaybackSource =
  | {
      type: 'remote';
      url: string;
      videoId?: string; // used for YouTube fallback
    }
  | {
      type: 'offline';
      localId: string;
    };
