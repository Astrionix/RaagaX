import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Song, RepeatMode, AIDJState, ActiveTab, Renderer } from '@/types/music';
import { RecommendationEngine } from '@/lib/recommendationEngine';
import { LocalDatabase } from '@/lib/localDatabase';
import { QueueManager } from '@/lib/queue/QueueManager';
import { LanguageEligibilityEngine } from '@/lib/language/LanguageEligibilityEngine';
import { InterruptionCoordinator } from '@/lib/playback/InterruptionCoordinator';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { RaagaXNativePlayer } from '@/lib/playback/native/RaagaXNativePlayer';
import { ConnectManager } from '@/lib/connect/ConnectManager';
import { PlaybackWatchdog } from '@/lib/playback/PlaybackWatchdog';
import { isKidsOrNurseryTrack } from '@/lib/jioSaavnProvider';
import { SongCoverEngine } from '@/lib/playback/SongCoverEngine';
import { SongUniquenessEngine } from '@/lib/music/SongUniquenessEngine';
import { PlaybackStateSync } from '@/lib/connect/PlaybackStateSync';
import { TransferManager } from '@/lib/connect/TransferManager';
import { MediaSessionManager } from '@/lib/playback/MediaSessionManager';

import { AudioQuality, AudioQualityState } from '@/lib/playback/types';
import { DownloadStorage } from '@/lib/offline/DownloadStorage';
import { NavigationStack } from '@/lib/navigation/NavigationStack';

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;

  playbackIntent: 'IDLE' | 'PLAYING' | 'PAUSED';
  trackSource: 'USER_SELECTED' | 'SESSION_RESTORE' | 'AUTO_NEXT' | 'RECENT_HISTORY' | null;
  setPlaybackIntent: (intent: 'IDLE' | 'PLAYING' | 'PAUSED') => void;
  setTrackSource: (source: 'USER_SELECTED' | 'SESSION_RESTORE' | 'AUTO_NEXT' | 'RECENT_HISTORY' | null) => void;

  queue: Song[];
  queueIndex: number;
  shuffleMode: import('@/lib/queue/types').ShuffleMode;
  repeatMode: RepeatMode;
  isRefillingQueue: boolean;

  likedSongIds: string[];
  likedSongs: Song[];
  downloadedSongIds: string[];
  cloudDownloadedSongIds: string[];
  cloudDownloadRecords: import('@/lib/sync/AccountSyncEngine').CloudDownloadRecord[];
  historySongIds: string[];
  favoriteArtistIds: string[];
  favoriteAlbumIds: string[];

  crossfadeSec: number;
  isGaplessEnabled: boolean;

  activeTab: ActiveTab;
  selectedArtistId: string | null;
  selectedAlbumId: string | null;
  selectedPlaylistId: string | null;
  navigateFromPlayer: (destination: {
    tab: ActiveTab;
    albumId?: string | null;
    artistId?: string | null;
    playlistId?: string | null;
  }) => void;
  streamingQuality: AudioQuality;
  downloadQuality: AudioQuality;
  isDataSaverEnabled: boolean;
  deliveredQuality: AudioQuality;

  isPlayerExpanded: boolean;
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  isMiniPlayerFloating: boolean;
  isAiDjModalOpen: boolean;
  isImporterOpen: boolean;
  isBackupOpen: boolean;
  isSettingsModalOpen: boolean;
  isCastModalOpen: boolean;
  isSleepTimerModalOpen: boolean;
  isDeviceModalOpen: boolean;
  isLockScreenOpen: boolean;
  toggleLockScreen: (open?: boolean) => void;
  isNotificationShadeOpen: boolean;
  toggleNotificationShade: (open?: boolean) => void;
  isSystemSurfacesOpen: boolean;
  toggleSystemSurfaces: (open?: boolean) => void;
  createPlaylistModalOpen: boolean;
  isWrappedModalOpen: boolean;
  toggleWrappedModal: (open?: boolean) => void;
  isEqualizerOpen: boolean;
  toggleEqualizer: (open?: boolean) => void;
  isCarModeOpen: boolean;
  toggleCarMode: (open?: boolean) => void;
  isOnboardingOpen: boolean;
  toggleOnboarding: (open?: boolean) => void;
  completeOnboarding: (languages: string[], interests: string[]) => void;

  toastMessage: string | null;
  setToastMessage: (msg: string | null) => void;

  aiDjState: AIDJState;
  searchQuery: string;
  activeGenreFilter: string;

  sleepTimerMinutes: number | null;
  sleepTimerEndsAt: number | null;
  sleepTimerMode: 'duration' | 'end_of_song' | 'end_of_queue' | null;

  contextMenuSong: Song | null;
  // 3-Tier Language & Interests Preference System
  preferredLanguage: string; // GLOBAL_LANGUAGE (Explicit User Selection)
  selectedLanguages: string[]; // MULTI_LANGUAGE (Active Music Languages)
  musicInterests: string[]; // User Selected Music Interests (e.g. New Releases, Trending, Devotional, etc.)
  sessionLanguage: string; // SESSION_LANGUAGE (Current Playback Queue Language)
  interestLanguages: Record<string, number>; // INTEREST_LANGUAGES (Inferred Soft Signals)
  homeFeedControls: {
    showNewReleases: boolean;
    showTrending: boolean;
    showRecommended: boolean;
    showPopularArtists: boolean;
    showPopularAlbums: boolean;
    showPlaylists: boolean;
  };
  setPreferredLanguage: (lang: string) => void;
  setSelectedLanguages: (langs: string[]) => void;
  setMusicInterests: (interests: string[]) => void;
  setHomeFeedControl: (key: 'showNewReleases' | 'showTrending' | 'showRecommended' | 'showPopularArtists' | 'showPopularAlbums' | 'showPlaylists', value: boolean) => void;
  setSessionLanguage: (lang: string) => void;
  recordLanguageInterest: (lang: string, delta?: number) => void;

  // Offline Mode State
  networkMode: 'online' | 'offline' | 'offline_forced';
  setNetworkMode: (mode: 'online' | 'offline' | 'offline_forced') => void;

  // Cross-Device Sync State
  deviceId: string;
  deviceInstanceId: string;
  activeDeviceId: string | null;
  connectedDeviceId: string | null;
  deviceConnectionState: import('@/lib/connect/types').DeviceConnectionState;
  availableDevicePlaybackStates: Record<string, { isPlaying: boolean; songTitle?: string; artist?: string }>;
  localPlaybackRevision: number;
  lastReceivedPlaybackRevision: number;
  lastReceivedPlaybackSessionRevision: number;
  activeRenderer: Renderer;
  playbackStatus: 'playing' | 'paused' | 'buffering' | 'transitioning';
  isActiveDevice: boolean;
  isTransferring: boolean;
  transferringDeviceId: string | null;
  remoteDeviceName: string | null;
  remoteAnchorPositionMs: number;
  remoteAnchorTimeMs: number;
  lastSyncDbTime: string | null;
  lastSyncPositionMs: number | null;
  playbackSession: import('@/lib/playback/PlaybackSession').UnifiedPlaybackSession | null;
  handoffState: {
    from: Renderer;
    to: Renderer;
    phase: import('@/lib/playback/HandoffCoordinator').HandoffPhase;
    positionMs: number;
  } | null;
  serverTimestamp: number | null; // Added for unified engine
  onlineDevices: { id: string; name: string; platform?: string; isOnline?: boolean }[];
  setOnlineDevices: (devices: { id: string; name: string; platform?: string; isOnline?: boolean }[]) => void;
  setRemoteState: (state: Partial<PlayerState>) => void;
  setRenderer: (renderer: Renderer) => void;
  connectToDevice: (targetDeviceId: string) => Promise<boolean>;
  disconnectDevice: () => void;
  transferPlayback: (targetDeviceId: string) => void;

  rightPanelMode: 'queue' | 'devices';
  setRightPanelMode: (mode: 'queue' | 'devices') => void;

  // Autoplay and Context
  isAutoplayEnabled: boolean;
  playbackContextData: import('@/types/music').PlaybackContext | null;
  playbackContext: import('@/lib/queue/types').PlaybackContext | null;
  albumPlaybackQueue: string[];
  toggleAutoplay: () => void;
  setPlaybackContext: (context: import('@/types/music').PlaybackContext | null) => void;
  getPlaybackSnapshot: () => import('@/lib/connect/types').PlaybackSnapshot;
  calculateLiveTime: () => number;
  restrictions: import('@/lib/playback/types').PlayerRestrictions;
  executePlayerCommand: (type: import('@/lib/playback/types').PlayerCommandType, payload?: any, origin?: any) => Promise<{ success: boolean; reason?: string }>;

  // Actions
  playAlbumSequence: (albumIds: string[]) => Promise<void>;
  restoreLocalSession: () => Promise<void>;
  syncCloudLibrary: () => Promise<void>;
  autoRefillQueue: () => Promise<void>;
  playbackRequestId: number;
  switchTrack: (track: Song, index: number, autoPlay?: boolean) => Promise<boolean>;
  playSong: (song: Song, newQueue?: Song[], context?: import('@/lib/queue/types').PlaybackContext) => Promise<void> | void;
  shufflePlay: (songs: Song[], context?: import('@/lib/queue/types').PlaybackContext) => Promise<void>;
  commitPlaybackTransition: (song: Song, queueIndex?: number, updatedQueue?: Song[]) => void;
  togglePlayPause: () => void;
  setIsPlaying: (playing: boolean, fromRemote?: boolean) => void;
  setCurrentTime: (time: number, isManualSeek?: boolean) => void;
  seekTarget: number | null;
  setSeekTarget: (time: number | null) => void;
  setDuration: (dur: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;

  playNext: () => void;
  playPrev: () => void;
  toggleShuffle: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  cycleRepeatMode: () => void;
  addToQueue: (song: Song) => void;
  playNextInQueue: (song: Song) => void;
  playLastInQueue: (song: Song) => void;
  playNextSequence: (songs: Song[]) => void;
  removeFromQueue: (songId: string) => void;
  reorderQueue: (newQueue: Song[]) => void;
  clearQueue: () => void;
  moveQueueItem: (fromUpNextIndex: number, toUpNextIndex: number) => void;
  deduplicateQueue: () => void;
  saveQueueAsPlaylist: (title?: string) => Promise<boolean>;

  toggleLikeSong: (songId: string) => void;
  setLikedSongIds: (songIds: string[]) => void;
  setLikedSongs: (songs: Song[]) => void;
  toggleDownloadSong: (songId: string) => void;
  toggleFavoriteArtist: (artistId: string) => void;
  toggleFavoriteAlbum: (albumId: string) => void;

  setCrossfadeSec: (sec: number) => void;
  setGaplessEnabled: (enabled: boolean) => void;

  setActiveTab: (tab: ActiveTab) => void;
  setSelectedArtistId: (id: string | null) => void;
  setSelectedAlbumId: (id: string | null) => void;
  setSelectedPlaylistId: (id: string | null) => void;
  setStreamingQuality: (quality: AudioQuality) => void;
  setDownloadQuality: (quality: AudioQuality) => void;
  setDataSaverEnabled: (enabled: boolean) => void;
  setDeliveredQuality: (quality: AudioQuality) => void;

  togglePlayerExpanded: (open?: boolean | any) => void;
  toggleLyrics: () => void;
  toggleQueue: () => void;
  toggleMiniPlayerFloating: () => void;
  toggleAiDjModal: () => void;
  toggleImporterModal: () => void;
  toggleBackupModal: () => void;
  toggleSettingsModal: () => void;
  toggleCastModal: () => void;
  toggleSleepTimerModal: () => void;
  toggleDeviceModal: () => void;
  setCreatePlaylistModalOpen: (open: boolean) => void;
  openContextMenu: (song: Song) => void;
  closeContextMenu: () => void;

  importSongsFromUrl: (songs: Song[]) => void;
  exportBackupJson: () => string;
  importBackupJson: (jsonStr: string) => boolean;

  setAiDjPrompt: (prompt: string) => void;
  setAiDjMood: (mood: AIDJState['currentMood']) => void;
  setSearchQuery: (query: string) => void;
  setActiveGenreFilter: (genre: string) => void;
  setSleepTimer: (minutes: number | null, mode?: 'duration' | 'end_of_song' | 'end_of_queue') => void;
  extendSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;

  logCurrentTelemetry: (action: 'play' | 'skip' | 'complete') => void;
}

