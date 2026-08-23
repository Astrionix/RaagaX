export interface DeviceCapabilities {
  audio: boolean;
  video: boolean;
  seek: boolean;
  volume: boolean;
  backgroundPlayback: boolean;
  remoteControl: boolean;
  offline: boolean;
  connect: boolean;
  queue?: boolean;      // Can receive QUEUE_SHUFFLE_COMMIT
  transfer?: boolean;   // Can be renderer target of TRANSFER
}

/** How close this device is to the current one — drives UI proximity labels. */
export type DeviceProximity = 'NEARBY' | 'LOCAL' | 'REMOTE' | 'UNREACHABLE';

/** Role of a device in the current session. */
export type DeviceRole = 'RENDERER' | 'CONTROLLER' | 'OBSERVER';

export type TransportMode = 'LOCAL_DIRECT' | 'HOTSPOT_DIRECT' | 'CLOUD_RELAY';

export type DeviceConnectionState =
  | "AVAILABLE"
  | "CONNECTING"
  | "CONNECTED"
  | "DISCONNECTING"
  | "OFFLINE"
  | "LAN_CONNECTED"
  | "LAN_DEGRADED"
  | "LAN_LOST"
  | "CLOUD_CONNECTED";

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
  | "TAKEOVER_PENDING"
  | "DISCONNECTING"
  | "DISCONNECTED";

export type ConnectCommandType = 
  | "PLAY"
  | "PAUSE"
  | "SEEK"
  | "SEEK_DRAG"         // HIGH_FREQUENCY: local only, never sent
  | "POSITION_PREVIEW"  // HIGH_FREQUENCY: local only, never sent  
  | "NEXT"
  | "PREV"
  | "PREVIOUS"
  | "SET_VOLUME"
  | "SET_SHUFFLE"
  | "SET_REPEAT"
  | "ADD_TO_QUEUE"
  | "REMOVE_FROM_QUEUE"
  | "MOVE_QUEUE_ITEM"
  | "CLEAR_QUEUE"
  | "PLAY_TRACK"
  | "STOP"
  | "TRANSFER_PLAYBACK"
  | "TRANSFER_REQUEST"
  | "TRANSFER_ACCEPTED"
  | "TRANSFER_PREPARING"
  | "TRANSFER_READY"
  | "TRANSFER_COMMIT"
  | "TRANSFER_COMMITTED"
  | "TRANSFER_ROLLBACK"
  | "HANDOFF"
  | "QUEUE_SHUFFLE_COMMIT"
  | "WEBRTC_SIGNAL"
  | "CONNECT_REQUEST"
  | "CONNECT_RESPONSE"
  | "HEARTBEAT"
  | "HEARTBEAT_ACK"
  | "COMMAND_ACK"
  | "CONTROLLER_REQUEST"  // Request control of a renderer
  | "CONTROLLER_RELEASE"; // Release controller role

/**
 * Command delivery class — determines how TransportRouter handles each command type.
 *
 * CRITICAL:       Sent over best transport + duplicated to Cloud (same commandId).
 *                 Renderer deduplicates. Use for commands where exactly-once delivery matters.
 *
 * INTERACTIVE:    Best transport only. Rapid identical commands coalesced (last wins within 50ms).
 *                 Safe to lose a frame; don't need cloud redundancy.
 *
 * HIGH_FREQUENCY: Never sent over any transport. Local UI only (e.g. seekbar drag preview).
 */
export type CommandClass = 'CRITICAL' | 'INTERACTIVE' | 'HIGH_FREQUENCY';

export const COMMAND_CLASS_MAP: Readonly<Record<ConnectCommandType, CommandClass>> = {
  // Critical — durable delivery + idempotency required
  PLAY:                'CRITICAL',
  PAUSE:               'CRITICAL',
  SEEK:                'CRITICAL',
  NEXT:                'CRITICAL',
  PREV:                'CRITICAL',
  PREVIOUS:            'CRITICAL',
  ADD_TO_QUEUE:        'CRITICAL',
  REMOVE_FROM_QUEUE:   'CRITICAL',
  MOVE_QUEUE_ITEM:     'CRITICAL',
  CLEAR_QUEUE:         'CRITICAL',
  PLAY_TRACK:          'CRITICAL',
  STOP:                'CRITICAL',
  TRANSFER_PLAYBACK:   'CRITICAL',
  TRANSFER_REQUEST:    'CRITICAL',
  TRANSFER_ACCEPTED:   'CRITICAL',
  TRANSFER_PREPARING:  'CRITICAL',
  TRANSFER_READY:      'CRITICAL',
  TRANSFER_COMMIT:     'CRITICAL',
  TRANSFER_COMMITTED:  'CRITICAL',
  TRANSFER_ROLLBACK:   'CRITICAL',
  HANDOFF:             'CRITICAL',
  CONTROLLER_REQUEST:  'CRITICAL',
  CONTROLLER_RELEASE:  'CRITICAL',
  COMMAND_ACK:         'CRITICAL',
  // Interactive — LAN-preferred, coalesceable
  SET_VOLUME:          'INTERACTIVE',
  SET_SHUFFLE:         'INTERACTIVE',
  SET_REPEAT:          'INTERACTIVE',
  QUEUE_SHUFFLE_COMMIT:'INTERACTIVE',
  // High-frequency — local only, never dispatched
  SEEK_DRAG:           'HIGH_FREQUENCY',
  POSITION_PREVIEW:    'HIGH_FREQUENCY',
  HEARTBEAT:           'HIGH_FREQUENCY',
  HEARTBEAT_ACK:       'HIGH_FREQUENCY',
  // Signalling — always Cloud, never LAN (bootstrap phase)
  WEBRTC_SIGNAL:       'HIGH_FREQUENCY',
  CONNECT_REQUEST:     'HIGH_FREQUENCY',
  CONNECT_RESPONSE:    'HIGH_FREQUENCY',
};

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
  | "RECEIVED"
  | "ACCEPTED"
  | "READY"
  | "EXECUTED"
  | "APPLIED"
  | "DUPLICATE"
  | "STALE_EPOCH"
  | "STALE_REVISION"
  | "INVALID_LEASE"
  | "TARGET_OFFLINE"
  | "UNAUTHORIZED"
  | "TRANSITION_ROLLED_BACK"
  | "PAYLOAD_TAMPERED"
  | "REJECTED"
  | "STALE"
  | "FAILED";

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
