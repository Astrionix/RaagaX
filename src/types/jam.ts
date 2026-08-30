import { Song } from './music';

export type JamParticipantState =
  | 'INVITED'
  | 'JOINING'
  | 'AUTHENTICATING'
  | 'SYNCING'
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

export interface JamSession {
  jamId: string;
  joinCode: string; // 5-character restricted-alphabet human code (e.g. 7K29P)
  name: string;
  hostId: string;
  hostName: string;
  isNearbyDiscoverable?: boolean;
  state: JamPlaybackState;
  trackId: string | null;
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
  permissions: JamPermissions;
  participants: Record<string, JamParticipant>;
  queue: JamQueueItem[];
  history: JamQueueItem[];
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
  discoveryMethod: 'bluetooth' | 'wifi' | 'lan' | 'subnet';
  signalStrength?: number; // RSSI or latency ms
  localIp?: string;
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
  | 'SEEK'
  | 'TRACK_CHANGED'
  | 'SYNC'
  | 'RESYNC_REQUIRED'
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
}

export type JamCommandAction =
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'SKIP_NEXT'
  | 'SKIP_PREV'
  | 'ADD_TRACK'
  | 'REMOVE_TRACK'
  | 'REORDER_QUEUE'
  | 'UPDATE_PERMISSIONS'
  | 'TRANSFER_HOST'
  | 'KICK_PARTICIPANT'
  | 'PROMOTE_MODERATOR'
  | 'SET_PRESET'
  | 'UPDATE_PARTICIPANT_STATUS'
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
}

export interface JamSyncDiagnostics {
  clockOffsetMs: number;
  rttMs: number;
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
  expectedPositionSec?: number;
  actualPositionSec?: number;
  transport?: 'CLOUD' | 'LAN' | 'PEER';
}

export interface TimeSyncPing {
  clientSendTime: number;
}

export interface TimeSyncResponse {
  clientSendTime: number;
  serverReceiveTime: number;
  serverSendTime: number;
}
