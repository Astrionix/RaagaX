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
