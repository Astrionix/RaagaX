export type PlaybackInterruption =
  | "NONE"
  | "EXTERNAL_AUDIO"
  | "PHONE_CALL"
  | "SYSTEM"
  | "AUDIO_FOCUS_LOSS"
  | "HANDOFF"
  | "USER"
  | "ERROR";

export type ResumePolicy = "AUTO" | "MANUAL" | "NEVER";

export interface InterruptionToken {
  id: string;
  trackId: string;
  positionMs: number;
  renderer: "audio" | "video";
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
