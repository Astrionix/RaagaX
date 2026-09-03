import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Song, RepeatMode, AIDJState, ActiveTab, Renderer } from '@/types/music';
import { AccountIsolationGuard } from '@/lib/auth/AccountIsolationGuard';

const safeLocalStorage = createJSONStorage(() => ({
  getItem: (name: string): string | null => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(name, value);
    } catch (e) {
      console.warn('[usePlayerStore] LocalStorage quota reached, pruning temporary cache keys...');
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && (
              key.startsWith('cache_') ||
              key.startsWith('cover_') ||
              key.startsWith('search_') ||
              key.startsWith('temp_') ||
              key.startsWith('telemetry_') ||
              key.startsWith('artist_') ||
              key.startsWith('album_') ||
              key === 'raagax_active_queue_snapshot'
            )) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => window.localStorage.removeItem(k));
          window.localStorage.setItem(name, value);
        }
      } catch {
        // Fallback swallow to prevent QuotaExceededError crashes
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(name);
      }
    } catch { }
  },
}));
import { PersonalizationEngine } from '@/lib/recommendation/PersonalizationEngine';
import { LocalDatabase } from '@/lib/localDatabase';
import { QueueManager } from '@/lib/queue/QueueManager';
import { LanguageEligibilityEngine } from '@/lib/language/LanguageEligibilityEngine';
import { InterruptionCoordinator } from '@/lib/playback/InterruptionCoordinator';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { RaagaXNativePlayer } from '@/lib/playback/native/RaagaXNativePlayer';
import { SongCoverEngine } from '@/lib/playback/SongCoverEngine';
import { JioSaavnMediaPipeline } from '@/lib/media/JioSaavnMediaPipeline';
import { SongUniquenessEngine } from '@/lib/music/SongUniquenessEngine';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { MediaSessionManager } from '@/lib/playback/MediaSessionManager';
import { JamClientManager } from '@/lib/jam/client/JamClientManager';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';

import { AudioQuality, AudioQualityState } from '@/lib/playback/types';
import { DownloadStorage } from '@/lib/offline/DownloadStorage';
import { NavigationStack } from '@/lib/navigation/NavigationStack';
import { ScrollManager } from '@/lib/navigation/ScrollManager';
import { isKidsOrNurseryTrack } from '@/lib/jioSaavnProvider';

export function isOfflineMode(): boolean {
  try {
    const store = usePlayerStore.getState();
    if (store.networkMode === 'offline' || store.networkMode === 'offline_forced') {
      return true;
    }
  } catch { }
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && navigator.onLine === false) {
    return true;
  }
  return false;
}

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  lastTrackId: string | null;
  lastPositionSec: number;
  checkpointPlaybackPosition: (posSec: number) => void;

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
  librarySongIds: string[]; // Apple Music-style: songs added to Library (independent of liked/downloaded)
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
  loudnessNormalizationEnabled: boolean;

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

  // Standalone Playback State
  deviceId: string;
  activeRenderer: Renderer;
  playbackStatus: 'playing' | 'paused' | 'buffering' | 'transitioning';
  isActiveDevice: boolean;
  setRemoteState: (state: Partial<PlayerState>) => void;
  setRenderer: (renderer: Renderer) => void;

  rightPanelMode: 'queue';
  setRightPanelMode: (mode: 'queue') => void;

  // Autoplay and Context
  isAutoplayEnabled: boolean;
  playbackContextData: import('@/types/music').PlaybackContext | null;
  playbackContext: import('@/lib/queue/types').PlaybackContext | null;
  albumPlaybackQueue: string[];
  toggleAutoplay: () => void;
  setPlaybackContext: (context: import('@/types/music').PlaybackContext | null) => void;
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

  playNext: (isNaturalAutoEnd?: boolean) => void;
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

  resetUserLibraryState: () => void;

  toggleLikeSong: (songId: string) => void;
  setLikedSongIds: (songIds: string[]) => void;
  setLikedSongs: (songs: Song[]) => void;
  addToLibrary: (songId: string, song?: Song) => void;
  removeFromLibrary: (songId: string) => void;
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
  setLoudnessNormalizationEnabled: (enabled: boolean) => void;

  togglePlayerExpanded: (open?: boolean | any) => void;
  toggleLyrics: () => void;
  toggleQueue: () => void;
  toggleMiniPlayerFloating: () => void;
  toggleAiDjModal: () => void;
  toggleImporterModal: () => void;
  toggleBackupModal: () => void;
  toggleSettingsModal: () => void;
  toggleCastModal: () => void;
  toggleSleepTimerModal: (open?: boolean | any) => void;
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
  lastPositionSec?: number;
}) {
  if (!state.currentSong) return;
  const currentPos = typeof state.currentTime === 'number' && Number.isFinite(state.currentTime) && state.currentTime >= 0
    ? Math.floor(state.currentTime)
    : (state.lastPositionSec || 0);

  const payload = {
    currentSong: state.currentSong,
    currentTime: currentPos, // Persist exact seek timestamp for seamless restore
    duration: state.duration || state.currentSong?.duration || 0,
    queue: state.queue || [],
    queueIndex: Math.max(0, state.queueIndex || 0),
    historySongIds: state.historySongIds || [],
    likedSongIds: state.likedSongIds || [],
    searchHistory: LocalDatabase.getInstance().getSearchHistory(),
    preferredLanguage: state.preferredLanguage,
    userId: AccountIsolationGuard.getInstance().getActiveUserId() || undefined,
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

const getInitialSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    const session = LocalDatabase.getInstance().getSyncPlaybackSession();
    if (session && session.timestamp && (Date.now() - session.timestamp < 7 * 24 * 60 * 60 * 1000)) {
      const activeUserId = AccountIsolationGuard.getInstance().getActiveUserId();
      // ACCOUNT ISOLATION: If session was recorded for a specific user, never restore it for a different user
      if (session.userId && activeUserId && session.userId !== activeUserId) {
        return null;
      }
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
    const pStore = usePlayerStore.getState();
    if (pStore?.downloadedSongIds?.includes(trackId)) return true;
  } catch { }
  try {
    const { useDownloadStore } = require('@/context/useDownloadStore');
    const dStore = useDownloadStore?.getState?.();
    if (dStore?.nativeDownloadedTracks?.[trackId]) return true;
    if (dStore?.tasks?.[trackId]?.status === 'COMPLETED') return true;
  } catch { }
  try {
    if (DownloadStorage.getInstance().isDownloadedSync(trackId)) return true;
  } catch { }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('download-storage');
      if (raw && raw.includes(`"${trackId}"`)) return true;
    }
  } catch { }
  return false;
};

