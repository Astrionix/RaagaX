import { AudioFocusManager } from './AudioFocusManager';
import { AudioFocusEvent } from './AudioFocusAdapter';
import { PlaybackEngine } from './PlaybackEngine';
import { InterruptionToken, PlaybackInterruption, ResumePolicy } from './types';

export class InterruptionCoordinator {
  private static instance: InterruptionCoordinator;
  private currentToken: InterruptionToken | null = null;
  private unsubscribeFocus: (() => void) | null = null;
  
  public onInterruptionStateChange: ((token: InterruptionToken | null) => void) | null = null;

  private constructor() {
    this.unsubscribeFocus = AudioFocusManager.getInstance().onFocusChange(this.handleFocusEvent.bind(this));
  }

  public static getInstance(): InterruptionCoordinator {
    if (!InterruptionCoordinator.instance) {
      InterruptionCoordinator.instance = new InterruptionCoordinator();
    }
    return InterruptionCoordinator.instance;
  }

  private handleFocusEvent(event: AudioFocusEvent) {
    console.log('[InterruptionCoordinator] AudioFocus event:', event.type);
    
    // Only interrupt if RaagaX is actually playing.
    const engine = PlaybackEngine.getInstance();
    if (!engine.isPlayingLocally()) {
      return;
    }

    switch (event.type) {
      case 'LOSS':
        this.interrupt('EXTERNAL_AUDIO', 'MANUAL');
        break;
      case 'LOSS_TRANSIENT':
        this.interrupt('PHONE_CALL', 'AUTO');
        break;
      case 'LOSS_DUCK':
        // Future enhancement: ducking logic instead of pause
        this.interrupt('AUDIO_FOCUS_LOSS', 'AUTO');
        break;
      case 'GAIN':
        this.resumeIfEligible();
        break;
    }
  }

  public interrupt(reason: PlaybackInterruption, resumePolicy: ResumePolicy, currentTrackId?: string, currentRenderer?: "audio" | "video") {
    const engine = PlaybackEngine.getInstance();
    
    // Do not interrupt if we are already interrupted or not playing
    if (!engine.isPlayingLocally()) return;

    const positionMs = engine.getCanonicalPositionMs();
    
    this.currentToken = {
      id: crypto.randomUUID(),
      trackId: currentTrackId || 'unknown',
      positionMs,
      renderer: currentRenderer || 'audio',
      startedAt: Date.now(),
      reason,
      resumePolicy
    };

    if (this.onInterruptionStateChange) {
      this.onInterruptionStateChange(this.currentToken);
    }

    // Command the engine to pause
    engine.pause(reason);
  }

  public async resumeIfEligible() {
    if (!this.currentToken) return;

    if (this.currentToken.resumePolicy === 'AUTO') {
      console.log('[InterruptionCoordinator] Resuming playback from token:', this.currentToken);
      const engine = PlaybackEngine.getInstance();
      
      // We could verify token trackId matches engine.getCurrentTrackId() here
      engine.seekCanonical(this.currentToken.positionMs);
      await engine.play();
    }

    // Clear token after processing
    this.clearInterruption();
  }

  public reportUserPause() {
    // A deliberate user pause invalidates any automatic resume.
    if (this.currentToken) {
      this.currentToken.resumePolicy = 'NEVER';
    } else {
      this.currentToken = {
        id: crypto.randomUUID(),
        trackId: 'unknown',
        positionMs: PlaybackEngine.getInstance().getCanonicalPositionMs(),
        renderer: 'audio',
        startedAt: Date.now(),
        reason: 'USER',
        resumePolicy: 'NEVER'
      };
    }
    
    if (this.onInterruptionStateChange) {
      this.onInterruptionStateChange(this.currentToken);
    }
    
    PlaybackEngine.getInstance().pause('USER');
  }

  public clearInterruption() {
    this.currentToken = null;
    if (this.onInterruptionStateChange) {
      this.onInterruptionStateChange(null);
    }
  }

  public getCurrentToken(): InterruptionToken | null {
    return this.currentToken;
  }
}
