import { RawAudioFocusEvent, InterruptionSnapshot, ResumePolicy, FocusReason } from './types';
import { InterruptionClassifier } from './InterruptionClassifier';
import { PlaybackEngine } from '../PlaybackEngine';
import { usePlayerStore } from '@/context/usePlayerStore';

export class InterruptionManager {
  private static instance: InterruptionManager;

  private duckDepth: number = 0;
  private activeSnapshot: InterruptionSnapshot | null = null;
  private currentResumePolicy: ResumePolicy | null = null;

  private constructor() {}

  public static getInstance(): InterruptionManager {
    if (!InterruptionManager.instance) {
      InterruptionManager.instance = new InterruptionManager();
    }
    return InterruptionManager.instance;
  }

  public getDuckDepth(): number {
    return this.duckDepth;
  }

  public getActiveSnapshot(): InterruptionSnapshot | null {
    return this.activeSnapshot;
  }

  /**
   * Main entrypoint for processing platform audio focus events
   */
  public async handlePlatformEvent(event: RawAudioFocusEvent): Promise<void> {
    const store = usePlayerStore.getState();
    const engine = PlaybackEngine.getInstance();



    const category = InterruptionClassifier.classify(event);
    console.log(`[InterruptionManager] Classifying event ${event.type} (reason: ${event.reason || 'none'}) -> ${category}`);

    switch (category) {
      case 'DUCK':
        this.applyDuck();
        break;

      case 'PAUSE_TRANSIENT_RESUMABLE':
        await this.applyTransientPause(event.reason || 'CALL');
        break;

      case 'PAUSE_PERMANENT':
        await this.applyPermanentPause(event.reason || 'OTHER_MEDIA');
        break;

      case 'RESTORE_GAIN':
        await this.handleGain();
        break;

      case 'IGNORE':
        break;
    }
  }

  private applyDuck(): void {
    const engine = PlaybackEngine.getInstance();
    this.duckDepth++;
    if (this.duckDepth === 1) {
      engine.setDucked(true, 0.25);
    }
  }

  private removeDuck(): void {
    const engine = PlaybackEngine.getInstance();
    if (this.duckDepth > 0) {
      this.duckDepth--;
      if (this.duckDepth === 0) {
        engine.setDucked(false);
      }
    }
  }

  private async applyTransientPause(reason: FocusReason): Promise<void> {
    const engine = PlaybackEngine.getInstance();
    const store = usePlayerStore.getState();

    const isPlaying = engine.isPlayingLocally() || store.isPlaying;

    this.activeSnapshot = {
      id: crypto.randomUUID(),
      reason,
      wasPlaying: isPlaying,
      positionMs: engine.getCanonicalPositionMs(),
      trackId: store.currentSong?.id || 'unknown',
      sessionId: 'global-session',
      rendererDeviceId: store.deviceId,
      timestamp: Date.now(),
    };

    if (isPlaying) {
      this.currentResumePolicy = {
        eligible: true,
        reason,
        sessionId: this.activeSnapshot.sessionId,
        trackId: this.activeSnapshot.trackId,
        positionMs: this.activeSnapshot.positionMs,
        rendererDeviceId: store.deviceId,
      };

      engine.pause(reason);
    } else {
      this.currentResumePolicy = {
        eligible: false,
        reason,
        sessionId: this.activeSnapshot.sessionId,
        trackId: this.activeSnapshot.trackId,
        positionMs: this.activeSnapshot.positionMs,
        rendererDeviceId: store.deviceId,
      };
    }
  }

  private async applyPermanentPause(reason: FocusReason): Promise<void> {
    const engine = PlaybackEngine.getInstance();
    const store = usePlayerStore.getState();

    this.activeSnapshot = {
      id: crypto.randomUUID(),
      reason,
      wasPlaying: engine.isPlayingLocally() || store.isPlaying,
      positionMs: engine.getCanonicalPositionMs(),
      trackId: store.currentSong?.id || 'unknown',
      sessionId: 'global-session',
      rendererDeviceId: store.deviceId,
      timestamp: Date.now(),
    };

    this.currentResumePolicy = {
      eligible: false, // Never auto-resume after permanent loss (e.g. YouTube/Spotify started)
      reason,
      sessionId: this.activeSnapshot.sessionId,
      trackId: this.activeSnapshot.trackId,
      positionMs: this.activeSnapshot.positionMs,
      rendererDeviceId: store.deviceId,
    };

    engine.pause(reason);
  }

  private async handleGain(): Promise<void> {
    const engine = PlaybackEngine.getInstance();

    // 1. Remove ducking if duckDepth > 0
    if (this.duckDepth > 0) {
      this.removeDuck();
    }

    // 2. Validate Resume Policy
    if (this.currentResumePolicy && this.currentResumePolicy.eligible) {
      const store = usePlayerStore.getState();

      const sameTrack = store.currentSong?.id === this.currentResumePolicy.trackId;

      if (sameTrack) {
        console.log(`[InterruptionManager] Resuming playback after transient interruption (${this.currentResumePolicy.reason})`);
        engine.seekCanonical(this.currentResumePolicy.positionMs);
        await engine.play();
      } else {
        console.warn(`[InterruptionManager] Resume policy ineligible: device/track/lease state changed during interruption.`);
      }
    }

    // Clear policy after processing
    this.currentResumePolicy = null;
    this.activeSnapshot = null;
  }

  public reportUserManualPause(): void {
    const engine = PlaybackEngine.getInstance();
    const store = usePlayerStore.getState();

    this.activeSnapshot = {
      id: crypto.randomUUID(),
      reason: 'USER',
      wasPlaying: false,
      positionMs: engine.getCanonicalPositionMs(),
      trackId: store.currentSong?.id || 'unknown',
      sessionId: 'global-session',
      rendererDeviceId: store.deviceId,
      timestamp: Date.now(),
    };

    // User manual pause permanently revokes auto-resume eligibility for any subsequent call/event
    this.currentResumePolicy = {
      eligible: false,
      reason: 'USER',
      sessionId: this.activeSnapshot.sessionId,
      trackId: this.activeSnapshot.trackId,
      positionMs: this.activeSnapshot.positionMs,
      rendererDeviceId: store.deviceId,
    };
  }
}
