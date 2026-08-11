import { AudioFocusManager, AudioFocusEvent } from './AudioFocusManager';
import { PlaybackEngine } from './PlaybackEngine';

export type PauseReason = 
  | "USER" 
  | "REMOTE" 
  | "HANDOFF" 
  | "EXTERNAL_AUDIO" 
  | "AUDIO_FOCUS_LOSS" 
  | "PHONE_CALL" 
  | "SYSTEM" 
  | "ERROR";

export type ResumePolicy = "AUTO" | "MANUAL" | "NEVER";

export interface InterruptionToken {
  id: string;
  trackId: string;
  canonicalPositionMs: number;
  renderer: "audio" | "video";
  startedAt: number;
  reason: PauseReason;
  resumePolicy: ResumePolicy;
}

export class InterruptionCoordinator {
  private static instance: InterruptionCoordinator;
  private currentToken: InterruptionToken | null = null;
  private unsubscribeFocus: (() => void) | null = null;
  
  // Callback to inform UI state if needed, without tight coupling
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
    switch (event.type) {
      case 'LOSS':
      case 'LOSS_TRANSIENT':
        this.handleSystemInterruption('AUDIO_FOCUS_LOSS', 'AUTO');
        break;
      case 'LOSS_DUCK':
        // Typically ducking means lower volume, but we can treat as PAUSE or handle volume later
        this.handleSystemInterruption('AUDIO_FOCUS_LOSS', 'AUTO');
        break;
      case 'GAIN':
        this.handleFocusRestored();
        break;
    }
  }

  public handleSystemInterruption(reason: PauseReason, resumePolicy: ResumePolicy, currentTrackId?: string, currentRenderer?: "audio" | "video") {
    const engine = PlaybackEngine.getInstance();
    const positionMs = engine.getCanonicalPositionMs();
    
    // Create token
    this.currentToken = {
      id: crypto.randomUUID(),
      trackId: currentTrackId || 'unknown',
      canonicalPositionMs: positionMs,
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

  public async handleFocusRestored() {
    if (!this.currentToken) return;

    if (this.currentToken.resumePolicy === 'AUTO') {
      console.log('[InterruptionCoordinator] Resuming playback from token:', this.currentToken);
      const engine = PlaybackEngine.getInstance();
      
      // Ensure we reconcile position if needed (it should still be near canonicalPositionMs)
      // and command play.
      engine.seekCanonical(this.currentToken.canonicalPositionMs);
      await engine.play();
    }

    // Clear token after processing
    this.currentToken = null;
    if (this.onInterruptionStateChange) {
      this.onInterruptionStateChange(null);
    }
  }

  public reportUserPause() {
    // A deliberate user pause invalidates any automatic resume.
    if (this.currentToken) {
      this.currentToken.resumePolicy = 'NEVER';
    } else {
      // Record a manual pause so if focus returns, we don't accidentally play
      this.currentToken = {
        id: crypto.randomUUID(),
        trackId: 'unknown',
        canonicalPositionMs: PlaybackEngine.getInstance().getCanonicalPositionMs(),
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
