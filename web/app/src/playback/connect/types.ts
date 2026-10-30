export type ConnectDeviceType = 'PHONE' | 'DESKTOP' | 'SPEAKER';

export interface ConnectTrack {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl?: string | null;
  durationText?: string | null;
  albumName?: string | null;
}

export interface ConnectDevice {
  id: string;
  name: string;
  type: ConnectDeviceType;
  host: string;
  port: number;
  lastSeenTimestamp: number;
  isCloud: boolean;
}

export type HandoffPhase = 'PREPARE' | 'READY' | 'COMMIT' | 'CONFIRMED' | 'ABORT';

export interface ConnectHandoffPacket {
  handoffId: string;
  phase: HandoffPhase;
  protocolVersion: number;
  sessionId: string;
  sourceDeviceId: string;
  sourceDeviceName: string;
  targetDeviceId: string;
  track?: ConnectTrack | null;
  positionMs: number;
  isPlaying: boolean;
  volume?: number | null;
  queue: ConnectTrack[];
  queueIndex: number;
  scheduledStartEpochMs?: number | null;
  bufferReadyDurationMs: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  timestampMs: number;
  syncKey?: string | null;
}

export interface ConnectControlCommand {
  action: 'PLAY' | 'PAUSE' | 'TOGGLE' | 'NEXT' | 'PREV' | 'SEEK' | 'VOLUME' | 'SPEED' | 'QUERY_STATUS';
  positionMs?: number | null;
  volume?: number | null;
  playbackSpeed?: number | null;
  targetDeviceId: string;
  commandId: string;
  seq: number;
  protocolVersion: number;
  sessionId?: string | null;
  senderDeviceId: string;
  syncKey?: string | null;
}

export interface ConnectDeviceStatus {
  deviceId: string;
  deviceName: string;
  deviceType: ConnectDeviceType;
  isPlaying: boolean;
  track?: ConnectTrack | null;
  positionMs: number;
  durationMs: number;
  volume: number;
  playbackSpeed: number;
  anchorMonotonicMs: number;
  protocolVersion: number;
  sessionId?: string | null;
  activeSpeakerDeviceId?: string | null;
  localReceiptMonotonicMs?: number;
}

export interface PairedDevice {
  id: string;
  name: string;
  type: ConnectDeviceType;
  pairedAt: number;
}

export interface ConnectPairRequest {
  code: string;
  fromDevice: ConnectDevice;
  timestamp: number;
}

export interface ConnectPairResponse {
  code: string;
  success: boolean;
  targetDeviceId: string;
  syncKey?: string | null;
  device?: ConnectDevice | null;
}

