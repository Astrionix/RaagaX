/**
 * RaagaX Connect — Lock Screen & Background MediaSession Bridge
 * Binds browser & mobile native playback controls (Android Notification / iOS Lock Screen)
 * to keep WebSocket pipelines alive and handle hardware key controls.
 */

import { TrackMetadata, PlaybackState } from './types';

export interface MediaSessionActionCallbacks {
  onPlay(): void;
  onPause(): void;
  onNext(): void;
  onPrev(): void;
  onSeekTo(positionSeconds: number): void;
}

export class MediaSessionBridge {
  private static instance: MediaSessionBridge;
  private callbacks: MediaSessionActionCallbacks | null = null;
  private isRegistered: boolean = false;

  private constructor() {}

  public static getInstance(): MediaSessionBridge {
    if (!MediaSessionBridge.instance) {
      MediaSessionBridge.instance = new MediaSessionBridge();
    }
    return MediaSessionBridge.instance;
  }

  public register(callbacks: MediaSessionActionCallbacks): void {
    this.callbacks = callbacks;
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (this.isRegistered) return;
    this.isRegistered = true;

    const ms = navigator.mediaSession;

    ms.setActionHandler('play', () => {
      this.callbacks?.onPlay();
    });

    ms.setActionHandler('pause', () => {
      this.callbacks?.onPause();
    });

    ms.setActionHandler('previoustrack', () => {
      this.callbacks?.onPrev();
    });

    ms.setActionHandler('nexttrack', () => {
      this.callbacks?.onNext();
    });

    ms.setActionHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number' && Number.isFinite(details.seekTime)) {
        this.callbacks?.onSeekTo(details.seekTime);
      }
    });

    ms.setActionHandler('seekbackward', (details) => {
      const skipSec = details.seekOffset || 10;
      const currentPos = this.getCurrentPositionSeconds();
      this.callbacks?.onSeekTo(Math.max(0, currentPos - skipSec));
    });

    ms.setActionHandler('seekforward', (details) => {
      const skipSec = details.seekOffset || 10;
      const currentPos = this.getCurrentPositionSeconds();
      this.callbacks?.onSeekTo(currentPos + skipSec);
    });
  }

  /**
   * Update Lock Screen Metadata (Artwork, Title, Artist, Album)
   */
  public updateMetadata(track: TrackMetadata | null, speakerName?: string): void {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !window.MediaMetadata) return;

    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const artistSuffix = speakerName ? `${track.artist} • 🔊 ${speakerName}` : track.artist;

    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: track.title,
      artist: artistSuffix,
      album: track.album || 'RaagaX',
      artwork: [
        { src: track.artworkUrl, sizes: '96x96', type: 'image/png' },
        { src: track.artworkUrl, sizes: '128x128', type: 'image/png' },
        { src: track.artworkUrl, sizes: '192x192', type: 'image/png' },
        { src: track.artworkUrl, sizes: '256x256', type: 'image/png' },
        { src: track.artworkUrl, sizes: '512x512', type: 'image/png' },
      ],
    });
  }

  /**
   * Synchronize position state to native lock screen scrubber
   */
  public updatePositionState(positionMs: number, durationMs: number, playbackState: PlaybackState): void {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;

    // Update playback state tag ('playing' | 'paused' | 'none')
    ms.playbackState = playbackState === 'PLAYING' ? 'playing' : playbackState === 'PAUSED' ? 'paused' : 'none';

    if (durationMs > 0 && Number.isFinite(durationMs) && typeof ms.setPositionState === 'function') {
      try {
        const safePos = Math.min(positionMs / 1000, durationMs / 1000);
        ms.setPositionState({
          duration: durationMs / 1000,
          playbackRate: playbackState === 'PLAYING' ? 1.0 : 0.0,
          position: Math.max(0, safePos),
        });
      } catch {}
    }
  }

  private getCurrentPositionSeconds(): number {
    return 0;
  }

  public destroy(): void {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const actions: MediaSessionAction[] = [
      'play',
      'pause',
      'previoustrack',
      'nexttrack',
      'seekto',
      'seekbackward',
      'seekforward',
    ];
    actions.forEach((a) => {
      try {
        ms.setActionHandler(a, null);
      } catch {}
    });
    ms.metadata = null;
    this.callbacks = null;
    this.isRegistered = false;
  }
}
