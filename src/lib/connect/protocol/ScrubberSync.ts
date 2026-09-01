import { PlaybackSessionState, PlaybackStateDelta, PlaybackState } from './types';
import { NtpClockEngine } from './NtpClockEngine';

export type ScrubberTickCallback = (interpolatedPositionMs: number, progressRatio: number) => void;

export class TimelineScrubberEngine {
  private session: PlaybackSessionState | null = null;
  private animFrameId: number | null = null;
  private listeners: Set<ScrubberTickCallback> = new Set();
  private isUserSeeking: boolean = false;
  private seekValueMs: number = 0;
  private lastRenderedPosMs: number = 0;

  public constructor() {}

  /**
   * NTP-Style Clock Synchronization:
   * Called upon receiving a Heartbeat ACK or handshake to calculate network latency (RTT)
   * and accurate time offset between server and client clock.
   */
  public recordNtpSample(clientSendTimeMs: number, serverTimestampMs: number, clientRecvTimeMs: number): void {
    NtpClockEngine.getInstance().recordSample(clientSendTimeMs, serverTimestampMs, clientRecvTimeMs);
  }

  /**
   * Apply atomic Full Hydrate snapshot
   */
  public hydrate(session: PlaybackSessionState): void {
    this.session = session;
    this.lastRenderedPosMs = session.positionMs;
    this.startLoop();
  }

  /**
   * Apply state mutation delta
   */
  public applyMutation(delta: PlaybackStateDelta): void {
    if (!this.session) return;
    if (delta.stateVersion < this.session.stateVersion) {
      // Out-of-order drop
      return;
    }

    this.session = {
      ...this.session,
      stateVersion: delta.stateVersion,
      serverTimestampMs: delta.serverTimestampMs,
      playbackState: delta.playbackState ?? this.session.playbackState,
      currentTrack: delta.currentTrack !== undefined ? delta.currentTrack : this.session.currentTrack,
      positionMs: delta.positionMs !== undefined ? delta.positionMs : this.session.positionMs,
      volume: delta.volume !== undefined ? delta.volume : this.session.volume,
      shuffle: delta.shuffle !== undefined ? delta.shuffle : this.session.shuffle,
      repeat: delta.repeat ?? this.session.repeat,
      queue: delta.queue ?? this.session.queue,
      queueIndex: delta.queueIndex ?? this.session.queueIndex,
      activeSinkDeviceId: delta.activeSinkDeviceId !== undefined ? delta.activeSinkDeviceId : this.session.activeSinkDeviceId,
    };

    if (delta.positionMs !== undefined) {
      this.lastRenderedPosMs = delta.positionMs;
    }
  }

  /**
   * Calculate live interpolated playback position with drift compensation
   * Formula:
   * CurrentPositionMs = AnchorPositionMs + (ServerAlignedNow - ServerTimestampMs) * isPlaying
   */
  public calculateCurrentPositionMs(): number {
    if (this.isUserSeeking) {
      return this.seekValueMs;
    }

    if (!this.session) return 0;
    const { playbackState, positionMs, serverTimestampMs, currentTrack } = this.session;
    const durationMs = currentTrack?.durationMs ?? 0;

    if (playbackState !== 'PLAYING') {
      return Math.min(positionMs, durationMs > 0 ? durationMs : Infinity);
    }

    const serverNow = NtpClockEngine.getInstance().getServerAlignedTime(Date.now());
    const elapsedMs = Math.max(0, serverNow - serverTimestampMs);
    const estimatedPos = positionMs + elapsedMs;

    const clamped = durationMs > 0 ? Math.min(estimatedPos, durationMs) : estimatedPos;
    return clamped;
  }

  public beginUserSeek(): void {
    this.isUserSeeking = true;
  }

  public setUserSeekPosition(positionMs: number): void {
    this.seekValueMs = positionMs;
    const dur = this.session?.currentTrack?.durationMs ?? 0;
    const ratio = dur > 0 ? Math.min(1, Math.max(0, positionMs / dur)) : 0;
    this.notify(positionMs, ratio);
  }

  public commitUserSeek(): number {
    this.isUserSeeking = false;
    this.lastRenderedPosMs = this.seekValueMs;
    return this.seekValueMs;
  }

  public subscribe(callback: ScrubberTickCallback): () => void {
    this.listeners.add(callback);
    this.startLoop();
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this.stopLoop();
      }
    };
  }

  private startLoop(): void {
    if (this.animFrameId !== null || typeof window === 'undefined') return;

    const loop = () => {
      if (!this.isUserSeeking) {
        const livePos = this.calculateCurrentPositionMs();
        const duration = this.session?.currentTrack?.durationMs ?? 0;
        const ratio = duration > 0 ? Math.min(1, Math.max(0, livePos / duration)) : 0;

        // Render at 60 FPS, avoid unnecessary layout thrash on micro adjustments (< 5ms)
        if (Math.abs(livePos - this.lastRenderedPosMs) >= 5 || this.session?.playbackState !== 'PLAYING') {
          this.lastRenderedPosMs = livePos;
          this.notify(livePos, ratio);
        }
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  private stopLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private notify(posMs: number, ratio: number): void {
    this.listeners.forEach((cb) => cb(posMs, ratio));
  }

  public destroy(): void {
    this.stopLoop();
    this.listeners.clear();
    this.session = null;
  }
}
