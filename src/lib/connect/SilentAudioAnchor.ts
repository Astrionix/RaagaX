/**
 * SilentAudioAnchor — Keepalive Media Session Anchor for Remote Controllers
 *
 * Browsers (Chrome on Android, Safari on iOS) only display notification and lock screen
 * media controls if a local audio track is playing. When acting as a Connect
 * Remote Controller, this class plays a lightweight, inaudible 1-second WAV loop
 * to sustain the W3C MediaSession interface without audio disruption.
 */

export class SilentMediaAnchor {
  private static instance: SilentMediaAnchor;
  private silentAudio: HTMLAudioElement | null = null;
  private isActive: boolean = false;

  private constructor() {}

  public static getInstance(): SilentMediaAnchor {
    if (!SilentMediaAnchor.instance) {
      SilentMediaAnchor.instance = new SilentMediaAnchor();
    }
    return SilentMediaAnchor.instance;
  }

  private initAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.silentAudio) {
      this.silentAudio = new Audio();
      // 1-second base64 encoded silent WAV audio file
      this.silentAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      this.silentAudio.loop = true;
      // FIX: Must be >= 0.01 on iOS. Values below 0.001 are rounded to 0 by AVAudioSession
      // and trigger hardware mute suppression, which silently kills the media session anchor.
      this.silentAudio.volume = 0.01;
    }
    return this.silentAudio;
  }

  public activate(): void {
    this.isActive = true;
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      const audio = this.initAudio();
      if (audio) {
        audio.play().catch(() => {
          console.warn('[SILENT_MEDIA_ANCHOR] User interaction required to hook notification bar');
        });
      }
    }
  }

  public deactivate(): void {
    this.isActive = false;
    if (this.silentAudio) {
      try {
        this.silentAudio.pause();
        this.silentAudio.removeAttribute('src');
        this.silentAudio.load();
      } catch {}
      this.silentAudio = null;
    }
  }

  /**
   * Resume the silent anchor after iOS/Android background tab suspension.
   *
   * On iOS Safari and Android Chrome, HTMLAudioElement.loop is paused automatically
   * when the page enters background. When visibilitychange fires on resume, the
   * anchor must be explicitly re-played BEFORE setupRemoteMediaHandlers() rebinds,
   * otherwise the OS drops the notification card and all media key events go dark.
   *
   * Safe to call even if already playing — play() on a running element is a no-op.
   */
  public resumeAfterSuspend(): void {
    if (!this.isActive) return;
    const audio = this.initAudio();
    if (audio) {
      audio.play().catch(() => {
        // Autoplay blocked post-suspend — will re-activate on next user gesture
        console.warn('[SILENT_MEDIA_ANCHOR] resumeAfterSuspend blocked — waiting for user interaction');
      });
    }
  }

  public getIsActive(): boolean {
    return this.isActive;
  }
}

export const silentMediaAnchor = SilentMediaAnchor.getInstance();
