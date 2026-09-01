/**
 * RaagaX Connect — Protocol & Data Contract Specifications
 * Strict typing with zero `any` types for cross-device audio synchronization.
 */

export type ConnectDeviceType = 'MOBILE' | 'DESKTOP' | 'TABLET' | 'TV' | 'SPEAKER' | 'WEB';

export type SupportedAudioCodec =
  | 'audio/aac'
  | 'audio/mp4'
  | 'audio/ogg'
  | 'audio/mpeg'
  | 'audio/opus';

export interface DeviceCapabilities {
  readonly canBeSink: boolean;
  readonly supportsGapless: boolean;
  readonly supportedCodecs: readonly SupportedAudioCodec[];
  readonly maxBitrateBps: number;
}

export interface ConnectedDevice {
  readonly deviceId: string;
  readonly userId: string;
  readonly name: string;
  readonly deviceType: ConnectDeviceType;
  readonly capabilities: DeviceCapabilities;
  readonly lastSeenMs: number;
  readonly isOnline: boolean;
}

export type PlaybackState = 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'IDLE';

export type RepeatMode = 'OFF' | 'ALL' | 'ONE';

export interface TrackMetadata {
  readonly uri: string;
  readonly title: string;
  readonly artist: string;
  readonly album: string;
  readonly artworkUrl: string;
  readonly durationMs: number;
  readonly bitrateBps: number;
}

export interface DeviceInfo {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly deviceType: 'MOBILE' | 'DESKTOP' | 'WEB';
  readonly isSink: boolean;
  readonly isActive: boolean;
}

export interface ClientCommandMessage {
  readonly commandId: string;
  readonly action:
    | 'TRANSFER_PLAYBACK'
    | 'PLAY_SONG'
    | 'PLAY'
    | 'PAUSE'
    | 'SEEK'
    | 'SKIP_NEXT'
    | 'SKIP_PREVIOUS'
    | 'SET_VOLUME'
    | 'SPEAKER_DETACH_CONTROLLER'
    | 'CONTROLLER_DETACH_SELF';
  readonly senderDeviceId: string;
  readonly timestamp: number;
  readonly payload?: {
    readonly targetDeviceId?: string;
    readonly seekPositionMs?: number;
    readonly volumeLevel?: number;
    readonly repeatMode?: 'OFF' | 'ALL' | 'ONE';
    readonly controllerId?: string;
    readonly speakerId?: string;
  };
}

export interface PlaybackSessionState {
  readonly sessionId: string;
  readonly userId: string;
  readonly activeSinkDeviceId: string | null;
  readonly controllerDeviceId?: string | null;
  readonly controllerDeviceName?: string | null;
  readonly stateVersion: number; // Monotonically increasing epoch counter
  readonly serverTimestampMs: number;
  readonly playbackState: PlaybackState;
  readonly currentTrack: TrackMetadata | null;
  readonly positionMs: number; // Anchor position captured at serverTimestampMs
  readonly volume: number; // Clamped [0.0, 1.0]
  readonly shuffle: boolean;
  readonly repeat: RepeatMode;
  readonly queue: readonly TrackMetadata[];
  readonly queueIndex: number;
}

export interface PlaybackStateDelta {
  readonly stateVersion: number;
  readonly serverTimestampMs: number;
  readonly activeSinkDeviceId?: string | null;
  readonly controllerDeviceId?: string | null;
  readonly controllerDeviceName?: string | null;
  readonly playbackState?: PlaybackState;
  readonly currentTrack?: TrackMetadata | null;
  readonly positionMs?: number;
  readonly volume?: number;
  readonly shuffle?: boolean;
  readonly repeat?: RepeatMode;
  readonly queue?: readonly TrackMetadata[];
  readonly queueIndex?: number;
}

// ── Client-to-Server Command Contracts ───────────────────────────

export type ClientCommandAction =
  | 'REGISTER_DEVICE'
  | 'TRANSFER_PLAYBACK'
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'SET_VOLUME'
  | 'SET_SHUFFLE'
  | 'SET_REPEAT'
  | 'SKIP_NEXT'
  | 'SKIP_PREV'
  | 'PLAY_SONG'
  | 'SPEAKER_DETACH_CONTROLLER'
  | 'CONTROLLER_DETACH_SELF'
  | 'QUEUE_MUTATE'
  | 'HEARTBEAT';

