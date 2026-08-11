export type ActivationState = 'UNACTIVATED' | 'ACTIVATED' | 'BLOCKED';

export class MediaActivationManager {
  private static instance: MediaActivationManager;
  private state: ActivationState = 'UNACTIVATED';
  private listeners: Set<(state: ActivationState) => void> = new Set();
  private dummyAudio: HTMLAudioElement | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      if (document.hasFocus() && (navigator as any).userActivation?.hasBeenActive) {
        this.state = 'ACTIVATED';
      }
    }
  }

  public static getInstance(): MediaActivationManager {
    if (!MediaActivationManager.instance) {
      MediaActivationManager.instance = new MediaActivationManager();
    }
    return MediaActivationManager.instance;
  }

  public getActivationState(): ActivationState {
    return this.state;
  }

  public isActivated(): boolean {
    return this.state === 'ACTIVATED';
  }

  public async activateWithUserGesture(): Promise<boolean> {
    if (typeof window === 'undefined') return true;

    try {
      if (!this.dummyAudio) {
        this.dummyAudio = new Audio();
        this.dummyAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      }

      await this.dummyAudio.play();
      this.state = 'ACTIVATED';
      this.notifyListeners();
      console.log('[MediaActivationManager] Media playback successfully activated via user gesture.');
      return true;
    } catch (e) {
      console.warn('[MediaActivationManager] Failed to activate media playback:', e);
      this.state = 'BLOCKED';
      this.notifyListeners();
      return false;
    }
  }

  public subscribe(listener: (state: ActivationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.state));
  }
}
