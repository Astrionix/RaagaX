import { AudioFocusAdapter, AudioFocusEvent, AudioFocusResult } from './AudioFocusAdapter';

export class BrowserAudioFocusAdapter implements AudioFocusAdapter {
  private listeners: Set<(event: AudioFocusEvent) => void> = new Set();
  
  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'audioSession' in navigator;
  }

  public async requestFocus(): Promise<AudioFocusResult> {
    if (!this.isSupported()) {
      return "UNSUPPORTED";
    }

    try {
      (navigator as any).audioSession.type = 'playback';
      return "GRANTED";
    } catch (err) {
      console.warn('[BrowserAudioFocusAdapter] Failed to set audioSession type:', err);
      return "DENIED";
    }
  }

  public releaseFocus(): void {
    // Standard web audioSession doesn't require explicit release.
    // It's managed implicitly when media playback finishes/stops.
  }

  public subscribe(listener: (event: AudioFocusEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Internal trigger if the platform ever exposes native onchange events
  public triggerEvent(event: AudioFocusEvent) {
    this.listeners.forEach(l => l(event));
  }
}