function persistSessionHelper(state: {
  currentSong: Song | null;
  currentTime: number;
  duration?: number;
  queue: Song[];
  queueIndex: number;
  historySongIds?: string[];
  likedSongIds?: string[];
  preferredLanguage?: string;
  shuffleMode?: string;
  repeatMode?: string;
  volume?: number;
}) {
  if (!state.currentSong) return;
  const payload = {
    currentSong: state.currentSong,
    currentTime: Math.max(0, state.currentTime || 0),
    duration: state.duration || state.currentSong?.duration || 0,
    queue: state.queue || [],
    queueIndex: Math.max(0, state.queueIndex || 0),
    historySongIds: state.historySongIds || [],
    likedSongIds: state.likedSongIds || [],
    searchHistory: LocalDatabase.getInstance().getSearchHistory(),
    preferredLanguage: state.preferredLanguage,
    timestamp: Date.now(),
  };
  LocalDatabase.getInstance().savePlaybackSession(payload);
}

let lastThrottledPersistTime = 0;
function throttlePersistSession(state: any, force = false) {
  const now = Date.now();
  if (force || now - lastThrottledPersistTime >= 2000) {
    lastThrottledPersistTime = now;
    persistSessionHelper(state);
  }
}

// Initial sync session hydration for zero-flicker startup (only if valid/under 4 hours old)
const getInitialSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    const session = LocalDatabase.getInstance().getSyncPlaybackSession();
    if (session && session.timestamp && (Date.now() - session.timestamp < 4 * 60 * 60 * 1000)) {
      return session;
    }
  } catch { }
  return null;
};
const initialSession = getInitialSession();

const getInitialSelectedLanguages = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('raagax_selected_languages');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getInitialMusicInterests = (): string[] => {
  if (typeof window === 'undefined') return ['New Releases', 'Trending Hits'];
  try {
    const raw = localStorage.getItem('raagax_music_interests');
    if (!raw) return ['New Releases', 'Trending Hits'];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ['New Releases', 'Trending Hits'];
  } catch {
    return ['New Releases', 'Trending Hits'];
  }
};

const getInitialFeedControls = () => {
  const defaults = {
    showNewReleases: true,
    showTrending: true,
    showRecommended: true,
    showPopularArtists: true,
    showPopularAlbums: true,
    showPlaylists: true,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem('raagax_home_feed_controls');
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? { ...defaults, ...parsed } : defaults;
  } catch {
    return defaults;
  }
};

let lastPlayCallTimestamp = 0;
let lastPlaySongId = '';
let globalPlaybackRequestId = 0;

export const isTrackDownloaded = (trackId: string): boolean => {
  if (!trackId) return false;
  try {
    if (DownloadStorage.getInstance().isDownloadedSync(trackId)) return true;
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('download-storage');
      if (raw && raw.includes(`"${trackId}"`)) return true;
    }
  } catch {}
  return false;
};

const getNextQueueIndex = (queue: Song[], currentIndex: number, repeatMode: string): number => {
  if (!queue || queue.length === 0) return -1;
  const norm = (repeatMode || 'off').toUpperCase();
  if (norm === 'ONE' || norm === 'TRACK') return currentIndex;

  const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST));
  const isOffline = !isTest && typeof navigator !== 'undefined' && navigator.onLine === false;

  if (isOffline) {
    // Scan forward from currentIndex + 1 to find the next available offline downloaded track
    for (let i = currentIndex + 1; i < queue.length; i++) {
      if (isTrackDownloaded(queue[i].id)) return i;
    }
    // If repeat ALL is active, wrap around to the start
    if (norm === 'ALL' || norm === 'CONTEXT') {
      for (let i = 0; i <= currentIndex; i++) {
        if (isTrackDownloaded(queue[i].id)) return i;
      }
    }
    return -1;
  }

  if (currentIndex + 1 < queue.length) return currentIndex + 1;
  if (norm === 'ALL' || norm === 'CONTEXT') return 0;
  return -1;
};

