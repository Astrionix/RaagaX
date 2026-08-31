import { Song } from './music';

export type JamDeviceJoinState =
  | 'JOIN_REQUESTED'
  | 'AUTHORIZED'
  | 'SNAPSHOT_RECEIVED'
  | 'CLOCK_SYNCING'
  | 'PREPARING'
  | 'SCHEDULED'
  | 'SYNCING'
  | 'SYNCED'
  | 'FAILED';

export type JamParticipantState =
  | 'INVITED'
  | 'JOIN_REQUESTED'
  | 'AUTHORIZED'
  | 'SNAPSHOT_RECEIVED'
  | 'CLOCK_SYNCING'
  | 'PREPARING'
  | 'SCHEDULED'
  | 'SYNCING'
  | 'SYNCED'
  | 'FAILED'
  | 'JOINING'
  | 'AUTHENTICATING'
  | 'BUFFERING'
  | 'READY'
  | 'PLAYING'
  | 'PAUSED'
  | 'RECONNECTING';

export type JamPlaybackState = 'PLAYING' | 'PAUSED';

export type JamRole = 'HOST' | 'MODERATOR' | 'GUEST';

export type JamPresetName = 'CHILL_PARTY' | 'HOST_CONTROLLED' | 'COLLABORATIVE' | 'DJ_EVENT';

export interface JamPermissions {
  canAddSongs: boolean;
  canRemoveSongs: boolean;
  canReorderQueue: boolean;
  canControlPlayback: boolean;
  canSkip: boolean;
  canSeek?: boolean;
  canInvite: boolean;
  canRemoveParticipants: boolean;
  canPromoteModerator?: boolean;
  canChangeSettings?: boolean;
  canChangePermissions?: boolean;
  canTransferHost?: boolean;
  canEndJam?: boolean;
  presetName?: JamPresetName;
}

export const JAM_PERMISSION_PRESETS: Record<JamPresetName, JamPermissions> = {
  CHILL_PARTY: {
    canAddSongs: true,
    canRemoveSongs: false,
    canReorderQueue: false,
    canControlPlayback: true,
    canSkip: true,
    canSeek: false,
    canInvite: true,
    canRemoveParticipants: false,
    canPromoteModerator: false,
    canChangeSettings: false,
    canChangePermissions: false,
    canTransferHost: false,
    canEndJam: false,
    presetName: 'CHILL_PARTY',
  },
  HOST_CONTROLLED: {
    canAddSongs: true,
    canRemoveSongs: false,
    canReorderQueue: false,
    canControlPlayback: false,
    canSkip: false,
    canSeek: false,
    canInvite: true,
    canRemoveParticipants: false,
    canPromoteModerator: false,
    canChangeSettings: false,
    canChangePermissions: false,
    canTransferHost: false,
    canEndJam: false,
    presetName: 'HOST_CONTROLLED',
  },
  COLLABORATIVE: {
    canAddSongs: true,
    canRemoveSongs: true,
    canReorderQueue: true,
    canControlPlayback: true,
    canSkip: true,
    canSeek: true,
    canInvite: true,
    canRemoveParticipants: false,
    canPromoteModerator: false,
    canChangeSettings: false,
    canChangePermissions: false,
    canTransferHost: false,
    canEndJam: false,
    presetName: 'COLLABORATIVE',
  },
  DJ_EVENT: {
    canAddSongs: true,
    canRemoveSongs: false,
    canReorderQueue: false,
    canControlPlayback: false,
    canSkip: false,
    canSeek: false,
    canInvite: true,
    canRemoveParticipants: false,
    canPromoteModerator: false,
    canChangeSettings: false,
    canChangePermissions: false,
    canTransferHost: false,
    canEndJam: false,
    presetName: 'DJ_EVENT',
  },
};

export interface DeviceCapabilities {
  deviceId: string;
  deviceName?: string;
  platform: 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'web';
  supportedCodecs: string[];
  audioCapabilities?: {
    sampleRates?: number[];
    channelCount?: number;
    spatialAudio?: boolean;
    maxBitrate?: number;
  };
  backgroundPlayback: boolean;
  lanSupported?: boolean;
  cloudSupported?: boolean;
  protocolVersion?: string;
  outputCapabilities?: {
    bluetooth?: boolean;
    airplay?: boolean;
    usb?: boolean;
    speaker?: boolean;
  };
  networkCapabilities?: {
    downlinkMbps?: number;
    effectiveType?: string;
    saveData?: boolean;
  };
}

