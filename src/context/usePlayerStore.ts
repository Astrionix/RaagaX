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

import { AudioQuality, AudioQualityState } from '@/lib/playback/types';

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
  createPlaylistModalOpen: boolean;

  toastMessage: string | null;
  setToastMessage: (msg: string | null) => void;

  aiDjState: AIDJState;
  searchQuery: string;
  activeGenreFilter: string;

  sleepTimerMinutes: number | null;
  sleepTimerEndsAt: number | null;
  sleepTimerMode: 'duration' | 'end_of_song' | 'end_of_queue' | null;

  contextMenuSong: Song | null;
  // 3-Tier Language Preference System
  preferredLanguage: string; // GLOBAL_LANGUAGE (Explicit User Selection)
  sessionLanguage: string; // SESSION_LANGUAGE (Current Playback Queue Language)
  interestLanguages: Record<string, number>; // INTEREST_LANGUAGES (Inferred Soft Signals)
  setPreferredLanguage: (lang: string) => void;
  setSessionLanguage: (lang: string) => void;
  recordLanguageInterest: (lang: string, delta?: number) => void;

  // Offline Mode State
  networkMode: 'online' | 'offline' | 'offline_forced';
  setNetworkMode: (mode: 'online' | 'offline' | 'offline_forced') => void;

  // Cross-Device Sync State
  deviceId: string;
  deviceInstanceId: string;
  activeDeviceId: string | null;
  activeRenderer: Renderer;
  playbackStatus: 'playing' | 'paused' | 'buffering' | 'transitioning';
  isActiveDevice: boolean;
  isTransferring: boolean;
  transferringDeviceId: string | null;
  remoteDeviceName: string | null;
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
  playSong: (song: Song, newQueue?: Song[], context?: import('@/lib/queue/types').PlaybackContext) => void;
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
  removeFromQueue: (songId: string) => void;
  reorderQueue: (newQueue: Song[]) => void;

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

  togglePlayerExpanded: () => void;
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

