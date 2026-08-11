export interface MediaActionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSeek?: (time: number) => void;
}

export class MediaSessionManager {
  private static instance: MediaSessionManager;

  private constructor() {}

  public static getInstance(): MediaSessionManager {
    if (!MediaSessionManager.instance) {
      MediaSessionManager.instance = new MediaSessionManager();
    }
    return MediaSessionManager.instance;
  }

  public updateMetadata(metadata: MediaMetadataInit): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata(metadata);
    }
  }

  public setPlaybackState(state: 'playing' | 'paused' | 'none'): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }

  public setActionHandlers(handlers: MediaActionHandlers): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      if (handlers.onPlay) navigator.mediaSession.setActionHandler('play', handlers.onPlay);
      if (handlers.onPause) navigator.mediaSession.setActionHandler('pause', handlers.onPause);
      if (handlers.onNext) navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
      if (handlers.onPrev) navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrev);
      if (handlers.onSeek) navigator.mediaSession.setActionHandler('seekto', (d) => handlers.onSeek!(d.seekTime || 0));
    }
  }
}
