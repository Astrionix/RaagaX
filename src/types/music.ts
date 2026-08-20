export interface Song {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  albumId: string;
  duration: number; // in seconds
  coverUrl: string;
  audioUrl: string | null;
  playable?: boolean;
  sources?: {
    youtube?: {
      videoId: string;
      channelId: string;
      channelTitle?: string;
      publishedAt: string;
    };
    jiosaavn?: {
      id: string;
    };
  };
  verification?: {
    languageVerified: boolean;
    songVerified: boolean;
    releaseDateVerified: boolean;
    sourceVerified: boolean;
    matchScore: number;
  };
  genre: string;
  language?: string;
  language_code?: string; // Verified language code: 'te', 'hi', 'ta', 'kn', 'ml', 'pa', 'bn', 'en', etc.
  languageCode?: string;
  category: 'latest_telugu' | '90s_telugu' | 'love' | 'mass' | 'melody' | 'folk' | 'devotional' | 'global_trending' | 'radio';
  releaseYear: number;
  releaseDate?: string;
  added_at?: string; // Immutable ISO timestamp when first discovered/added to RaagaX
  addedAt?: string;
  plays: number;
  likes: number;
  downloads?: number;
  popularity?: number;
  audioQuality?: '24-bit FLAC' | 'Dolby Atmos' | 'Hi-Res Lossless' | 'Spatial Audio';
  bitrate?: string;
  sampleRate?: string;
  codec?: string;
  lyrics?: LyricLine[];
  credits?: {
    composer: string;
    lyricist: string;
    singers: string[];
    label: string;
  };
}

export interface LyricLine {
  time: number; // seconds
  text: string;
}

export interface Artist {
  id: string;
  name: string;
  image: string;
  bannerImage: string;
  bio: string;
  monthlyListeners: number;
  genres: string[];
  topSongIds: string[];
  albumIds: string[];
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  coverUrl: string;
  releaseYear: number;
  songIds: string[];
  genre: string;
  totalDuration: number;
  audioQuality?: string;
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  songIds: string[];
  isSmart?: boolean;
  category?: string;
  creator: string;
  followerCount?: number;
}

export interface RadioStation {
  id: string;
  name: string;
  frequency: string;
  genre: string;
  coverUrl: string;
  streamUrl: string;
  currentTrack: string;
  listeners: number;
  country?: string;
  audioQuality?: string;
}

export type RepeatMode = 'OFF' | 'ALL' | 'ONE' | 'off' | 'all' | 'one';


export interface AIDJState {
  isActive: boolean;
  mode: 'auto' | 'mood' | 'voice';
  prompt: string;
  currentMood: 'energetic' | 'romantic' | 'chill' | 'focus' | 'nostalgic' | 'devotional';
  insightText: string;
}

export type PlaybackContext = { type: 'album' | 'playlist' | 'radio' | 'recommendation' | 'album_sequence'; id?: string; language?: string; mood?: string; genre?: string; seedSongId?: string; seedAlbumId?: string; seedPlaylistId?: string; collectionId?: string; };

export type ActiveTab = 'home' | 'search' | 'library' | 'radio' | 'ai-dj' | 'artist' | 'album' | 'playlist' | 'profile' | 'downloads' | 'favorites' | 'settings' | 'insights' | 'recaps' | 'history';

export interface Device {
  id: string;
  name: string;
  type: string;
  platform?: string;
  isOnline: boolean;
  capabilities: {
    playback: boolean;
    seek: boolean;
    volume: boolean;
    lyrics: boolean;
    crossfade: boolean;
    gapless: boolean;
  };
  volume: number;
}

export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'switching'
  | 'transferring'
  | 'ended'
  | 'error';

export type LyricsMode = 'native' | 'english' | 'romanized' | 'dual' | 'auto';

export type Renderer = 'audio' | 'video' | 'remote';

export interface PlaybackSession {
  sessionId: string;
  activeDeviceId: string | null;
  activeRenderer: Renderer;
  status: 'playing' | 'paused' | 'buffering' | 'transitioning';
  songData: Song | null;
  positionMs: number;
  durationMs: number;
  queue: Song[];
  queueIndex: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  sessionEpoch: number;
  sequenceNumber: number;
  serverTimestamp: number;
  leaseId?: string;
  leaseExpiresAt?: string;
  updatedAt: string;
}

export type PlaybackEventType =
  | "PLAY"
  | "PAUSE"
  | "SEEK"
  | "NEXT"
  | "PREV"
  | "TRACK_CHANGE"
  | "TRANSFER_REQUEST"
  | "TRANSFER_ACCEPT"
  | "HANDOFF_PREPARE"
  | "HANDOFF_READY"
  | "HANDOFF_COMMIT"
  | "QUEUE_UPDATE"
  | "VOLUME"
  | "REPEAT"
  | "SHUFFLE";

export interface PlaybackCommand {
  commandId: string;
  sessionId: string;
  sessionEpoch: number;
  sequenceNumber: number;
  senderDeviceId: string;
  event: PlaybackEventType;
  positionMs: number;
  serverTimestamp: number;
  renderer: Renderer;
  trackId?: string;
  payload?: any;
}
