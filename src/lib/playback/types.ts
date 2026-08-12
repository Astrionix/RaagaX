export type PlaybackInterruption =
  | "NONE"
  | "EXTERNAL_AUDIO"
  | "PHONE_CALL"
  | "SYSTEM"
  | "AUDIO_FOCUS_LOSS"
  | "HANDOFF"
  | "USER"
  | "ERROR"
  | "NOTIFICATION"
  | "NAVIGATION"
  | "CALL"
  | "ALARM"
  | "OTHER_MEDIA"
  | "BLUETOOTH";

export type ResumePolicy = "AUTO" | "MANUAL" | "NEVER";

export interface InterruptionToken {
  id: string;
  trackId: string;
  positionMs: number;
  renderer: "audio" | "video" | "remote";
  reason: PlaybackInterruption;
  startedAt: number;
  resumePolicy: ResumePolicy;
}

export type PlaybackState = 
  | "IDLE"
  | "LOADING"
  | "READY"
  | "PLAYING"
  | "PAUSED"
  | "INTERRUPTED"
  | "TRANSITIONING"
  | "RETRYING"
  | "HANDOFF"
  | "ERROR";

export interface PlaybackCapabilities {
  audioSession: boolean;
  mediaSession: boolean;
  nativeAudioFocus: boolean;
}

export function getPlaybackCapabilities(): PlaybackCapabilities {
  const isNavDefined = typeof navigator !== 'undefined';
  return {
    audioSession: isNavDefined && 'audioSession' in navigator,
    mediaSession: isNavDefined && 'mediaSession' in navigator,
    nativeAudioFocus: isNavDefined && typeof (window as any).AndroidAudioFocus !== 'undefined',
  };
}

export type AudioQuality = 
  | 'AUTO'
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'VERY_HIGH'
  | 'LOSSLESS';

export type AudioQualityState = {
  requested: AudioQuality;
  delivered: AudioQuality;
  
  codec?: string;
  bitrateKbps?: number;
  sampleRate?: number;
};

export type AdvanceReason =
  | 'NATURAL_END'
  | 'USER_NEXT'
  | 'USER_PREV'
  | 'AUTOPLAY'
  | 'REPEAT_TRACK'
  | 'REPEAT_CONTEXT'
  | 'ERROR_RECOVERY';

export interface PlayerRestrictions {
  disallowSkipNext: string[];
  disallowSkipPrev: string[];
  disallowSeek: string[];
  disallowPause: string[];
  disallowSetQueue: string[];
  disallowTransfer: string[];
}

export interface PlayerQueueWindow {
  revision: number;
  prevTracks: import('@/types/music').Song[];
  currentTrack: import('@/types/music').Song | null;
  nextTracks: import('@/types/music').Song[];
}

export type PlayerCommandType =
  | 'SET_QUEUE'
  | 'ADD_TO_QUEUE'
  | 'PLAY_AS_NEXT'
  | 'SKIP_TO_NEXT'
  | 'SKIP_TO_PREV'
  | 'SEEK'
  | 'SET_REPEAT'
  | 'SET_SHUFFLE'
  | 'UPDATE_CONTEXT';

export interface PlayerCommand<T = unknown> {
  commandId: string;
  sessionId: string;
  sessionCommandId: string;
  sourceDeviceId: string;
  expectedQueueRevision?: number;
  type: PlayerCommandType;
  sentAt: number;
  playOrigin?: 'HOME' | 'SEARCH' | 'ALBUM' | 'PLAYLIST' | 'RECOMMENDATION' | 'AUTOPLAY';
  payload: T;
}
