import { Song } from '@/types/music';

export interface MediaActionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSeek?: (time: number) => void;
  onSeekBackward?: (offsetSeconds?: number) => void;
  onSeekForward?: (offsetSeconds?: number) => void;
  onStop?: () => void;
}

export class MediaSessionManager {
  private static instance: MediaSessionManager;
  private lastPositionUpdate = 0;
  private lastPositionValue = -1;
  private isRemoteBindingActive = false;

  private constructor() {}

  public static getInstance(): MediaSessionManager {
    if (!MediaSessionManager.instance) {
      MediaSessionManager.instance = new MediaSessionManager();
    }
    return MediaSessionManager.instance;
  }

  /**
   * Constructs high-resolution responsive artwork matrix for Android lock screen,
   * notification shade, Android Auto, and Bluetooth metadata.
   */
  public generateArtwork(coverUrl?: string): MediaImage[] {
    const rawUrl = coverUrl && !coverUrl.includes('/null/') && !coverUrl.includes('null/null')
      ? coverUrl.replace('http://', 'https://')
      : '/app-icon.png';

    const clean500 = rawUrl.replace(/150x150|50x50/g, '500x500');
    const clean150 = rawUrl.replace(/500x500|50x50/g, '150x150');

    return [
      { src: clean150, sizes: '96x96', type: 'image/jpeg' },
      { src: clean150, sizes: '128x128', type: 'image/jpeg' },
      { src: clean150, sizes: '192x192', type: 'image/jpeg' },
      { src: clean500, sizes: '256x256', type: 'image/jpeg' },
      { src: clean500, sizes: '384x384', type: 'image/jpeg' },
      { src: clean500, sizes: '512x512', type: 'image/jpeg' },
    ];
  }

  /**
   * Formats and publishes authoritative track metadata to Android MediaSession.
   */
  public updateSongMetadata(song: Song, options?: { isOffline?: boolean; downloadText?: string; remoteSpeakerName?: string }): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      let displayTitle = song.title || 'Unknown Title';
      if (options?.remoteSpeakerName) {
        displayTitle = `🔊 ${options.remoteSpeakerName}: ${displayTitle}`;
      } else if (options?.isOffline) {
        displayTitle = `✓ ${displayTitle}`;
      } else if (options?.downloadText) {
        displayTitle = `${displayTitle} (${options.downloadText})`;
      }

      const metadataInit: MediaMetadataInit = {
        title: displayTitle,
        artist: song.artist || 'RaagaX Artist',
        album: song.album || 'RaagaX Music',
        artwork: this.generateArtwork(song.coverUrl),
      };

