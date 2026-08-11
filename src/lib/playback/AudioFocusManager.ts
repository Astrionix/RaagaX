export type AudioFocusEvent = 
  | { type: 'GAIN' }
  | { type: 'LOSS' }
  | { type: 'LOSS_TRANSIENT' }
  | { type: 'LOSS_DUCK' };

export type AudioFocusPolicy = 'exclusive' | 'duckable';
export type AudioFocusState = 'granted' | 'denied' | 'delayed';

export interface AudioFocusAdapter {
  request(policy: AudioFocusPolicy): Promise<AudioFocusState>;
  release(): void;
  subscribe(listener: (event: AudioFocusEvent) => void): () => void;
  updateMetadata(metadata: MediaMetadataInit): void;
  setMediaActionHandlers(handlers: MediaActionHandlers): void;
}

interface MediaActionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSeek?: (time: number) => void;
}

class BrowserAudioFocusAdapter implements AudioFocusAdapter {
  private listeners: Set<(event: AudioFocusEvent) => void> = new Set();
  
  constructor() {
    this.setupAudioSession();
  }

  private setupAudioSession() {
    // Feature detect Audio Session API (Experimental)
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
      try {
        (navigator as any).audioSession.type = 'playback';
        
        // In the future, browsers might expose an onchange event on audioSession
        // to detect external interruptions, but for now we rely on the implicit
        // OS level routing that 'playback' type provides.
        // Some platforms map mediaSession events (like pause fired by the OS) 
        // to audio focus loss.
      } catch (err) {
        console.warn('[AudioFocusManager] Failed to set audioSession type:', err);
      }
    }
  }

  public async request(policy: AudioFocusPolicy): Promise<AudioFocusState> {
    // Web browsers generally grant focus implicitly when play() is called.
    return 'granted';
  }

  public release(): void {
    // No explicit release on standard web yet, managed by media elements.
  }

  public subscribe(listener: (event: AudioFocusEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public updateMetadata(metadata: MediaMetadataInit): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata(metadata);
    }
  }

  public setMediaActionHandlers(handlers: MediaActionHandlers): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      if (handlers.onPlay) navigator.mediaSession.setActionHandler('play', handlers.onPlay);
      if (handlers.onPause) navigator.mediaSession.setActionHandler('pause', handlers.onPause);
      if (handlers.onNext) navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
      if (handlers.onPrev) navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrev);
      if (handlers.onSeek) navigator.mediaSession.setActionHandler('seekto', (d) => handlers.onSeek!(d.seekTime || 0));
    }
  }

  // Internal method to trigger events (e.g. if we add a native bridge later)
  public triggerEvent(event: AudioFocusEvent) {
    this.listeners.forEach(l => l(event));
  }
}

export class AudioFocusManager {
  private static instance: AudioFocusManager;
  private adapter: AudioFocusAdapter;

  private constructor() {
    // For now, default to browser adapter. 
    // If running in a Capacitor/Tauri wrapper, we could inject a Native adapter here.
    this.adapter = new BrowserAudioFocusAdapter();
  }

  public static getInstance(): AudioFocusManager {
    if (!AudioFocusManager.instance) {
      AudioFocusManager.instance = new AudioFocusManager();
    }
    return AudioFocusManager.instance;
  }

  public async requestFocus(policy: AudioFocusPolicy = 'exclusive'): Promise<AudioFocusState> {
    return this.adapter.request(policy);
  }

  public releaseFocus(): void {
    this.adapter.release();
  }

  public onFocusChange(listener: (event: AudioFocusEvent) => void): () => void {
    return this.adapter.subscribe(listener);
  }

  public updateMetadata(metadata: MediaMetadataInit): void {
    this.adapter.updateMetadata(metadata);
  }

  public setActionHandlers(handlers: MediaActionHandlers): void {
    this.adapter.setMediaActionHandlers(handlers);
  }
}
