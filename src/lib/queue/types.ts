import { Song } from '@/types/music';

export type QueueSource =
  | 'USER'
  | 'PLAYLIST'
  | 'ALBUM'
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

export interface QueueSnapshot {
  queueId: string;
  revision: number;
  currentIndex: number;
  items: QueueItem[];
  autoplayEnabled: boolean;
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
  shuffleSeed?: string;
}