      if (typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata(metadataInit);
      } else {
        navigator.mediaSession.metadata = metadataInit as any;
      }
    } catch (e) {
      console.warn('[MediaSessionManager] Failed to update track metadata:', e);
    }
  }

  /**
   * Bind OS lockscreen and notification media keys to Remote Controller RPCs.
   *
   * FIX 2: seekforward / seekbackward are the actual events fired by iOS lock screen,
   * many Android OEM notification widgets, and Bluetooth earbuds (single/double press).
   * Without handlers here they fall through to the dormant local <audio> element.
   * We forward them as SEEK RPCs (+/- 10s by default, matching Chrome's default seekOffset).
   */
  public setupRemoteMediaHandlers(): void {
    // Reset guard: allow re-bind after restoreLocalMediaHandlers() clears it
    this.isRemoteBindingActive = true;

    this.setActionHandlers({
      onPlay: () => {
        import('@/lib/connect/ConnectClientManager').then(({ ConnectClientManager }) => {
          ConnectClientManager.getInstance().sendCommand('RESUME');
        });
      },
      onPause: () => {
        import('@/lib/connect/ConnectClientManager').then(({ ConnectClientManager }) => {
          ConnectClientManager.getInstance().sendCommand('PAUSE');
        });
      },
      onNext: () => {
        import('@/lib/connect/ConnectClientManager').then(({ ConnectClientManager }) => {
          ConnectClientManager.getInstance().sendCommand('SKIP_NEXT');
        });
      },
      onPrev: () => {
        import('@/lib/connect/ConnectClientManager').then(({ ConnectClientManager }) => {
          ConnectClientManager.getInstance().sendCommand('SKIP_PREV');
        });
      },
      onSeek: (time: number) => {
        import('@/lib/connect/ConnectClientManager').then(({ ConnectClientManager }) => {
          ConnectClientManager.getInstance().sendCommand('SEEK', { positionMs: Math.round(time * 1000) });
        });
      },
      // seekforward / seekbackward: fired by iOS lock screen, earbud hardware buttons, Android OEM widgets
      onSeekForward: (offsetSec: number = 10) => {
        import('@/lib/connect/ConnectClientManager').then(({ ConnectClientManager }) => {
          const client = ConnectClientManager.getInstance();
          const currentPosSec = client.getInterpolatedPosition();
          const session = client.getRemoteSession();
          const durationSec = session ? session.durationMs / 1000 : Infinity;
          const targetMs = Math.round(Math.min(currentPosSec + offsetSec, durationSec) * 1000);
          client.sendCommand('SEEK', { positionMs: targetMs });
        });
      },
      onSeekBackward: (offsetSec: number = 10) => {
        import('@/lib/connect/ConnectClientManager').then(({ ConnectClientManager }) => {
          const client = ConnectClientManager.getInstance();
          const currentPosSec = client.getInterpolatedPosition();
          const targetMs = Math.round(Math.max(0, currentPosSec - offsetSec) * 1000);
          client.sendCommand('SEEK', { positionMs: targetMs });
        });
      },
    });
  }



  public restoreLocalMediaHandlers(): void {
    this.isRemoteBindingActive = false;
    import('./PlaybackService').then(({ PlaybackService }) => {
      PlaybackService.getInstance().setupMediaSessionHandlers();
    });
  }

  public updateMetadata(metadata: MediaMetadataInit): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        if (typeof MediaMetadata !== 'undefined') {
          navigator.mediaSession.metadata = new MediaMetadata(metadata);
        } else {
          navigator.mediaSession.metadata = metadata as any;
        }
      } catch (e) {
        console.warn('[MediaSessionManager] updateMetadata warning:', e);
      }
    }
  }

  public setPlaybackState(state: 'playing' | 'paused' | 'none'): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = state;
      } catch (e) {
        console.warn('[MediaSessionManager] setPlaybackState error:', e);
      }
    }
  }

  public setPositionState(state: { duration: number; playbackRate?: number; position: number }): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) {
      return;
    }

    try {
      const now = performance.now();
      // Throttle rapid updates — maximum 1 update per 250ms unless seek step is > 1.5s
      const isLargeJump = Math.abs(state.position - this.lastPositionValue) > 1.5;
      if (now - this.lastPositionUpdate < 250 && !isLargeJump) {
        return;
      }

      if (!isNaN(state.duration) && state.duration > 0 && !isNaN(state.position) && state.position >= 0) {
        this.lastPositionUpdate = now;
        this.lastPositionValue = state.position;

        navigator.mediaSession.setPositionState({
          duration: Math.max(1, state.duration),
          playbackRate: state.playbackRate ?? 1.0,
          position: Math.min(state.position, state.duration),
        });
      }
    } catch (e) {
      // Ignored for platform quirks
    }
  }

  public setActionHandlers(handlers: MediaActionHandlers): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const trySet = (action: MediaSessionAction, fn?: (details: any) => void) => {
      try {
        if (fn) {
          navigator.mediaSession.setActionHandler(action, fn);
        } else {
          navigator.mediaSession.setActionHandler(action, null);
        }
      } catch (e) {
        // Unsupported action on some platform engines
      }
    };

    trySet('play', handlers.onPlay);
    trySet('pause', handlers.onPause);
    trySet('nexttrack', handlers.onNext);
    trySet('previoustrack', handlers.onPrev);
    trySet('seekto', handlers.onSeek ? (d) => handlers.onSeek!(d.seekTime || 0) : undefined);
    trySet('seekbackward', handlers.onSeekBackward ? (d) => handlers.onSeekBackward!(d.seekOffset || 10) : undefined);
    trySet('seekforward', handlers.onSeekForward ? (d) => handlers.onSeekForward!(d.seekOffset || 10) : undefined);
    trySet('stop', handlers.onStop);
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
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('stop', null);
      } catch (e) {
        console.warn('[MediaSessionManager] Cleanup warning:', e);
      }
    }
  }
}
