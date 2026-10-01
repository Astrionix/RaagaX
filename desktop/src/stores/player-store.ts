import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Song, LyricsData, QueueTier, LyricsSource } from "@/types/music";
import { syncClient } from "@/services/connect/raaga-sync-client";

export interface EqualizerSettings {
  enabled: boolean;
  bass: number; // -10 to +10
  mid: number;  // -10 to +10
  treble: number; // -10 to +10
  preset: "Flat" | "Bass Boost" | "Vocal Boost" | "Treble Boost" | "Rock" | "Pop" | "Custom";
}

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: "OFF" | "ALL" | "ONE";
  isShuffled: boolean;

  // Playback features & speed
  playbackSpeed: number;

  // Spotify Canvas
  canvasUrl: string | null;
  canvasLoading: boolean;
  canvasActive: boolean;

  // Queue system
  queue: Song[];
  currentIndex: number;
  unshuffledQueue: Song[];

  // Modals & Panels
  isNowPlayingOpen: boolean;
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  isEqualizerOpen: boolean;
  isConnectModalOpen: boolean;
  isAuthModalOpen: boolean;
  isPlaylistPickerOpen: boolean;
  playlistPickerTarget: Song | null;
  isNerdStatsOpen: boolean;

  // Lyrics & Sync
  lyrics: LyricsData | null;
  lyricsLoading: boolean;
  lyricsOffsetMs: number;
  activeLyricIndex: number;
  selectedLyricsProvider: LyricsSource | null;
  setLyricsProvider: (provider: LyricsSource) => Promise<void>;

  // Equalizer
  equalizer: EqualizerSettings;

  // Sleep Timer
  sleepTimerEndsAt: number | null;

  // Actions
  playSong: (song: Song, contextQueue?: Song[], sourceLabel?: string) => Promise<void>;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  next: () => void;
  prev: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPlaybackSpeed: (speed: number) => void;
  
  addToQueue: (song: Song) => void;
  playNext: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  
  setNowPlayingOpen: (open: boolean) => void;
  setCanvasActive: (active: boolean) => void;
  setLyricsOpen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
  setEqualizerOpen: (open: boolean) => void;
  setConnectModalOpen: (open: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
  openPlaylistPicker: (song: Song) => void;
  closePlaylistPicker: () => void;
  setNerdStatsOpen: (open: boolean) => void;
  toggleNerdStats: () => void;

  setEqualizer: (eq: Partial<EqualizerSettings>) => void;
  setSleepTimer: (minutes: number | null) => void;
  setLyricsOffset: (offsetMs: number) => void;
  setCurrentTime: (seconds: number) => void;
  setDuration: (seconds: number) => void;

  // Remote handoff sync
  applyRemoteState: (state: any) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.85,
      isMuted: false,
      repeatMode: "OFF",
      isShuffled: false,

      // Playback speed
      playbackSpeed: 1.0,

      // Spotify Canvas
      canvasUrl: null,
      canvasLoading: false,
      canvasActive: false,

      queue: [],
      currentIndex: 0,
      unshuffledQueue: [],

      isNowPlayingOpen: false,
      isLyricsOpen: false,
      isQueueOpen: false,
      isEqualizerOpen: false,
      isConnectModalOpen: false,
      isAuthModalOpen: false,
      isPlaylistPickerOpen: false,
      playlistPickerTarget: null,
      isNerdStatsOpen: false,

      lyrics: null,
      lyricsLoading: false,
      lyricsOffsetMs: 0,
      activeLyricIndex: -1,
      selectedLyricsProvider: null,

      equalizer: {
        enabled: false,
        bass: 0,
        mid: 0,
        treble: 0,
        preset: "Flat",
      },

      sleepTimerEndsAt: null,

      playSong: async (song: Song, contextQueue?: Song[], sourceLabel?: string) => {
        let newQueue: Song[] = [];
        let index = 0;

        const preparedSong: Song = {
          ...song,
          playbackSource: sourceLabel || song.playbackSource || "Raaga",
        };

        if (contextQueue && contextQueue.length > 0) {
          newQueue = contextQueue.map((s) => ({
            ...s,
            playbackSource: sourceLabel || s.playbackSource,
          }));
          const foundIdx = newQueue.findIndex((s) => s.videoId === song.videoId);
          index = foundIdx !== -1 ? foundIdx : 0;
          if (foundIdx === -1) {
            newQueue.unshift(preparedSong);
            index = 0;
          }
        } else {
          newQueue = [preparedSong];
          index = 0;
        }

        set({
          currentSong: preparedSong,
          queue: newQueue,
          unshuffledQueue: newQueue,
          currentIndex: index,
          isPlaying: true,
          currentTime: 0,
          lyrics: null,
          activeLyricIndex: -1,
          canvasUrl: null,
          canvasLoading: true,
          canvasActive: false,
        });

        // Broadcast active state to connected devices
        syncClient.broadcastState({
          track: preparedSong,
          positionMs: 0,
          isPlaying: true,
          volume: get().volume,
        });

        // 1. Fetch synchronized lyrics asynchronously via Next.js API
        set({ lyricsLoading: true });
        const providerParam = get().selectedLyricsProvider ? `&provider=${get().selectedLyricsProvider}` : "";
        const lyricsUrl = `/api/music/lyrics?title=${encodeURIComponent(
          preparedSong.title
        )}&artist=${encodeURIComponent(preparedSong.artist)}&duration=${
          preparedSong.durationSeconds || 0
        }&videoId=${encodeURIComponent(preparedSong.videoId)}&album=${encodeURIComponent(
          preparedSong.albumName || ""
        )}${providerParam}`;
        fetch(lyricsUrl)
          .then((res) => (res.ok ? res.json() : null))
          .then((lyrics) => {
            if (lyrics) {
              set({ lyrics, lyricsLoading: false });
            } else {
              set({ lyricsLoading: false });
            }
          })
          .catch(() => set({ lyricsLoading: false }));

        // 2. Fetch Spotify Canvas looping video in background
        const canvasApiUrl = `/api/music/canvas?title=${encodeURIComponent(
          preparedSong.title
        )}&artist=${encodeURIComponent(preparedSong.artist)}&album=${encodeURIComponent(
          preparedSong.albumName || ""
        )}`;
        fetch(canvasApiUrl)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.canvasUrl) {
              set({
                canvasUrl: data.canvasUrl,
                canvasLoading: false,
                canvasActive: true,
              });
            } else {
              set({
                canvasUrl: null,
                canvasLoading: false,
                canvasActive: false,
              });
            }
          })
          .catch(() =>
            set({
              canvasUrl: null,
              canvasLoading: false,
              canvasActive: false,
            })
          );

        // 3. If context queue is small, fetch radio recommendations in background via Next.js API
        if (newQueue.length <= 1) {
          fetch(`/api/music/radio?videoId=${encodeURIComponent(preparedSong.videoId)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              const radioSongs: Song[] = data?.songs || [];
              if (radioSongs.length > 0) {
                set((state) => {
                  const existingIds = new Set(state.queue.map((s) => s.videoId));
                  const filtered = radioSongs.filter((s) => !existingIds.has(s.videoId));
                  return {
                    queue: [...state.queue, ...filtered],
                  };
                });
              }
            })
            .catch(() => {});
        }
      },

      togglePlay: () => {
        const isPlaying = !get().isPlaying;
        set({ isPlaying });
        syncClient.broadcastState({
          isPlaying,
          positionMs: get().currentTime * 1000,
        });
      },

      pause: () => {
        set({ isPlaying: false });
        syncClient.broadcastState({
          isPlaying: false,
          positionMs: get().currentTime * 1000,
        });
      },

      resume: () => {
        set({ isPlaying: true });
        syncClient.broadcastState({
          isPlaying: true,
          positionMs: get().currentTime * 1000,
        });
      },

      seek: (seconds: number) => {
        set({ currentTime: seconds });
        syncClient.broadcastState({
          positionMs: seconds * 1000,
          isPlaying: get().isPlaying,
        });
      },

      setVolume: (volume: number) => {
        set({ volume, isMuted: volume === 0 });
        syncClient.broadcastState({ volume });
      },

      toggleMute: () => {
        const isMuted = !get().isMuted;
        set({ isMuted });
      },

      next: () => {
        const { queue, currentIndex, repeatMode } = get();
        if (queue.length === 0) return;

        if (currentIndex < queue.length - 1) {
          const nextIndex = currentIndex + 1;
          const nextSong = queue[nextIndex];
          set({
            currentIndex: nextIndex,
            currentSong: nextSong,
            currentTime: 0,
            isPlaying: true,
            lyrics: null,
            activeLyricIndex: -1,
          });
          get().playSong(nextSong, queue);
        } else if (repeatMode === "ALL") {
          const nextSong = queue[0];
          set({
            currentIndex: 0,
            currentSong: nextSong,
            currentTime: 0,
            isPlaying: true,
          });
          get().playSong(nextSong, queue);
        }
      },

      prev: () => {
        const { queue, currentIndex, currentTime } = get();
        if (queue.length === 0) return;

        // If playback past 3 seconds, replay current song
        if (currentTime > 3) {
          set({ currentTime: 0 });
          return;
        }

        if (currentIndex > 0) {
          const prevIndex = currentIndex - 1;
          const prevSong = queue[prevIndex];
          set({
            currentIndex: prevIndex,
            currentSong: prevSong,
            currentTime: 0,
            isPlaying: true,
            lyrics: null,
            activeLyricIndex: -1,
          });
          get().playSong(prevSong, queue);
        } else {
          set({ currentTime: 0 });
        }
      },

      toggleShuffle: () => {
        const { isShuffled, queue, currentSong, unshuffledQueue } = get();
        const nextShuffled = !isShuffled;

        if (nextShuffled) {
          // Shuffle remaining queue items
          const remaining = queue.filter((s) => s.videoId !== currentSong?.videoId);
          for (let i = remaining.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
          }
          const newQueue = currentSong ? [currentSong, ...remaining] : remaining;
          set({ isShuffled: true, queue: newQueue, currentIndex: 0 });
        } else {
          const newQueue = unshuffledQueue.length ? unshuffledQueue : queue;
          const idx = newQueue.findIndex((s) => s.videoId === currentSong?.videoId);
          set({
            isShuffled: false,
            queue: newQueue,
            currentIndex: idx !== -1 ? idx : 0,
          });
        }
      },

      toggleRepeat: () => {
        const current = get().repeatMode;
        const nextMode = current === "OFF" ? "ALL" : current === "ALL" ? "ONE" : "OFF";
        set({ repeatMode: nextMode });
      },

      addToQueue: (song: Song) => {
        const prepared = { ...song, queueTier: "USER_QUEUE" as QueueTier };
        set((state) => ({
          queue: [...state.queue, prepared],
          unshuffledQueue: [...state.unshuffledQueue, prepared],
        }));
      },

      playNext: (song: Song) => {
        const { queue, currentIndex } = get();
        const prepared = { ...song, queueTier: "USER_QUEUE" as QueueTier };
        const newQueue = [...queue];
        newQueue.splice(currentIndex + 1, 0, prepared);
        set({ queue: newQueue });
      },

      removeFromQueue: (index: number) => {
        const { queue, currentIndex } = get();
        if (index === currentIndex) return;
        const newQueue = queue.filter((_, i) => i !== index);
        const newIdx = index < currentIndex ? currentIndex - 1 : currentIndex;
        set({ queue: newQueue, currentIndex: newIdx });
      },

      reorderQueue: (fromIndex: number, toIndex: number) => {
        const { queue, currentIndex } = get();
        const newQueue = [...queue];
        const [moved] = newQueue.splice(fromIndex, 1);
        newQueue.splice(toIndex, 0, moved);

        let newIdx = currentIndex;
        if (currentIndex === fromIndex) {
          newIdx = toIndex;
        } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
          newIdx = currentIndex - 1;
        } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
          newIdx = currentIndex + 1;
        }

        set({ queue: newQueue, currentIndex: newIdx });
      },

      clearQueue: () => {
        const { currentSong } = get();
        set({
          queue: currentSong ? [currentSong] : [],
          currentIndex: 0,
        });
      },

      setPlaybackSpeed: (speed: number) => set({ playbackSpeed: speed }),
      setNowPlayingOpen: (open: boolean) => set({ isNowPlayingOpen: open }),
      setCanvasActive: (active: boolean) => set({ canvasActive: active }),
      setLyricsOpen: (open: boolean) => set({ isLyricsOpen: open }),
      setQueueOpen: (open: boolean) => set({ isQueueOpen: open }),
      setEqualizerOpen: (open: boolean) => set({ isEqualizerOpen: open }),
      setConnectModalOpen: (open: boolean) => set({ isConnectModalOpen: open }),
      setAuthModalOpen: (open: boolean) => set({ isAuthModalOpen: open }),
      openPlaylistPicker: (song: Song) =>
        set({ isPlaylistPickerOpen: true, playlistPickerTarget: song }),
      closePlaylistPicker: () =>
        set({ isPlaylistPickerOpen: false, playlistPickerTarget: null }),
      setNerdStatsOpen: (open: boolean) => set({ isNerdStatsOpen: open }),
      toggleNerdStats: () => set((state) => ({ isNerdStatsOpen: !state.isNerdStatsOpen })),

      setEqualizer: (eq: Partial<EqualizerSettings>) =>
        set((state) => ({ equalizer: { ...state.equalizer, ...eq } })),

      setSleepTimer: (minutes: number | null) => {
        if (!minutes) {
          set({ sleepTimerEndsAt: null });
        } else {
          set({ sleepTimerEndsAt: Date.now() + minutes * 60 * 1000 });
        }
      },

      setLyricsOffset: (offsetMs: number) => set({ lyricsOffsetMs: offsetMs }),

      setLyricsProvider: async (provider: LyricsSource) => {
        set({ selectedLyricsProvider: provider, lyricsLoading: true });
        const { currentSong } = get();
        if (!currentSong) {
          set({ lyricsLoading: false });
          return;
        }

        try {
          const lyricsUrl = `/api/music/lyrics?title=${encodeURIComponent(
            currentSong.title
          )}&artist=${encodeURIComponent(currentSong.artist)}&duration=${
            currentSong.durationSeconds || 0
          }&videoId=${encodeURIComponent(currentSong.videoId)}&album=${encodeURIComponent(
            currentSong.albumName || ""
          )}&provider=${provider}`;

          const res = await fetch(lyricsUrl);
          if (res.ok) {
            const data = await res.json();
            set({ lyrics: data, lyricsLoading: false });
          } else {
            set({ lyricsLoading: false });
          }
        } catch {
          set({ lyricsLoading: false });
        }
      },

      setCurrentTime: (currentTime: number) => {
        const { lyrics, lyricsOffsetMs, sleepTimerEndsAt, pause } = get();
        
        // Check sleep timer
        if (sleepTimerEndsAt && Date.now() >= sleepTimerEndsAt) {
          set({ sleepTimerEndsAt: null });
          pause();
          return;
        }

        // Update active lyric index
        if (lyrics?.synced && lyrics.lines.length > 0) {
          const currentMs = currentTime * 1000 + lyricsOffsetMs;
          let activeIdx = -1;
          for (let i = 0; i < lyrics.lines.length; i++) {
            if (currentMs >= lyrics.lines[i].startTimeMs) {
              activeIdx = i;
            } else {
              break;
            }
          }
          set({ currentTime, activeLyricIndex: activeIdx });
        } else {
          set({ currentTime });
        }
      },

      setDuration: (duration: number) => set({ duration }),

      applyRemoteState: (state: any) => {
        if (!state) return;
        if (state.track) {
          set({
            currentSong: state.track,
            isPlaying: state.isPlaying ?? true,
            currentTime: (state.positionMs || 0) / 1000,
          });
        }
        if (typeof state.isPlaying === "boolean") {
          set({ isPlaying: state.isPlaying });
        }
        if (typeof state.positionMs === "number") {
          set({ currentTime: state.positionMs / 1000 });
        }
        if (typeof state.volume === "number") {
          set({ volume: state.volume });
        }
      },
    }),
    {
      name: "raaga_player_state",
      partialize: (state) => ({
        currentSong: state.currentSong,
        volume: state.volume,
        isMuted: state.isMuted,
        repeatMode: state.repeatMode,
        isShuffled: state.isShuffled,
        equalizer: state.equalizer,
      }),
    }
  )
);
