export interface Song {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  albumId: string;
  duration: number; // in seconds
  coverUrl: string;
  audioUrl: string;
  genre: string;
  category: 'latest_telugu' | '90s_telugu' | 'love' | 'mass' | 'melody' | 'folk' | 'devotional' | 'global_trending' | 'radio';
  releaseYear: number;
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

export interface EqualizerSettings {
  enabled: boolean;
  preset: 'flat' | 'bass_boost' | 'vocal' | 'acoustic' | 'electronic' | 'telugu_mass';
  bands: {
    low: number;      // 60 Hz (-12 to +12 dB)
    midLow: number;   // 230 Hz
    mid: number;      // 910 Hz
    midHigh: number;  // 4 kHz
    high: number;     // 14 kHz
  };
}

export interface AIDJState {
  isActive: boolean;
  mode: 'auto' | 'mood' | 'voice';
  prompt: string;
  currentMood: 'energetic' | 'romantic' | 'chill' | 'focus' | 'nostalgic' | 'devotional';
  insightText: string;
}

export type ActiveTab = 'home' | 'search' | 'library' | 'radio' | 'ai-dj' | 'artist' | 'album' | 'playlist' | 'profile' | 'downloads' | 'favorites';
