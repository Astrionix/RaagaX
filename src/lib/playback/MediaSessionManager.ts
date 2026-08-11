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
      if (typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata(metadata);
      } else {
        navigator.mediaSession.metadata = metadata as any;
      }
    }
  }

  public setPlaybackState(state: 'playing' | 'paused' | 'none'): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }

  public setPositionState(state: { duration: number; playbackRate?: number; position: number }): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && typeof navigator.mediaSession.setPositionState === 'function') {
      try {
        if (!isNaN(state.duration) && state.duration > 0 && !isNaN(state.position) && state.position >= 0) {
          navigator.mediaSession.setPositionState({
            duration: state.duration,
            playbackRate: state.playbackRate ?? 1,
            position: Math.min(state.position, state.duration)
          });
        }
      } catch (e) {
        console.warn('[MediaSessionManager] setPositionState warning:', e);
      }
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

  public destroy(): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      } catch (e) {
        console.warn('[MediaSessionManager] Cleanup warning:', e);
      }
    }
  }
}
