import { Song } from '@/types/music';

export type LANPlatform = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'web';
export type LANDeviceType = 'desktop' | 'mobile' | 'tablet' | 'tv' | 'speaker' | 'web';
export type LANActivityStatus = 'playing' | 'paused' | 'idle' | 'buffering';
export type LANAuthTier = 'SAME_ACCOUNT' | 'OTHER_ACCOUNT' | 'UNVERIFIED' | 'REJECTED';
export type LANConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'FAILED' | 'RECONNECTING';

export interface LANDeviceAdvertisement {
  deviceId: string;
  deviceName: string;
  deviceType: LANDeviceType;
  platform: LANPlatform;
  protocolVersion: '2.0.0';
  host: string;
  port: number;
  capabilities: string[];
  userId?: string;
  accountName?: string;
  accountAvatar?: string;
  currentActivity: LANActivityStatus;
  activeSongTitle?: string;
  activeSongCover?: string;
  timestamp: number;
}

export type LANControlPolicy = 'NOBODY' | 'ASK_EVERY_TIME' | 'TRUSTED_ONLY' | 'ANYONE_ON_WIFI';
export type LANSwitchPolicy = 'ASK_EVERY_TIME' | 'TRUSTED_ONLY' | 'NEVER';

export interface LANPermissions {
  allowControl: boolean;
  allowSwitch: boolean;
}

export type LANExpiryDuration = '15m' | '1h' | 'session' | 'permanent';

export interface TrustedPeer {
  deviceId: string;
  deviceName: string;
  accountName?: string;
  userId?: string;
  permissions: LANPermissions;
  pairedAt: number;
  expiresAt: number | null;
}

export interface DiscoveredLANDevice extends LANDeviceAdvertisement {
  isSameAccount: boolean;
  authTier: LANAuthTier;
  connectionStatus: LANConnectionStatus;
  isPaired?: boolean;
  permissions?: LANPermissions;
  lastSeen: number;
  rttMs?: number;
  isLocalDevice?: boolean;
}

export type LANMessageType =
  | 'HANDSHAKE_REQUEST'
  | 'HANDSHAKE_RESPONSE'
  | 'PAIRING_REQUEST'
  | 'PAIRING_RESPONSE'
  | 'REVOKE_PAIRING'
  | 'HEARTBEAT_PING'
  | 'HEARTBEAT_PONG'
  | 'PLAYBACK_STATE'
  | 'CMD_PLAY'
  | 'CMD_PAUSE'
  | 'CMD_NEXT'
  | 'CMD_PREV'
  | 'CMD_SEEK'
  | 'CMD_VOLUME'
  | 'CMD_SHUFFLE'
  | 'CMD_REPEAT'
  | 'CMD_LOAD_TRACK'
  | 'CMD_QUEUE_CHANGE'
  | 'CMD_ACK'
  | 'STATE_REQUEST'
  | 'CMD_STATE_REQUEST'
  | 'CMD_DISCONNECT'
  | 'DISCONNECT'
  | 'SWITCH_REQUEST'
  | 'SWITCH_OFFER'
  | 'SWITCH_READY'
  | 'SWITCH_COMMIT'
  | 'SWITCH_FAILED'
  | 'SWITCH_CANCEL';

export interface LANBaseMessage {
  id: string;
  type: LANMessageType;
  sourceDeviceId: string;
  targetDeviceId: string;
  timestamp: number;
}

export interface LANPairingRequestMessage extends LANBaseMessage {
  type: 'PAIRING_REQUEST';
  pairingId: string;
  clientIdentity: LANDeviceAdvertisement;
  requestedPermissions: LANPermissions;
}

export interface LANPairingResponseMessage extends LANBaseMessage {
  type: 'PAIRING_RESPONSE';
  pairingId: string;
  accepted: boolean;
  grantedPermissions: LANPermissions;
  expiresAt: number | null;
  reason?: string;
}

export interface LANRevokePairingMessage extends LANBaseMessage {
  type: 'REVOKE_PAIRING';
  targetDeviceId: string;
}

export interface LANHandshakeRequestMessage extends LANBaseMessage {
  type: 'HANDSHAKE_REQUEST';
  clientIdentity: LANDeviceAdvertisement;
  sessionToken?: string;
  clientNonce: string;
}