const getPreviousQueueIndex = (queue: Song[], currentIndex: number, repeatMode: string): number => {
  if (!queue || queue.length === 0) return -1;
  const norm = (repeatMode || 'off').toUpperCase();
  if (norm === 'ONE' || norm === 'TRACK') return currentIndex;

  const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST));
  const isOffline = !isTest && typeof navigator !== 'undefined' && navigator.onLine === false;

  if (isOffline) {
    // Scan backward from currentIndex - 1 to find the previous downloaded track
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (isTrackDownloaded(queue[i].id)) return i;
    }
    if (norm === 'ALL' || norm === 'CONTEXT') {
      for (let i = queue.length - 1; i >= currentIndex; i--) {
        if (isTrackDownloaded(queue[i].id)) return i;
      }
    }
    return -1;
  }

  if (currentIndex - 1 >= 0) return currentIndex - 1;
  if (norm === 'ALL' || norm === 'CONTEXT') return queue.length - 1;
  return -1;
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      playbackRequestId: 0,
      currentSong: initialSession?.currentSong || null,
      isPlaying: false, // Strict rule: ALWAYS boot in paused state
      playbackIntent: 'IDLE' as const,
      trackSource: (initialSession?.currentSong ? 'SESSION_RESTORE' : null) as any,
      setPlaybackIntent: (intent) => set({ playbackIntent: intent }),
      setTrackSource: (source) => set({ trackSource: source }),
      currentTime: initialSession?.currentTime || 0,
      duration: initialSession?.currentSong?.duration || 0,
      volume: 0.8,
      isMuted: false,

      queue: initialSession?.queue || [],
      queueIndex: initialSession?.queueIndex || 0,
      shuffleMode: 'OFF',
      repeatMode: 'off',
      isRefillingQueue: false,
      crossfadeSec: 0,
      isGaplessEnabled: true,
      playbackContext: null,

      likedSongIds: [],
      likedSongs: [],
      downloadedSongIds: [],
      cloudDownloadedSongIds: [],
      cloudDownloadRecords: [],
      historySongIds: [],
      favoriteArtistIds: [],
      favoriteAlbumIds: [],

      activeTab: 'home',
      selectedArtistId: null,
      selectedAlbumId: null,
      selectedPlaylistId: null,

      streamingQuality: 'AUTO',
      downloadQuality: 'HIGH',
      isDataSaverEnabled: false,
      deliveredQuality: 'AUTO',
      isPlayerExpanded: false,
      isLyricsOpen: false,
      isQueueOpen: false,
      isMiniPlayerFloating: false,
      seekTarget: null,
      setSeekTarget: (time) => set({ seekTarget: time }),
      isAiDjModalOpen: false,
      isImporterOpen: false,
      isBackupOpen: false,

      isSettingsModalOpen: false,
      isCastModalOpen: false,
      isSleepTimerModalOpen: false,
      isDeviceModalOpen: false,
      isLockScreenOpen: false,
      toggleLockScreen: (open) => set((s) => ({ isLockScreenOpen: open !== undefined ? open : !s.isLockScreenOpen })),
      isNotificationShadeOpen: false,
      toggleNotificationShade: (open) => set((s) => ({ isNotificationShadeOpen: open !== undefined ? open : !s.isNotificationShadeOpen })),
      isSystemSurfacesOpen: false,
      toggleSystemSurfaces: (open) => set((s) => ({ isSystemSurfacesOpen: open !== undefined ? open : !s.isSystemSurfacesOpen })),
      createPlaylistModalOpen: false,
      isWrappedModalOpen: false,
      toggleWrappedModal: (open) => set((s) => ({ isWrappedModalOpen: open !== undefined ? open : !s.isWrappedModalOpen })),
      isEqualizerOpen: false,
      toggleEqualizer: (open) => set((s) => ({ isEqualizerOpen: open !== undefined ? open : !s.isEqualizerOpen })),
      isCarModeOpen: false,
      toggleCarMode: (open) => set((s) => ({ isCarModeOpen: open !== undefined ? open : !s.isCarModeOpen })),
      isOnboardingOpen: typeof window !== 'undefined' ? localStorage.getItem('raagax_onboarding_completed') !== 'true' : false,
      toggleOnboarding: (open) => set((s) => ({ isOnboardingOpen: open !== undefined ? open : !s.isOnboardingOpen })),

      musicInterests: getInitialMusicInterests(),
      setMusicInterests: (interests: string[]) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('raagax_music_interests', JSON.stringify(interests));
        }
        set({ musicInterests: interests });
      },

      completeOnboarding: (languages: string[], interests: string[]) => {
        const validLangs = languages.length > 0 ? languages : ['Telugu'];
        const validInterests = interests.length > 0 ? interests : ['New Releases', 'Trending Hits'];

        if (typeof window !== 'undefined') {
          localStorage.setItem('raagax_onboarding_completed', 'true');
          localStorage.setItem('raagax_selected_languages', JSON.stringify(validLangs));
          localStorage.setItem('raagax_preferred_language', validLangs[0]);
          localStorage.setItem('raagax_music_interests', JSON.stringify(validInterests));
        }

        const prevInterests = get().interestLanguages || {};
        const newInterests: Record<string, number> = { ...prevInterests };
        validLangs.forEach(l => { newInterests[l] = 0.95; });

        set({
          isOnboardingOpen: false,
          selectedLanguages: validLangs,
          preferredLanguage: validLangs[0],
          sessionLanguage: validLangs[0],
          musicInterests: validInterests,
          interestLanguages: newInterests
        });

        // Sync to user lifecycle & Supabase profile if authenticated
        import('@/lib/lifecycle/UserLifecycleManager').then(({ UserLifecycleManager }) => {
          UserLifecycleManager.getInstance().setSelectedLanguages(validLangs);
        }).catch(() => { });

        import('@/lib/lifecycle/ListeningDnaEngine').then(({ ListeningDnaEngine }) => {
          ListeningDnaEngine.getInstance().setInitialLanguages(validLangs);
        }).catch(() => { });

        import('@/lib/supabase').then(({ supabase }) => {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.id) {
              Promise.resolve(
                supabase.from('profiles').update({
                  preferred_languages: validLangs,
                  music_interests: validInterests,
                  updated_at: new Date().toISOString()
                }).eq('id', session.user.id)
              ).catch(() => { });
            }
          }).catch(() => { });
        }).catch(() => { });
      },

      toastMessage: null,

      setToastMessage: (msg) => set({ toastMessage: msg }),

      isAutoplayEnabled: true,
      playbackContextData: null,
      albumPlaybackQueue: [],
      toggleAutoplay: () => set((state) => ({ isAutoplayEnabled: !state.isAutoplayEnabled })),
      setPlaybackContext: (context) => set({ playbackContextData: context }),

      aiDjState: {
        isActive: false,
        mode: 'auto',
        prompt: '',
        currentMood: 'energetic',
        insightText: 'RaagaX AI suggests personalized music tailored to your vibe.',
      },
      searchQuery: '',
      activeGenreFilter: 'all',

      sleepTimerMinutes: null,
      sleepTimerEndsAt: null,
      contextMenuSong: null,

      // Offline Mode State
      networkMode: 'online',
      setNetworkMode: (mode) => set({ networkMode: mode }),

      preferredLanguage: (typeof window !== 'undefined' && localStorage.getItem('raagax_preferred_language')) || '',
      selectedLanguages: getInitialSelectedLanguages(),
      sessionLanguage: (typeof window !== 'undefined' && localStorage.getItem('raagax_preferred_language')) || '',
      interestLanguages: {},
      setPreferredLanguage: (lang: string) => {
        if (typeof window !== 'undefined') localStorage.setItem('raagax_preferred_language', lang);
        const prevInterests = get().interestLanguages || {};
        set({
          preferredLanguage: lang,
          sessionLanguage: lang,
          interestLanguages: {
            ...prevInterests,
            [lang]: 0.90,
          }
        });
        import('@/lib/lifecycle/UserLifecycleManager').then(({ UserLifecycleManager }) => {
          UserLifecycleManager.getInstance().setSelectedLanguages([lang]);
        });
      },
      setSelectedLanguages: (langs: string[]) => {
        const valid = langs;
        if (typeof window !== 'undefined') {
          localStorage.setItem('raagax_selected_languages', JSON.stringify(valid));
          if (valid.length > 0) {
            localStorage.setItem('raagax_preferred_language', valid[0]);
          } else {
            localStorage.removeItem('raagax_preferred_language');
          }
        }
        const prevInterests = get().interestLanguages || {};
        const newInterests: Record<string, number> = { ...prevInterests };
        valid.forEach(l => { newInterests[l] = 0.90; });

        set({
          selectedLanguages: valid,
          preferredLanguage: valid[0] || '',
          sessionLanguage: valid[0] || '',
          interestLanguages: newInterests
        });

        import('@/lib/lifecycle/UserLifecycleManager').then(({ UserLifecycleManager }) => {
          UserLifecycleManager.getInstance().setSelectedLanguages(valid);
        });
        import('@/lib/lifecycle/ListeningDnaEngine').then(({ ListeningDnaEngine }) => {
          ListeningDnaEngine.getInstance().setInitialLanguages(valid);
        });
      },
      homeFeedControls: getInitialFeedControls(),
      setHomeFeedControl: (key, value) => {
        set((state) => {
          const updated = { ...(state.homeFeedControls || getInitialFeedControls()), [key]: value };
          if (typeof window !== 'undefined') {
            localStorage.setItem('raagax_home_feed_controls', JSON.stringify(updated));
          }
          return { homeFeedControls: updated };
        });
      },

      setSessionLanguage: (lang: string) => set({ sessionLanguage: lang }),
      recordLanguageInterest: (lang: string, delta: number = 0.15) => {
        const current = { ...(get().interestLanguages || {}) };
        const prev = current[lang] || 0;
        current[lang] = Math.min(1.0, Math.max(0.01, Math.round((prev + delta) * 100) / 100));
        set({ interestLanguages: current });
      },

      deviceId: typeof window !== 'undefined' ? (require('@/lib/connect/DeviceRegistry').DeviceRegistry.getInstance().getOrCreateDeviceId()) : '',
      deviceInstanceId: typeof window !== 'undefined' ? (require('@/lib/connect/DeviceRegistry').DeviceRegistry.getInstance().getOrCreateDeviceInstanceId()) : '',
      activeDeviceId: null,
      connectedDeviceId: null,
      deviceConnectionState: 'AVAILABLE',
      availableDevicePlaybackStates: {},
      localPlaybackRevision: 0,
      lastReceivedPlaybackRevision: 0,
      lastReceivedPlaybackSessionRevision: 0,
      activeRenderer: 'audio',
      playbackStatus: 'paused',
      isActiveDevice: true, // Default to true until sync starts
      isTransferring: false,
      transferringDeviceId: null,
      remoteDeviceName: null,
      remoteAnchorPositionMs: 0,
      remoteAnchorTimeMs: 0,
      lastSyncDbTime: null,
      lastSyncPositionMs: null,
      playbackSession: null,
      handoffState: null,
      serverTimestamp: null,
      onlineDevices: [],
      rightPanelMode: 'queue',

      setOnlineDevices: (devices) => set({ onlineDevices: devices }),

      connectToDevice: async (targetDeviceId: string) => {
        return ConnectManager.getInstance().connectToDevice(targetDeviceId);
      },

      disconnectDevice: () => {
        ConnectManager.getInstance().disconnectFromDevice();
      },

      transferPlayback: async (targetDeviceId: string) => {
        const { currentSong } = get();
        if (!currentSong) {
          // If no song is playing locally, connect to the target device as a remote controller
          return get().connectToDevice(targetDeviceId);
        }

        set({ isTransferring: true, transferringDeviceId: targetDeviceId });

        try {
          const { TransferManager } = await import('@/lib/connect/TransferManager');
          await TransferManager.getInstance().initiateTransfer(targetDeviceId);
          // Note: TransferManager's 3-way handshake will update isActiveDevice and connectedDeviceId
          // in handleTransferCommitted (on success) or handleTransferRollback (on timeout/failure).
        } catch (e) {
          console.error('[ZUSTAND] Playback transfer failed:', e);
          set({ isTransferring: false, transferringDeviceId: null });
        }
      },

      getPlaybackSnapshot: () => {
        const state = get();
        return {
          sessionId: state.playbackSession?.sessionId || 'local_session',
          deviceId: state.deviceId || 'local_device',
          currentTrackId: state.currentSong?.id || null,
          positionMs: state.currentTime * 1000,
          timestampMs: state.serverTimestamp || Date.now(),
          isPlaying: state.isPlaying,
          sequence: state.playbackSession?.revision || 1,
          context: state.playbackContext || undefined,
          durationMs: state.duration * 1000,
        };
      },

      calculateLiveTime: () => {
        const { calculateLivePositionMs } = require('@/lib/connect/types');
        const snapshot = get().getPlaybackSnapshot();
        return calculateLivePositionMs(snapshot) / 1000;
      },

      restrictions: {
        disallowSkipNext: [],
        disallowSkipPrev: [],
        disallowSeek: [],
        disallowPause: [],
        disallowSetQueue: [],
        disallowTransfer: [],
      },

      executePlayerCommand: async (type, payload, origin) => {
        const { PlayerCommandBus } = await import('@/lib/playback/PlayerCommandBus');
        const bus = PlayerCommandBus.getInstance();
        const command = bus.createCommand(type, payload, origin);
        const result = await bus.executeCommand(command);

        const manager = QueueManager.getInstance();
        const newRestrictions = manager.getRestrictions();
        const newSnapshot = manager.getSnapshot();
        set({
          restrictions: newRestrictions,
          queue: newSnapshot.items.map((i: any) => i.song),
          queueIndex: newSnapshot.currentIndex >= 0 ? newSnapshot.currentIndex : 0,
          currentSong: newSnapshot.items[newSnapshot.currentIndex]?.song || get().currentSong,
        });

        return result;
      },

      setRightPanelMode: (mode) => set({ rightPanelMode: mode }),
      setRemoteState: (newState) => set((state) => ({ ...state, ...newState })),

      restoreLocalSession: async () => {
        // Prevent duplicate concurrent restorations
        const state = get();
        if (state.currentSong && state.isPlaying) {
          return;
        }

        const manager = QueueManager.getInstance();
        const { RaagaXNativePlayer } = await import('@/lib/playback/native/RaagaXNativePlayer');
        const { QueueHistory } = await import('@/lib/queue/QueueHistory');
        const historyInstance = QueueHistory.getInstance();
        await historyInstance.ensureLoaded();
        const historyEntries = historyInstance.getHistory();
        const mostRecentHistorySong = historyEntries.length > 0 ? historyEntries[historyEntries.length - 1].song : null;

        // Load local playback session
        const session = await LocalDatabase.getInstance().loadPlaybackSession();

        // Check if Native Android foreground playback is actively playing
        if (RaagaXNativePlayer.isNative()) {
          const nativeState = await RaagaXNativePlayer.getPlaybackState();
          // Case 1: Native service is actively playing audio (e.g. app was in background and brought back to foreground)
          if (nativeState && nativeState.isPlaying) {
            console.log(`[PLAYER EVENT] Source=NativeBackgroundService Title="${nativeState.title}" Artist="${nativeState.artist}" isPlaying=true PositionMs=${nativeState.positionMs}`);

            // Find matching song in session queue or history to match active audio EXACTLY
            const candidateQueue = (session?.queue && session.queue.length > 0) ? session.queue : (mostRecentHistorySong ? [mostRecentHistorySong] : []);
            let matchedSong: Song | null = null;
            let matchedIndex = 0;

            if (nativeState.title) {
              const idx = candidateQueue.findIndex(s => s.title?.toLowerCase() === nativeState.title?.toLowerCase());
              if (idx !== -1) {
                matchedSong = candidateQueue[idx];
                matchedIndex = idx;
              }
            }

            if (!matchedSong && mostRecentHistorySong && nativeState.title && mostRecentHistorySong.title?.toLowerCase() === nativeState.title?.toLowerCase()) {
              matchedSong = mostRecentHistorySong;
            }

            if (!matchedSong && candidateQueue.length > 0) {
              matchedSong = candidateQueue[0];
            }

            if (matchedSong) {
              manager.replaceQueue(candidateQueue, matchedIndex);
              set({
                isPlaying: true,
                playbackIntent: 'PLAYING',
                trackSource: 'SESSION_RESTORE',
                currentSong: matchedSong,
                currentTime: nativeState.positionMs / 1000,
                queue: candidateQueue,
                queueIndex: matchedIndex,
              });
              console.log(`[UI MINI PLAYER] songId=${matchedSong.id} title="${matchedSong.title}" cover="${matchedSong.coverUrl}" isPlaying=true source=NativeActiveHandoff`);
              return;
            }
          }
        }

        // Case 2: Cold boot / Fresh App Session — PASSIVE restoration (isPlaying = false, DO NOT AUTOPLAY)
        // Sourced strictly from the most recent session if it's still valid/active (less than 4 hours old)
        const isSessionValid = session && session.timestamp && (Date.now() - session.timestamp < 4 * 60 * 60 * 1000);
        if (isSessionValid && session && session.currentSong) {
          const candidateSong = session.currentSong;
          const rawQueue = (session.queue && session.queue.length > 0) ? session.queue : [session.currentSong];
          const cleanQueue = rawQueue.filter(s => s && !isKidsOrNurseryTrack(s));

          const isCandidateClean = candidateSong && !isKidsOrNurseryTrack(candidateSong);
          const activeSong = isCandidateClean ? candidateSong : (cleanQueue[0] || null);

          if (cleanQueue.length > 0 && activeSong) {
            let safeIndex = cleanQueue.findIndex(s => s.id === activeSong.id);
            if (safeIndex === -1) safeIndex = Math.min(session.queueIndex || 0, Math.max(0, cleanQueue.length - 1));

            let restoredTime = session.currentTime || 0;
            const totalDuration = activeSong.duration || session.duration || 0;

            // ── NEAR-END RULE: If saved position is within 5 seconds of the end, reset to 0:00 ──
            if (totalDuration > 0 && restoredTime >= (totalDuration - 5)) {
              restoredTime = 0;
            }

            manager.replaceQueue(cleanQueue, safeIndex);

            set({
              isPlaying: false, // Strict Rule: ALWAYS PAUSED ON COLD BOOT (Zero Autoplay)
              playbackIntent: 'PAUSED',
              trackSource: 'SESSION_RESTORE',
              currentSong: activeSong,
              currentTime: restoredTime,
              duration: totalDuration,
              queue: cleanQueue,
              queueIndex: safeIndex,
            });

            await PlaybackService.getInstance().prepareTrack(activeSong, restoredTime);
            await PlaybackService.getInstance().loadQueueContext(cleanQueue, safeIndex, false, Math.round(restoredTime * 1000));
          }
        } else {
          // Clear/Reset current store state if session is stale/invalid to prevent resurrected stale state
          set({
            currentSong: null,
            currentTime: 0,
            duration: 0,
            queue: [],
            queueIndex: 0,
            trackSource: null,
          });
        }
      },

      logCurrentTelemetry: (action) => {
        const { currentSong, currentTime, duration } = get();
        if (!currentSong) return;

        const safeDuration = duration > 0 ? duration : (currentSong.duration || Math.max(1, currentTime));
        let completionPercentage = currentTime / safeDuration;
        if (completionPercentage > 1) completionPercentage = 1;

        let finalAction = action;
        if (action === 'skip' && completionPercentage >= 0.95) finalAction = 'complete';

        RecommendationEngine.getInstance().trackEngagement(
          currentSong,
          finalAction,
          currentTime,
          completionPercentage,
          'home',
          finalAction === 'skip' ? currentTime : undefined
        );
      },

      playAlbumSequence: async (albumIds: string[]) => {
        if (!albumIds || albumIds.length === 0) return;

        const { AlbumCollectionBuilder } = await import('@/lib/queue/AlbumCollectionBuilder');
        const collectionResult = await AlbumCollectionBuilder.getInstance().buildCollectionQueue(albumIds, 100);

        if (collectionResult.songs.length > 0) {
          set({
            albumPlaybackQueue: albumIds,
            playbackContextData: { type: 'album_sequence', collectionId: collectionResult.queueId },
          });

          const firstSong = collectionResult.songs[0];
          const manager = QueueManager.getInstance();
          manager.replaceQueue(collectionResult.songs, 0);

          // Play first song
          get().playSong(firstSong, collectionResult.songs);
        }
      },

      commitPlaybackTransition: (song: Song, queueIndex?: number, updatedQueue?: Song[]) => {
        if (!song) return;
        const currentQ = updatedQueue || get().queue;
        const finalIndex = queueIndex !== undefined ? queueIndex : get().queueIndex;
        const formattedTrack: Song = {
          ...song,
          coverUrl: SongCoverEngine.getInstance().formatRawCoverUrl(song.coverUrl),
        };
        const requestId = ++globalPlaybackRequestId;
        set({
          currentSong: formattedTrack,
          queueIndex: finalIndex,
          queue: currentQ,
          currentTime: 0,
          isPlaying: true,
          playbackIntent: 'PLAYING',
          playbackRequestId: requestId,
        });
        import('@/lib/playback/PlaybackSession').then(({ SessionManager }) => {
          SessionManager.getInstance().updateSession({
            currentTrack: formattedTrack,
            currentTrackId: formattedTrack.id,
            currentQueueIndex: finalIndex,
            queue: currentQ,
            position: 0,
            duration: formattedTrack.duration || 0,
            isPlaying: true,
            playbackRequestId: requestId,
          });
        }).catch(() => {});
        MediaSessionManager.getInstance().updateMetadata({
          title: formattedTrack.title,
          artist: formattedTrack.artist,
          album: formattedTrack.album || 'RaagaX Music',
          artwork: formattedTrack.coverUrl ? [{ src: formattedTrack.coverUrl, sizes: '512x512', type: 'image/png' }] : [],
        });
        persistSessionHelper(get());
      },

      switchTrack: async (track: Song, index: number, autoPlay: boolean = true) => {
        if (!track) return false;

        // 1. Atomically increment playbackRequestId
        const requestId = ++globalPlaybackRequestId;
        PlaybackService.getInstance().setPlaybackRequestId(requestId);
        PlaybackService.getInstance().stopAllAudio();
        console.log(`[SWITCH_TRACK] #${requestId} target="${track.title}" @ index ${index}`);

        const formattedTrack: Song = {
          ...track,
          coverUrl: SongCoverEngine.getInstance().formatRawCoverUrl(track.coverUrl),
        };

        // 2. ATOMIC SYNCHRONOUS STATE UPDATE:
        // Currently playing audio URL, artwork, title, artist, duration and track ID must ALWAYS belong to the same currentTrack object!
        set({
          currentSong: formattedTrack,
          queueIndex: index,
          currentTime: 0,
          duration: formattedTrack.duration || 0,
          isPlaying: autoPlay,
          playbackIntent: autoPlay ? 'PLAYING' : 'PAUSED',
          activeRenderer: 'audio',
          playbackRequestId: requestId,
        });

        // Update PlaybackSession singleton
        import('@/lib/playback/PlaybackSession').then(({ SessionManager }) => {
          SessionManager.getInstance().updateSession({
            currentTrack: formattedTrack,
            currentTrackId: formattedTrack.id,
            currentQueueIndex: index,
            queue: get().queue,
            position: 0,
            duration: formattedTrack.duration || 0,
            isPlaying: autoPlay,
            shuffleMode: get().shuffleMode,
            repeatMode: get().repeatMode,
            playbackRequestId: requestId,
          });
        }).catch(() => {});

        // Sync QueueManager position
        QueueManager.getInstance().skipTo(index);

        // Update Recently Played history
        const existingHistory = get().historySongIds.filter((id) => id !== formattedTrack.id);
        const updatedHistory = [formattedTrack.id, ...existingHistory].slice(0, 50);
        set({ historySongIds: updatedHistory });

        // Persist durable session immediately
        persistSessionHelper(get());

        // Update MediaSession (Android lockscreen, Notification shade, Bluetooth metadata)
        MediaSessionManager.getInstance().updateMetadata({
          title: formattedTrack.title,
          artist: formattedTrack.artist,
          album: formattedTrack.album || 'RaagaX Music',
          artwork: formattedTrack.coverUrl ? [{ src: formattedTrack.coverUrl, sizes: '512x512', type: 'image/png' }] : [],
        });
        MediaSessionManager.getInstance().setPlaybackState(autoPlay ? 'playing' : 'paused');
        MediaSessionManager.getInstance().setPositionState({
          duration: formattedTrack.duration || 0,
          position: 0,
        });

        // If remote device (Connect / Cast)
        if (!get().isActiveDevice && get().connectedDeviceId) {
          const res = await ConnectManager.getInstance().dispatchPlaybackCommand('PLAY', {
            trackId: track.id,
            songData: track,
            queue: get().queue,
            queueIndex: index,
            positionMs: 0,
          });
          return requestId === globalPlaybackRequestId;
        }

        // 3. Load the NEW track's audio URL into audio engine
        const loaded = await PlaybackService.getInstance().loadAudioSource(track, requestId, autoPlay);

        // 4. Stale-request check: verify the requestId is still current
        if (requestId !== globalPlaybackRequestId || !loaded) {
          console.log(`[SWITCH_TRACK] Stale or cancelled request #${requestId} for "${track.title}" (current #${globalPlaybackRequestId}) - DISCARDED`);
          return false;
        }

        // Background Real Artwork Verification & Resolution
        SongCoverEngine.getInstance().ensureActiveSongCover(formattedTrack).then((enhanced) => {
          if (enhanced.coverUrl && enhanced.coverUrl !== formattedTrack.coverUrl && enhanced.coverUrl !== '/app-icon.png') {
            const current = get().currentSong;
            if (current?.id === enhanced.id && get().playbackRequestId === requestId) {
              set({ currentSong: { ...current, coverUrl: enhanced.coverUrl } });
              MediaSessionManager.getInstance().updateMetadata({
                title: enhanced.title,
                artist: enhanced.artist || 'RaagaX',
                album: enhanced.album || 'RaagaX Music',
                artwork: [{ src: enhanced.coverUrl, sizes: '512x512', type: 'image/png' }],
              });
            }
          }
        }).catch(() => {});

        // Broadcast to peers
        try {
          PlaybackStateSync.getInstance().broadcastState(true);
        } catch {}

        // Proactive queue refilling for Radio and continuous playback streams
        get().autoRefillQueue().catch(() => {});

        return true;
      },

      playSong: async (song, newQueue, context) => {
        if (!song) return;
        const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST));
        const now = Date.now();
        if (!isTest && song.id && lastPlaySongId === song.id && (now - lastPlayCallTimestamp) < 350) {
          console.warn(`[usePlayerStore] Debounced duplicate play request for: ${song.id} (${now - lastPlayCallTimestamp}ms)`);
          return;
        }
        lastPlayCallTimestamp = now;
        lastPlaySongId = song.id;

        // Upgrade coverUrl immediately to 500x500 HD
        const activePlaySong: Song = {
          ...song,
          coverUrl: SongCoverEngine.getInstance().formatRawCoverUrl(song.coverUrl),
        };

        const isOffline = !isTest && typeof navigator !== 'undefined' && navigator.onLine === false;
        if (isOffline && !isTrackDownloaded(activePlaySong.id)) {
          get().setToastMessage("This song isn't available offline.");
          return;
        }

        console.log(`[PLAY CALLED] songId=${activePlaySong.id} title="${activePlaySong.title}" artist="${activePlaySong.artist}" cover="${activePlaySong.coverUrl}" source=${context?.type || 'USER_CLICK'}`);
        get().logCurrentTelemetry('skip');

        // 3-Tier Language System: Session Language Resolution
        const songLang = LanguageEligibilityEngine.getInstance().detectSongLanguage(activePlaySong);
        get().recordLanguageInterest(songLang, 0.20);

        // Check if newQueue was passed (e.g. from an album or playlist)
        const manager = QueueManager.getInstance();
        let syncedQueue = get().queue;
        let targetIndex = 0;

        if (newQueue && newQueue.length > 0) {
          const index = newQueue.findIndex((s: Song) => s.id === activePlaySong.id);
          const boundedQueue = index !== -1 ? newQueue.slice(index) : newQueue;
          manager.replaceQueue(boundedQueue, 0, (context?.type as any) || 'PLAYLIST', context);
          const snapshot = manager.getSnapshot();
          syncedQueue = snapshot.items.map((i: any) => i.song);
          targetIndex = 0;
          set({ queue: syncedQueue });
        } else {
          manager.playNow(activePlaySong);
          const snapshot = manager.getSnapshot();
          syncedQueue = snapshot.items.map((i: any) => i.song);
          targetIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0;
          set({ queue: syncedQueue });
        }

        // Authoritative Playback Context
        const effectiveContext = context ? {
          contextType: (context.contextType || context.type || 'PLAYLIST') as any,
          type: context.type || context.contextType || 'playlist',
          id: context.id || context.collectionId || (context as any).seedAlbumId || (context as any).seedPlaylistId || '',
          title: context.title || (context as any).name || (activePlaySong.album ? activePlaySong.album : 'Your Queue'),
          name: context.title || (context as any).name || (activePlaySong.album ? activePlaySong.album : 'Your Queue'),
        } : (get().playbackContext || {
          contextType: 'ALBUM',
          type: 'album',
          id: activePlaySong.albumId || activePlaySong.album || 'queue',
          title: activePlaySong.album || 'Your Queue',
          name: activePlaySong.album || 'Your Queue',
        });

        set({
          sessionLanguage: songLang,
          playbackContext: effectiveContext as any,
          playbackContextData: effectiveContext as any,
        });

        if (!get().connectedDeviceId) {
          set({ isActiveDevice: true, activeDeviceId: get().deviceId });
        }

        await get().switchTrack(activePlaySong, targetIndex, true);
      },

      shufflePlay: async (songs, context) => {
        if (!songs || songs.length === 0) return;

        get().logCurrentTelemetry('skip');

        // Truly randomize full sequence so starting song is never forced to track 1
        const shuffledSongs = [...songs].sort(() => Math.random() - 0.5);

        const manager = QueueManager.getInstance();
        manager.replaceQueue(shuffledSongs, 0, 'PLAYLIST', context);

        const snapshot = manager.getSnapshot();
        const syncedQueue = snapshot.items.map((i: any) => i.song);
        const firstSong = syncedQueue[0] || shuffledSongs[0];

        set({
          queue: syncedQueue,
          shuffleMode: snapshot.shuffleMode || 'STANDARD',
        });

        await get().switchTrack(firstSong, 0, true);
      },

      togglePlayPause: async () => {
        if (get().isTransferring) {
          const isNowPlaying = !get().isPlaying;
          set({ isPlaying: isNowPlaying, playbackIntent: isNowPlaying ? 'PLAYING' : 'PAUSED' });
          try {
            TransferManager.getInstance().recordPendingIntent({
              action: isNowPlaying ? 'PLAY' : 'PAUSE',
              positionMs: get().currentTime * 1000,
              timestamp: Date.now()
            });
          } catch { }
          return;
        }

        // Single Source of Truth: derive true playing state directly from the active engine
        let currentLivePlaying = get().isPlaying;
        if (get().activeRenderer === 'audio' && get().isActiveDevice) {
          if (RaagaXNativePlayer.isNative()) {
            currentLivePlaying = get().isPlaying;
          } else {
            currentLivePlaying = PlaybackService.getInstance().getLivePlayingState();
          }
        }

        const isNowPlaying = !currentLivePlaying;
        const oldIsPlaying = get().isPlaying;
        const oldPlaybackIntent = get().playbackIntent;

        if (!isNowPlaying) {
          InterruptionCoordinator.getInstance().reportUserPause();
        } else {
          InterruptionCoordinator.getInstance().clearInterruption();
        }
        set({ isPlaying: isNowPlaying, playbackIntent: isNowPlaying ? 'PLAYING' : 'PAUSED' });
        persistSessionHelper({ ...get() });

        if (!get().connectedDeviceId && !get().isActiveDevice) {
          set({ isActiveDevice: true, activeDeviceId: get().deviceId });
        }

        if (get().isActiveDevice) {
          if (get().activeRenderer === 'video') {
            PlaybackService.getInstance().pauseAudioElementOnly();
          } else if (RaagaXNativePlayer.isNative()) {
            if (!isNowPlaying) {
              await RaagaXNativePlayer.pause();
            } else {
              await RaagaXNativePlayer.resume();
            }
          } else {
            if (!isNowPlaying) {
              PlaybackService.getInstance().pause();
            } else {
              PlaybackService.getInstance().play();
            }
          }
          try {
            PlaybackStateSync.getInstance().broadcastState(true);
          } catch { }
          return;
        }

        const res = await ConnectManager.getInstance().dispatchPlaybackCommand(isNowPlaying ? 'PLAY' : 'PAUSE', { positionMs: get().currentTime * 1000 });
        if (res && !res.success) {
          console.warn('[ZUSTAND] Play/Pause command rejected or timed out. Rolling back UI...');
          set({ isPlaying: oldIsPlaying, playbackIntent: oldPlaybackIntent });
          persistSessionHelper({ ...get() });
        }
      },
      setIsPlaying: async (playing, fromRemote = false) => {
        if (get().isTransferring && !fromRemote) {
          set({ isPlaying: playing, playbackIntent: playing ? 'PLAYING' : 'PAUSED' });
          try {
            TransferManager.getInstance().recordPendingIntent({
              action: playing ? 'PLAY' : 'PAUSE',
              positionMs: get().currentTime * 1000,
              timestamp: Date.now()
            });
          } catch { }
          return;
        }
        const oldIsPlaying = get().isPlaying;
        const oldPlaybackIntent = get().playbackIntent;

        if (!playing && !fromRemote) {
          InterruptionCoordinator.getInstance().reportUserPause();
        } else if (playing) {
          InterruptionCoordinator.getInstance().clearInterruption();
        }
        set({ isPlaying: playing, playbackIntent: playing ? 'PLAYING' : 'PAUSED' });
        persistSessionHelper({ ...get() });
        MediaSessionManager.getInstance().setPlaybackState(playing ? 'playing' : 'paused');

        if (!get().connectedDeviceId && !get().isActiveDevice && !fromRemote) {
          set({ isActiveDevice: true, activeDeviceId: get().deviceId });
        }

        if (get().isActiveDevice && !fromRemote) {
          if (get().activeRenderer === 'video') {
            PlaybackService.getInstance().pauseAudioElementOnly();
          } else {
            if (!playing) {
              PlaybackService.getInstance().pause();
            } else {
              PlaybackService.getInstance().play();
            }
          }
          try {
            PlaybackStateSync.getInstance().broadcastState(true);
          } catch { }
          return;
        }

        if (!fromRemote) {
          const res = await ConnectManager.getInstance().dispatchPlaybackCommand(playing ? 'PLAY' : 'PAUSE', { positionMs: get().currentTime * 1000 });
          if (res && !res.success) {
            console.warn('[ZUSTAND] setIsPlaying command failed. Rolling back UI...');
            set({ isPlaying: oldIsPlaying, playbackIntent: oldPlaybackIntent });
            persistSessionHelper({ ...get() });
          }
        }
      },
      setCurrentTime: (time, fromRemote = false) => {
        if (typeof time !== 'number' || !Number.isFinite(time) || isNaN(time) || time < 0) return;

        // Optimistic UI: Always update local state immediately
        set({ currentTime: time });

        if (get().isTransferring && !fromRemote) {
          try {
            TransferManager.getInstance().recordPendingIntent({
              action: 'SEEK',
              positionMs: time * 1000,
              timestamp: Date.now()
            });
          } catch { }
          return;
        }

        const state = get();
        if (state.isActiveDevice && state.currentSong) {
          throttlePersistSession(state, fromRemote);
        }
      },
      setDuration: (dur) => {
        if (typeof dur === 'number' && Number.isFinite(dur) && !isNaN(dur) && dur > 0) {
          set({ duration: dur });
        }
      },
      setVolume: (vol) => {
        const safeVol = Math.max(0, Math.min(1, vol));
        set({ volume: safeVol });
        if (get().isActiveDevice) {
          try {
            PlaybackStateSync.getInstance().broadcastState(true);
          } catch { }
        } else {
          try {
            ConnectManager.getInstance().dispatchPlaybackCommand('SET_VOLUME', { volume: safeVol });
          } catch { }
        }
        persistSessionHelper(get());
      },
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

      playNext: async () => {
        const { duration, currentTime } = get();
        const isComplete = duration > 0 && currentTime >= duration - 5;
        get().logCurrentTelemetry(isComplete ? 'complete' : 'skip');
        if (get().sleepTimerMode === 'end_of_song') {
          get().setIsPlaying(false);
          get().setSleepTimer(null);
          get().setToastMessage('Sleep Timer Ended — Playback paused at end of song');
          return;
        }

        const { queue, queueIndex, repeatMode } = get();
        if (queue.length === 0) return;

        const nextIndex = getNextQueueIndex(queue, queueIndex, repeatMode);
        if (nextIndex >= 0 && nextIndex < queue.length) {
          const nextTrack = queue[nextIndex];
          console.log(`[NEXT] ${queueIndex} → ${nextIndex} (Track: "${nextTrack.title}")`);
          await get().switchTrack(nextTrack, nextIndex, true);
        } else {
          if (get().sleepTimerMode === 'end_of_queue') {
            get().setSleepTimer(null);
            get().setToastMessage('Sleep Timer Ended — Playback paused at end of queue');
          }
          get().setIsPlaying(false, true);
          persistSessionHelper(get());
        }
      },

      playPrev: async () => {
        const { queue, queueIndex, currentTime, currentSong, repeatMode } = get();

        // If track played more than 3 seconds, restart current track at 0:00
        if (currentTime > 3) {
          console.log(`[RESTART] ${currentSong?.id || 'unknown'} (pos: ${currentTime.toFixed(1)}s > 3s)`);
          get().setCurrentTime(0, true);
          get().setSeekTarget(0);
          PlaybackService.getInstance().seek(0);
          return;
        }

        get().logCurrentTelemetry('skip');

        if (queue.length === 0) return;

        const prevIndex = getPreviousQueueIndex(queue, queueIndex, repeatMode);
        if (prevIndex >= 0 && prevIndex < queue.length) {
          const prevTrack = queue[prevIndex];
          console.log(`[PREVIOUS] ${queueIndex} → ${prevIndex} (Track: "${prevTrack.title}")`);
          await get().switchTrack(prevTrack, prevIndex, true);
        } else {
          // At beginning of queue and no previous: restart at 0:00
          console.log(`[RESTART] ${currentSong?.id || 'unknown'} (beginning of queue)`);
          get().setCurrentTime(0, true);
          get().setSeekTarget(0);
          PlaybackService.getInstance().seek(0);
        }
      },

      toggleShuffle: async () => {
        const manager = QueueManager.getInstance();
        await manager.toggleShuffle();
        const snapshot = manager.getSnapshot();
        const syncedQueue = snapshot.items.map((i: any) => i.song);
        const syncedIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0;
        const currentSong = syncedQueue[syncedIndex] || get().currentSong;

        console.log(`[SHUFFLE] ${syncedIndex}`);
        set({
          shuffleMode: snapshot.shuffleMode || 'STANDARD',
          queue: syncedQueue,
          queueIndex: syncedIndex,
          currentSong
        });
        persistSessionHelper(get());

        if (get().isActiveDevice) {
          PlaybackService.getInstance().loadQueueContext(syncedQueue, syncedIndex);
          try {
            PlaybackStateSync.getInstance().broadcastState(true);
          } catch { }
        } else {
          try {
            ConnectManager.getInstance().dispatchPlaybackCommand('SET_SHUFFLE', {
              shuffleMode: snapshot.shuffleMode || 'STANDARD',
            });
          } catch { }
        }
      },
      setRepeatMode: (mode) => {
        const raw = (mode || 'OFF').toUpperCase();
        const normalized: 'OFF' | 'ALL' | 'ONE' = (raw === 'ONE' || raw === 'TRACK') ? 'ONE' : (raw === 'ALL' || raw === 'CONTEXT') ? 'ALL' : 'OFF';
        console.log(`[REPEAT] ${normalized}`);
        QueueManager.getInstance().setRepeatMode(normalized as any);
        set({ repeatMode: normalized as any });
        persistSessionHelper(get());

        if (RaagaXNativePlayer.isNative()) {
          RaagaXNativePlayer.setRepeatMode(normalized);
        }

        if (get().isActiveDevice) {
          try {
            PlaybackStateSync.getInstance().broadcastState(true);
          } catch { }
        } else {
          try {
            ConnectManager.getInstance().dispatchPlaybackCommand('SET_REPEAT', {
              repeatMode: normalized,
            });
          } catch { }
        }
      },
      cycleRepeatMode: () => {
        const modes: Array<'OFF' | 'ALL' | 'ONE'> = ['OFF', 'ALL', 'ONE'];
        const cur = (get().repeatMode || 'OFF').toUpperCase();
        const normalized = (cur === 'ONE' || cur === 'TRACK') ? 'ONE' : (cur === 'ALL' || cur === 'CONTEXT') ? 'ALL' : 'OFF';
        const nextIdx = (modes.indexOf(normalized as any) + 1) % modes.length;
        get().setRepeatMode(modes[nextIdx]);
      },

      addToQueue: (song) => {
        const manager = QueueManager.getInstance();
        manager.addToQueue(song);
        const snapshot = manager.getSnapshot();
        const syncedQueue = snapshot.items.map((i: any) => i.song);
        const syncedIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0;
        set({ queue: syncedQueue, queueIndex: syncedIndex });

        PlaybackService.getInstance().loadQueueContext(syncedQueue, syncedIndex);
      },
      playNextInQueue: (song) => {
        const manager = QueueManager.getInstance();
        manager.playNext(song);
        const snapshot = manager.getSnapshot();
        const syncedQueue = snapshot.items.map((i: any) => i.song);
        const syncedIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0;
        set({ queue: syncedQueue, queueIndex: syncedIndex });

        PlaybackService.getInstance().loadQueueContext(syncedQueue, syncedIndex);
      },
      playLastInQueue: (song) => {
        const manager = QueueManager.getInstance();
        manager.addToQueue(song);
        const snapshot = manager.getSnapshot();
        const syncedQueue = snapshot.items.map((i: any) => i.song);
        const syncedIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0;
        set({ queue: syncedQueue, queueIndex: syncedIndex });

        PlaybackService.getInstance().loadQueueContext(syncedQueue, syncedIndex);
      },
      removeFromQueue: (songId) => {
        const manager = QueueManager.getInstance();
        const items = manager.getAllItems();
        const target = items.find((i: any) => i.trackId === songId);
        if (target) {
          manager.removeItem(target.queueItemId);
          const snapshot = manager.getSnapshot();
          const syncedQueue = snapshot.items.map((i: any) => i.song);
          const syncedIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0;
          set({ queue: syncedQueue, queueIndex: syncedIndex });

          PlaybackService.getInstance().loadQueueContext(syncedQueue, syncedIndex);
        }
      },
      reorderQueue: (newQueue) => {
        const manager = QueueManager.getInstance();
        manager.replaceQueue(newQueue, get().queueIndex, 'USER');
        set({ queue: newQueue });

        PlaybackService.getInstance().loadQueueContext(newQueue, get().queueIndex);
      },
      clearQueue: () => {
        const { queue, queueIndex } = get();
        // Keep active song and past history, remove only upcoming tracks
        const remainingQueue = queue.slice(0, queueIndex + 1);
        const manager = QueueManager.getInstance();
        manager.replaceQueue(remainingQueue, queueIndex, 'USER');
        set({ queue: remainingQueue });

        PlaybackService.getInstance().loadQueueContext(remainingQueue, queueIndex);
      },
      moveQueueItem: (fromUpNextIndex: number, toUpNextIndex: number) => {
        const { queue, queueIndex } = get();
        const pastAndCurrent = queue.slice(0, queueIndex + 1);
        const upNext = [...queue.slice(queueIndex + 1)];
        if (
          fromUpNextIndex < 0 ||
          fromUpNextIndex >= upNext.length ||
          toUpNextIndex < 0 ||
          toUpNextIndex >= upNext.length
        ) {
          return;
        }
        const [moved] = upNext.splice(fromUpNextIndex, 1);
        upNext.splice(toUpNextIndex, 0, moved);
        const newQueue = [...pastAndCurrent, ...upNext];
        const manager = QueueManager.getInstance();
        manager.replaceQueue(newQueue, queueIndex, 'USER');
        set({ queue: newQueue });

        PlaybackService.getInstance().loadQueueContext(newQueue, queueIndex);
      },

      playNextSequence: (songs: Song[]) => {
        if (!songs || songs.length === 0) return;
        const { queue, queueIndex } = get();
        const pastAndCurrent = queue.slice(0, queueIndex + 1);
        const remaining = queue.slice(queueIndex + 1);
        const newQueue = [...pastAndCurrent, ...songs, ...remaining];

        const manager = QueueManager.getInstance();
        manager.replaceQueue(newQueue, queueIndex, 'USER');
        set({ queue: newQueue });

        PlaybackService.getInstance().loadQueueContext(newQueue, queueIndex);
      },

      deduplicateQueue: () => {
        const { queue, queueIndex } = get();
        if (!queue || queue.length <= 1) return;

        const current = queue[queueIndex];
        const past = queue.slice(0, queueIndex);
        const upNext = queue.slice(queueIndex + 1);

        const filteredUpNext = SongUniquenessEngine.deduplicate(upNext, current ? [current] : []);

        const newQueue = [...past, ...(current ? [current] : []), ...filteredUpNext];
        const manager = QueueManager.getInstance();
        manager.replaceQueue(newQueue, queueIndex, 'USER');
        set({ queue: newQueue });

        PlaybackService.getInstance().loadQueueContext(newQueue, queueIndex);
      },

      saveQueueAsPlaylist: async (title?: string): Promise<boolean> => {
        const { queue, currentSong } = get();
        if (!queue || queue.length === 0) return false;

        try {
          const { usePlaylistStore } = await import('@/context/usePlaylistStore');
          const playlistStore = usePlaylistStore.getState();

          const playlistName = title || (currentSong ? `Queue (${currentSong.title})` : `Queue (${new Date().toLocaleDateString()})`);
          const newPlaylist = await playlistStore.createPlaylist(playlistName, 'Created from active playback queue', 'private');

          if (newPlaylist) {
            for (const song of queue) {
              if (song && song.id) {
                await playlistStore.addSongToPlaylist(newPlaylist.id, song);
              }
            }
            return true;
          }
          return false;
        } catch (e) {
          console.error('[usePlayerStore] saveQueueAsPlaylist error:', e);
          return false;
        }
      },

      autoRefillQueue: async () => {
        try {
          const state = get();
          const remaining = state.queue.length - 1 - state.queueIndex;
          if (remaining <= 4) {
            const { RadioEngine } = await import('@/lib/radio/RadioEngine');
            if (state.playbackContext?.type === 'radio' || RadioEngine.getInstance().isRadioActive()) {
              await RadioEngine.getInstance().extendQueueIfNeeded(remaining);
            }
          }
        } catch (e) {
          console.warn('[usePlayerStore] autoRefillQueue error:', e);
        }
      },

      syncCloudLibrary: async () => {
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: session } = await supabase.auth.getSession();
          if (!session?.session?.user) return;
          const userId = session.session.user.id;

          // Reconcile cloud likes with single authoritative AccountSyncEngine
          const { AccountSyncEngine } = await import('@/lib/sync/AccountSyncEngine');
          await AccountSyncEngine.getInstance().reconcile(userId);

          // 1. Fetch User Favorites (Artists/Albums)
          const { data: favData } = await supabase
            .from('user_favorites')
            .select('item_id, item_type')
            .eq('user_id', userId);

          const favoriteArtistIds = favData ? favData.filter(d => d.item_type === 'artist').map(d => d.item_id) : [];
          const favoriteAlbumIds = favData ? favData.filter(d => d.item_type === 'album').map(d => d.item_id) : [];

          // 2. Fetch Playback History (Recently Played)
          const { data: historyData } = await supabase
            .from('listening_events')
            .select('song_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

          const historySongIds = historyData ? Array.from(new Set(historyData.map(d => d.song_id))) : [];

          set({
            favoriteArtistIds,
            favoriteAlbumIds,
            historySongIds: Array.from(new Set([...historySongIds, ...get().historySongIds]))
          });
        } catch (e) {
          console.error("Failed to sync cloud library:", e);
        }
      },

      toggleLikeSong: (songId) => {
        const isLiked = get().likedSongIds.includes(songId);
        const targetSong = get().currentSong?.id === songId ? get().currentSong : get().queue.find((s) => s?.id === songId);

        // Optimistic UI update for both IDs and full song objects
        set((state) => {
          const newLikedIds = isLiked
            ? state.likedSongIds.filter((id) => id !== songId)
            : [...state.likedSongIds, songId];

          const newLikedSongs = isLiked
            ? state.likedSongs.filter((s) => s.id !== songId)
            : (targetSong ? [targetSong, ...state.likedSongs.filter((s) => s.id !== songId)] : state.likedSongs);

          return { likedSongIds: newLikedIds, likedSongs: newLikedSongs };
        });

        if (!isLiked && targetSong) {
          const songLang = LanguageEligibilityEngine.getInstance().detectSongLanguage(targetSong);
          get().recordLanguageInterest(songLang, 0.35);
        }

        // Smart Download Rules Hook for Favorites
        if (!isLiked) {
          import('@/lib/offline/SmartDownloadEngine').then(async ({ SmartDownloadEngine }) => {
            try {
              let songToDownload = targetSong;
              if (!songToDownload) {
                const { SongResolver } = await import('@/lib/discovery/SongResolver');
                const resolved = await SongResolver.resolveSongs([songId]);
                if (resolved.length > 0) songToDownload = resolved[0];
              }
              if (songToDownload) {
                await SmartDownloadEngine.getInstance().evaluateAndDownload(songToDownload, { trigger: 'FAVORITE_ADD' });
              }
            } catch (favErr) {
              console.warn('[SmartDownloadEngine] Error evaluating favorite download rule:', favErr);
            }
          });
        }

        // Delegate solely to authoritative AccountSyncEngine & UserBehaviorTracker
        import('@/context/useAuthStore').then(({ useAuthStore }) => {
          const activeUserId = useAuthStore.getState().user?.id || 'guest';

          import('@/lib/sync/AccountSyncEngine').then(({ AccountSyncEngine }) => {
            if (isLiked) {
              AccountSyncEngine.getInstance().unlikeSong(activeUserId, songId);
            } else {
              AccountSyncEngine.getInstance().likeSong(activeUserId, songId);
            }
          });

          import('@/lib/analytics/UserBehaviorTracker').then(({ UserBehaviorTracker }) => {
            UserBehaviorTracker.getInstance().trackEvent(activeUserId, {
              event_type: isLiked ? 'UNLIKE' : 'LIKE',
              song_id: songId,
              artist_id: targetSong?.artistId,
              genre: targetSong?.genre,
              language: (targetSong as any)?.language || (targetSong as any)?.languageId,
            });
          });
        });
      },
      setLikedSongIds: (songIds) => {
        set({ likedSongIds: songIds });
      },

      setLikedSongs: (songs) => {
        set({ likedSongs: songs });
      },

      toggleDownloadSong: (songId) => {
        const { queue, currentSong, downloadedSongIds } = get();
        const targetSong = (currentSong && currentSong.id === songId) ? currentSong : queue.find((s) => s && s.id === songId);

        const isCurrentlyDownloaded = downloadedSongIds.includes(songId);

        if (targetSong) {
          if (isCurrentlyDownloaded) {
            import('@/lib/downloadHelper').then(({ removeCachedSong }) => {
              removeCachedSong(targetSong);
            });
          } else {
            import('@/context/useDownloadStore').then(({ useDownloadStore }) => {
              const downloadStore = useDownloadStore.getState();
              if (!downloadStore.isOfflineStorageEnabled) {
                downloadStore.setSetupModalOpen(true);
                // Optionally we could store the pending song to queue it after setup, 
                // but for simplicity they can just tap download again after setup.
              } else {
                downloadStore.queueDownload(targetSong);
              }
            });
          }
        }

        set((state) => {
          const isDownloaded = state.downloadedSongIds.includes(songId);
          return {
            downloadedSongIds: isDownloaded
              ? state.downloadedSongIds.filter((id) => id !== songId)
              : [...state.downloadedSongIds, songId],
          };
        });
      },

      toggleFavoriteArtist: async (artistId) => {
        const isFav = get().favoriteArtistIds.includes(artistId);

        set((state) => {
          const newFavs = isFav
            ? state.favoriteArtistIds.filter((id) => id !== artistId)
            : [...state.favoriteArtistIds, artistId];
          return { favoriteArtistIds: newFavs };
        });

        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: session } = await supabase.auth.getSession();
          if (session?.session?.user) {
            if (isFav) {
              await supabase.from('user_favorites').delete()
                .eq('user_id', session.session.user.id)
                .eq('item_id', artistId)
                .eq('item_type', 'artist');
            } else {
              await supabase.from('user_favorites').upsert({
                user_id: session.session.user.id,
                item_id: artistId,
                item_type: 'artist'
              }, { onConflict: 'user_id,item_id,item_type' });
            }
          }
        } catch (e) {
          console.error("Failed to sync favorite artist:", e);
        }
      },

      toggleFavoriteAlbum: async (albumId) => {
        const isFav = get().favoriteAlbumIds.includes(albumId);

        set((state) => {
          const newFavs = isFav
            ? state.favoriteAlbumIds.filter((id) => id !== albumId)
            : [...state.favoriteAlbumIds, albumId];
          return { favoriteAlbumIds: newFavs };
        });

        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: session } = await supabase.auth.getSession();
          if (session?.session?.user) {
            if (isFav) {
              await supabase.from('user_favorites').delete()
                .eq('user_id', session.session.user.id)
                .eq('item_id', albumId)
                .eq('item_type', 'album');
            } else {
              await supabase.from('user_favorites').upsert({
                user_id: session.session.user.id,
                item_id: albumId,
                item_type: 'album'
              }, { onConflict: 'user_id,item_id,item_type' });
            }
          }
        } catch (e) {
          console.error("Failed to sync favorite album:", e);
        }
      },

      setCrossfadeSec: (sec) => set({ crossfadeSec: sec }),
      setGaplessEnabled: (enabled) => set({ isGaplessEnabled: enabled }),

      setActiveTab: (tab) => {
        set({ activeTab: tab });
        NavigationStack.getInstance().push({
          activeTab: tab,
          selectedAlbumId: get().selectedAlbumId,
          selectedArtistId: get().selectedArtistId,
          selectedPlaylistId: get().selectedPlaylistId,
          isPlayerExpanded: get().isPlayerExpanded,
        });
      },
      setSelectedArtistId: (id) => {
        set({ selectedArtistId: id, activeTab: 'artist' });
        NavigationStack.getInstance().push({
          activeTab: 'artist',
          selectedAlbumId: null,
          selectedArtistId: id,
          selectedPlaylistId: null,
          isPlayerExpanded: get().isPlayerExpanded,
        });
      },
      setSelectedAlbumId: (id) => {
        set({ selectedAlbumId: id, activeTab: 'album' });
        NavigationStack.getInstance().push({
          activeTab: 'album',
          selectedAlbumId: id,
          selectedArtistId: null,
          selectedPlaylistId: null,
          isPlayerExpanded: get().isPlayerExpanded,
        });
      },
      setSelectedPlaylistId: (id) => {
        set({ selectedPlaylistId: id, activeTab: 'playlist' });
        NavigationStack.getInstance().push({
          activeTab: 'playlist',
          selectedAlbumId: null,
          selectedArtistId: null,
          selectedPlaylistId: id,
          isPlayerExpanded: get().isPlayerExpanded,
        });
      },
      navigateFromPlayer: (destination) => {
        NavigationStack.getInstance().navigateFromPlayer(destination);
        set({
          activeTab: destination.tab,
          selectedAlbumId: destination.albumId || null,
          selectedArtistId: destination.artistId || null,
          selectedPlaylistId: destination.playlistId || null,
          isPlayerExpanded: false,
        });
      },
      setStreamingQuality: (quality) => set({ streamingQuality: quality }),
      setDownloadQuality: (quality) => set({ downloadQuality: quality }),
      setDataSaverEnabled: (enabled) => set({ isDataSaverEnabled: enabled }),
      setDeliveredQuality: (quality) => set({ deliveredQuality: quality }),

      togglePlayerExpanded: (open) => {
        const next = typeof open === 'boolean' ? open : !get().isPlayerExpanded;
        set({ isPlayerExpanded: next });
        NavigationStack.getInstance().push({
          activeTab: get().activeTab,
          selectedAlbumId: get().selectedAlbumId,
          selectedArtistId: get().selectedArtistId,
          selectedPlaylistId: get().selectedPlaylistId,
          isPlayerExpanded: next,
        });
      },
      setRenderer: (renderer) => set({ activeRenderer: renderer }),
      toggleLyrics: () => set((state) => ({ isLyricsOpen: !state.isLyricsOpen })),
      toggleQueue: () => set((state) => ({ isQueueOpen: !state.isQueueOpen })),
      toggleMiniPlayerFloating: () =>
        set((state) => ({ isMiniPlayerFloating: !state.isMiniPlayerFloating })),
      toggleAiDjModal: () =>
        set((state) => ({ isAiDjModalOpen: !state.isAiDjModalOpen })),
      toggleImporterModal: () => set((state) => ({ isImporterOpen: !state.isImporterOpen })),
      toggleBackupModal: () => set((state) => ({ isBackupOpen: !state.isBackupOpen })),
      toggleSettingsModal: () => set((state) => ({ isSettingsModalOpen: !state.isSettingsModalOpen })),
      toggleCastModal: () => set((state) => ({ isCastModalOpen: !state.isCastModalOpen })),
      toggleSleepTimerModal: () => set((state) => ({ isSleepTimerModalOpen: !state.isSleepTimerModalOpen })),
      toggleDeviceModal: () => set((state) => ({ isDeviceModalOpen: !state.isDeviceModalOpen })),
      setCreatePlaylistModalOpen: (open) => set({ createPlaylistModalOpen: open }),

      openContextMenu: (song) => set({ contextMenuSong: song }),
      closeContextMenu: () => set({ contextMenuSong: null }),

      importSongsFromUrl: (newSongs) => {
        const { queue } = get();
        const updatedQueue = [...newSongs, ...queue];
        set({
          queue: updatedQueue,
          currentSong: newSongs[0] || get().currentSong,
          isPlaying: true,
          activeTab: 'library',
        });
      },

      exportBackupJson: () => {
        const { likedSongIds, downloadedSongIds, historySongIds, streamingQuality } = get();
        const backupData = {
          app: 'RaagaX Music Engine',
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          likedSongIds,
          downloadedSongIds,
          historySongIds,
          streamingQuality,
        };
        return JSON.stringify(backupData, null, 2);
      },

      importBackupJson: (jsonStr) => {
        try {
          const data = JSON.parse(jsonStr);
          if (data && Array.isArray(data.likedSongIds)) {
            set({
              likedSongIds: data.likedSongIds,
              downloadedSongIds: data.downloadedSongIds || get().downloadedSongIds,
              streamingQuality: data.streamingQuality || get().streamingQuality,
            });
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      },

      setAiDjPrompt: (prompt) =>
        set((state) => ({
          aiDjState: { ...state.aiDjState, prompt, isActive: true },
        })),
      setAiDjMood: (mood) =>
        set((state) => ({
          aiDjState: { ...state.aiDjState, currentMood: mood, isActive: true },
        })),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveGenreFilter: (genre) => set({ activeGenreFilter: genre }),

      sleepTimerMode: null,
      setSleepTimer: (minutes, mode = 'duration') => {
        if (minutes === null) {
          set({ sleepTimerMinutes: null, sleepTimerEndsAt: null, sleepTimerMode: null });
        } else if (mode === 'end_of_song' || mode === 'end_of_queue') {
          set({ sleepTimerMinutes: -1, sleepTimerEndsAt: null, sleepTimerMode: mode });
        } else {
          const endsAt = Date.now() + minutes * 60 * 1000;
          set({ sleepTimerMinutes: minutes, sleepTimerEndsAt: endsAt, sleepTimerMode: 'duration' });
        }
      },
      extendSleepTimer: (minutes) => {
        const { sleepTimerEndsAt, sleepTimerMinutes } = get();
        const currentEnd = sleepTimerEndsAt && sleepTimerEndsAt > Date.now() ? sleepTimerEndsAt : Date.now();
        const newEnd = currentEnd + minutes * 60 * 1000;
        const addedMinutes = (sleepTimerMinutes && sleepTimerMinutes > 0 ? sleepTimerMinutes : 0) + minutes;
        set({ sleepTimerEndsAt: newEnd, sleepTimerMinutes: addedMinutes, sleepTimerMode: 'duration' });
      },
      cancelSleepTimer: () => {
        set({ sleepTimerMinutes: null, sleepTimerEndsAt: null, sleepTimerMode: null });
      },
    }),
    {
      name: 'raagax_player_prefs',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version === 0 || version === 1) {
          // Migration from legacy schema: ensure arrays and required defaults exist
          return {
            ...persistedState,
            likedSongIds: Array.isArray(persistedState.likedSongIds) ? persistedState.likedSongIds : [],
            downloadedSongIds: Array.isArray(persistedState.downloadedSongIds) ? persistedState.downloadedSongIds : [],
            historySongIds: Array.isArray(persistedState.historySongIds) ? persistedState.historySongIds : [],
            favoriteArtistIds: Array.isArray(persistedState.favoriteArtistIds) ? persistedState.favoriteArtistIds : [],
            favoriteAlbumIds: Array.isArray(persistedState.favoriteAlbumIds) ? persistedState.favoriteAlbumIds : [],
            streamingQuality: persistedState.streamingQuality || 'AUTO',
          };
        }
        return persistedState;
      },
      partialize: (state) => ({
        downloadedSongIds: state.downloadedSongIds,
        historySongIds: state.historySongIds,
        favoriteArtistIds: state.favoriteArtistIds,
        favoriteAlbumIds: state.favoriteAlbumIds,
        preferredLanguage: state.preferredLanguage,
        crossfadeSec: state.crossfadeSec,
        streamingQuality: state.streamingQuality,
        isAutoplayEnabled: state.isAutoplayEnabled,
      }),
    }
  )
);
