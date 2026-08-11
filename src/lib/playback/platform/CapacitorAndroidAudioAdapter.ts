import { AudioFocusAdapter, AudioFocusEvent, AudioFocusResult } from '../AudioFocusAdapter';
import { RawAudioFocusEvent } from '../interruption/types';

export class CapacitorAndroidAudioAdapter implements AudioFocusAdapter {
  private listeners: Set<(event: AudioFocusEvent) => void> = new Set();
  private rawListeners: Set<(event: RawAudioFocusEvent) => void> = new Set();
  private isCapacitorNative: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      this.isCapacitorNative = (window as any).Capacitor.isNativePlatform();
      this.setupNativeBridge();
    }
  }

  private setupNativeBridge() {
    if (!this.isCapacitorNative) return;

    const capacitor = (window as any).Capacitor;
    if (capacitor && capacitor.Plugins && capacitor.Plugins.AudioManager) {
      capacitor.Plugins.AudioManager.addListener('audioFocusChange', (data: { focusChange: string }) => {
        this.handleNativeFocusChange(data.focusChange);
      });
    }
  }

  public handleNativeFocusChange(focusChange: string) {
    let rawEvent: RawAudioFocusEvent;
    let focusEvent: AudioFocusEvent;

    switch (focusChange) {
      case 'AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK':
        rawEvent = { type: 'LOSS_DUCK', reason: 'NOTIFICATION' };
        focusEvent = { type: 'LOSS_DUCK' };
        break;

      case 'AUDIOFOCUS_LOSS_TRANSIENT':
        rawEvent = { type: 'LOSS_TRANSIENT', reason: 'CALL' };
        focusEvent = { type: 'LOSS_TRANSIENT' };
        break;

      case 'AUDIOFOCUS_LOSS':
        rawEvent = { type: 'LOSS', reason: 'OTHER_MEDIA' };
        focusEvent = { type: 'LOSS' };
        break;

      case 'AUDIOFOCUS_GAIN':
      default:
        rawEvent = { type: 'GAIN' };
        focusEvent = { type: 'GAIN' };
        break;
    }

    this.dispatchEvent(focusEvent, rawEvent);
  }

  public isSupported(): boolean {
    return this.isCapacitorNative || (typeof window !== 'undefined' && 'Capacitor' in window);
  }

  public async requestFocus(): Promise<AudioFocusResult> {
    if (!this.isSupported()) return 'UNSUPPORTED';
    try {
      const capacitor = (window as any).Capacitor;
      if (capacitor && capacitor.Plugins && capacitor.Plugins.AudioManager) {
        await capacitor.Plugins.AudioManager.requestFocus();
      }
      return 'GRANTED';
    } catch {
      return 'DENIED';
    }
  }

  public releaseFocus(): void {
    if (this.isSupported()) {
      try {
        const capacitor = (window as any).Capacitor;
        if (capacitor && capacitor.Plugins && capacitor.Plugins.AudioManager) {
          capacitor.Plugins.AudioManager.abandonFocus();
        }
      } catch {}
    }
  }

  public subscribe(listener: (event: AudioFocusEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribeRaw(listener: (event: RawAudioFocusEvent) => void): () => void {
    this.rawListeners.add(listener);
    return () => this.rawListeners.delete(listener);
  }

  public dispatchEvent(event: AudioFocusEvent, rawEvent?: RawAudioFocusEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
    if (rawEvent) {
      for (const listener of this.rawListeners) {
        listener(rawEvent);
      }
    }
  }
}