export interface LANHandshakeResponseMessage extends LANBaseMessage {
  type: 'HANDSHAKE_RESPONSE';
  authTier: LANAuthTier;
  accepted: boolean;
  serverIdentity: LANDeviceAdvertisement;
  reason?: string;
  sessionId: string;
}

export interface LANHeartbeatMessage extends LANBaseMessage {
  type: 'HEARTBEAT_PING' | 'HEARTBEAT_PONG';
}

export interface LANPlaybackStatePayload {
  ownerDeviceId: string;
  songId: string | null;
  song: Song | null;
  queue: Song[];
  queueIndex: number;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  isBuffering?: boolean;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  shuffleMode: 'OFF' | 'STANDARD' | 'SMART';
  repeatMode: 'OFF' | 'ALL' | 'ONE';
  stateVersion: number;
  timestamp: number;
}

export interface LANPlaybackStateMessage extends LANBaseMessage {
  type: 'PLAYBACK_STATE';
  payload: LANPlaybackStatePayload;
}

export interface LANCommandTiming {
  tapTimestamp?: number;
  sendTimestamp: number;
  receiveTimestamp?: number;
  executeTimestamp?: number;
  ackTimestamp?: number;
}

export interface LANRemoteCommandMessage extends LANBaseMessage {
  type:
    | 'CMD_PLAY'
    | 'CMD_PAUSE'
    | 'CMD_NEXT'
    | 'CMD_PREV'
    | 'CMD_SEEK'
    | 'CMD_VOLUME'
    | 'CMD_SHUFFLE'
    | 'CMD_REPEAT'
    | 'CMD_LOAD_TRACK'
    | 'CMD_QUEUE_CHANGE';
  commandId: string;
  sequence?: number;
  expectedStateVersion?: number;
  timing?: LANCommandTiming;
  payload?: {
    positionMs?: number;
    volume?: number;
    isMuted?: boolean;
    shuffleMode?: 'OFF' | 'STANDARD' | 'SMART';
    repeatMode?: 'OFF' | 'ALL' | 'ONE';
    song?: Song;
    queue?: Song[];
    queueIndex?: number;
  };
}

export interface LANCommandAckMessage extends LANBaseMessage {
  type: 'CMD_ACK';
  commandId: string;
  success: boolean;
  stateVersion: number;
  timing: LANCommandTiming;
}

export interface LANSwitchRequestMessage extends LANBaseMessage {
  type: 'SWITCH_REQUEST';
  transferId: string;
  initiatorDeviceId: string;
  targetDeviceId: string;
}

export interface LANSwitchOfferMessage extends LANBaseMessage {
  type: 'SWITCH_OFFER';
  transferId: string;
  snapshot: {
    song: Song | null;
    queue: Song[];
    queueIndex: number;
    positionMs: number;
    durationMs: number;
    isPlaying: boolean;
    playbackRate: number;
    stateVersion: number;
  };
}

export interface LANSwitchReadyMessage extends LANBaseMessage {
  type: 'SWITCH_READY';
  transferId: string;
  readyPositionMs: number;
}

export interface LANSwitchCommitMessage extends LANBaseMessage {
  type: 'SWITCH_COMMIT';
  transferId: string;
  newOwnerDeviceId: string;
  finalPositionMs: number;
  stateVersion: number;
}

export interface LANSwitchFailedMessage extends LANBaseMessage {
  type: 'SWITCH_FAILED';
  transferId: string;
  reason: string;
  errorCode?: 'TRACK_UNAVAILABLE' | 'PLAYBACK_ERROR' | 'TIMEOUT' | 'REJECTED';
}

export type LANMessage =
  | LANHandshakeRequestMessage
  | LANHandshakeResponseMessage
  | LANPairingRequestMessage
  | LANPairingResponseMessage
  | LANRevokePairingMessage
  | LANHeartbeatMessage
  | LANPlaybackStateMessage
  | LANRemoteCommandMessage
  | LANCommandAckMessage
  | LANSwitchRequestMessage
  | LANSwitchOfferMessage
  | LANSwitchReadyMessage
  | LANSwitchCommitMessage
  | LANSwitchFailedMessage;
