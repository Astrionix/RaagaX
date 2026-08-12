import { AudioFocusAdapter, AudioFocusEvent, AudioFocusResult } from './AudioFocusAdapter';
import { BrowserAudioFocusAdapter } from './BrowserAudioFocusAdapter';

export class AudioFocusManager {
  private static instance: AudioFocusManager;
  private adapter: AudioFocusAdapter;

  private constructor() {
    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor && typeof (window as any).Capacitor.isNativePlatform === 'function' && (window as any).Capacitor.isNativePlatform();
    if (isCapacitor) {
      const { CapacitorAndroidAudioAdapter } = require('./platform/CapacitorAndroidAudioAdapter');
      this.adapter = new CapacitorAndroidAudioAdapter();
    } else {
      this.adapter = new BrowserAudioFocusAdapter();
    }
  }

  public static getInstance(): AudioFocusManager {
    if (!AudioFocusManager.instance) {
      AudioFocusManager.instance = new AudioFocusManager();
    }
    return AudioFocusManager.instance;
  }

  public async requestFocus(): Promise<AudioFocusResult> {
    return this.adapter.requestFocus();
  }

  public releaseFocus(): void {
    this.adapter.releaseFocus();
  }

  public onFocusChange(listener: (event: AudioFocusEvent) => void): () => void {
    return this.adapter.subscribe(listener);
  }
}
