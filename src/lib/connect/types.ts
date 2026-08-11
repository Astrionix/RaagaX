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
