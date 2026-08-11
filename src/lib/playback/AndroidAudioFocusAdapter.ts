import { AudioFocusAdapter, AudioFocusEvent, AudioFocusResult } from './AudioFocusAdapter';

export class AndroidAudioFocusAdapter implements AudioFocusAdapter {
  private listeners: Set<(event: AudioFocusEvent) => void> = new Set();

  public isSupported(): boolean {
    return typeof window !== 'undefined' && typeof (window as any).AndroidAudioFocus !== 'undefined';
  }

  public async requestFocus(): Promise<AudioFocusResult> {
    if (!this.isSupported()) return 'UNSUPPORTED';
    
    try {
      const result = await (window as any).AndroidAudioFocus.request();
      return result as AudioFocusResult;
    } catch (e) {
      console.warn('[AndroidAudioFocusAdapter] Focus request failed:', e);
      return 'DENIED';
    }
  }

  public releaseFocus(): void {
    if (this.isSupported()) {
      try {
        (window as any).AndroidAudioFocus.release();
      } catch (e) {
        console.warn('[AndroidAudioFocusAdapter] Focus release failed:', e);
      }
    }
  }

  public subscribe(listener: (event: AudioFocusEvent) => void): () => void {
    this.listeners.add(listener);
    
    // Bind native JS bridge callback if defined
    if (typeof window !== 'undefined' && !(window as any).__onAndroidAudioFocusEvent) {
      (window as any).__onAndroidAudioFocusEvent = (eventType: string) => {
        if (eventType === 'GAIN') this.notify({ type: 'GAIN' });
        else if (eventType === 'LOSS') this.notify({ type: 'LOSS' });
        else if (eventType === 'LOSS_TRANSIENT') this.notify({ type: 'LOSS_TRANSIENT' });
        else if (eventType === 'LOSS_DUCK') this.notify({ type: 'LOSS_DUCK' });
      };
    }

    return () => this.listeners.delete(listener);
  }

  private notify(event: AudioFocusEvent) {
    this.listeners.forEach(l => l(event));
  }
}