export interface JamParticipant {
  participantId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: JamRole;
  isHost: boolean;
  status: JamParticipantState;
  joinedAt: number;
  lastSeenAt: number;
  clockOffsetMs: number;
  rttMs: number;
  playbackDriftMs: number;
  deviceType: 'mobile' | 'desktop' | 'web';
  deviceId?: string;
  capabilities?: DeviceCapabilities;
  isReadyForPlayback?: boolean;
  customPermissions?: Partial<JamPermissions>;
  temporaryPermissionsUntil?: number;
}

export interface JamQueueItem {
  queueItemId: string; // Unique ID per queue instance (independent of song.id)
  trackId: string;
  song: Song;
  addedBy: string; // User ID or Participant ID
  addedByName: string;
  addedByAvatar?: string;
  addedAt: number;
  orderKey: string; // Lexicographic / fractional index key for deterministic reordering
}

export type PlaybackHistoryReason =
  | 'MANUAL_NEXT'
  | 'MANUAL_PREVIOUS'
  | 'AUTO_NEXT'
  | 'REPEAT_ONE'
  | 'REPEAT_ALL'
  | 'HANDOFF'
  | 'STOP';

export interface PlaybackHistoryEntry {
  historyId: string;
  queueItemId: string | null;
  trackId: string;
  transitionId: string;
  startedAt: number;
  endedAt?: number;
  reason: PlaybackHistoryReason;
  generation: number;
  song?: Song | null;
}

export type JamHandoffStatus =
  | 'HANDOFF_REQUESTED'
  | 'HANDOFF_PREPARING'
  | 'HANDOFF_READY'
  | 'HANDOFF_COMMITTED'
  | 'TARGET_PLAYING'
  | 'SOURCE_STOPPED'
  | 'HANDOFF_FAILED';

export interface JamHandoffState {
  handoffId: string;
  sourceDeviceId: string;
  sourceUserId: string;
  targetDeviceId: string;
  targetUserId: string;
  trackId: string;
  queueItemId: string | null;
  transitionId: string;
  timelineId: string;
  generation: number;
  revision: number;
  status: JamHandoffStatus;
  positionMs: number;
  requestedAt: number;
  committedAt?: number;
  errorMessage?: string;
}

export type ConnectionQuality = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'OFFLINE';

export interface NetworkMetrics {
  rtt: number;
  rttMedian: number;
  rttAverage: number;
  jitter: number;
  packetLoss: number;
  quality: ConnectionQuality;
  transport: 'CLOUD' | 'LAN' | 'PEER';
  lastCheckedAt: number;
}

export type JamSessionStatus = 'CREATING' | 'ACTIVE' | 'IDLE' | 'ENDING' | 'ENDED';

export interface JamSession {
  jamId: string;
  joinCode: string; // 5-character restricted-alphabet human code (e.g. 7K29P)
  name: string;
  hostId: string;
  hostName: string;
  isNearbyDiscoverable?: boolean;
  status?: JamSessionStatus;
  state: JamPlaybackState;
  trackId: string | null;
  currentQueueItemId?: string | null;
  currentSong: Song | null;
  positionMs: number; // Playback position at serverTimestamp / startAtServerTime
  basePositionMs?: number;
  serverTimestamp: number; // Server clock time when state was last updated
  startAtServerTime: number; // Authoritative future timestamp when playback should begin
  timelineStartServerMs?: number;
  leadTimeMs: number; // Dynamic schedule buffer for latency adaptation
  revision: number; // Monotonically increasing revision number
  timelineId?: string; // Authoritative timeline unique ID (e.g. TL_55)
  transitionId?: string; // Unique transition generation ID (e.g. TR_...)
  generation?: number; // Monotonically increasing playback generation counter
  createdAt: number;
  updatedAt: number;
  lastActivityAt?: number;
  expiresAt?: number;
  permissions: JamPermissions;
  participants: Record<string, JamParticipant>;
  queue: JamQueueItem[];
  history: JamQueueItem[];
  playbackHistory?: PlaybackHistoryEntry[];
  activeHandoff?: JamHandoffState | null;
}

export interface TrackMetadata {
  trackId: string;
  title: string;
  artist: string;
  album?: string;
  albumId?: string;
  artwork?: string;
  durationMs: number;
  sourceUrl?: string;
  language?: string;
  genre?: string;
  generation?: number;
}

export interface DiscoveredJam {
  jamId: string;
  joinCode: string;
  name: string;
  hostName: string;
  currentSongTitle?: string;
  currentSongArtist?: string;
  currentSongCover?: string;
  participantCount: number;
  discoveryMethod: 'wifi' | 'lan' | 'subnet' | 'nearby';
  signalStrength?: number; // RSSI or latency ms
  localIp?: string;
  lanEndpoint?: string;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  protocolVersion?: string;
  capabilities?: DeviceCapabilities;
  discoveredAt: number;
}

