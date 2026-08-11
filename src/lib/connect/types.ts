export interface DeviceCapabilities {
  audio: boolean;
  video: boolean;
  offline: boolean;
  connect: boolean;
}

export type ConnectCommandType = 
  | "PLAY"
  | "PAUSE"
  | "SEEK"
  | "NEXT"
  | "PREV"
  | "TRANSFER_REQUEST"
  | "TRANSFER_READY"
  | "TRANSFER_COMMIT"
  | "HANDOFF"
  | "COMMAND_ACK";

export interface ConnectCommand<T = unknown> {
  commandId: string;
  sessionId: string;
  epoch: number;
  sequence: number;
  sourceDeviceId: string;
  targetDeviceId?: string;
  type: ConnectCommandType;
  sentAt: number;
  payload: T;
}

export interface CommandAckPayload {
  status: "APPLIED" | "REJECTED";
  reason?: string;
}
