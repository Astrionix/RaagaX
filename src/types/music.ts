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
  category: 'latest_telugu' | '90s_telugu' | 'love' | 'mass' | 'melody' | 'folk' | 'devotional' | 'global_trending' | 'radio';
  releaseYear: number;
  releaseDate?: string;
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

export type RepeatMode = 'off' | 'all' | 'one';


export interface AIDJState {
  isActive: boolean;
  mode: 'auto' | 'mood' | 'voice';
  prompt: string;
  currentMood: 'energetic' | 'romantic' | 'chill' | 'focus' | 'nostalgic' | 'devotional';
  insightText: string;
}

export type PlaybackContext = { type: 'album' | 'playlist' | 'radio' | 'recommendation' | 'album_sequence'; language?: string; mood?: string; genre?: string; seedSongId?: string; seedAlbumId?: string; seedPlaylistId?: string; };

export type ActiveTab = 'home' | 'search' | 'browse' | 'library' | 'radio' | 'ai-dj' | 'artist' | 'album' | 'playlist' | 'profile' | 'downloads' | 'favorites';

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

export interface PlaybackSession {
  sessionId: string;
  activeDeviceId: string | null;
  songData: Song | null;
  positionMs: number;
  isPlaying: boolean;
  queue: Song[];
  queueIndex: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  stateVersion: number;
  updatedAt: string;
}

export type PlaybackCommand = 
  | { type: 'PLAY'; deviceId?: string; stateVersion?: number }
  | { type: 'PAUSE'; deviceId?: string; stateVersion?: number }
  | { type: 'SEEK'; position: number; deviceId?: string; stateVersion?: number }
  | { type: 'TRANSFER'; fromDeviceId?: string; toDeviceId: string; toDeviceName?: string; positionMs?: number; stateVersion?: number }
  | { type: 'NEXT'; deviceId?: string; stateVersion?: number }
  | { type: 'PREV'; deviceId?: string; stateVersion?: number }
  | { type: 'SET_VOLUME'; percent: number; deviceId?: string; stateVersion?: number }
  | { type: 'SET_SHUFFLE'; enabled: boolean; deviceId?: string; stateVersion?: number }
  | { type: 'SET_REPEAT'; mode: RepeatMode; deviceId?: string; stateVersion?: number }
  | { type: 'ADD_TO_QUEUE'; song: Song; deviceId?: string; stateVersion?: number }
  | { type: 'REMOVE_FROM_QUEUE'; songId: string; deviceId?: string; stateVersion?: number }
  | { type: 'SYNC_STATE'; state: Partial<PlaybackSession>; stateVersion?: number };