export type JamEventType =
  | 'SESSION_CREATED'
  | 'SESSION_UPDATED'
  | 'PARTICIPANT_JOINED'
  | 'PARTICIPANT_LEFT'
  | 'PARTICIPANT_STATE_CHANGED'
  | 'PARTICIPANT_UPDATED'
  | 'PERMISSIONS_UPDATED'
  | 'HOST_TRANSFERRED'
  | 'QUEUE_ITEM_ADDED'
  | 'QUEUE_ITEM_REMOVED'
  | 'QUEUE_REORDERED'
  | 'PLAY'
  | 'PAUSE'
  | 'STOP'
  | 'SEEK'
  | 'TRACK_CHANGED'
  | 'HANDOFF_REQUESTED'
  | 'HANDOFF_PREPARING'
  | 'HANDOFF_READY'
  | 'HANDOFF_COMMITTED'
  | 'HANDOFF_FAILED'
  | 'HANDOFF_COMPLETED'
  | 'SYNC'
  | 'RESYNC_REQUIRED'
  | 'HEARTBEAT'
  | 'SESSION_ENDED';

export interface JamEvent {
  eventId: string;
  jamId: string;
  type: JamEventType;
  revision: number;
  serverTimestamp: number;
  senderId: string;
  payload: any;
  requestId?: string;
  timelineId?: string;
  transitionId?: string;
  generation?: number;
  deviceId?: string;
}

export type JamCommandAction =
  | 'PLAY'
  | 'PAUSE'
  | 'STOP'
  | 'SEEK'
  | 'SKIP_NEXT'
  | 'SKIP_PREV'
  | 'ADD_TRACK'
  | 'ADD_TRACKS'
  | 'REMOVE_TRACK'
  | 'REORDER_QUEUE'
  | 'REQUEST_HANDOFF'
  | 'CONFIRM_HANDOFF_READY'
  | 'COMMIT_HANDOFF'
  | 'CONFIRM_TARGET_PLAYING'
  | 'FAIL_HANDOFF'
  | 'UPDATE_PERMISSIONS'
  | 'TRANSFER_HOST'
  | 'KICK_PARTICIPANT'
  | 'PROMOTE_MODERATOR'
  | 'SET_PRESET'
  | 'UPDATE_PARTICIPANT_STATUS'
  | 'HEARTBEAT'
  | 'REPORT_METRICS'
  | 'END_SESSION';

export interface JamCommand {
  commandId: string;
  jamId: string;
  userId: string;
  action: JamCommandAction;
  payload?: any;
  requestId?: string;
  expectedRevision?: number;
  timelineId?: string;
  generation?: number;
  deviceId?: string;
  timestamp?: number;
}

export interface JamCommandResponse {
  success: boolean;
  session?: JamSession;
  error?: string;
  code?: string;
  revision: number;
  commandId?: string;
  isIdempotentReplay?: boolean;
}

export interface JamSyncDiagnostics {
  // 4-Tier Latency Breakdown
  rttMs: number; // 1. Network RTT
  commandDeliveryLatencyMs?: number; // 2. Command delivery latency
  audioPreparationLatencyMs?: number; // 3. Audio preparation / decoder readiness latency
  scheduledStartErrorMs?: number; // 4. Scheduled start execution error
  steadyDriftMs?: number; // 5. Steady-state playback drift

  clockOffsetMs: number;
  rttMedianMs: number;
  rttAverageMs: number;
  jitterMs: number;
  packetLossPercent: number;
  connectionQuality: ConnectionQuality;
  playbackDriftMs: number;
  serverTime: number;
  localTime: number;
  revision: number;
  syncState: 'SYNCHRONIZED' | 'SYNCHRONIZING' | 'RECONNECTING' | 'DISCONNECTED';
  estimatedLeadTimeMs: number;
  bufferSec: number;
  timelineId?: string;
  transitionId?: string;
  generation?: number;
  trackId?: string | null;
  currentQueueItemId?: string | null;
  playbackState?: JamPlaybackState;
  expectedPositionSec?: number;
  actualPositionSec?: number;
  transport?: 'CLOUD' | 'LAN' | 'PEER';
  transportLabel?: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  platform?: string;

  // Real Audio Buffer & Playback Health (Section 14)
  bufferedAheadMs?: number;
  audioReadyState?: number;
  audioPaused?: boolean;
  audioNetworkState?: number;
  audioError?: string | null;
  hardSeekCount?: number;
  bufferingCount?: number;
  cloudRttMs?: number;
  cloudJitterMs?: number;
}

export interface TimeSyncPing {
  clientSendTime: number;
}

export interface TimeSyncResponse {
  clientSendTime: number;
  serverReceiveTime: number;
  serverSendTime: number;
}
