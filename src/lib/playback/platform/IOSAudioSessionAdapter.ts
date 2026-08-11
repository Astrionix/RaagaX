import { AudioFocusAdapter, AudioFocusResult } from '../AudioFocusAdapter';
import { RawAudioFocusEvent } from '../interruption/types';

export class IOSAudioSessionAdapter implements AudioFocusAdapter {
  private listeners: Set<(event: RawAudioFocusEvent) => void> = new Set();

  public isSupported(): boolean {
    return typeof window !== 'undefined' && (window as any).Capacitor?.getPlatform() === 'ios';
  }

  public async requestFocus(): Promise<AudioFocusResult> {
    return 'GRANTED';
  }

  public releaseFocus(): void {}

  public subscribe(listener: (event: any) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public dispatchAVAudioSessionInterruption(type: 'Began' | 'Ended', shouldResume: boolean = true): void {
    let event: RawAudioFocusEvent;
    if (type === 'Began') {
      event = { type: 'LOSS_TRANSIENT', reason: 'CALL' };
    } else {
      event = { type: 'GAIN', reason: 'SYSTEM' };
    }

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  public dispatchAVAudioSessionRouteChange(reason: 'OldDeviceUnavailable' | 'NewDeviceAvailable'): void {
    const event: RawAudioFocusEvent = {
      type: 'LOSS_TRANSIENT',
      reason: 'BLUETOOTH'
    };

    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