const getNextQueueIndex = (queue: Song[], currentIndex: number, repeatMode: string): number => {
  if (!queue || queue.length === 0) return -1;
  const norm = (repeatMode || 'off').toUpperCase();
  if (norm === 'ONE' || norm === 'TRACK') return currentIndex;

  if (isOfflineMode()) {
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

  if (isOfflineMode()) {
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
      currentTime: (initialSession?.currentTime && initialSession.currentTime > 0) ? initialSession.currentTime : 0, // Restore exact position on cold launch
      duration: initialSession?.duration || initialSession?.currentSong?.duration || 0,
      volume: 0.8,
      isMuted: false,
      lastTrackId: initialSession?.currentSong?.id || null,
      lastPositionSec: (initialSession?.currentTime && initialSession.currentTime > 0) ? initialSession.currentTime : 0,
      checkpointPlaybackPosition: (posSec: number) => {
        if (typeof posSec === 'number' && Number.isFinite(posSec) && posSec >= 0) {
          set({ lastPositionSec: Math.floor(posSec) });
        }
      },

      queue: (initialSession?.queue && initialSession.queue.length > 0) ? initialSession.queue : (initialSession?.currentSong ? [initialSession.currentSong] : []),
      queueIndex: Math.max(0, initialSession?.queueIndex || 0),
      shuffleMode: 'OFF',
      repeatMode: 'off',
      isRefillingQueue: false,
      crossfadeSec: 0,
      isGaplessEnabled: true,
      playbackContext: null,

      likedSongIds: [],
      likedSongs: [],
      librarySongIds: [],
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
      loudnessNormalizationEnabled: false,
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

      deviceId: typeof window !== 'undefined' ? (localStorage.getItem('raagax_device_id') || 'local_device') : 'local_device',
      activeRenderer: 'audio',
      playbackStatus: 'paused',
      isActiveDevice: true,
      rightPanelMode: 'queue',

      setRemoteState: (state) => set(state),
      setRenderer: (renderer) => set({ activeRenderer: renderer }),

      calculateLiveTime: () => get().currentTime,

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
        // Sourced strictly from the most recent session if it's still valid/active (less than 7 days old)
        const isSessionValid = session && session.timestamp && (Date.now() - session.timestamp < 7 * 24 * 60 * 60 * 1000);
        if (isSessionValid && session && session.currentSong) {
          const candidateSong = session.currentSong;
          const rawQueue = (session.queue && session.queue.length > 0) ? session.queue : [session.currentSong];
          const cleanQueue = rawQueue.filter(s => s && !isKidsOrNurseryTrack(s));

          const isCandidateClean = candidateSong && !isKidsOrNurseryTrack(candidateSong);
          const activeSong = isCandidateClean ? candidateSong : (cleanQueue[0] || null);

          if (cleanQueue.length > 0 && activeSong) {
            let safeIndex = cleanQueue.findIndex(s => s.id === activeSong.id);
            if (safeIndex === -1) safeIndex = Math.min(session.queueIndex || 0, Math.max(0, cleanQueue.length - 1));

            const totalDuration = activeSong.duration || session.duration || 0;

            manager.replaceQueue(cleanQueue, safeIndex);

            const savedPos = (session as any).position || (session as any).currentTime || 0;

            set({
              isPlaying: false, // Strict Rule: ALWAYS PAUSED ON COLD BOOT (Zero Autoplay)
              playbackIntent: 'PAUSED',
              trackSource: 'SESSION_RESTORE',
              currentSong: activeSong,
              currentTime: savedPos, // Restore exact saved timestamp
              duration: totalDuration,
              queue: cleanQueue,
              queueIndex: safeIndex,
            });

            await PlaybackService.getInstance().prepareTrack(activeSong, savedPos);
            await PlaybackService.getInstance().loadQueueContext(cleanQueue, safeIndex, false, savedPos * 1000);
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

        PersonalizationEngine.getInstance().trackEngagement(
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
        const resolvedCover = JioSaavnMediaPipeline.getInstance().resolveSongArtwork({
          songCoverUrl: song.songCoverUrl,
          albumCoverUrl: song.albumCoverUrl,
          coverUrl: song.coverUrl,
        }) || (JioSaavnMediaPipeline.getInstance().isDirectSongOrAlbumArtwork(song.coverUrl) ? SongCoverEngine.getInstance().formatRawCoverUrl(song.coverUrl) : '/app-icon.png');

        const formattedTrack: Song = {
          ...song,
          coverUrl: resolvedCover,
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
        }).catch(() => { });
        MediaSessionManager.getInstance().updateSongMetadata(formattedTrack);
        MediaSessionManager.getInstance().setPlaybackState('playing');
        persistSessionHelper(get());
      },

      switchTrack: async (track: Song, index: number, autoPlay: boolean = true) => {
        if (!track) return false;

        // RaagaX Connect: If in Remote Controller mode in browser, dispatch PLAY_SONG to the speaker
        if (typeof window !== 'undefined') {
          try {
            const { ConnectClientManager } = await import('@/lib/connect/ConnectClientManager');
            const { useConnectStore } = await import('@/context/useConnectStore');
            const connectClient = ConnectClientManager.getInstance();
            if (connectClient.isRemoteMode()) {
              const now = Date.now();
              if ((globalThis as any).__lastRemoteTrackId === track.id && now - ((globalThis as any).__lastRemoteTrackTime || 0) < 600) {
                return true;
              }
              (globalThis as any).__lastRemoteTrackId = track.id;
              (globalThis as any).__lastRemoteTrackTime = now;

              console.log(`[CONNECT_CONTROLLER_SWITCH_TRACK] Forwarding "${track.title}" to target playback device`);
              const resolvedCover = JioSaavnMediaPipeline.getInstance().resolveSongArtwork({
                songCoverUrl: track.songCoverUrl,
                albumCoverUrl: track.albumCoverUrl,
                coverUrl: track.coverUrl,
              }) || (JioSaavnMediaPipeline.getInstance().isDirectSongOrAlbumArtwork(track.coverUrl) ? SongCoverEngine.getInstance().formatRawCoverUrl(track.coverUrl) : '/app-icon.png');

              const formattedTrack = SongFormatter.formatSong({
                ...track,
                coverUrl: resolvedCover,
              });

              // Pre-resolve direct stream URL if possible to eliminate speaker fetch latency
              let directAudioUrl = formattedTrack.audioUrl;
              if (!directAudioUrl || directAudioUrl.includes('pixabay.com')) {
                try {
                  const { PlaybackSourceResolver } = await import('@/lib/playbackSourceResolver');
                  const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(formattedTrack);
                  if (source?.url) {
                    directAudioUrl = source.url;
                  }
                } catch {}
              }

              const trackWithUrl: Song = {
                ...formattedTrack,
                audioUrl: directAudioUrl || formattedTrack.audioUrl,
              };

              const currentQueue = get().queue.length > 0 ? get().queue : [trackWithUrl];

              // Optimistic UI update — mirror what the speaker will reflect
              useConnectStore.setState((prev) => ({
                remoteSession: prev.remoteSession ? {
                  ...prev.remoteSession,
                  currentTrackId: trackWithUrl.id,
                  currentSong: trackWithUrl,
                  queue: currentQueue,
                  queueIndex: index,
                  isPlaying: autoPlay,
                  positionMs: 0,
                  anchorPositionMs: 0,
                  anchorTimeMs: Date.now(),
                } : null,
              }));

              set({
                currentSong: trackWithUrl,
                queueIndex: index,
                isPlaying: autoPlay,
                playbackIntent: autoPlay ? 'PLAYING' : 'PAUSED',
                currentTime: 0,
                duration: trackWithUrl.duration || 0,
              });

              // Lock remote updates to this track for 1200ms to eliminate track bounce/flicker
              connectClient.setOptimisticTrackLock(trackWithUrl.id, 1200);

              // PLAY_SONG: instructs speaker to load and play this specific song immediately
              await connectClient.sendCommand('PLAY_SONG', {
                song: trackWithUrl,
                queue: currentQueue,
                queueIndex: index,
                isPlaying: autoPlay,
                positionMs: 0,
              });
              return true;
            }
          } catch { }
        }

        const oldSong = get().currentSong;
        const oldIndex = get().queueIndex;

        // 1. Atomically increment playbackRequestId
        const requestId = ++globalPlaybackRequestId;
        PlaybackService.getInstance().setPlaybackRequestId(requestId);
        PlaybackService.getInstance().stopAllAudio();

        const resolvedCover = JioSaavnMediaPipeline.getInstance().resolveSongArtwork({
          songCoverUrl: track.songCoverUrl,
          albumCoverUrl: track.albumCoverUrl,
          coverUrl: track.coverUrl,
        }) || (JioSaavnMediaPipeline.getInstance().isDirectSongOrAlbumArtwork(track.coverUrl) ? SongCoverEngine.getInstance().formatRawCoverUrl(track.coverUrl) : '/app-icon.png');

        const formattedTrack: Song = SongFormatter.formatSong({
          ...track,
          coverUrl: resolvedCover,
        });

        console.log(`[PlaybackTransition] source="${formattedTrack.title}" oldTrackId="${oldSong?.id}" newTrackId="${formattedTrack.id}" oldQueueIndex=${oldIndex} newQueueIndex=${index} queueLength=${get().queue.length} transitionId=${requestId} playbackGeneration=${requestId}`);

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
        }).catch(() => { });

        // Sync QueueManager position
        QueueManager.getInstance().skipTo(index);

        // Update Recently Played history (capped at 100 songs)
        const existingHistory = get().historySongIds.filter((id) => id !== formattedTrack.id);
        const updatedHistory = [formattedTrack.id, ...existingHistory].slice(0, 100);
        set({ historySongIds: updatedHistory });

        // Persist durable session immediately
        persistSessionHelper(get());

        // Update MediaSession (Android lockscreen, Notification shade, Bluetooth metadata)
        MediaSessionManager.getInstance().updateSongMetadata(formattedTrack);
        MediaSessionManager.getInstance().setPlaybackState(autoPlay ? 'playing' : 'paused');
        MediaSessionManager.getInstance().setPositionState({
          duration: formattedTrack.duration || 0,
          position: 0,
        });

        // 3. Load the NEW track's audio URL into audio engine
        const loaded = await PlaybackService.getInstance().loadAudioSource(track, requestId, autoPlay);

        // 4. Stale-request check: verify the requestId is still current
        if (requestId !== globalPlaybackRequestId || !loaded) {
          console.log(`[SWITCH_TRACK] Stale or failed request #${requestId} for "${track.title}" (current #${globalPlaybackRequestId}, loaded=${loaded})`);
          if (!loaded && requestId === globalPlaybackRequestId) {
            set({ isPlaying: false, playbackIntent: 'PAUSED' });
            MediaSessionManager.getInstance().setPlaybackState('paused');
          }
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
        }).catch(() => { });

        // ── RULE 21: GLOBAL DEBUG ASSERTION ──────────────────────────────────────
        const currentStoreTrack = get().currentSong;
        if (currentStoreTrack && currentStoreTrack.id !== track.id) {
          console.error('[ANDROID_PLAYBACK_DESYNC]', {
            source: track.audioUrl || 'NATIVE_EXOPLAYER',
            currentTrack: currentStoreTrack.id,
            audioTrack: track.id,
            mediaSessionTrack: track.title,
            queueIndex: index,
            queueLength: get().queue.length,
            transitionId: requestId,
          });
        }



        // Proactive queue refilling for Radio and continuous playback streams
        get().autoRefillQueue().catch(() => { });

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

        // Separate Source Playlist / Discovery Context from Song Identity
        const sourcePlaylistName = context?.name || context?.title || (context?.type === 'PLAYLIST' ? context?.id : undefined);

        const resolvedCover = JioSaavnMediaPipeline.getInstance().resolveSongArtwork({
          songCoverUrl: song.songCoverUrl,
          albumCoverUrl: song.albumCoverUrl,
          coverUrl: song.coverUrl,
        }) || (JioSaavnMediaPipeline.getInstance().isDirectSongOrAlbumArtwork(song.coverUrl) ? SongCoverEngine.getInstance().formatRawCoverUrl(song.coverUrl) : '/app-icon.png');

        // Upgrade coverUrl immediately to 500x500 HD & clean display text
        const activePlaySong: Song = SongFormatter.formatSong({
          ...song,
          sourcePlaylistTitle: sourcePlaylistName,
          sourceContext: context?.type || 'USER_CLICK',
          coverUrl: resolvedCover,
        });

        // If currently inside a shared Jam Party, route track change/addition through Jam server
        try {
          const jamManager = JamClientManager.getInstance();
          const jamSession = jamManager.getActiveSession();
          if (jamSession) {
            if (newQueue && Array.isArray(newQueue) && newQueue.length > 1) {
              const startIdx = newQueue.findIndex((s) => s.id === activePlaySong.id);
              const effectiveIdx = startIdx >= 0 ? startIdx : 0;
              jamManager.sendAddTracks(newQueue, true, effectiveIdx);
              get().setToastMessage(`Playing "${activePlaySong.title}" & ${newQueue.length - 1} upcoming tracks in Jam`);
            } else {
              jamManager.sendAddTrack(activePlaySong, true);
              get().setToastMessage(`Playing "${activePlaySong.title}" in Jam Party`);
            }
            return;
          }
        } catch { }

        // RaagaX Connect: If acting as Remote Controller, forward song selection to authoritative Speaker
        try {
          const { ConnectClientManager } = require('@/lib/connect/ConnectClientManager');
          const connectClient = ConnectClientManager.getInstance();
          if (connectClient.isRemoteMode()) {
            console.log(`[CONNECT_CONTROLLER_PLAY_SONG] Routing "${activePlaySong.title}" to authoritative Speaker`);
            const dedupedQueue = newQueue && newQueue.length > 0 ? newQueue : [activePlaySong];
            const startIdx = dedupedQueue.findIndex((s: Song) => s.id === activePlaySong.id);
            const effectiveIdx = startIdx >= 0 ? startIdx : 0;

            set({ queue: dedupedQueue, queueIndex: effectiveIdx, currentSong: activePlaySong });
            await get().switchTrack(activePlaySong, effectiveIdx, true);
            return;
          }
        } catch { }

        // NOTE: navigator.onLine is intentionally NOT used here.
        // On Android/Capacitor WebView it can return false even with a live network
        // connection, which would block all liked/library songs from playing.
        // Offline enforcement is handled downstream by PlaybackService + PlaybackSourceResolver
        // which use the explicit store.networkMode ('offline' | 'offline_forced') instead.

        JioSaavnMediaPipeline.getInstance().inspectPipeline(activePlaySong, context);
        get().logCurrentTelemetry('skip');

        // 3-Tier Language System: Session Language Resolution
        const songLang = LanguageEligibilityEngine.getInstance().detectSongLanguage(activePlaySong);
        get().recordLanguageInterest(songLang, 0.20);

        // Check if newQueue was passed (e.g. from an album or playlist)
        const manager = QueueManager.getInstance();
        let syncedQueue = get().queue;
        let targetIndex = 0;

        let filteredNewQueue = newQueue;
        if (isOfflineMode()) {
          try {
            const { useDownloadStore } = require('@/context/useDownloadStore');
            const downloadStore = useDownloadStore?.getState?.();
            const downloadedSongIds = get().downloadedSongIds || [];
            const originalQueue = newQueue && newQueue.length > 0 ? newQueue : [activePlaySong];
            filteredNewQueue = originalQueue.filter((s: Song) => {
              return s && (s.id === activePlaySong.id || downloadedSongIds.includes(s.id) || !!downloadStore?.nativeDownloadedTracks?.[s.id]);
            });
          } catch { }
        }

        if (filteredNewQueue && filteredNewQueue.length > 0) {
          // ── FULL-COLLECTION QUEUE FIX ──────────────────────────────────────────
          // IMPORTANT: Pass the ENTIRE collection to QueueManager with the correct
          // startIndex. Do NOT slice from the tapped song — that destroys all tracks
          // before it and makes Previous impossible.
          //
          // Example: Liked Songs [A,B,C,D,E], user taps C (index=2)
          //   queue  = [A,B,C,D,E]  ← full collection preserved
          //   index  = 2            ← QueueManager starts at C
          //   NEXT   = D, E        ← works
          //   PREV   = B, A        ← works
          // ──────────────────────────────────────────────────────────────────────

          // 1. Deduplicate by stable track ID while preserving order
          const seen = new Set<string>();
          const dedupedQueue = filteredNewQueue.filter((s: Song) => {
            if (!s || !s.id) return false;
            if (seen.has(s.id)) return false;
            seen.add(s.id);
            return true;
          });

          // 2. Find the tapped song's position in the deduplicated full collection
          const index = dedupedQueue.findIndex((s: Song) => s.id === activePlaySong.id);
          const startIndex = index !== -1 ? index : 0;

          // 3. Load the COMPLETE collection starting at the correct position
          manager.replaceQueue(dedupedQueue, startIndex, (context?.type as any) || 'PLAYLIST', context);
          const snapshot = manager.getSnapshot();
          syncedQueue = snapshot.items.map((i: any) => i.song);

          // 4. targetIndex must be the actual position in the full queue, not always 0
          targetIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : startIndex;
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

        await get().switchTrack(activePlaySong, targetIndex, true);

        if (RaagaXNativePlayer.isNative() && syncedQueue && syncedQueue.length > 0) {
          PlaybackService.getInstance().loadQueueContext(syncedQueue, targetIndex, true, 0, get().playbackRequestId);
        }
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

        if (RaagaXNativePlayer.isNative() && syncedQueue && syncedQueue.length > 0) {
          PlaybackService.getInstance().loadQueueContext(syncedQueue, 0, true, 0, get().playbackRequestId);
        }
      },

      togglePlayPause: async () => {
        // 0. RaagaX Connect: If in Remote Controller mode in browser, dispatch command to the playback device
        if (typeof window !== 'undefined') {
          try {
            const { ConnectClientManager } = await import('@/lib/connect/ConnectClientManager');
            const connectClient = ConnectClientManager.getInstance();
            if (connectClient.isRemoteMode()) {
              const isPlayingNow = get().isPlaying;
              if (isPlayingNow) {
                set({ isPlaying: false, playbackIntent: 'PAUSED' });
                await connectClient.sendCommand('PAUSE');
              } else {
                set({ isPlaying: true, playbackIntent: 'PLAYING' });
                await connectClient.sendCommand('RESUME');
              }
              return;
            }
          } catch { }
        }

        // 1. Single Source of Truth: derive true playing state directly from store or active engine
        let currentLivePlaying = get().isPlaying;
        if (!RaagaXNativePlayer.isNative()) {
          const servicePlaying = PlaybackService.getInstance().getLivePlayingState();
          if (servicePlaying) {
            currentLivePlaying = true;
          }
        }

        // 2. If in Jam, dispatch authoritative Jam play/pause command
        try {
          const jamManager = JamClientManager.getInstance();
          const jamSession = jamManager.getActiveSession();
          if (jamSession) {
            if (currentLivePlaying) {
              set({ isPlaying: false, playbackIntent: 'PAUSED' });
              PlaybackService.getInstance().pause();
              await jamManager.sendPause();
            } else {
              set({ isPlaying: true, playbackIntent: 'PLAYING' });
              const currentPosMs = Math.round((get().currentTime || 0) * 1000);
              await jamManager.sendPlay(currentPosMs > 0 ? currentPosMs : undefined);
            }
            return;
          }
        } catch { }

        const isNowPlaying = !currentLivePlaying;

        if (!isNowPlaying) {
          InterruptionCoordinator.getInstance().reportUserPause();
        } else {
          InterruptionCoordinator.getInstance().clearInterruption();
        }
        set({ isPlaying: isNowPlaying, playbackIntent: isNowPlaying ? 'PLAYING' : 'PAUSED' });
        persistSessionHelper({ ...get() });

        if (RaagaXNativePlayer.isNative()) {
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
      },
      setIsPlaying: async (playing, fromRemote = false) => {
        if (!playing && !fromRemote) {
          InterruptionCoordinator.getInstance().reportUserPause();
        } else if (playing) {
          InterruptionCoordinator.getInstance().clearInterruption();
        }
        set({ isPlaying: playing, playbackIntent: playing ? 'PLAYING' : 'PAUSED' });
        persistSessionHelper({ ...get() });
        MediaSessionManager.getInstance().setPlaybackState(playing ? 'playing' : 'paused');

        if (!fromRemote) {
          try {
            const jamManager = JamClientManager.getInstance();
            const jamSession = jamManager.getActiveSession();
            if (jamSession && (jamManager.isHost() || jamSession.permissions?.canControlPlayback)) {
              if (playing && jamSession.state !== 'PLAYING') {
                jamManager.sendPlay(Math.round((get().currentTime || 0) * 1000)).catch(() => { });
              } else if (!playing && jamSession.state === 'PLAYING') {
                jamManager.sendPause().catch(() => { });
              }
            }
          } catch { }

          if (RaagaXNativePlayer.isNative()) {
            if (!playing) {
              await RaagaXNativePlayer.pause();
            } else {
              await RaagaXNativePlayer.resume();
            }
          } else {
            if (!playing) {
              PlaybackService.getInstance().pause();
            } else {
              PlaybackService.getInstance().play();
            }
          }
        }
      },
      setCurrentTime: (time, fromRemote = false) => {
        if (typeof time !== 'number' || !Number.isFinite(time) || isNaN(time) || time < 0) return;

        set({ currentTime: time });

        const state = get();
        if (state.currentSong) {
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
        persistSessionHelper(get());
      },
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

      playNext: async (isNaturalAutoEnd: boolean = false) => {
        // If in Jam: authorize who may advance the queue.
        // - Host: always authorized for both user-gesture NEXT and auto-next (track ended naturally).
        // - Participant with canSkip: authorized ONLY for user-gesture NEXT (not auto-next).
        //   If auto-next on a non-host participant, we MUST wait for the host's authoritative
        //   TRACK_CHANGED broadcast — otherwise both host and participant fire SKIP_NEXT simultaneously.
        // This is the AUTO_NEXT SINGLE OWNER guarantee (Phase 6).
        // RaagaX Connect: If in Remote Controller mode in browser, dispatch target track with pre-resolved audioUrl
        if (typeof window !== 'undefined') {
          try {
            const { ConnectClientManager } = await import('@/lib/connect/ConnectClientManager');
            const connectClient = ConnectClientManager.getInstance();
            if (connectClient.isRemoteMode()) {
              const { queue, queueIndex, repeatMode } = get();
              const nextIndex = getNextQueueIndex(queue, queueIndex, repeatMode);
              if (nextIndex >= 0 && nextIndex < queue.length) {
                const nextTrack = queue[nextIndex];
                await get().switchTrack(nextTrack, nextIndex, true);
              }
              return;
            }
          } catch { }
        }

        try {
          const jamManager = JamClientManager.getInstance();
          const jamSession = jamManager.getActiveSession();
          if (jamSession) {
            if (jamManager.isHost()) {
              // Host always authoritative — send SKIP_NEXT for both manual and auto-next
              await jamManager.sendSkipNext();
            } else if (jamSession.permissions?.canSkip && !isNaturalAutoEnd) {
              // canSkip participant: only for explicit user gesture, not for audio ended event
              await jamManager.sendSkipNext();
            } else {
              // Non-host participant in auto-next: wait for server TRACK_CHANGED
              const reason = isNaturalAutoEnd ? 'AUTO_NEXT_HOST_ONLY' : 'INSUFFICIENT_PERMISSION';
              console.log(`[playNext] In Jam — skipped sendSkipNext: reason=${reason} isHost=${jamManager.isHost()} canSkip=${jamSession.permissions?.canSkip} isNaturalAutoEnd=${isNaturalAutoEnd}`);
            }
            return;
          }
        } catch { }

        const { duration, currentTime, isPlaying, playbackIntent } = get();
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

        // Preserve playback intent:
        // When track ends naturally (isNaturalAutoEnd === true), ALWAYS play the next track.
        // For manual next: if playing, keep playing; if paused, remain paused.
        const shouldPlay = isNaturalAutoEnd ? true : (isPlaying || playbackIntent === 'PLAYING');

        const nextIndex = getNextQueueIndex(queue, queueIndex, repeatMode);
        if (nextIndex >= 0 && nextIndex < queue.length) {
          const nextTrack = queue[nextIndex];
          const oldTrackId = get().currentSong?.id || '';

          console.log(`[NEXT_QUEUE]\noldTrackId=${oldTrackId}\nnewTrackId=${nextTrack.id}\noldQueueIndex=${queueIndex}\nnewQueueIndex=${nextIndex}`);
          console.log(`[NEXT_PLAY]\ntrackId=${nextTrack.id}\nisPlaying=${shouldPlay}`);

          await get().switchTrack(nextTrack, nextIndex, shouldPlay);
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
        const { queue, queueIndex, currentTime, currentSong, repeatMode, isPlaying, playbackIntent } = get();

        // RaagaX Connect: If in Remote Controller mode in browser
        if (typeof window !== 'undefined') {
          try {
            const { ConnectClientManager } = await import('@/lib/connect/ConnectClientManager');
            const connectClient = ConnectClientManager.getInstance();
            if (connectClient.isRemoteMode()) {
              if (currentTime > 3) {
                await connectClient.sendCommand('SEEK', { positionMs: 0 });
              } else {
                const prevIndex = getPreviousQueueIndex(queue, queueIndex, repeatMode);
                if (prevIndex >= 0 && prevIndex < queue.length) {
                  const prevTrack = queue[prevIndex];
                  await get().switchTrack(prevTrack, prevIndex, true);
                }
              }
              return;
            }
          } catch { }
        }

        // If in Jam: host or participants with canSkip permission are authorized to issue SKIP_PREV.
        try {
          const jamManager = JamClientManager.getInstance();
          const jamSession = jamManager.getActiveSession();
          if (jamSession) {
            if (jamManager.isHost() || jamSession.permissions?.canSkip) {
              if (currentTime > 3) {
                await jamManager.sendSeek(0);
              } else {
                await jamManager.sendSkipPrev();
              }
            } else {
              console.log('[playPrev] In Jam as guest without skip permission — waiting for authoritative TRACK_CHANGED from server.');
            }
            return;
          }
        } catch { }

        // If track played more than 3 seconds, restart current track at 0:00 and keep current playing state
        if (currentTime > 3) {
          console.log(`[RESTART] ${currentSong?.id || 'unknown'} (pos: ${currentTime.toFixed(1)}s > 3s)`);
          get().setCurrentTime(0, true);
          get().setSeekTarget(0);
          PlaybackService.getInstance().seek(0);
          if (isPlaying || playbackIntent === 'PLAYING') {
            PlaybackService.getInstance().play();
          }
          return;
        }

        get().logCurrentTelemetry('skip');

        if (queue.length === 0) return;

        const shouldPlay = isPlaying || playbackIntent === 'PLAYING';
        const prevIndex = getPreviousQueueIndex(queue, queueIndex, repeatMode);
        if (prevIndex >= 0 && prevIndex < queue.length) {
          const prevTrack = queue[prevIndex];
          console.log(`[PREVIOUS] ${queueIndex} → ${prevIndex} (Track: "${prevTrack.title}")`);
          await get().switchTrack(prevTrack, prevIndex, shouldPlay);
        } else {
          // At beginning of queue and no previous: restart at 0:00
          console.log(`[RESTART] ${get().currentSong?.id || 'unknown'} (beginning of queue)`);
          get().setCurrentTime(0, true);
          get().setSeekTarget(0);
          PlaybackService.getInstance().seek(0);
          if (shouldPlay) {
            PlaybackService.getInstance().play();
          }
        }
      },

      toggleShuffle: async () => {
        if (typeof window !== 'undefined') {
          try {
            const { ConnectClientManager } = await import('@/lib/connect/ConnectClientManager');
            const connectClient = ConnectClientManager.getInstance();
            if (connectClient.isRemoteMode()) {
              const curShuffle = get().shuffleMode !== 'OFF';
              const nextShuffle = !curShuffle;
              set({ shuffleMode: nextShuffle ? 'STANDARD' : 'OFF' });
              await connectClient.sendCommand('SET_SHUFFLE', { shuffle: nextShuffle });
              return;
            }
          } catch { }
        }

        const manager = QueueManager.getInstance();
        manager.toggleShuffle();
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

        PlaybackService.getInstance().loadQueueContext(syncedQueue, syncedIndex);
      },
      setRepeatMode: async (mode) => {
        const raw = (mode || 'OFF').toUpperCase();
        const normalized: 'OFF' | 'ALL' | 'ONE' = (raw === 'ONE' || raw === 'TRACK') ? 'ONE' : (raw === 'ALL' || raw === 'CONTEXT') ? 'ALL' : 'OFF';
        console.log(`[REPEAT] ${normalized}`);

        if (typeof window !== 'undefined') {
          try {
            const { ConnectClientManager } = await import('@/lib/connect/ConnectClientManager');
            const connectClient = ConnectClientManager.getInstance();
            if (connectClient.isRemoteMode()) {
              set({ repeatMode: normalized as any });
              await connectClient.sendCommand('SET_REPEAT', { repeat: normalized });
              return;
            }
          } catch { }
        }

        QueueManager.getInstance().setRepeatMode(normalized as any);
        set({ repeatMode: normalized as any });
        persistSessionHelper(get());

        if (RaagaXNativePlayer.isNative()) {
          RaagaXNativePlayer.setRepeatMode(normalized);
        }

      },
      cycleRepeatMode: () => {
        const modes: Array<'OFF' | 'ALL' | 'ONE'> = ['OFF', 'ALL', 'ONE'];
        const cur = (get().repeatMode || 'OFF').toUpperCase();
        const normalized = (cur === 'ONE' || cur === 'TRACK') ? 'ONE' : (cur === 'ALL' || cur === 'CONTEXT') ? 'ALL' : 'OFF';
        const nextIdx = (modes.indexOf(normalized as any) + 1) % modes.length;
        get().setRepeatMode(modes[nextIdx]);
      },

      addToQueue: async (song) => {
        if (typeof window !== 'undefined') {
          try {
            const { ConnectClientManager } = await import('@/lib/connect/ConnectClientManager');
            const connectClient = ConnectClientManager.getInstance();
            if (connectClient.isRemoteMode()) {
              const curQ = get().queue || [];
              set({ queue: [...curQ, song] });
              await connectClient.sendCommand('ADD_TO_QUEUE', { song });
              return;
            }
          } catch { }
        }

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
        get().addToQueue(song);
      },
      removeFromQueue: async (songId) => {
        if (typeof window !== 'undefined') {
          try {
            const { ConnectClientManager } = await import('@/lib/connect/ConnectClientManager');
            const connectClient = ConnectClientManager.getInstance();
            if (connectClient.isRemoteMode()) {
              const curQ = (get().queue || []).filter((s) => s.id !== songId);
              set({ queue: curQ });
              await connectClient.sendCommand('REMOVE_FROM_QUEUE', { trackId: songId });
              return;
            }
          } catch { }
        }

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
      reorderQueue: async (newQueue) => {
        if (typeof window !== 'undefined') {
          try {
            const { ConnectClientManager } = await import('@/lib/connect/ConnectClientManager');
            const connectClient = ConnectClientManager.getInstance();
            if (connectClient.isRemoteMode()) {
              set({ queue: newQueue });
              await connectClient.sendCommand('REORDER_QUEUE', { queue: newQueue, queueIndex: get().queueIndex });
              return;
            }
          } catch { }
        }

        const manager = QueueManager.getInstance();
        manager.replaceQueue(newQueue, get().queueIndex, 'USER');
        set({ queue: newQueue });
        PlaybackService.getInstance().loadQueueContext(newQueue, get().queueIndex);
      },
      clearQueue: async () => {
        const { queue, queueIndex } = get();
        // Keep active song and past history, remove only upcoming tracks
        const activeSong = queue[queueIndex];
        const trimmedQueue = activeSong ? [activeSong] : [];

        if (typeof window !== 'undefined') {
          try {
            const { ConnectClientManager } = await import('@/lib/connect/ConnectClientManager');
            const connectClient = ConnectClientManager.getInstance();
            if (connectClient.isRemoteMode()) {
              set({ queue: trimmedQueue, queueIndex: 0 });
              return;
            }
          } catch { }
        }
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
        // Autoplay refill handled in AudioPlayerController / recommendation engine
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

          // Favorite artists, albums & history are managed in local device storage
        } catch (e) {
          console.error("Failed to sync cloud library:", e);
        }
      },

      toggleLikeSong: (songId) => {
        const isLiked = get().likedSongIds.includes(songId);
        const targetSong = get().currentSong?.id === songId ? get().currentSong : get().queue.find((s) => s?.id === songId);

        // Optimistic UI update for both IDs and full song objects (prepend to keep newest first)
        set((state) => {
          const newLikedIds = isLiked
            ? state.likedSongIds.filter((id) => id !== songId)
            : [songId, ...state.likedSongIds];

          const newLikedSongs = isLiked
            ? state.likedSongs.filter((s) => s.id !== songId)
            : (targetSong ? [targetSong, ...state.likedSongs.filter((s) => s.id !== songId)] : state.likedSongs);

          // Apple Music behavior: liking auto-adds to Library; unliking does NOT remove from library
          const newLibraryIds = !isLiked && !state.librarySongIds.includes(songId)
            ? [songId, ...state.librarySongIds]
            : state.librarySongIds;

          return { likedSongIds: newLikedIds, likedSongs: newLikedSongs, librarySongIds: newLibraryIds };
        });

        // Background metadata resolution for newly liked songs
        if (!isLiked) {
          import('@/lib/discovery/SongResolver').then(async ({ SongResolver }) => {
            try {
              const resolved = await SongResolver.resolveSongs([songId]);
              if (resolved.length > 0) {
                set((state) => {
                  if (state.likedSongIds.includes(songId) && !state.likedSongs.some(s => s.id === songId)) {
                    return { likedSongs: [resolved[0], ...state.likedSongs] };
                  }
                  return {};
                });
              }
            } catch (err) {
              console.warn('[usePlayerStore] Background like resolution failed:', err);
            }
          }).catch(() => { });
        }

        if (!isLiked && targetSong) {
          const songLang = LanguageEligibilityEngine.getInstance().detectSongLanguage(targetSong);
          get().recordLanguageInterest(songLang, 0.35);
        }

        // Automatic Download for Liked Songs (Setting: autoDownloadLikedSongs)
        if (!isLiked) {
          import('@/context/useDownloadStore').then(async ({ useDownloadStore }) => {
            try {
              const downloadState = useDownloadStore.getState();
              const isAutoDownloadOn = Boolean(
                downloadState.offlineSettings.autoDownloadLikedSongs ||
                downloadState.offlineSettings.autoDownloadFavorites
              );

              if (!isAutoDownloadOn) return;

              // Duplicate Protection using songId / trackId
              const downloadedSongIds = get().downloadedSongIds || [];
              const nativeTracks = downloadState.nativeDownloadedTracks || {};
              const tasks = downloadState.tasks || {};

              const isAlreadyDownloaded = downloadedSongIds.includes(songId) || Boolean(nativeTracks[songId]);
              const currentTask = tasks[songId];
              const isAlreadyInProgress = currentTask && ['QUEUED', 'DOWNLOADING', 'VERIFYING', 'COMPLETED'].includes(currentTask.status);

              if (isAlreadyDownloaded || isAlreadyInProgress) {
                return; // Duplicate protection: do nothing
              }

              // Resolve complete Song metadata
              let songToDownload = targetSong;
              if (!songToDownload) {
                const inLiked = get().likedSongs.find((s) => s.id === songId);
                if (inLiked) songToDownload = inLiked;
              }
              if (!songToDownload) {
                const { SongResolver } = await import('@/lib/discovery/SongResolver');
                const resolved = await SongResolver.resolveSongs([songId]);
                if (resolved.length > 0) songToDownload = resolved[0];
              }

              if (songToDownload) {
                console.log('[AutoDownloadLikedSongs] Enqueueing automatic download for liked track:', songId, songToDownload.title);
                await downloadState.saveForOffline(songToDownload);
              }
            } catch (err) {
              console.warn('[AutoDownloadLikedSongs] Failed to evaluate auto-download for', songId, err);
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

      resetUserLibraryState: () => {
        set({
          likedSongIds: [],
          likedSongs: [],
          librarySongIds: [],
          favoriteArtistIds: [],
          favoriteAlbumIds: [],
          cloudDownloadedSongIds: [],
          cloudDownloadRecords: [],
          historySongIds: [],
          queue: [],
          currentSong: null,
          playbackContext: null,
          trackSource: null,
          isPlaying: false,
          playbackIntent: 'IDLE',
          currentTime: 0,
          duration: 0,
        });
      },

      setLikedSongIds: (songIds) => {
        set({ likedSongIds: songIds });
      },

      setLikedSongs: (songs) => {
        set({ likedSongs: songs });
      },

      addToLibrary: (songId, song) => {
        set((state) => {
          if (state.librarySongIds.includes(songId)) return state;
          const newLikedSongs = song && !state.likedSongs.find((s) => s.id === songId)
            ? [song, ...state.likedSongs]
            : state.likedSongs;
          return {
            librarySongIds: [songId, ...state.librarySongIds],
            likedSongs: newLikedSongs,
          };
        });
        import('@/context/useAuthStore').then(({ useAuthStore }) => {
          const userId = useAuthStore.getState().user?.id || 'guest';
          import('@/lib/sync/AccountSyncEngine').then(({ AccountSyncEngine }) => {
            AccountSyncEngine.getInstance().likeSong(userId, songId);
          });
        });
      },

      removeFromLibrary: (songId) => {
        set((state) => ({
          librarySongIds: state.librarySongIds.filter((id) => id !== songId),
        }));
        // NOTE: removing from library does NOT remove download or like
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

      },

      toggleFavoriteAlbum: async (albumId) => {
        const isFav = get().favoriteAlbumIds.includes(albumId);

        set((state) => {
          const newFavs = isFav
            ? state.favoriteAlbumIds.filter((id) => id !== albumId)
            : [...state.favoriteAlbumIds, albumId];
          return { favoriteAlbumIds: newFavs };
        });
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
        if (typeof window !== 'undefined') {
          ScrollManager.getInstance().navigateTo(`tab:${tab}`);
        }
      },
      setSelectedArtistId: (id) => {
        const safeId = id && id !== 'offline' && id !== 'unknown' ? id : null;
        set({ selectedArtistId: safeId, activeTab: 'artist' });
        NavigationStack.getInstance().push({
          activeTab: 'artist',
          selectedAlbumId: null,
          selectedArtistId: safeId,
          selectedPlaylistId: null,
          isPlayerExpanded: get().isPlayerExpanded,
        });
        if (typeof window !== 'undefined' && safeId) {
          ScrollManager.getInstance().navigateTo(`artist:${safeId}`);
        }
      },
      setSelectedAlbumId: (id) => {
        const safeId = id && id !== 'offline' && id !== 'unknown' ? id : null;
        set({ selectedAlbumId: safeId, activeTab: 'album' });
        NavigationStack.getInstance().push({
          activeTab: 'album',
          selectedAlbumId: safeId,
          selectedArtistId: null,
          selectedPlaylistId: null,
          isPlayerExpanded: get().isPlayerExpanded,
        });
        if (typeof window !== 'undefined' && safeId) {
          ScrollManager.getInstance().navigateTo(`album:${safeId}`);
        }
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
        if (typeof window !== 'undefined' && id) {
          ScrollManager.getInstance().navigateTo(`playlist:${id}`);
        }
      },
      navigateFromPlayer: (destination) => {
        const safeAlbumId = destination.albumId && destination.albumId !== 'offline' && destination.albumId !== 'unknown' ? destination.albumId : null;
        const safeArtistId = destination.artistId && destination.artistId !== 'offline' && destination.artistId !== 'unknown' ? destination.artistId : null;
        NavigationStack.getInstance().navigateFromPlayer({
          ...destination,
          albumId: safeAlbumId,
          artistId: safeArtistId,
        });
        set({
          activeTab: destination.tab,
          selectedAlbumId: safeAlbumId,
          selectedArtistId: safeArtistId,
          selectedPlaylistId: destination.playlistId || null,
          isPlayerExpanded: false,
        });
        if (typeof window !== 'undefined') {
          const key = ScrollManager.getInstance().getRouteKey({
            activeTab: destination.tab,
            selectedAlbumId: safeAlbumId,
            selectedArtistId: safeArtistId,
            selectedPlaylistId: destination.playlistId || null,
          });
          ScrollManager.getInstance().navigateTo(key);
        }
      },
      setStreamingQuality: (quality) => set({ streamingQuality: quality }),
      setDownloadQuality: (quality) => set({ downloadQuality: quality }),
      setDataSaverEnabled: (enabled) => set({ isDataSaverEnabled: enabled }),
      setDeliveredQuality: (quality) => set({ deliveredQuality: quality }),
      setLoudnessNormalizationEnabled: (enabled) => {
        set({ loudnessNormalizationEnabled: enabled });
        import('@/lib/playback/native/RaagaXNativePlayer').then(({ RaagaXNativePlayer }) => {
          if (RaagaXNativePlayer.isNative()) {
            RaagaXNativePlayer.setLoudnessNormalizationEnabled(enabled).catch(() => { });
          }
        });
      },

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
      toggleSleepTimerModal: (open) =>
        set((state) => ({
          isSleepTimerModalOpen: typeof open === 'boolean' ? open : !state.isSleepTimerModalOpen,
        })),
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
      storage: safeLocalStorage,
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version === 0 || version === 1) {
          return {
            ...persistedState,
            likedSongIds: Array.isArray(persistedState.likedSongIds) ? persistedState.likedSongIds : [],
            librarySongIds: Array.isArray(persistedState.librarySongIds) ? persistedState.librarySongIds : (persistedState.likedSongIds || []),
            downloadedSongIds: Array.isArray(persistedState.downloadedSongIds) ? persistedState.downloadedSongIds : [],
            historySongIds: Array.isArray(persistedState.historySongIds) ? persistedState.historySongIds : [],
            favoriteArtistIds: Array.isArray(persistedState.favoriteArtistIds) ? persistedState.favoriteArtistIds : [],
            favoriteAlbumIds: Array.isArray(persistedState.favoriteAlbumIds) ? persistedState.favoriteAlbumIds : [],
            streamingQuality: persistedState.streamingQuality || 'AUTO',
            downloadQuality: persistedState.downloadQuality || 'HIGH',
            loudnessNormalizationEnabled: persistedState.loudnessNormalizationEnabled ?? false,
          };
        }
        return persistedState;
      },
      partialize: (state) => ({
        volume: state.volume,
        isMuted: state.isMuted,
        shuffleMode: state.shuffleMode,
        repeatMode: state.repeatMode,
        preferredLanguage: state.preferredLanguage,
        crossfadeSec: state.crossfadeSec,
        streamingQuality: state.streamingQuality,
        downloadQuality: state.downloadQuality,
        isAutoplayEnabled: state.isAutoplayEnabled,
        loudnessNormalizationEnabled: state.loudnessNormalizationEnabled,
        lastTrackId: state.currentSong?.id || null,
        lastPositionSec: state.lastPositionSec || 0,
        // ACCOUNT ISOLATION: User library items (likedSongIds, librarySongIds, favoriteArtistIds, favoriteAlbumIds)
        // are intentionally NOT persisted in global un-scoped preferences to maintain strict account isolation.
        // User library is persisted user-scoped in IndexedDB via LocalDatabase / AccountSyncEngine.
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).__usePlayerStore = usePlayerStore;
}
