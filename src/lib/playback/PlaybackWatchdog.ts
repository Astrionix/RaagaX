import { PlaybackService } from './PlaybackService';
import { RaagaXNativePlayer } from './native/RaagaXNativePlayer';

export class PlaybackWatchdog {
  private static instance: PlaybackWatchdog;

  private isMonitoring = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastPositionMs = 0;
  private stalledSecondsCount = 0;
  private isTransitioningLock = false;

  private constructor() {}

  public static getInstance(): PlaybackWatchdog {
    if (!PlaybackWatchdog.instance) {
      PlaybackWatchdog.instance = new PlaybackWatchdog();
    }
    return PlaybackWatchdog.instance;
  }

  public startMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    this.intervalId = setInterval(() => {
      this.checkPlaybackStall();
    }, 2000);
  }

  public stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isMonitoring = false;
  }

  // --- Transition Lock Guard ---

  public acquireTransitionLock(): boolean {
    if (this.isTransitioningLock) {
      console.warn('[PlaybackWatchdog] Transition lock active: rejecting duplicate command');
      return false; // Lock busy: reject duplicate next/prev command
    }
    this.isTransitioningLock = true;
    setTimeout(() => {
      this.isTransitioningLock = false;
    }, 1500); // 1.5s transition lock window
    return true;
  }

  public releaseTransitionLock() {
    this.isTransitioningLock = false;
  }

  /**
   * Validates if a song end event is genuine vs a premature network drop
   */
  public isValidNaturalEnd(currentTimeSec: number, durationSec: number): boolean {
    if (durationSec <= 0) return true;
    const toleranceSec = 4;
    return currentTimeSec >= (durationSec - toleranceSec);
  }

  /**
   * Watchdog: Detects frozen audio (PLAYING state but currentTime stalled) and recovers current song
   */
  private checkPlaybackStall() {
    if (RaagaXNativePlayer.isNative()) return; // Native ExoPlayer manages its own audio focus/watchdog

    const service = PlaybackService.getInstance();
    const activeAudio = service.getActiveAudio();
    if (!activeAudio) return;

    if (!activeAudio.paused && !activeAudio.ended) {
      const currentPosMs = Math.floor(activeAudio.currentTime * 1000);
      if (currentPosMs === this.lastPositionMs && activeAudio.currentTime > 0) {
        this.stalledSecondsCount += 2;
        if (this.stalledSecondsCount >= 6) {
          console.warn('[PlaybackWatchdog] Detected audio stall (>6s motionless). Recovering current track...');
          this.stalledSecondsCount = 0;
          
          // Graceful recovery of current song source — NEVER auto-skip!
          activeAudio.load();
          activeAudio.play().catch(() => {});
        }
      } else {
        this.lastPositionMs = currentPosMs;
        this.stalledSecondsCount = 0;
      }
    } else {
      this.stalledSecondsCount = 0;
    }
  }
}
