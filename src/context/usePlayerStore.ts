import { create } from 'zustand';
import { Song, RepeatMode, AIDJState, ActiveTab } from '@/types/music';
import { RecommendationEngine } from '@/lib/recommendationEngine';
import { LocalDatabase } from '@/lib/localDatabase';

export type AudioQualityPreset = '320kbps MP3' | '1411kbps Lossless' | '24-bit 96kHz FLAC';

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  
  queue: Song[];
  queueIndex: number;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  isRefillingQueue: boolean;

  likedSongIds: string[];
  likedSongs: Song[];
  downloadedSongIds: string[];
  historySongIds: string[];
  favoriteArtistIds: string[];
  favoriteAlbumIds: string[];

  crossfadeSec: number;

  activeTab: ActiveTab;
  selectedArtistId: string | null;
  selectedAlbumId: string | null;
  selectedPlaylistId: string | null;

  audioQualityPreset: AudioQualityPreset;
  isPlayerExpanded: boolean;
  isVideoModeActive: boolean;
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

  // Cross-Device Sync State
  deviceId: string;
  activeDeviceId: string | null;
  isActiveDevice: boolean;
  remoteDeviceName: string | null;
  lastSyncDbTime: string | null;
  lastSyncPositionMs: number | null;
  onlineDevices: { id: string; name: string }[];
  setOnlineDevices: (devices: { id: string; name: string }[]) => void;
  setRemoteState: (state: Partial<PlayerState>) => void;
  transferPlayback: (targetDeviceId: string) => void;

  rightPanelMode: 'queue' | 'devices';
  setRightPanelMode: (mode: 'queue' | 'devices') => void;

  // Autoplay and Context
  isAutoplayEnabled: boolean;
  playbackContext: import('@/types/music').PlaybackContext | null;
  toggleAutoplay: () => void;
  setPlaybackContext: (context: import('@/types/music').PlaybackContext | null) => void;

  // Actions
  restoreLocalSession: () => Promise<void>;
  syncCloudLibrary: () => Promise<void>;
  autoRefillQueue: () => Promise<void>;
  setPreferredLanguage: (lang: string) => void;
  playSong: (song: Song, newQueue?: Song[]) => void;
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
  cycleRepeatMode: () => void;
  addToQueue: (song: Song) => void;
  playNextInQueue: (song: Song) => void;
  playLastInQueue: (song: Song) => void;
  removeFromQueue: (songId: string) => void;
  reorderQueue: (newQueue: Song[]) => void;

  toggleLikeSong: (songId: string) => void;
  toggleDownloadSong: (songId: string) => void;
  toggleFavoriteArtist: (artistId: string) => void;
  toggleFavoriteAlbum: (albumId: string) => void;

  setCrossfadeSec: (sec: number) => void;

  setActiveTab: (tab: ActiveTab) => void;
  setSelectedArtistId: (id: string | null) => void;
  setSelectedAlbumId: (id: string | null) => void;
  setSelectedPlaylistId: (id: string | null) => void;
  setAudioQualityPreset: (preset: AudioQualityPreset) => void;

  togglePlayerExpanded: () => void;
  setVideoModeActive: (active: boolean) => void;
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

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,

  queue: [],
  queueIndex: 0,
  isShuffle: false,
  repeatMode: 'off',
  isRefillingQueue: false,

  likedSongIds: [],
  likedSongs: [],
  downloadedSongIds: [],
  historySongIds: [],
  favoriteArtistIds: [],
  favoriteAlbumIds: [],

  crossfadeSec: 2,

  activeTab: 'home',
  selectedArtistId: null,
  selectedAlbumId: null,
  selectedPlaylistId: null,

  audioQualityPreset: '24-bit 96kHz FLAC',
  isPlayerExpanded: false,
  isVideoModeActive: false,
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
  playbackContext: null,
  toggleAutoplay: () => set((state) => ({ isAutoplayEnabled: !state.isAutoplayEnabled })),
  setPlaybackContext: (context) => set({ playbackContext: context }),

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
  preferredLanguage: 'Telugu',

  deviceId: typeof window !== 'undefined' ? localStorage.getItem('raagax_device_id') || '' : '',
  activeDeviceId: null,
  isActiveDevice: true, // Default to true until sync starts
  remoteDeviceName: null,
  lastSyncDbTime: null,
  lastSyncPositionMs: null,
  onlineDevices: [],
  rightPanelMode: 'queue',

  setRightPanelMode: (mode) => set({ rightPanelMode: mode }),
  setOnlineDevices: (devices) => set({ onlineDevices: devices }),
  setRemoteState: (newState) => set((state) => ({ ...state, ...newState })),
  
  transferPlayback: (targetDeviceId) => {
    const { deviceId, currentTime } = get();
    set({ activeDeviceId: targetDeviceId, isActiveDevice: targetDeviceId === deviceId });
    if (targetDeviceId !== deviceId) set({ isPlaying: false });

    import('@/lib/sync/DeviceSyncManager').then(({ DeviceSyncManager }) => {
      const syncManager = DeviceSyncManager.getInstance();
      syncManager.dispatchCommand({ type: 'TRANSFER', toDeviceId: targetDeviceId, positionMs: currentTime * 1000 });
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
    if (session && session.currentSong) {
      const { isKidsOrNurseryTrack } = await import('@/lib/jioSaavnProvider');
      const cleanQueue = (session.queue || []).filter(s => s && !isKidsOrNurseryTrack(s));
      const isCurrentClean = !isKidsOrNurseryTrack(session.currentSong);

      set({
        currentSong: isCurrentClean ? session.currentSong : (cleanQueue[0] || null),
        currentTime: session.currentTime || 0,
        queue: cleanQueue,
        queueIndex: Math.min(session.queueIndex || 0, Math.max(0, cleanQueue.length - 1)),
        historySongIds: session.historySongIds || [],
        likedSongIds: session.likedSongIds || [],
        preferredLanguage: session.preferredLanguage || 'Telugu',
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
      'home'
    );
  },

  playSong: (song, newQueue) => {
    get().logCurrentTelemetry('skip'); // Log previous song before switching
    const queue = newQueue || get().queue;
    let index = queue.findIndex((s) => s.id === song.id);
    if (index === -1) {
      queue.unshift(song);
      index = 0;
    }
    
    // Guess context if not explicitly set
    const currentContext = get().playbackContext;
    const newContext = currentContext && (currentContext.seedAlbumId === song.albumId || currentContext.seedPlaylistId === song.genre) 
      ? currentContext 
      : { type: 'recommendation' as const, seedSongId: song.id, language: song.genre?.split(' ')[0] || 'Telugu' };

    const newHistory = Array.from(new Set([song.id, ...get().historySongIds]));
    set({
      currentSong: song,
      isPlaying: true,
      queue,
      queueIndex: index,
      currentTime: 0,
      historySongIds: newHistory,
      playbackContext: newContext,
    });
    LocalDatabase.getInstance().savePlaybackSession({
      currentSong: song,
      currentTime: 0,
      queue,
      queueIndex: index,
      historySongIds: newHistory,
      likedSongIds: get().likedSongIds,
      searchHistory: LocalDatabase.getInstance().getSearchHistory(),
      preferredLanguage: get().preferredLanguage,
    });
  },

  togglePlayPause: () => {
    const isNowPlaying = !get().isPlaying;
    if (get().isActiveDevice) {
      set({ isPlaying: isNowPlaying });
    }
    import('@/lib/sync/DeviceSyncManager').then(({ DeviceSyncManager }) => {
      DeviceSyncManager.getInstance().dispatchCommand({ type: isNowPlaying ? 'PLAY' : 'PAUSE' });
    });
  },
  setIsPlaying: (playing, fromRemote = false) => {
    // Optimistic UI: Always update local state immediately
    set({ isPlaying: playing });
    if (!fromRemote) {
      import('@/lib/sync/DeviceSyncManager').then(({ DeviceSyncManager }) => {
        DeviceSyncManager.getInstance().dispatchCommand({ type: playing ? 'PLAY' : 'PAUSE' });
      });
    }
  },
  setCurrentTime: (time, fromRemote = false) => {
    // Optimistic UI: Always update local state immediately
    set({ currentTime: time });
    
    if (!fromRemote) {
      import('@/lib/sync/DeviceSyncManager').then(({ DeviceSyncManager }) => {
        DeviceSyncManager.getInstance().dispatchCommand({ type: 'SEEK', position: time });
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
    if (!get().isActiveDevice) {
      import('@/lib/sync/DeviceSyncManager').then(({ DeviceSyncManager }) => {
        DeviceSyncManager.getInstance().dispatchCommand({ type: 'NEXT' });
      });
      return;
    }

    const { queue, queueIndex, isShuffle, repeatMode, currentSong, currentTime, duration } = get();
    if (queue.length === 0) return;

    // If currentTime is close to duration, it finished. Otherwise it was skipped.
    const isComplete = duration > 0 && currentTime >= duration - 5;
    get().logCurrentTelemetry(isComplete ? 'complete' : 'skip');

    if (repeatMode === 'one' && currentSong) {
      set({ currentSong: { ...currentSong }, currentTime: 0, isPlaying: true });
      return;
    }

    let nextIndex = queueIndex + 1;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          // Attempt Autoplay via Queue Engine
          await get().autoRefillQueue();
          
          // Check if queue successfully grew
          const newQueue = get().queue;
          if (nextIndex < newQueue.length) {
            set({
              currentSong: newQueue[nextIndex],
              queueIndex: nextIndex,
              isPlaying: true,
              currentTime: 0,
            });
            return;
          } else {
            set({ isPlaying: false });
            return;
          }
        }
      }
    }

    const nextSong = get().queue[nextIndex];
    if (nextSong) {
      set({
        currentSong: nextSong,
        queueIndex: nextIndex,
        isPlaying: true,
        currentTime: 0,
      });
      
      // Trigger background auto-refill if running low
      if (!isShuffle && (get().queue.length - 1 - nextIndex) <= 3) {
        get().autoRefillQueue();
      }
    }
  },

  playPrev: () => {
    if (!get().isActiveDevice) {
      import('@/lib/sync/DeviceSyncManager').then(({ DeviceSyncManager }) => {
        DeviceSyncManager.getInstance().dispatchCommand({ type: 'PREV' });
      });
      return;
    }

    const { queue, queueIndex, currentTime, setCurrentTime, setSeekTarget } = get();
    if (currentTime > 2) {
      setCurrentTime(0);
      setSeekTarget(0);
      return;
    }
    
    get().logCurrentTelemetry('skip');
    if (queueIndex > 0) {
      const prevIndex = queueIndex - 1;
      set({
        currentSong: queue[prevIndex],
        queueIndex: prevIndex,
        isPlaying: true,
        currentTime: 0,
      });
    } else {
      get().setCurrentTime(0);
      get().setSeekTarget(0);
    }
  },

  toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),
  cycleRepeatMode: () =>
    set((state) => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const nextIdx = (modes.indexOf(state.repeatMode) + 1) % modes.length;
      return { repeatMode: modes[nextIdx] };
    }),

  addToQueue: (song) => set((state) => ({ queue: [...state.queue, song] })),
  playNextInQueue: (song) =>
    set((state) => {
      const newQueue = [...state.queue];
      newQueue.splice(state.queueIndex + 1, 0, song);
      return { queue: newQueue };
    }),
  playLastInQueue: (song) => set((state) => ({ queue: [...state.queue, song] })),
  removeFromQueue: (songId) =>
    set((state) => ({ queue: state.queue.filter((s) => s.id !== songId) })),
  reorderQueue: (newQueue) => set({ queue: newQueue }),

  autoRefillQueue: async () => {
    const { currentSong, historySongIds, likedSongIds, preferredLanguage, queue, queueIndex } = get();
    if (get().isRefillingQueue) return;
    set({ isRefillingQueue: true });

    try {
      const { CandidateGenerator } = await import('@/lib/recommendation/CandidateGenerator');
      const { Ranker } = await import('@/lib/recommendation/Ranker');

      const candidates = await CandidateGenerator.generateCandidates(
        currentSong,
        historySongIds,
        likedSongIds,
        preferredLanguage,
        50
      );

      const lastArtists = queue.slice(Math.max(0, queueIndex - 5), queueIndex + 1).map(s => s.artist);
      const rankedCandidates = Ranker.rankCandidates(candidates, lastArtists, 15);

      const getCleanTitle = (title: string) => title.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').split('-')[0].trim().toLowerCase();
      const seenTitles = new Set<string>();
      queue.forEach(q => seenTitles.add(getCleanTitle(q.title)));

      const uniqueSongs = rankedCandidates.filter((s: any) => {
        const cleanTitle = getCleanTitle(s.title);
        if (seenTitles.has(cleanTitle)) return false;
        seenTitles.add(cleanTitle);
        return true;
      }).slice(0, 10);

      if (uniqueSongs.length > 0) {
        set({ queue: [...queue, ...uniqueSongs] });
      }
    } catch (e) {
      console.error('Auto-refill failed:', e);
    } finally {
      set({ isRefillingQueue: false });
    }
  },

  syncCloudLibrary: async () => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;
      const userId = session.session.user.id;

      // 1. Fetch Liked Songs
      const { data: likedData, error: likedError } = await supabase
        .from('liked_songs')
        .select('song_id')
        .eq('user_id', userId);
        
      const songIds = likedData ? Array.from(new Set(likedData.map(d => d.song_id))) : [];
      
      // 2. Fetch User Favorites (Artists/Albums)
      const { data: favData } = await supabase
        .from('user_favorites')
        .select('item_id, item_type')
        .eq('user_id', userId);
        
      const favoriteArtistIds = favData ? favData.filter(d => d.item_type === 'artist').map(d => d.item_id) : [];
      const favoriteAlbumIds = favData ? favData.filter(d => d.item_type === 'album').map(d => d.item_id) : [];

      // 3. Fetch Playback History (Recently Played)
      const { data: historyData } = await supabase
        .from('listening_events')
        .select('song_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
        
      const historySongIds = historyData ? Array.from(new Set(historyData.map(d => d.song_id))) : [];
      
      let songs: Song[] = [];
      if (songIds.length > 0) {
        const { SongResolver } = await import('@/lib/discovery/SongResolver');
        songs = await SongResolver.resolveSongs(songIds);
      }
      
      set({ 
        likedSongIds: songIds, 
        likedSongs: songs,
        favoriteArtistIds,
        favoriteAlbumIds,
        // Merge with local history to prevent losing active session history
        historySongIds: Array.from(new Set([...historySongIds, ...get().historySongIds]))
      });
    } catch (e) {
      console.error("Failed to sync cloud library:", e);
    }
  },

  toggleLikeSong: async (songId) => {
    const isLiked = get().likedSongIds.includes(songId);
    
    // Optimistic UI update and local persistence for guests
    set((state) => {
      const newLikedIds = isLiked
        ? state.likedSongIds.filter((id) => id !== songId)
        : [...state.likedSongIds, songId];
        
      // Save locally to persist for guests across reloads
      LocalDatabase.getInstance().savePlaybackSession({
        currentSong: state.currentSong,
        currentTime: state.currentTime,
        queue: state.queue,
        queueIndex: state.queueIndex,
        historySongIds: state.historySongIds,
        likedSongIds: newLikedIds,
        searchHistory: LocalDatabase.getInstance().getSearchHistory(),
        preferredLanguage: state.preferredLanguage,
      });

      return { likedSongIds: newLikedIds };
    });

    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: session } = await supabase.auth.getSession();
      
      if (session?.session?.user) {
        if (isLiked) {
          // Unlike
          await supabase
            .from('liked_songs')
            .delete()
            .eq('user_id', session.session.user.id)
            .eq('song_id', songId);
        } else {
          // Like - use upsert to prevent 409 Conflict if row already exists
          await supabase
            .from('liked_songs')
            .upsert({
              user_id: session.session.user.id,
              song_id: songId,
            }, { onConflict: 'user_id,song_id' });
        }
        
        // Refresh full liked songs metadata after mutation
        get().syncCloudLibrary();
      }
    } catch (e) {
      console.error("Failed to sync like status:", e);
      // Rollback on failure could be implemented here
    }
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

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedArtistId: (id) => set({ selectedArtistId: id, activeTab: 'artist' }),
  setSelectedAlbumId: (id) => set({ selectedAlbumId: id, activeTab: 'album' }),
  setSelectedPlaylistId: (id) => set({ selectedPlaylistId: id, activeTab: 'playlist' }),
  setAudioQualityPreset: (preset) => set({ audioQualityPreset: preset }),

  togglePlayerExpanded: () =>
    set((state) => ({ isPlayerExpanded: !state.isPlayerExpanded })),
  setVideoModeActive: (active) => set({ isVideoModeActive: active, isPlayerExpanded: true }),
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
    const { likedSongIds, downloadedSongIds, historySongIds, audioQualityPreset } = get();
    const backupData = {
      app: 'RaagaX Music Engine',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      likedSongIds,
      downloadedSongIds,
      historySongIds,
      audioQualityPreset,
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
          audioQualityPreset: data.audioQualityPreset || get().audioQualityPreset,
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
}));
