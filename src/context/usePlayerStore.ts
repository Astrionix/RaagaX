import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Song, RepeatMode, AIDJState, ActiveTab, Renderer } from '@/types/music';
import { RecommendationEngine } from '@/lib/recommendationEngine';
import { LocalDatabase } from '@/lib/localDatabase';

import { AudioQuality, AudioQualityState } from '@/lib/playback/types';

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  
  queue: Song[];
  queueIndex: number;
  shuffleMode: import('@/lib/queue/types').ShuffleMode;
  repeatMode: RepeatMode;
  isRefillingQueue: boolean;

  likedSongIds: string[];
  likedSongs: Song[];
  downloadedSongIds: string[];
  historySongIds: string[];
  favoriteArtistIds: string[];
  favoriteAlbumIds: string[];

  crossfadeSec: number;
  isGaplessEnabled: boolean;
  playbackContext: any[];

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

  contextMenuSong: Song | null;
  preferredLanguage: string;

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
  onlineDevices: { id: string; name: string }[];
  setOnlineDevices: (devices: { id: string; name: string }[]) => void;
  setRemoteState: (state: Partial<PlayerState>) => void;
  setRenderer: (renderer: Renderer) => void;
  transferPlayback: (targetDeviceId: string) => void;

  rightPanelMode: 'queue' | 'devices';
  setRightPanelMode: (mode: 'queue' | 'devices') => void;

  // Autoplay and Context
  isAutoplayEnabled: boolean;
  playbackContextData: import('@/types/music').PlaybackContext | null;
  albumPlaybackQueue: string[];
  toggleAutoplay: () => void;
  setPlaybackContext: (context: import('@/types/music').PlaybackContext | null) => void;

  // Actions
  playAlbumSequence: (albumIds: string[]) => Promise<void>;
  restoreLocalSession: () => Promise<void>;
  syncCloudLibrary: () => Promise<void>;
  autoRefillQueue: () => Promise<void>;
  setPreferredLanguage: (lang: string) => void;
  playSong: (song: Song, newQueue?: Song[]) => void;
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
  setSleepTimer: (minutes: number | null) => void;

  logCurrentTelemetry: (action: 'play' | 'skip' | 'complete') => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,

  queue: [],
  queueIndex: 0,
  shuffleMode: 'OFF',
  repeatMode: 'off',
  isRefillingQueue: false,
  crossfadeSec: 0,
  isGaplessEnabled: true,
  playbackContext: ['EXPLORE'],

  likedSongIds: [],
  likedSongs: [],
  downloadedSongIds: [],
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

  deviceId: typeof window !== 'undefined' ? localStorage.getItem('raagax_device_id') || '' : '',
  deviceInstanceId: typeof window !== 'undefined' ? localStorage.getItem('raagax_device_instance_id') || '' : '',
  activeDeviceId: null,
  activeRenderer: 'audio',
  playbackStatus: 'paused',
  isActiveDevice: true, // Default to true until sync starts
  remoteDeviceName: null,
  lastSyncDbTime: null,
  lastSyncPositionMs: null,
  playbackSession: null,
  handoffState: null,
  serverTimestamp: null,
  onlineDevices: [],
  rightPanelMode: 'queue',

  setRightPanelMode: (mode) => set({ rightPanelMode: mode }),
  setOnlineDevices: (devices) => set({ onlineDevices: devices }),
  setRemoteState: (newState) => set((state) => ({ ...state, ...newState })),
  
  transferPlayback: (targetDeviceId) => {
    import('@/lib/connect/TransferManager').then(({ TransferManager }) => {
      TransferManager.getInstance().initiateTransfer(targetDeviceId);
    });
  },

  setPreferredLanguage: (lang) => {
    set({ preferredLanguage: lang });
    if (typeof window !== 'undefined') {
      localStorage.setItem('raagax_preferred_language', lang);
    }
  },

  restoreLocalSession: async () => {
    const session = await LocalDatabase.getInstance().loadPlaybackSession();
    const savedLanguage = (typeof window !== 'undefined' && localStorage.getItem('raagax_preferred_language')) || (session && session.preferredLanguage) || 'Telugu';

    if (session && session.currentSong) {
      const { isKidsOrNurseryTrack } = await import('@/lib/jioSaavnProvider');
      const cleanQueue = (session.queue || []).filter(s => s && !isKidsOrNurseryTrack(s));
      const isCurrentClean = !isKidsOrNurseryTrack(session.currentSong);

      set({
        currentSong: isCurrentClean ? session.currentSong : (cleanQueue[0] || null),
        currentTime: session.currentTime || 0,
        queue: cleanQueue,
        queueIndex: Math.min(session.queueIndex || 0, Math.max(0, cleanQueue.length - 1)),
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
      const manager = require('@/lib/queue/QueueManager').QueueManager.getInstance();
      manager.replaceQueue(collectionResult.songs, 0);

      // Play first song
      get().playSong(firstSong, collectionResult.songs);
    }
  },

  commitPlaybackTransition: (song: Song, queueIndex?: number, updatedQueue?: Song[]) => {
    const manager = require('@/lib/queue/QueueManager').QueueManager.getInstance();
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

  playSong: (song, newQueue) => {
    get().logCurrentTelemetry('skip');
    
    // Check if newQueue was passed (e.g. from an album or playlist)
    const manager = require('@/lib/queue/QueueManager').QueueManager.getInstance();
    if (newQueue && newQueue.length > 0) {
       const index = newQueue.findIndex((s: Song) => s.id === song.id);
       manager.replaceQueue(newQueue, index !== -1 ? index : 0);
    } else {
       // Play now immediately overrides next
       manager.playNow(song);
    }

    const snapshot = manager.getSnapshot();
    const syncedQueue = snapshot.items.map((i: any) => i.song);
    const syncedIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0;

    // Atomically commit playing state, queue & queueIndex
    set({ isPlaying: true, currentTime: 0, currentSong: song, queue: syncedQueue, queueIndex: syncedIndex });

    // Delegate immediately to PlaybackService for local or Connect dispatch for remote
    if (get().isActiveDevice) {
      import('@/lib/playback/PlaybackService').then(({ PlaybackService }) => {
        PlaybackService.getInstance().playTrack(song, true);
      });
    } else {
      import('@/lib/connect/ConnectManager').then(({ ConnectManager }) => {
        ConnectManager.getInstance().dispatchPlaybackCommand('PLAY', { trackId: song.id, positionMs: 0 });
      });
    }
  },

  togglePlayPause: () => {
    const isNowPlaying = !get().isPlaying;
    if (get().isActiveDevice) {
      if (!isNowPlaying) {
        import('@/lib/playback/InterruptionCoordinator').then(({ InterruptionCoordinator }) => {
          InterruptionCoordinator.getInstance().reportUserPause();
        });
      } else {
        import('@/lib/playback/InterruptionCoordinator').then(({ InterruptionCoordinator }) => {
          InterruptionCoordinator.getInstance().clearInterruption();
        });
      }
      set({ isPlaying: isNowPlaying });
    }
    import('@/lib/connect/ConnectManager').then(({ ConnectManager }) => {
      ConnectManager.getInstance().dispatchPlaybackCommand(isNowPlaying ? 'PLAY' : 'PAUSE', { positionMs: get().currentTime * 1000 });
    });
  },
  setIsPlaying: (playing, fromRemote = false) => {
    // Optimistic UI: Always update local state immediately
    if (!playing && !fromRemote) {
      import('@/lib/playback/InterruptionCoordinator').then(({ InterruptionCoordinator }) => {
        InterruptionCoordinator.getInstance().reportUserPause();
      });
    } else if (playing) {
      import('@/lib/playback/InterruptionCoordinator').then(({ InterruptionCoordinator }) => {
        InterruptionCoordinator.getInstance().clearInterruption();
      });
    }
    set({ isPlaying: playing });
    if (!fromRemote) {
      import('@/lib/connect/ConnectManager').then(({ ConnectManager }) => {
        ConnectManager.getInstance().dispatchPlaybackCommand(playing ? 'PLAY' : 'PAUSE', { positionMs: get().currentTime * 1000 });
      });
    }
  },
  setCurrentTime: (time, fromRemote = false) => {
    // Optimistic UI: Always update local state immediately
    set({ currentTime: time });
    
    if (!fromRemote) {
      import('@/lib/connect/ConnectManager').then(({ ConnectManager }) => {
        ConnectManager.getInstance().dispatchPlaybackCommand('SEEK', { positionMs: time * 1000 });
      });
    }

    const { currentSong, queue, queueIndex, historySongIds, likedSongIds, isActiveDevice } = get();
    if (isActiveDevice && currentSong && Math.floor(time) % 5 === 0) {
      LocalDatabase.getInstance().savePlaybackSession({
        currentSong,
        currentTime: time,
        queue,
        queueIndex,
        historySongIds,
        likedSongIds,
        searchHistory: LocalDatabase.getInstance().getSearchHistory(),
      });
    }
  },
  setDuration: (dur) => set({ duration: dur }),
  setVolume: (vol) => set({ volume: vol }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  playNext: async () => {
    const { PlaybackWatchdog } = await import('@/lib/playback/PlaybackWatchdog');
    if (!PlaybackWatchdog.getInstance().acquireTransitionLock()) return;

    if (!get().isActiveDevice) {
      import('@/lib/connect/ConnectManager').then(({ ConnectManager }) => {
        ConnectManager.getInstance().dispatchPlaybackCommand('NEXT');
      });
      return;
    }

    const { duration, currentTime } = get();
    const isComplete = duration > 0 && currentTime >= duration - 5;
    get().logCurrentTelemetry(isComplete ? 'complete' : 'skip');

    const manager = require('@/lib/queue/QueueManager').QueueManager.getInstance();
    const nextItem = manager.getNext();
    
    if (nextItem && nextItem.song) {
      const snapshot = manager.getSnapshot();
      set({ 
        currentSong: nextItem.song,
        queue: snapshot.items.map((i: any) => i.song),
        queueIndex: snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0,
        isPlaying: true, 
        currentTime: 0 
      });
      import('@/lib/playback/PlaybackService').then(({ PlaybackService }) => {
        PlaybackService.getInstance().playTrack(nextItem.song, true);
      });
    } else {
      set({ isPlaying: false });
    }
  },

  playPrev: () => {
    if (!get().isActiveDevice) {
      import('@/lib/connect/ConnectManager').then(({ ConnectManager }) => {
        ConnectManager.getInstance().dispatchPlaybackCommand('PREV');
      });
      return;
    }

    const { currentTime, setCurrentTime, setSeekTarget } = get();
    if (currentTime > 2) {
      setCurrentTime(0);
      setSeekTarget(0);
      return;
    }
    
    get().logCurrentTelemetry('skip');
    const manager = require('@/lib/queue/QueueManager').QueueManager.getInstance();
    const prevItem = manager.getPrevious();

    if (prevItem && prevItem.song) {
      const snapshot = manager.getSnapshot();
      set({
        currentSong: prevItem.song,
        queue: snapshot.items.map((i: any) => i.song),
        queueIndex: snapshot.currentIndex >= 0 ? snapshot.currentIndex : 0,
        isPlaying: true,
        currentTime: 0
      });
      import('@/lib/playback/PlaybackService').then(({ PlaybackService }) => {
        PlaybackService.getInstance().playTrack(prevItem.song, true);
      });
    }
  },

  toggleShuffle: () => require('@/lib/queue/QueueManager').QueueManager.getInstance().toggleShuffle(),
  setRepeatMode: (mode) => require('@/lib/queue/QueueManager').QueueManager.getInstance().setRepeatMode(mode),
  cycleRepeatMode: () => {
    const modes: import('@/lib/queue/types').RepeatMode[] = ['OFF', 'CONTEXT', 'TRACK'];
    const current = require('@/lib/queue/QueueManager').QueueManager.getInstance().getRepeatMode();
    const nextIdx = (modes.indexOf(current) + 1) % modes.length;
    require('@/lib/queue/QueueManager').QueueManager.getInstance().setRepeatMode(modes[nextIdx]);
  },

  addToQueue: (song) => require('@/lib/queue/QueueManager').QueueManager.getInstance().addToQueue(song),
  playNextInQueue: (song) => require('@/lib/queue/QueueManager').QueueManager.getInstance().playNext(song),
  playLastInQueue: (song) => require('@/lib/queue/QueueManager').QueueManager.getInstance().addToQueue(song),
  removeFromQueue: (songId) => {
    const items = require('@/lib/queue/QueueManager').QueueManager.getInstance().getAllItems();
    const target = items.find((i: any) => i.trackId === songId);
    if (target) {
      require('@/lib/queue/QueueManager').QueueManager.getInstance().removeItem(target.queueItemId);
    }
  },
  reorderQueue: (newQueue) => {
    require('@/lib/queue/QueueManager').QueueManager.getInstance().replaceQueue(newQueue, get().queueIndex, 'USER');
  },

  autoRefillQueue: async () => {},

  syncCloudLibrary: async () => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;
      const userId = session.session.user.id;

      // Note: Liked songs are now synced via LibrarySyncManager.reconcile()
      
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
    
    // Optimistic UI update
    set((state) => {
      const newLikedIds = isLiked
        ? state.likedSongIds.filter((id) => id !== songId)
        : [...state.likedSongIds, songId];

      return { likedSongIds: newLikedIds };
    });

    // Delegate cloud mutation to LibrarySyncEngine & LibrarySyncManager
    import('@/lib/sync/LibrarySyncEngine').then(({ LibrarySyncEngine }) => {
      const songToLike = get().currentSong?.id === songId ? get().currentSong : get().queue.find(s => s?.id === songId);
      if (isLiked) {
        LibrarySyncEngine.getInstance().unlikeSong(songId);
      } else if (songToLike) {
        LibrarySyncEngine.getInstance().likeSong(songToLike);
      }
    });

    import('@/lib/sync/LibrarySyncManager').then(({ LibrarySyncManager }) => {
      if (isLiked) {
        LibrarySyncManager.getInstance().unlikeSong(songId);
      } else {
        LibrarySyncManager.getInstance().likeSong(songId);
      }
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

  setSleepTimer: (minutes) => {
    if (minutes === null) {
      set({ sleepTimerMinutes: null, sleepTimerEndsAt: null });
    } else {
      const endsAt = Date.now() + minutes * 60 * 1000;
      set({ sleepTimerMinutes: minutes, sleepTimerEndsAt: endsAt });
    }
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
        likedSongIds: state.likedSongIds,
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
