export type FocusReason =
  | 'NOTIFICATION'
  | 'NAVIGATION'
  | 'CALL'
  | 'ALARM'
  | 'OTHER_MEDIA'
  | 'SYSTEM'
  | 'USER'
  | 'BLUETOOTH'
  | 'HEADPHONES_REMOVED'
  | 'HANDOFF';

export type RawAudioFocusType =
  | 'GAIN'
  | 'LOSS'
  | 'LOSS_TRANSIENT'
  | 'LOSS_DUCK'
  | 'GAIN_TRANSIENT_END';

export interface RawAudioFocusEvent {
  type: RawAudioFocusType;
  reason?: FocusReason;
}

export type InterruptionClass =
  | 'DUCK'
  | 'PAUSE_TRANSIENT_RESUMABLE'
  | 'PAUSE_PERMANENT';

export interface InterruptionSnapshot {
  id: string;
  reason: FocusReason;
  wasPlaying: boolean;
  positionMs: number;
  trackId: string;
  sessionId: string;
  rendererDeviceId: string;
  timestamp: number;
}

export interface ResumePolicy {
  eligible: boolean;
  reason: FocusReason;
  sessionId: string;
  trackId: string;
  positionMs: number;
  rendererDeviceId: string;
}
