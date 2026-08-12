import { Song } from '@/types/music';

export interface PlaybackSessionState {
  sessionId: string;
  deviceId: string;
  sessionEpoch: number;
  sequenceNumber: number;
  currentSong: Song | null;
  positionMs: number;
  playbackState: 'playing' | 'paused' | 'stopped' | 'buffering';
  recoveryState: 'STABLE' | 'RECOVERING' | 'RECONNECTED';
  updatedAt: number;
}

const STORAGE_KEY = 'raagax_playback_recovery_state';

export class PlaybackRecoveryStateEngine {
  private static instance: PlaybackRecoveryStateEngine;

  private state: PlaybackSessionState = {
    sessionId: '',
    deviceId: '',
    sessionEpoch: Date.now(),
    sequenceNumber: 1,
    currentSong: null,
    positionMs: 0,
    playbackState: 'paused',
    recoveryState: 'STABLE',
    updatedAt: Date.now(),
  };

  private constructor() {
    this.initSession();
  }

  public static getInstance(): PlaybackRecoveryStateEngine {
    if (!PlaybackRecoveryStateEngine.instance) {
      PlaybackRecoveryStateEngine.instance = new PlaybackRecoveryStateEngine();
    }
    return PlaybackRecoveryStateEngine.instance;
  }

  private initSession() {
    if (typeof window === 'undefined') return;
    try {
      const deviceId = localStorage.getItem('raagax_device_id') || crypto.randomUUID();
      localStorage.setItem('raagax_device_id', deviceId);

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.state = {
          ...parsed,
          deviceId,
          recoveryState: 'RECOVERING',
          sequenceNumber: (parsed.sequenceNumber || 0) + 1,
        };
      } else {
        this.state.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.state.deviceId = deviceId;
      }
    } catch (e) {
      console.warn('[PlaybackRecoveryStateEngine] Init failed:', e);
    }
  }

  private saveState() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('[PlaybackRecoveryStateEngine] Save failed:', e);
    }
  }

  /**
   * Updates state with monotonic sequence number increment to reject stale/duplicate commands
   */
  public updateState(
    song: Song | null,
    positionSec: number,
    isPlaying: boolean,
    playbackState: 'playing' | 'paused' | 'stopped' | 'buffering' = isPlaying ? 'playing' : 'paused'
  ) {
    this.state.sequenceNumber++;
    this.state.currentSong = song;
    this.state.positionMs = Math.floor(positionSec * 1000);
    this.state.playbackState = playbackState;
    this.state.recoveryState = 'STABLE';
    this.state.updatedAt = Date.now();

    this.saveState();
  }

  public isCommandStale(sequenceNumber: number): boolean {
    return sequenceNumber <= this.state.sequenceNumber;
  }

  public getState(): PlaybackSessionState {
    return { ...this.state };
  }
}
