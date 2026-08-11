import { AudioFocusAdapter, AudioFocusResult } from '../AudioFocusAdapter';
import { RawAudioFocusEvent } from '../interruption/types';

export class BrowserAudioFocusAdapter implements AudioFocusAdapter {
  private listeners: Set<(event: RawAudioFocusEvent) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // Document backgrounded
        }
      });
    }
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'audioSession' in navigator;
  }

  public async requestFocus(): Promise<AudioFocusResult> {
    if (!this.isSupported()) return 'UNSUPPORTED';
    try {
      (navigator as any).audioSession.type = 'playback';
      return 'GRANTED';
    } catch {
      return 'DENIED';
    }
  }

  public releaseFocus(): void {
    if (this.isSupported()) {
      try {
        (navigator as any).audioSession.type = 'auto';
      } catch {}
    }
  }

  public subscribe(listener: (event: any) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public dispatchEvent(event: RawAudioFocusEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
