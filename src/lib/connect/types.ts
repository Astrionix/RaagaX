export interface DeviceCapabilities {
  audio: boolean;
  video: boolean;
  seek: boolean;
  volume: boolean;
  backgroundPlayback: boolean;
  remoteControl: boolean;
  offline: boolean;
  connect: boolean;
}

export type TransportMode = 'LOCAL_DIRECT' | 'HOTSPOT_DIRECT' | 'CLOUD_RELAY';

export type DeviceConnectionState =
  | "AVAILABLE"
  | "CONNECTING"
  | "CONNECTED"
  | "DISCONNECTING"
  | "OFFLINE";

export type SeekTransactionState =
  | "SEEK_IDLE"
  | "SEEK_REQUESTED"
  | "SEEK_EXECUTING"
  | "PLAYER_POSITION_CONFIRMED"
  | "SEEK_COMPLETE";

export type ConnectState =
  | "OFFLINE"
  | "CONNECTING"
  | "SUBSCRIBING"
  | "CONNECTED"
  | "RECOVERING"
  | "RESYNCING"
  | "READY"
  | "STALE"
  | "TAKEOVER_PENDING";

export type ConnectCommandType = 
  | "PLAY"
  | "PAUSE"
  | "SEEK"
  | "NEXT"
  | "PREV"
  | "SET_VOLUME"
  | "SET_SHUFFLE"
  | "SET_REPEAT"
  | "TRANSFER_REQUEST"
  | "TRANSFER_ACCEPTED"
  | "TRANSFER_PREPARING"
  | "TRANSFER_READY"
  | "TRANSFER_COMMIT"
  | "TRANSFER_ROLLBACK"
  | "HANDOFF"
  | "QUEUE_SHUFFLE_COMMIT"
  | "WEBRTC_SIGNAL"
  | "COMMAND_ACK";

export interface ConnectCommand<T = unknown> {
  commandId: string;
  sessionId: string;
  transitionId?: string;
  commandHash?: string;
  epoch: number;
  revision?: number;
  sequence: number;
  sourceDeviceId: string;
  targetDeviceId?: string;
  type: ConnectCommandType;
  sentAt: number;
  payload: T;
}

export type CommandAckStatus =
  | "APPLIED"
  | "DUPLICATE"
  | "STALE_EPOCH"
  | "STALE_REVISION"
  | "INVALID_LEASE"
  | "TARGET_OFFLINE"
  | "UNAUTHORIZED"
  | "TRANSITION_ROLLED_BACK"
  | "PAYLOAD_TAMPERED"
  | "REJECTED";

export interface CommandAckPayload {
  commandId: string;
  transitionId?: string;
  status: CommandAckStatus;
  reason?: string;
  revision?: number;
  epoch?: number;
}

export interface PlaybackSnapshot {
  sessionId: string;
  deviceId: string;
  currentTrackId: string | null;
  positionMs: number;
  timestampMs: number; // Date.now() when state was checkpointed
  isPlaying: boolean;
  sequence: number;
  context?: import('../queue/types').PlaybackContext;
  durationMs?: number;
}

/**
 * Calculates current live playback position dynamically based on timestamped snapshot:
 * positionMs = snapshot.positionMs + (snapshot.isPlaying ? (now - snapshot.timestampMs) : 0)
 */
export function calculateLivePositionMs(snapshot: PlaybackSnapshot | null, now: number = Date.now()): number {
  if (!snapshot) return 0;
  if (!snapshot.isPlaying) return snapshot.positionMs;
  const elapsed = Math.max(0, now - snapshot.timestampMs);
  const calculated = snapshot.positionMs + elapsed;
  if (snapshot.durationMs && snapshot.durationMs > 0) {
    return Math.min(calculated, snapshot.durationMs);
  }
  return calculated;
}
