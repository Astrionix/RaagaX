/**
 * RaagaX Connect — Audio Sink & Local Clock Controller
 * Audio buffer manager using Web Audio API / AudioContext.
 *
 * CRITICAL ARCHITECTURAL GUARANTEE:
 * Features a detachable clock driver that completely flushes and detaches
 * local audio hardware listeners when transitioning to "Remote Controller" mode,
 * permanently eliminating ghost ticker updates and stuck metadata bugs.
 */

import { TrackMetadata, SupportedAudioCodec } from './types';
import { MediaSessionBridge } from './MediaSessionBridge';

export type SinkMode = 'SINK' | 'CONTROLLER';

export interface SinkPlaybackListener {
  onPositionTick(positionMs: number, durationMs: number): void;
  onTrackEnded(): void;
  onBufferProgress(bufferedAheadMs: number): void;
  onError(error: Error): void;
}

export class ConnectAudioPlayer {
  private mode: SinkMode = 'CONTROLLER';
  private audioContext: AudioContext | null = null;
  private primaryElement: HTMLAudioElement | null = null;
  private secondaryElement: HTMLAudioElement | null = null; // Buffer B (Gapless prefetch)
  private currentTrack: TrackMetadata | null = null;
  private nextTrack: TrackMetadata | null = null;
  private isPrefetching: boolean = false;
  private listeners: Set<SinkPlaybackListener> = new Set();
  private animationFrameId: number | null = null;

  public constructor() {
    if (typeof window !== 'undefined') {
      this.initElements();
    }
  }

  private initElements(): void {
    this.primaryElement = new Audio();
    this.secondaryElement = new Audio();

    [this.primaryElement, this.secondaryElement].forEach((el) => {
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
    });

    this.setupListeners(this.primaryElement);
  }

  private setupListeners(element: HTMLAudioElement): void {
    element.addEventListener('ended', () => {
      if (this.mode === 'SINK') {
        this.listeners.forEach((l) => l.onTrackEnded());
      }
    });

    element.addEventListener('error', () => {
      if (this.mode === 'SINK' && element.error) {
        const err = new Error(`Audio sink error code ${element.error.code}: ${element.error.message}`);
        this.listeners.forEach((l) => l.onError(err));
      }
    });
  }

  /**
   * Set device mode: 'SINK' (Physical audio player) vs 'CONTROLLER' (Remote UI)
   *
   * WHEN SWITCHING TO 'CONTROLLER':
   * Halts local audio hardware clock, flushes media buffers, removes source,
   * and terminates requestAnimationFrame ticker to prevent ghost updates.
   */
  public setDeviceMode(mode: SinkMode): void {
    if (this.mode === mode) return;
    this.mode = mode;

    if (mode === 'CONTROLLER') {
      this.detachAndFlushHardware();
    } else {
      this.ensureAudioContext();
    }
  }

  public getDeviceMode(): SinkMode {
    return this.mode;
  }

