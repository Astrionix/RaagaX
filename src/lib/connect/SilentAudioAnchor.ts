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
      this.silentAudio.volume = 0.001; // Avoid hardware mute suppression
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

  public getIsActive(): boolean {
    return this.isActive;
  }
}

export const silentMediaAnchor = SilentMediaAnchor.getInstance();
