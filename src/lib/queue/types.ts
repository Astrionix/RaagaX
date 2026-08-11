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

export interface PlaybackQueueContext {
  type: 'ALBUM_COLLECTION' | 'ALBUM' | 'PLAYLIST' | 'SEARCH' | 'USER';
  sourceIds?: string[];
}

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
  context?: PlaybackQueueContext;
}
