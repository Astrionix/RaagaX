/**
 * SpeakerVolumeGainManager — Authoritative Speaker-Side Volume Engine
 *
 * Because saavncdn.com lacks CORS headers, Web Audio API routing via
 * createMediaElementSource() outputs silence (CORS-muted). Therefore we
 * cannot use a GainNode in the conventional sense.
 *
 * Solution: CSS-free, pop-free smooth volume via a micro requestAnimationFrame
 * ramp directly on the HTMLAudioElement.volume property, which IS allowed.
 * This matches the 15–30 ms ramp spec without touching the audio graph.
 *
 * Invariants:
 * - Only the SPEAKER device (isRemoteMode() === false) applies physical gain.
 * - The CONTROLLER device reads/writes Zustand volume, never touches audio.
 * - Mute preserves the pre-mute volume for restore on un-mute.
 */

import { PlaybackService } from '@/lib/playback/PlaybackService';
import { usePlayerStore } from '@/context/usePlayerStore';

/** Duration of the smooth gain ramp in seconds (25 ms) */
const RAMP_DURATION_S = 0.025;
/** Minimum step size per rAF tick to guarantee completion */
const MIN_STEP = 0.001;

export class SpeakerVolumeGainManager {
  private static instance: SpeakerVolumeGainManager;

  /** Current rAF handle, cancelled before starting a new ramp */
  private rafHandle: number | null = null;
  /** Volume frozen before mute for restore */
  private premuteVolume: number = 0.8;

  private constructor() {}

  public static getInstance(): SpeakerVolumeGainManager {
    if (!SpeakerVolumeGainManager.instance) {
      SpeakerVolumeGainManager.instance = new SpeakerVolumeGainManager();
    }
    return SpeakerVolumeGainManager.instance;
  }

  /**
   * Apply a smooth linear volume ramp to the active audio element.
   * Safe to call at high frequency — cancels any in-flight ramp first.
   *
   * @param targetVolume  0.0 – 1.0 (already clamped externally)
   */
  public setSmoothVolume(targetVolume: number): void {
    if (typeof window === 'undefined') return;

    const target = Math.max(0, Math.min(1, targetVolume));

    // Cancel any in-flight ramp
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }

    const pb = PlaybackService.getInstance();
    const audioA = pb.getActiveAudio();
    const audioB = pb.getStandbyAudio();

    if (!audioA) return;

    const startVolume = audioA.volume;
    const delta = target - startVolume;

    // Skip ramp if already there (within noise floor)
    if (Math.abs(delta) < MIN_STEP) {
      audioA.volume = target;
      if (audioB && audioB.src) audioB.volume = target;
      return;
    }

    const startTime = performance.now();
    const rampMs = RAMP_DURATION_S * 1000;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / rampMs); // 0 → 1

      // Linear interpolation
      const current = startVolume + delta * t;
      const clamped = Math.max(0, Math.min(1, current));

      audioA.volume = clamped;
      // Keep standby element in sync (for crossfade continuity)
      if (audioB && audioB.src) audioB.volume = clamped;

      if (t < 1) {
        this.rafHandle = requestAnimationFrame(tick);
      } else {
        this.rafHandle = null;
      }
    };

    this.rafHandle = requestAnimationFrame(tick);
  }

  /**
   * Mute: freeze pre-mute volume, ramp to 0.
   */
  public mute(): void {
    const { volume } = usePlayerStore.getState();
    if (volume > 0) this.premuteVolume = volume;
    this.setSmoothVolume(0);
    usePlayerStore.setState({ isMuted: true });
  }

  /**
   * Unmute: restore pre-mute volume with smooth ramp.
   */
  public unmute(): void {
    const restored = this.premuteVolume > 0 ? this.premuteVolume : 0.8;
    this.setSmoothVolume(restored);
    usePlayerStore.setState({ isMuted: false, volume: restored });
  }

  /**
   * Toggle mute state.
   */
  public toggleMute(): void {
    const { isMuted } = usePlayerStore.getState();
    if (isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
  }

  /**
   * Sync speaker audio element to the current Zustand volume immediately
   * (used on initial load / reconnection — no ramp needed).
   */
  public syncImmediate(): void {
    const { volume, isMuted } = usePlayerStore.getState();
    const target = isMuted ? 0 : volume;
    const pb = PlaybackService.getInstance();
    const audioA = pb.getActiveAudio();
    const audioB = pb.getStandbyAudio();
    if (audioA) audioA.volume = target;
    if (audioB && audioB.src) audioB.volume = target;
  }
}