export interface RegisterDevicePayload {
  readonly deviceId: string;
  readonly name: string;
  readonly deviceType: ConnectDeviceType;
  readonly capabilities: DeviceCapabilities;
}

export interface TransferPlaybackPayload {
  readonly targetDeviceId: string;
  readonly track?: TrackMetadata;
  readonly queue?: readonly TrackMetadata[];
  readonly seekPositionMs?: number;
  readonly autoPlay: boolean;
}

export interface SeekPayload {
  readonly positionMs: number;
}

export interface VolumePayload {
  readonly volume: number;
}

export interface ShufflePayload {
  readonly shuffle: boolean;
}

export interface RepeatPayload {
  readonly repeat: RepeatMode;
}

export interface QueueMutatePayload {
  readonly action: 'ADD' | 'REMOVE' | 'REORDER' | 'CLEAR';
  readonly track?: TrackMetadata;
  readonly fromIndex?: number;
  readonly toIndex?: number;
  readonly newQueue?: readonly TrackMetadata[];
}

export interface ClientCommand<T = unknown> {
  readonly type: 'COMMAND';
  readonly commandId: string;
  readonly clientTimestampMs: number;
  readonly originDeviceId: string;
  readonly expectedVersion?: number;
  readonly action: ClientCommandAction;
  readonly payload: T;
}

// ── Server-to-Client Message Contracts ───────────────────────────

export type ServerMessageType =
  | 'FULL_HYDRATE'
  | 'STATE_MUTATION'
  | 'PAUSE_AND_FLUSH'
  | 'LOAD_AND_PLAY'
  | 'DEVICE_LIST_UPDATE'
  | 'COMMAND_ACK'
  | 'HEARTBEAT_ACK'
  | 'ERROR';

export interface FullHydrateMessage {
  readonly type: 'FULL_HYDRATE';
  readonly state: PlaybackSessionState;
  readonly serverTimestampMs: number;
}

export interface StateMutationMessage {
  readonly type: 'STATE_MUTATION';
  readonly delta: PlaybackStateDelta;
  readonly serverTimestampMs: number;
}

export interface PauseAndFlushMessage {
  readonly type: 'PAUSE_AND_FLUSH';
  readonly commandId: string;
  readonly targetDeviceId: string;
  readonly serverTimestampMs: number;
}

export interface LoadAndPlayMessage {
  readonly type: 'LOAD_AND_PLAY';
  readonly commandId: string;
  readonly track: TrackMetadata;
  readonly offsetMs: number;
  readonly autoPlay: boolean;
  readonly serverTimestampMs: number;
}

export interface DeviceListUpdateMessage {
  readonly type: 'DEVICE_LIST_UPDATE';
  readonly devices: readonly ConnectedDevice[];
  readonly serverTimestampMs: number;
}

export interface CommandAckMessage {
  readonly type: 'COMMAND_ACK';
  readonly commandId: string;
  readonly success: boolean;
  readonly stateVersion: number;
  readonly serverTimestampMs: number;
}

export interface HeartbeatAckMessage {
  readonly type: 'HEARTBEAT_ACK';
  readonly clientTimestampMs: number;
  readonly serverTimestampMs: number;
}

export interface ErrorMessage {
  readonly type: 'ERROR';
  readonly code: 'UNAUTHORIZED' | 'STALE_VERSION' | 'DEVICE_NOT_FOUND' | 'INVALID_PAYLOAD' | 'BUFFER_ERROR';
  readonly message: string;
  readonly commandId?: string;
  readonly serverTimestampMs: number;
}

export type ServerMessage =
  | FullHydrateMessage
  | StateMutationMessage
  | PauseAndFlushMessage
  | LoadAndPlayMessage
  | DeviceListUpdateMessage
  | CommandAckMessage
  | HeartbeatAckMessage
  | ErrorMessage;
