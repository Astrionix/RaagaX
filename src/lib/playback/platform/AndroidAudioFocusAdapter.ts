import { AudioFocusAdapter, AudioFocusResult } from '../AudioFocusAdapter';
import { RawAudioFocusEvent } from '../interruption/types';

export class AndroidAudioFocusAdapter implements AudioFocusAdapter {
  private listeners: Set<(event: RawAudioFocusEvent) => void> = new Set();

  public isSupported(): boolean {
    return typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform();
  }

  public async requestFocus(): Promise<AudioFocusResult> {
    return 'GRANTED';
  }

  public releaseFocus(): void {}

  public subscribe(listener: (event: any) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public dispatchNativeAndroidFocusChange(focusChangeEvent: number): void {
    // Android AudioManager Focus Change Constants:
    // AUDIOFOCUS_GAIN = 1
    // AUDIOFOCUS_LOSS = -1
    // AUDIOFOCUS_LOSS_TRANSIENT = -2
    // AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK = -3
    let event: RawAudioFocusEvent;
    switch (focusChangeEvent) {
      case -3:
        event = { type: 'LOSS_DUCK', reason: 'NOTIFICATION' };
        break;
      case -2:
        event = { type: 'LOSS_TRANSIENT', reason: 'CALL' };
        break;
      case -1:
        event = { type: 'LOSS', reason: 'OTHER_MEDIA' };
        break;
      case 1:
      default:
        event = { type: 'GAIN', reason: 'SYSTEM' };
        break;
    }

    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
