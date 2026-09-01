/**
 * RaagaX Connect — Authoritative Playback & Controller Types
 *
 * Implements 1-to-1 or 1-to-Many remote control (Spotify Connect architecture):
 * ONE DEVICE = ACTUAL AUDIO PLAYBACK DEVICE
 * OTHER DEVICES = REMOTE CONTROLLERS
 */

import { Song } from './music';

export type ConnectDeviceType = 'desktop' | 'mobile' | 'tablet' | 'tv' | 'speaker' | 'web';

export type ConnectDeviceState = 'IDLE' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'TRANSFERRING' | 'OFFLINE';

export type ConnectTransportType = 'LOCAL_LAN' | 'CLOUD_RELAY';

export type ConnectAuthStatus =
  | 'AUTO_AUTHORIZED'
  | 'REQUIRES_PAIRING'
  | 'PENDING_APPROVAL'
  | 'PAIRED'
  | 'DENIED';

export interface ConnectDevice {
  deviceId: string;
  deviceName: string;
  deviceType: ConnectDeviceType;
  platform?: string;
  ip?: string;
  port?: number;
  isCurrentDevice?: boolean;
  isOnline: boolean;
  state: ConnectDeviceState;
  currentSong?: Song | null;
  positionMs?: number;
  durationMs?: number;
  volume?: number;
  lastSeenAt: number;
  transport: ConnectTransportType;
  accountId?: string | null;
  authStatus?: ConnectAuthStatus;
  subnet?: string;
  isSameAccount?: boolean;
  isSameSubnet?: boolean;
  capabilities?: {
    canPlayAudio: boolean;
    supportsVolume: boolean;
    supportsLossless: boolean;
  };
}

export type ConnectCommandAction =
  | 'PLAY'
  | 'PAUSE'
  | 'RESUME'
  | 'SEEK'
  | 'SKIP_NEXT'
  | 'SKIP_PREV'
  | 'SET_VOLUME'
  | 'TRANSFER_PLAYBACK'
  | 'PLAY_SONG'
  | 'SET_QUEUE'
  | 'ADD_TO_QUEUE'
  | 'REMOVE_FROM_QUEUE'
  | 'REORDER_QUEUE'
  | 'MOVE_QUEUE_ITEM'
  | 'CLEAR_QUEUE'
  | 'SET_SHUFFLE'
  | 'SET_REPEAT'
  | 'REQUEST_SNAPSHOT'
  | 'DISCONNECT_CONTROLLER'
  | 'SPEAKER_DETACH_CONTROLLER'
  | 'CONTROLLER_DETACH_SELF'
  | 'HANDOFF_PREPARE'
  | 'HANDOFF_COMMIT'
  | 'HEARTBEAT';

export interface ConnectCommand {
  commandId: string;
  requestId?: string;
  senderDeviceId: string;
  senderName?: string;
  targetDeviceId: string;
  action: ConnectCommandAction;
  expectedRevision?: number;
  transitionId?: string;
  payload?: {
    positionMs?: number;
    volume?: number;
    song?: Song;
    queue?: Song[];
    queueIndex?: number;
    isPlaying?: boolean;
    shuffle?: boolean;
    repeat?: 'OFF' | 'ALL' | 'ONE';
    timelineId?: string;
    sourceDeviceId?: string;
    targetDeviceId?: string;
    controllerId?: string;
    speakerId?: string;
    newIndex?: number;
    oldIndex?: number;
    songId?: string;
    trackId?: string;
  };
  timestamp: number;
}

export interface ConnectTrackMetadata {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  durationMs: number;
  audioUrl?: string;
}

/**
 * Authoritative Playback Session State
 * Owned strictly by the Target Playback Device
 */
export interface ConnectPlaybackSession {
  sessionId: string;
  playbackDeviceId: string;
  playbackDeviceName: string;
  controllerIds: string[];
  controllerDeviceId?: string | null;
  controllerDeviceName?: string | null;
  
  currentTrackId: string | null;
  currentQueueItemId: string | null;
  currentSong: Song | null;
  metadata: ConnectTrackMetadata | null;

  queue: Song[];
  queueIndex: number;
  history: Song[];

  isPlaying: boolean;
  playbackState: ConnectDeviceState;

  positionMs: number;
  durationMs: number;

  volume: number;
  shuffle: boolean;
  repeat: 'OFF' | 'ALL' | 'ONE';

  revision: number;
  generation: number;

  timelineId: string;
  anchorPositionMs: number;
  anchorTimeMs: number; // Monotonic / server timestamp for smooth interpolation

  updatedAt: number;
}

export interface ConnectEvent {
  eventId: string;
  type: 'SESSION_STATE_CHANGED' | 'PLAYBACK_TRANSFERRED' | 'CONTROLLER_DISCONNECTED' | 'COMMAND_ACCEPTED' | 'COMMAND_REJECTED';
  senderDeviceId: string;
  session: ConnectPlaybackSession;
  serverTimestamp: number;
  requestId?: string;
}

export interface DeviceNode {
  id: string;
  name: string;
  type: 'mobile' | 'desktop' | 'browser';
  lastSeen: number;
}

export interface UserConnectSession {
  userId: string;
  sessionId: string;
  activeSpeakerId: string | null;     // Device Y (Actual Audio Out)
  activeSpeakerName: string | null;
  controllerId: string | null;        // Device X (Remote Driver)
  controllerName: string | null;
  stateVersion: number;
  track: {
    id: string;
    title: string;
    artist: string;
    durationMs: number;
    audioUrl: string;
  } | null;
  playback: {
    isPaused: boolean;
    positionMs: number;
    timestamp: number; // Server epoch ms for clock-drift compensation
  };
  volume: {
    value: number; // 0 - 100
    isMuted: boolean;
  };
  registeredDevices: Record<string, DeviceNode>;
}
