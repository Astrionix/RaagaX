import { AudioFocusAdapter, AudioFocusEvent, AudioFocusResult } from './AudioFocusAdapter';
import { BrowserAudioFocusAdapter } from './BrowserAudioFocusAdapter';

export class AudioFocusManager {
  private static instance: AudioFocusManager;
  private adapter: AudioFocusAdapter;

  private constructor() {
    // For now, use the browser adapter. 
    // If native integration (Capacitor/Tauri/React Native) exists, 
    // feature detection would select the native adapter here.
    this.adapter = new BrowserAudioFocusAdapter();
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
