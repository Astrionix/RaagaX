export type DeviceType = 'phone' | 'tablet' | 'desktop';
export type Platform = 'web' | 'android' | 'electron';

export interface DeviceCapabilities {
  play: boolean;
  pause: boolean;
  seek: boolean;
  volume: boolean;
  shuffle: boolean;
  repeat: boolean;
  queue_control: boolean;
  handoff: boolean;
}

export interface DeviceInfo {
  deviceId: string;
  userId?: string | null;
  deviceName: string;
  deviceType: DeviceType;
  platform: Platform;
  capabilities: DeviceCapabilities;
  isOnline: boolean;
  lastSeen: number;
  appVersion: string;
  protocolVersion: number;
  source?: 'LAN' | 'CLOUD' | 'BOTH';
  isSameWifi?: boolean;
  isAuthorized?: boolean;
  activeJamPin?: string | null;
}

export type ConnectCommandType =
  | 'PLAY'
  | 'PAUSE'
  | 'PAUSED'
  | 'NEXT'
  | 'PREVIOUS'
  | 'SEEK'
  | 'SET_VOLUME'
  | 'MUTE'
  | 'SET_SHUFFLE'
  | 'SET_REPEAT'
  | 'TRANSFER_PLAYBACK'
  | 'RELINQUISH_SPEAKER'
  | 'SYNC_QUEUE'
  | 'ADD_TO_QUEUE';

export interface ConnectCommand {
  commandId: string;
  connectionId: string;
  controllerDeviceId: string;
  playerDeviceId: string;
  commandType: ConnectCommandType;
  payload?: any;
  timestamp: number;
  stateVersion: number;
}

export interface CommandAck {
  commandId: string;
  status: 'accepted' | 'rejected' | 'unsupported';
  reason?: string;
  stateVersion?: number;
}

import { RepeatMode } from '@/types/music';

export interface PlaybackState {
  playerDeviceId: string;
  track: any | null;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  stateVersion: number;
  updatedAt: number;
  queue?: any[];
  queueIndex?: number;
}

export type ConnectionState =
  | 'DISCONNECTED'
  | 'DISCOVERING'
  | 'FOUND'
  | 'AUTHORIZING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'FAILED';

export interface PairingRequest {
  id?: string;
  pinCode: string;
  hostDeviceId: string;
  hostDeviceName: string;
  guestDeviceId: string;
  guestDeviceName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  expiresAt: number;
}

export interface DiagnosticReport {
  deviceId: string;
  userId: string | null;
  lanDiscovery: boolean;
  cloudPresence: boolean;
  reachability: boolean;
  authorization: boolean;
  lanTransport: boolean;
  cloudTransport: boolean;
  handshake: boolean;
  playbackControl: boolean;
  stateSync: boolean;
  handoff: boolean;
  roundTripLatencyMs: number;
  lastCheck: number;
}
