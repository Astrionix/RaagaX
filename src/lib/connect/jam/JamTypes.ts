/**
 * Raaga Jam — Data Contracts & Protocol Definitions
 */

import { Song } from '@/types/music';

export interface JamMember {
  deviceId: string;
  displayName: string;
  avatarUrl?: string;
  isHost: boolean;
  joinedAt: number;
}

export interface JamQueueItem {
  id: string;
  song: Song;
  addedByDeviceId: string;
  addedByMemberName: string;
  addedAt: number;
  upvotes: string[]; // List of member deviceIds who upvoted
  downvotes?: string[]; // List of member deviceIds who downvoted
}

export interface JamSessionState {
  roomCode: string;               // e.g. "JAM-4921"
  hostDeviceId: string;
  hostName: string;
  isGuestControlAllowed: boolean; // If true, guests can pause/play/skip
  isGuestQueueAllowed?: boolean;   // If true, guests can add songs to queue
  members: JamMember[];
  queue: JamQueueItem[];
  currentSong: Song | null;
  positionMs: number;
  isPlaying: boolean;
  updatedAt: number;
}

export type JamEventType =
  | 'JOIN_ROOM'
  | 'LEAVE_ROOM'
  | 'STATE_SYNC'
  | 'ADD_TO_QUEUE'
  | 'REMOVE_FROM_QUEUE'
  | 'VOTE_SONG'
  | 'CONTROL_COMMAND'
  | 'SETTINGS_UPDATE';

export type JamControlAction = 'PLAY' | 'PAUSE' | 'NEXT' | 'PREV' | 'SEEK' | 'PLAY_SONG';

export interface JamSignalEvent {
  eventId: string;
  roomCode: string;
  type: JamEventType;
  senderDeviceId: string;
  senderName: string;
  timestamp: number;
  payload: any;
}