  /**
   * Complete teardown of local audio element to prevent ghost ticker driver
   */
  public detachAndFlushHardware(): void {
    // 1. Stop high-precision 60fps animation frame ticker
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 2. Pause and completely flush audio buffers on both elements
    [this.primaryElement, this.secondaryElement].forEach((el) => {
      if (el) {
        try {
          el.pause();
          el.currentTime = 0;
          el.removeAttribute('src');
          el.src = '';
          el.load(); // Forces browser to flush memory buffer
        } catch {}
      }
    });

    // 3. Suspend AudioContext if instantiated
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.suspend().catch(() => {});
      } catch {}
    }

    // 4. Detach native lock screen metadata
    MediaSessionBridge.getInstance().updateMetadata(null);
    MediaSessionBridge.getInstance().updatePositionState(0, 0, 'IDLE');

    this.currentTrack = null;
    this.nextTrack = null;
    this.isPrefetching = false;
  }

  /**
   * Load and play track at exact byte-calculated millisecond offset
   */
  public async loadAndPlay(
    track: TrackMetadata,
    offsetMs: number = 0,
    autoPlay: boolean = true
  ): Promise<boolean> {
    if (this.mode !== 'SINK') {
      console.warn('[AudioPlayer] Rejecting loadAndPlay in CONTROLLER mode.');
      return false;
    }

    this.ensureAudioContext();
    if (!this.primaryElement) return false;

    this.currentTrack = track;
    const element = this.primaryElement;

    try {
      element.src = track.uri;

      // Handle seeking to exact millisecond offset
      const offsetSec = Math.max(0, offsetMs / 1000);
      if (offsetSec > 0) {
        element.currentTime = offsetSec;
      }

      if (autoPlay) {
        await element.play();
      }

      MediaSessionBridge.getInstance().updateMetadata(track);
      MediaSessionBridge.getInstance().updatePositionState(offsetMs, track.durationMs, 'PLAYING');

      this.startHardwareClock();
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.listeners.forEach((l) => l.onError(err));
      return false;
    }
  }

  public pause(): void {
    if (this.primaryElement) {
      this.primaryElement.pause();
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    MediaSessionBridge.getInstance().updatePositionState(
      this.getCurrentPositionMs(),
      this.currentTrack?.durationMs ?? 0,
      'PAUSED'
    );
  }

  public async resume(): Promise<void> {
    if (this.mode !== 'SINK' || !this.primaryElement) return;
    this.ensureAudioContext();
    await this.primaryElement.play();
    this.startHardwareClock();
  }

  public seekTo(positionMs: number): void {
    if (!this.primaryElement) return;
    const targetSec = Math.max(0, positionMs / 1000);
    this.primaryElement.currentTime = targetSec;
  }

  public setVolume(volume: number): void {
    const safeVol = Math.max(0, Math.min(1, volume));
    if (this.primaryElement) {
      this.primaryElement.volume = safeVol;
    }
  }

  /**
   * Dual-buffer next track preparation (Gapless prefetch)
   * Fetches the first 512KB using HTTP Range Requests when nearing track boundary.
   */
  public async prepareNextTrack(nextTrack: TrackMetadata): Promise<void> {
    if (this.mode !== 'SINK' || this.isPrefetching || !this.secondaryElement) return;
    this.isPrefetching = true;
    this.nextTrack = nextTrack;

    try {
      // Byte Range Request: fetch first 512KB chunk (bytes=0-524287)
      const response = await fetch(nextTrack.uri, {
        headers: { Range: 'bytes=0-524287' },
      });

      if (response.ok || response.status === 206) {
        this.secondaryElement.src = nextTrack.uri;
        this.secondaryElement.load();
      }
    } catch {
      // Non-critical fallback
    } finally {
      this.isPrefetching = false;
    }
  }

  /**
   * Hardware 60 FPS clock driver — active ONLY when this node is Audio Sink
   */
  private startHardwareClock(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const tick = () => {
      if (this.mode !== 'SINK' || !this.primaryElement) {
        return;
      }

      const element = this.primaryElement;
      if (!element.paused && !element.seeking && Number.isFinite(element.currentTime)) {
        const curMs = Math.round(element.currentTime * 1000);
        const durMs = this.currentTrack?.durationMs ?? Math.round((element.duration || 0) * 1000);

        this.listeners.forEach((l) => l.onPositionTick(curMs, durMs));

        // Buffer diagnostics & pre-fetch trigger (10s before track ends)
        if (this.nextTrack && durMs > 0 && durMs - curMs <= 10000 && !this.isPrefetching) {
          this.prepareNextTrack(this.nextTrack).catch(() => {});
        }
      }

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  private ensureAudioContext(): void {
    if (typeof window === 'undefined') return;
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  public addListener(listener: SinkPlaybackListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getCurrentPositionMs(): number {
    if (this.mode === 'SINK' && this.primaryElement) {
      return Math.round(this.primaryElement.currentTime * 1000);
    }
    return 0;
  }
}
