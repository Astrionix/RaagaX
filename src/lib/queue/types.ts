import { Song } from '@/types/music';

export type QueueSource =
  | 'USER'
  | 'PLAYLIST'
  | 'ALBUM'
  | 'ALBUM_COLLECTION'
  | 'ARTIST'
  | 'SEARCH'
  | 'RECOMMENDATION'
  | 'RADIO'
  | 'AUTOPLAY'
  | 'OFFLINE';

export type SmartQueueReasonType =
  | 'SAME_ALBUM'
  | 'SAME_ARTIST'
  | 'SIMILAR_GENRE'
  | 'USER_AFFINITY'
  | 'LANGUAGE_MATCH'
  | 'DISCOVERY';

export interface SmartQueueReason {
  type: SmartQueueReasonType;
  score: number;
}

export interface QueueItem {
  queueItemId: string; // Unique ID for this specific position in the queue
  trackId: string;
  song: Song; // Full track metadata for instant rendering

  albumId?: string;
  albumTitle?: string;
  albumIndex?: number;
  trackIndex?: number;

  source: QueueSource;
  sourceId?: string;

  smartQueueReason?: SmartQueueReason;

  addedAt: number;

  playable: boolean;
  offlineAvailable: boolean;
}

export interface QueueHistoryEntry {
  trackId: string;
  song: Song;
  startedAt: number;
  completedAt?: number;
  source: QueueSource;
  playedPercentage: number;
}

export type RepeatMode = 'OFF' | 'TRACK' | 'CONTEXT';
export type ShuffleMode = 'OFF' | 'STANDARD' | 'SMART';

export interface ShuffleState {
  enabled: boolean;
  seed: string;
  order: string[]; // Array of queueItemIds in deterministic shuffled sequence
  cursor: number;
}

export type ContextType = 'ALBUM' | 'PLAYLIST' | 'ARTIST' | 'AUTOPLAY' | 'RADIO' | 'SEARCH' | 'USER' | string;

export interface PlaybackContext {
  contextType?: ContextType;
  type?: string; // Backwards compatibility
  id?: string;
  contextUri?: string;
  collectionId?: string;
  title?: string;
  sourceIds?: string[];
}

export type PlaybackQueueContext = PlaybackContext;

export interface QueueSnapshot {
  queueId: string;
  revision: number;
  currentItemId: string | null;
  currentIndex: number;
  items: QueueItem[];
  autoplayEnabled: boolean;
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
  shuffleSeed?: string;
  shuffleState?: ShuffleState;
  context?: PlaybackContext;
}