// Initial sync session hydration for zero-flicker startup
const initialSession = typeof window !== 'undefined' ? LocalDatabase.getInstance().getSyncPlaybackSession() : null;

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
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
  createPlaylistModalOpen: false,
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
    insightText: 'RaagaX AI suggests Telugu Mass Beats for your evening peak focus.',
  },
  searchQuery: '',
  activeGenreFilter: 'all',

  sleepTimerMinutes: null,
  sleepTimerEndsAt: null,
  contextMenuSong: null,
  
  // Offline Mode State
  networkMode: 'online',
  setNetworkMode: (mode) => set({ networkMode: mode }),
  
  preferredLanguage: (typeof window !== 'undefined' && localStorage.getItem('raagax_preferred_language')) || 'Telugu',
  sessionLanguage: (typeof window !== 'undefined' && localStorage.getItem('raagax_preferred_language')) || 'Telugu',
  interestLanguages: {
    Telugu: 0.90,
  },
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
  activeRenderer: 'audio',
  playbackStatus: 'paused',
  isActiveDevice: true, // Default to true until sync starts
  isTransferring: false,
  transferringDeviceId: null,
  remoteDeviceName: null,
  lastSyncDbTime: null,
  lastSyncPositionMs: null,
  playbackSession: null,
  handoffState: null,
  serverTimestamp: null,
  onlineDevices: [],
  rightPanelMode: 'queue',

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
  setOnlineDevices: (devices) => set({ onlineDevices: devices }),
  setRemoteState: (newState) => set((state) => ({ ...state, ...newState })),
  
  transferPlayback: async (targetDeviceId) => {
    if (get().isTransferring) {
      console.warn('[usePlayerStore] Transfer already in progress, ignoring duplicate request.');
      return;
    }
    set({ isTransferring: true, transferringDeviceId: targetDeviceId });
    try {
      const { TransferManager } = await import('@/lib/connect/TransferManager');
      await TransferManager.getInstance().initiateTransfer(targetDeviceId);
    } catch (e) {
      console.error('[usePlayerStore] transferPlayback error:', e);
      set({ isTransferring: false, transferringDeviceId: null });
    }
  },

  restoreLocalSession: async () => {
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
    // Sourced strictly from the most recent song in listening history (or session)
    if ((session && session.currentSong) || mostRecentHistorySong) {
      const candidateSong = session?.currentSong || mostRecentHistorySong || null;
      const rawQueue = (session?.queue && session.queue.length > 0) ? session.queue : (mostRecentHistorySong ? [mostRecentHistorySong] : []);
      const cleanQueue = rawQueue.filter(s => s && !isKidsOrNurseryTrack(s));
      
      const isCandidateClean = candidateSong && !isKidsOrNurseryTrack(candidateSong);
      const activeSong = isCandidateClean ? candidateSong : (cleanQueue[0] || null);

      if (cleanQueue.length > 0 && activeSong) {
        let safeIndex = cleanQueue.findIndex(s => s.id === activeSong.id);
        if (safeIndex === -1) safeIndex = Math.min(session?.queueIndex || 0, Math.max(0, cleanQueue.length - 1));

        let restoredTime = session?.currentTime || 0;
        const totalDuration = activeSong.duration || session?.duration || 0;

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
    const manager = QueueManager.getInstance();
    const snapshot = manager.getSnapshot();
    const currentItem = manager.getCurrentItem();
    const targetSong = song || (currentItem ? currentItem.song : null);
    const finalQueue = updatedQueue || snapshot.items.map((i: any) => i.song);
    const finalIndex = queueIndex !== undefined ? queueIndex : snapshot.currentIndex;

    set({
      currentSong: targetSong,
      queue: finalQueue,
      queueIndex: finalIndex >= 0 ? finalIndex : 0,
      currentTime: 0,
      isPlaying: true,
      playbackIntent: 'PLAYING',
      trackSource: 'AUTO_NEXT',
    });

    if (targetSong) {
      import('@/lib/playback/MediaSessionManager').then(({ MediaSessionManager }) => {
        MediaSessionManager.getInstance().updateMetadata({
          title: targetSong.title,
          artist: targetSong.artist || 'RaagaX',
          album: targetSong.album || 'RaagaX Music',
          artwork: targetSong.coverUrl ? [{ src: targetSong.coverUrl, sizes: '512x512', type: 'image/png' }] : [],
        });
        MediaSessionManager.getInstance().setPlaybackState('playing');
        MediaSessionManager.getInstance().setPositionState({
          duration: targetSong.duration || 0,
          position: 0,
        });
      });
    }
  },

  playSong: (song, newQueue, context) => {
    console.log(`[PLAY CALLED] songId=${song.id} title="${song.title}" artist="${song.artist}" source=${context?.type || 'USER_CLICK'}`);
    get().logCurrentTelemetry('skip');
    
    // 3-Tier Language System: Session Language Resolution
    // If the user explicitly plays a song (e.g. from search, an album, or playlist),
    // establish SESSION_LANGUAGE to that song's language for the current playback session.
    // GLOBAL_LANGUAGE (preferredLanguage) remains untouched.
    const songLang = LanguageEligibilityEngine.getInstance().detectSongLanguage(song);
    get().recordLanguageInterest(songLang, 0.20);

    // Check if newQueue was passed (e.g. from an album or playlist)
    const manager = QueueManager.getInstance();
    if (newQueue && newQueue.length > 0) {
       const index = newQueue.findIndex((s: Song) => s.id === song.id);
       const boundedQueue = index !== -1 ? newQueue.slice(index) : newQueue;
       manager.replaceQueue(boundedQueue, 0, (context?.type as any) || 'PLAYLIST', context);
    } else {
       // Play now immediately overrides next
       manager.playNow(song);
    }

    const snapshot = manager.getSnapshot();
    const syncedQueue = snapshot.items.map((i: any) => i.song);
    const syncedIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0;

    // Atomically commit playing state, queue & queueIndex
    set({ 
      isPlaying: true, 
      playbackIntent: 'PLAYING',
      trackSource: 'USER_SELECTED',
      sessionLanguage: songLang,
      currentTime: 0, 
      currentSong: song, 
      queue: syncedQueue, 
      queueIndex: syncedIndex 
    });
    persistSessionHelper({ ...get(), currentSong: song, currentTime: 0, queue: syncedQueue, queueIndex: syncedIndex });

    // Delegate to PlaybackService (local) or ConnectManager (remote)
    if (get().isActiveDevice) {
      const service = PlaybackService.getInstance();
      if (RaagaXNativePlayer.isNative() && syncedQueue.length > 0) {
        // ── Native path: loadQueueContext resolves ALL URLs in parallel and calls
        // setQueue() which hands ExoPlayer the complete playlist.
        // ExoPlayer auto-advances natively — WebView does NOT need to wake up.
        service.loadQueueContext(syncedQueue, syncedIndex);
      } else {
        // ── Web / PWA path: use HTMLAudioElement + queue management
        service.playTrack(song, true);
      }
      import('@/lib/connect/PlaybackStateSync').then(({ PlaybackStateSync }) => {
        PlaybackStateSync.getInstance().broadcastState(true);
      });
    } else {
      ConnectManager.getInstance().dispatchPlaybackCommand('PLAY', {
        trackId: song.id,
        songData: song,
        queue: syncedQueue,
        queueIndex: syncedIndex,
        positionMs: 0
      });
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
      isPlaying: true,
      playbackIntent: 'PLAYING',
      trackSource: 'USER_SELECTED',
      currentTime: 0,
      currentSong: firstSong,
      queue: syncedQueue,
      queueIndex: 0,
      shuffleMode: snapshot.shuffleMode || 'STANDARD',
    });
    persistSessionHelper({ ...get(), currentSong: firstSong, currentTime: 0, queue: syncedQueue, queueIndex: 0 });

    if (get().isActiveDevice) {
      const service = PlaybackService.getInstance();
      if (RaagaXNativePlayer.isNative()) {
        service.loadQueueContext(syncedQueue, 0);
      } else {
        service.playTrack(firstSong, true);
      }
      import('@/lib/connect/PlaybackStateSync').then(({ PlaybackStateSync }) => {
        PlaybackStateSync.getInstance().broadcastState(true);
      });
    } else {
      ConnectManager.getInstance().dispatchPlaybackCommand('PLAY', {
        trackId: firstSong.id,
        songData: firstSong,
        queue: syncedQueue,
        queueIndex: 0,
        positionMs: 0
      });
    }
  },

  togglePlayPause: () => {
    const isNowPlaying = !get().isPlaying;
    if (get().isActiveDevice) {
      if (!isNowPlaying) {
        InterruptionCoordinator.getInstance().reportUserPause();
      } else {
        InterruptionCoordinator.getInstance().clearInterruption();
      }
      set({ isPlaying: isNowPlaying, playbackIntent: isNowPlaying ? 'PLAYING' : 'PAUSED' });
      import('@/lib/connect/PlaybackStateSync').then(({ PlaybackStateSync }) => {
        PlaybackStateSync.getInstance().broadcastState(true);
      });
    }
    persistSessionHelper({ ...get() });
    ConnectManager.getInstance().dispatchPlaybackCommand(isNowPlaying ? 'PLAY' : 'PAUSE', { positionMs: get().currentTime * 1000 });
  },
  setIsPlaying: (playing, fromRemote = false) => {
    // Optimistic UI: Always update local state immediately
    if (!playing && !fromRemote) {
      InterruptionCoordinator.getInstance().reportUserPause();
    } else if (playing) {
      InterruptionCoordinator.getInstance().clearInterruption();
    }
    set({ isPlaying: playing, playbackIntent: playing ? 'PLAYING' : 'PAUSED' });
    if (get().isActiveDevice && !fromRemote) {
      import('@/lib/connect/PlaybackStateSync').then(({ PlaybackStateSync }) => {
        PlaybackStateSync.getInstance().broadcastState(true);
      });
    }
    persistSessionHelper({ ...get() });
    if (!fromRemote) {
      ConnectManager.getInstance().dispatchPlaybackCommand(playing ? 'PLAY' : 'PAUSE', { positionMs: get().currentTime * 1000 });
    }
  },
  setCurrentTime: (time, fromRemote = false) => {
    // Optimistic UI: Always update local state immediately
    set({ currentTime: time });
    
    if (!fromRemote) {
      ConnectManager.getInstance().dispatchPlaybackCommand('SEEK', { positionMs: time * 1000 });
      if (get().isActiveDevice) {
        import('@/lib/connect/PlaybackStateSync').then(({ PlaybackStateSync }) => {
          PlaybackStateSync.getInstance().broadcastState(false);
        });
      }
    }

    const state = get();
    if (state.isActiveDevice && state.currentSong) {
      throttlePersistSession(state, fromRemote);
    }
  },
  setDuration: (dur) => set({ duration: dur }),
  setVolume: (vol) => {
    set({ volume: vol });
    if (get().isActiveDevice) {
      import('@/lib/connect/PlaybackStateSync').then(({ PlaybackStateSync }) => {
        PlaybackStateSync.getInstance().broadcastState(true);
      });
    }
    persistSessionHelper(get());
  },
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  playNext: async () => {
    if (!PlaybackWatchdog.getInstance().acquireTransitionLock()) return;

    if (!get().isActiveDevice) {
      ConnectManager.getInstance().dispatchPlaybackCommand('NEXT');
      return;
    }

    const { duration, currentTime } = get();
    const isComplete = duration > 0 && currentTime >= duration - 5;
    get().logCurrentTelemetry(isComplete ? 'complete' : 'skip');

    if (get().sleepTimerMode === 'end_of_song') {
      get().setIsPlaying(false);
      get().setSleepTimer(null);
      get().setToastMessage('Sleep Timer Ended — Playback paused at end of song');
      return;
    }

    if (RaagaXNativePlayer.isNative()) {
      await RaagaXNativePlayer.next();
      return;
    }

    const manager = QueueManager.getInstance();
    const nextItem = manager.getNext(false);
    
    if (nextItem && nextItem.song) {
      const snapshot = manager.getSnapshot();
      const syncedQueue = snapshot.items.map((i: any) => i.song);
      const syncedIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0;
      set({ 
        currentSong: nextItem.song,
        queue: syncedQueue,
        queueIndex: syncedIndex,
        isPlaying: true, 
        currentTime: 0 
      });
      persistSessionHelper({ ...get(), currentSong: nextItem.song, currentTime: 0, queue: syncedQueue, queueIndex: syncedIndex });
      PlaybackService.getInstance().playTrack(nextItem.song, true);
    } else {
      if (get().sleepTimerMode === 'end_of_queue') {
        get().setSleepTimer(null);
        get().setToastMessage('Sleep Timer Ended — Playback paused at end of queue');
      }
      set({ isPlaying: false });
      persistSessionHelper(get());
    }
  },

  playPrev: async () => {
    if (!get().isActiveDevice) {
      ConnectManager.getInstance().dispatchPlaybackCommand('PREV');
      return;
    }

    const { currentTime, setCurrentTime, setSeekTarget } = get();
    if (currentTime > 2) {
      setCurrentTime(0);
      setSeekTarget(0);
      return;
    }
    
    get().logCurrentTelemetry('skip');

    if (RaagaXNativePlayer.isNative()) {
      await RaagaXNativePlayer.previous();
      return;
    }

    const manager = QueueManager.getInstance();
    const prevItem = manager.getPrevious();

    if (prevItem && prevItem.song) {
      const snapshot = manager.getSnapshot();
      const syncedQueue = snapshot.items.map((i: any) => i.song);
      const syncedIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0;
      set({
        currentSong: prevItem.song,
        queue: syncedQueue,
        queueIndex: syncedIndex,
        isPlaying: true,
        currentTime: 0
      });
      persistSessionHelper({ ...get(), currentSong: prevItem.song, currentTime: 0, queue: syncedQueue, queueIndex: syncedIndex });
      PlaybackService.getInstance().playTrack(prevItem.song, true);
    } else {
      set({ isPlaying: false });
      persistSessionHelper(get());
    }
  },

  toggleShuffle: async () => {
    const manager = QueueManager.getInstance();
    await manager.toggleShuffle();
    const snapshot = manager.getSnapshot();
    const syncedQueue = snapshot.items.map((i: any) => i.song);
    const syncedIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0;
    const currentSong = syncedQueue[syncedIndex] || get().currentSong;

    set({ 
      shuffleMode: snapshot.shuffleMode || 'STANDARD',
      queue: syncedQueue, 
      queueIndex: syncedIndex, 
      currentSong 
    });
    persistSessionHelper(get());

    PlaybackService.getInstance().loadQueueContext(syncedQueue, syncedIndex);
  },
  setRepeatMode: (mode) => {
    QueueManager.getInstance().setRepeatMode(mode as any);
    persistSessionHelper(get());
  },
  cycleRepeatMode: () => {
    const modes: import('@/lib/queue/types').RepeatMode[] = ['OFF', 'CONTEXT', 'TRACK'];
    const current = QueueManager.getInstance().getRepeatMode();
    const nextIdx = (modes.indexOf(current) + 1) % modes.length;
    QueueManager.getInstance().setRepeatMode(modes[nextIdx]);
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

  autoRefillQueue: async () => {},

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

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedArtistId: (id) => set({ selectedArtistId: id, activeTab: 'artist' }),
  setSelectedAlbumId: (id) => set({ selectedAlbumId: id, activeTab: 'album' }),
  setSelectedPlaylistId: (id) => set({ selectedPlaylistId: id, activeTab: 'playlist' }),
  setStreamingQuality: (quality) => set({ streamingQuality: quality }),
  setDownloadQuality: (quality) => set({ downloadQuality: quality }),
  setDataSaverEnabled: (enabled) => set({ isDataSaverEnabled: enabled }),
  setDeliveredQuality: (quality) => set({ deliveredQuality: quality }),

  togglePlayerExpanded: () =>
    set((state) => ({ isPlayerExpanded: !state.isPlayerExpanded })),
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
