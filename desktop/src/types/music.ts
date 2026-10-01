export type QueueTier = "USER_QUEUE" | "CONTEXT" | "AUTOPLAY";

export type BrowseType = "ALBUM" | "ARTIST" | "PLAYLIST" | "OTHER";

export type PlaybackSourceType =
  | "HOME"
  | "SEARCH"
  | "HISTORY"
  | "REPLAY"
  | "EXPLORE"
  | "BROWSE"
  | "SHARED_LINK"
  | "QUEUE";

export interface Song {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  durationText?: string;
  durationSeconds?: number;
  artistId?: string;
  albumId?: string;
  albumName?: string;
  isVideo?: boolean;
  setVideoId?: string;
  queueTier?: QueueTier;
  queueEntryId?: string;
  radioName?: string;
  sourceQuality?: string;
  isExplicit?: boolean;
  playbackSource?: string;
  playbackSourceType?: PlaybackSourceType;
  playbackSourceId?: string;
  saavnSongId?: string;
  streamUrl?: string;
  kbps?: number;
}

export interface ShelfItem {
  title: string;
  subtitle: string;
  thumbnailUrl: string;
  videoId?: string;
  browseId?: string;
  isVideo?: boolean;
  type?: BrowseType;
}

export interface HomeShelf {
  title: string;
  subtitle?: string;
  items: ShelfItem[];
  moreBrowseId?: string;
  moreParams?: string;
}

export interface MoodGenre {
  title: string;
  browseId: string;
  params?: string;
  thumbnailUrl?: string;
  color?: string;
}

export interface MoodGenreSection {
  title: string;
  items: MoodGenre[];
}

export interface NewFeedData {
  newReleases: HomeShelf[];
  charts: HomeShelf[];
  exploreShelves: HomeShelf[];
  moodGenres: MoodGenreSection[];
}

export type SearchFilter =
  | "All"
  | "Songs"
  | "Videos"
  | "Albums"
  | "Artists"
  | "Playlists";

export interface BrowseItem {
  browseId: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string;
  type: BrowseType;
}

export interface SearchResultGroup {
  topResult?: Song | BrowseItem;
  songs: Song[];
  albums: BrowseItem[];
  artists: BrowseItem[];
  playlists: BrowseItem[];
  videos: Song[];
}

export interface DetailPage {
  browseId: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string;
  type: BrowseType;
  songs: Song[];
  sections?: HomeShelf[];
  suggestedSongs?: Song[];
  description?: string;
  subscriberCountText?: string;
  monthlyListenerCount?: string;
  year?: string;
  trackCount?: number;
}

export type {
  LyricWord,
  LyricAlignment,
  LyricLine,
  LyricsSyncType,
  LyricsSource,
  LyricsQuery,
  ProviderMeta,
  LyricsData,
} from "./lyrics";

export type DeviceType = "PHONE" | "TABLET" | "COMPUTER" | "TV" | "SPEAKER";

export interface ConnectDevice {
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  platform: string;
  isOnline: boolean;
  isCurrent?: boolean;
  lastSeen?: number;
  accountId?: string;
  volume?: number;
  activeTrack?: {
    videoId: string;
    title: string;
    artist: string;
    thumbnailUrl: string;
    positionMs: number;
    durationMs: number;
    isPlaying: boolean;
  };
}

export type RemoteCommand =
  | { type: "Play" }
  | { type: "Pause" }
  | { type: "Seek"; positionMs: number }
  | { type: "Volume"; volume: number }
  | { type: "Next" }
  | { type: "Previous" }
  | { type: "SwitchPlayback"; videoId: string; title?: string; artist?: string; thumbnailUrl?: string; positionMs: number; isPlaying: boolean };

export interface PlaybackSession {
  userId?: string;
  activeDeviceId?: string;
  track?: Song;
  positionMs: number;
  isPlaying: boolean;
  queue: Song[];
  shuffle: boolean;
  repeatMode: "OFF" | "ALL" | "ONE";
  updatedAt: number;
}

export interface UserPlaylist {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  coverUrl?: string;
  songCount: number;
  createdAt: string;
  updatedAt: string;
  songs?: Song[];
}

export interface YouTubeProfile {
  profileId: string;
  name: string;
  handle?: string;
  avatar?: string;
  pageId?: string;
  dataSyncId?: string;
  authUser?: string;
  isBrandAccount?: boolean;
}

export interface YouTubeAccountSession {
  accountId: string;
  cookie: string;
  name: string;
  email?: string;
  profiles: YouTubeProfile[];
  activeProfileId?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  isGuest: boolean;
  preferredLanguage?: string;
  theme?: "dark" | "oled" | "light";
  audioQuality?: "lossless" | "high" | "normal";
  autoPlayRadio?: boolean;
  youtubeSession?: YouTubeAccountSession;
}
