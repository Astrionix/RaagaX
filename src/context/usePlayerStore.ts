import { create } from 'zustand';
import { Song, RepeatMode, EqualizerSettings, AIDJState, ActiveTab } from '@/types/music';
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

  likedSongIds: string[];
  likedSongs: Song[];
  downloadedSongIds: string[];
  historySongIds: string[];
  favoriteArtistIds: string[];
  favoriteAlbumIds: string[];

  eqSettings: EqualizerSettings;
  crossfadeSec: number;
  isSpatial3DEnabled: boolean;

  activeTab: ActiveTab;
  selectedArtistId: string | null;
  selectedAlbumId: string | null;
  selectedPlaylistId: string | null;

  audioQualityPreset: AudioQualityPreset;
  isPlayerExpanded: boolean;
  isVideoModeActive: boolean;
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  isEqOpen: boolean;
  isMiniPlayerFloating: boolean;
  isAiDjModalOpen: boolean;
  isImporterOpen: boolean;
  isBackupOpen: boolean;
  isSettingsModalOpen: boolean;
  isCastModalOpen: boolean;
  isSleepTimerModalOpen: boolean;
  isDeviceModalOpen: boolean;

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
  onlineDevices: { id: string; name: string }[];
  setOnlineDevices: (devices: { id: string; name: string }[]) => void;
  setRemoteState: (state: Partial<PlayerState>) => void;
  transferPlayback: (targetDeviceId: string) => void;

  rightPanelMode: 'queue' | 'devices';
  setRightPanelMode: (mode: 'queue' | 'devices') => void;

  // Actions
  restoreLocalSession: () => Promise<void>;
  fetchLikedSongs: () => Promise<void>;
  setPreferredLanguage: (lang: string) => void;
  playSong: (song: Song, newQueue?: Song[]) => void;
  togglePlayPause: () => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
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

  setEqSettings: (eq: EqualizerSettings) => void;
  setBandGain: (band: keyof EqualizerSettings['bands'], val: number) => void;
  setCrossfadeSec: (sec: number) => void;
  toggleSpatial3D: () => void;

  setActiveTab: (tab: ActiveTab) => void;
  setSelectedArtistId: (id: string | null) => void;
  setSelectedAlbumId: (id: string | null) => void;
  setSelectedPlaylistId: (id: string | null) => void;
  setAudioQualityPreset: (preset: AudioQualityPreset) => void;

  togglePlayerExpanded: () => void;
  setVideoModeActive: (active: boolean) => void;
  toggleLyrics: () => void;
  toggleQueue: () => void;
  toggleEq: () => void;
  toggleMiniPlayerFloating: () => void;
  toggleAiDjModal: () => void;
  toggleImporterModal: () => void;
  toggleBackupModal: () => void;
  toggleSettingsModal: () => void;
  toggleCastModal: () => void;
  toggleSleepTimerModal: () => void;
  toggleDeviceModal: () => void;
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

  likedSongIds: [],
  likedSongs: [],
  downloadedSongIds: [],
  historySongIds: [],
  favoriteArtistIds: [],
  favoriteAlbumIds: [],

  eqSettings: {
    enabled: true,
    preset: 'flat',
    bands: {
      low: 0,
      midLow: 0,
      mid: 0,
      midHigh: 0,
      high: 0,
    },
  },
  crossfadeSec: 2,
  isSpatial3DEnabled: true,

  activeTab: 'home',
  selectedArtistId: null,
  selectedAlbumId: null,
  selectedPlaylistId: null,

  audioQualityPreset: '24-bit 96kHz FLAC',
  isPlayerExpanded: false,
  isVideoModeActive: false,
  isLyricsOpen: false,
  isQueueOpen: false,
  isEqOpen: false,
  isMiniPlayerFloating: false,
  isAiDjModalOpen: false,
  isImporterOpen: false,
  isBackupOpen: false,

  isSettingsModalOpen: false,
  isCastModalOpen: false,
  isSleepTimerModalOpen: false,
  isDeviceModalOpen: false,

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
  onlineDevices: [],
  rightPanelMode: 'queue',

  setRightPanelMode: (mode) => set({ rightPanelMode: mode }),
  setOnlineDevices: (devices) => set({ onlineDevices: devices }),
  setRemoteState: (newState) => set((state) => ({ ...state, ...newState })),
  
  transferPlayback: (targetDeviceId) => {
    set({ activeDeviceId: targetDeviceId, isActiveDevice: targetDeviceId === get().deviceId });
    import('@/lib/sync/DeviceSyncManager').then(({ DeviceSyncManager }) => {
      DeviceSyncManager.getInstance().broadcastState(true);
    });
  },

  setPreferredLanguage: (lang) => set({ preferredLanguage: lang }),

  restoreLocalSession: async () => {
    const session = await LocalDatabase.getInstance().loadPlaybackSession();
    if (session && session.currentSong) {
      set({
        currentSong: session.currentSong,
        currentTime: session.currentTime || 0,
        queue: session.queue || [],
        queueIndex: session.queueIndex || 0,
        historySongIds: session.historySongIds || [],
        likedSongIds: session.likedSongIds || [],
        preferredLanguage: session.preferredLanguage || 'Telugu',
      });
    }
  },

  playSong: (song, newQueue) => {
    const queue = newQueue || get().queue;
    let index = queue.findIndex((s) => s.id === song.id);
    if (index === -1) {
      queue.unshift(song);
      index = 0;
    }
    RecommendationEngine.getInstance().trackPlay(song);
    const newHistory = Array.from(new Set([song.id, ...get().historySongIds]));
    set({
      currentSong: song,
      isPlaying: true,
      queue,
      queueIndex: index,
      currentTime: 0,
      historySongIds: newHistory,
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

  togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => {
    set({ currentTime: time });
    const { currentSong, queue, queueIndex, historySongIds, likedSongIds } = get();
    if (currentSong && Math.floor(time) % 5 === 0) {
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
    const { queue, queueIndex, isShuffle, repeatMode, currentSong, currentTime } = get();
    if (queue.length === 0) return;

    if (currentSong) {
      if (currentTime < 15) {
        RecommendationEngine.getInstance().trackSkip(currentSong);
      } else if (currentTime >= 30) {
        RecommendationEngine.getInstance().trackPlay(currentSong);
      }
    }

    if (repeatMode === 'one' && currentSong) {
      set({ currentSong: { ...currentSong }, currentTime: 0, isPlaying: true });
      return;
    }

    let nextIndex: number;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          // Attempt Autoplay
          if (currentSong) {
            try {
              const { ProviderRegistry } = await import('@/lib/discovery/ProviderRegistry');
              const jiosaavn = ProviderRegistry.getInstance().getProvider('jiosaavn');
              const newSongs = jiosaavn ? await jiosaavn.search(`${currentSong.artist} top hits`, 10) : [];
              const uniqueSongs = newSongs.filter((s: any) => !queue.some((q: any) => q.id === s.id)) as unknown as any[];
              
              if (uniqueSongs.length > 0) {
                const updatedQueue = [...queue, ...uniqueSongs];
                set({ queue: updatedQueue as any });
                // Play the first new song immediately
                set({
                  currentSong: uniqueSongs[0],
                  queueIndex: nextIndex,
                  isPlaying: true,
                  currentTime: 0,
                });
                return;
              } else {
                set({ isPlaying: false });
                return;
              }
            } catch (e) {
              console.error('Autoplay failed:', e);
              set({ isPlaying: false });
              return;
            }
          } else {
            set({ isPlaying: false });
            return;
          }
        }
      }
    }

    const nextSong = queue[nextIndex];
    if (nextSong) {
      set({
        currentSong: nextSong,
        queueIndex: nextIndex,
        isPlaying: true,
        currentTime: 0,
      });
    }
  },

  playPrev: () => {
    const { queue, queueIndex, currentTime } = get();
    if (currentTime > 5) {
      set({ currentTime: 0 });
      return;
    }
    if (queueIndex > 0) {
      const prevIndex = queueIndex - 1;
      set({
        currentSong: queue[prevIndex],
        queueIndex: prevIndex,
        isPlaying: true,
        currentTime: 0,
      });
    } else {
      set({ currentTime: 0 });
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

  fetchLikedSongs: async () => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      const { data, error } = await supabase
        .from('liked_songs')
        .select('song_id')
        .eq('user_id', session.session.user.id);
        
      if (error) throw error;
      
      const songIds = Array.from(new Set(data.map(d => d.song_id)));
      
      const { SongResolver } = await import('@/lib/discovery/SongResolver');
      const songs = await SongResolver.resolveSongs(songIds);
      
      set({ likedSongIds: songIds, likedSongs: songs });
    } catch (e) {
      console.error("Failed to fetch liked songs:", e);
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
        get().fetchLikedSongs();
      }
    } catch (e) {
      console.error("Failed to sync like status:", e);
      // Rollback on failure could be implemented here
    }
  },

  toggleDownloadSong: (songId) => {
    const { queue, currentSong, downloadedSongIds } = get();
    const targetSong = (currentSong && currentSong.id === songId) ? currentSong : queue.find((s) => s.id === songId);

    if (targetSong) {
      import('@/lib/downloadHelper').then(({ downloadSongFile }) => {
        downloadSongFile(targetSong);
      });
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

  toggleFavoriteArtist: (artistId) =>
    set((state) => {
      const isFav = state.favoriteArtistIds.includes(artistId);
      return {
        favoriteArtistIds: isFav
          ? state.favoriteArtistIds.filter((id) => id !== artistId)
          : [...state.favoriteArtistIds, artistId],
      };
    }),

  toggleFavoriteAlbum: (albumId) =>
    set((state) => {
      const isFav = state.favoriteAlbumIds.includes(albumId);
      return {
        favoriteAlbumIds: isFav
          ? state.favoriteAlbumIds.filter((id) => id !== albumId)
          : [...state.favoriteAlbumIds, albumId],
      };
    }),

  setEqSettings: (eq) => set({ eqSettings: eq }),
  setBandGain: (band, val) =>
    set((state) => ({
      eqSettings: {
        ...state.eqSettings,
        bands: { ...state.eqSettings.bands, [band]: val },
      },
    })),
  setCrossfadeSec: (sec) => set({ crossfadeSec: sec }),
  toggleSpatial3D: () => set((state) => ({ isSpatial3DEnabled: !state.isSpatial3DEnabled })),

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
  toggleEq: () => set((state) => ({ isEqOpen: !state.isEqOpen })),
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
