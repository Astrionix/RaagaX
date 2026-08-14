'use client';

import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { RendererManager } from '@/lib/playback/RendererManager';
import { PlaybackEngine } from '@/lib/playback/PlaybackEngine';
import { AudioFocusManager } from '@/lib/playback/AudioFocusManager';
import { InterruptionCoordinator } from '@/lib/playback/InterruptionCoordinator';
import { MediaSessionManager } from '@/lib/playback/MediaSessionManager';
import { TransitionManager } from '@/lib/playback/TransitionManager';
import { WebAudioGraph } from '@/lib/playback/WebAudioGraph';
import { BufferMonitor } from '@/lib/playback/BufferMonitor';
import { LyricsEngine } from '@/lib/lyrics/LyricsEngine';
import { RaagaXNativePlayer } from '@/lib/playback/native/RaagaXNativePlayer';
import { QueueManager } from '@/lib/queue/QueueManager';
const FALLBACK_AUDIO_URL = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
const QUEUE_REFILL_THRESHOLD = 3;

import { PlaybackService } from '@/lib/playback/PlaybackService';

export function AudioPlayerController() {
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);
  
  const prevSongIdRef = useRef<string | null>(null);
  const isRefilling = useRef(false);
  const seekTarget = usePlayerStore(state => state.seekTarget);
  const lastSeekTimeRef = useRef<number>(0);

  const {
    currentSong,
    isPlaying,
    currentTime,
    volume,
    isMuted,
    activeRenderer,
    queue,
    queueIndex,
    likedSongIds,
    historySongIds,
    addToQueue,
    playNext,
    playPrev,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    sleepTimerEndsAt,
    setSleepTimer,
    restoreLocalSession,
    isActiveDevice,
    isAutoplayEnabled,
  } = usePlayerStore();

  // Register Audio Elements with PlaybackService (web only)
  useEffect(() => {
    if (RaagaXNativePlayer.isNative()) return; // native path
    if (audioRefA.current && audioRefB.current) {
      PlaybackService.getInstance().registerElements(audioRefA.current, audioRefB.current);
      PlaybackService.getInstance().setupMediaSessionHandlers();
      WebAudioGraph.getInstance().init(audioRefA.current, audioRefB.current);
    }
  }, []);

  // Native Android: hook into ExoPlayer queueEnded & trackChanged events.
  // NOTE: We do NOT trigger playNext() on trackChanged — ExoPlayer auto-advances
  // natively via the full playlist set by setQueue(). We only sync the UI state.
  useEffect(() => {
    if (!RaagaXNativePlayer.isNative()) return;

    // queueEnded fires only when ExoPlayer has exhausted the entire playlist.
    // This is where we trigger autoplay continuation, NOT on every song end.
    const unsubQueueEnded = RaagaXNativePlayer.addQueueEndedListener(() => {
      console.log('[AudioPlayerController] Native queue exhausted — triggering autoplay continuation');
      const store = usePlayerStore.getState();
      if (store.isActiveDevice) {
        store.setIsPlaying(false, true);
        // Let the autoplay/recommendation engine load the next batch
        if (store.isAutoplayEnabled) {
          store.playNext();
        }
      }
    });

    // trackChanged fires on every auto-advance. We sync the JS queue index to
    // match what ExoPlayer is already playing — no JS-side queue advancement needed.
    const unsubChanged = RaagaXNativePlayer.addTrackChangedListener((data) => {
      console.log('[AudioPlayerController] Native track changed — index:', data.index, 'title:', data.title);
      const store = usePlayerStore.getState();
      const manager = QueueManager.getInstance();
      const snapshot = manager.getSnapshot();
      const queue = snapshot.items.map((i: any) => i.song);

      // Use native index first (most reliable), then fall back to URL/title matching
      let targetIndex = -1;
      if (typeof data.index === 'number' && data.index >= 0 && data.index < queue.length) {
        targetIndex = data.index;
      } else if (data.url) {
        targetIndex = queue.findIndex((s: Song) => s.audioUrl === data.url);
      } else if (data.title) {
        targetIndex = queue.findIndex((s: Song) => s.title === data.title);
      }

      if (targetIndex >= 0 && targetIndex < queue.length) {
        const nextSong = queue[targetIndex];
        // Avoid re-sync if already on this song
        if (store.currentSong?.id === nextSong?.id) return;
        manager.skipTo(targetIndex);
        store.commitPlaybackTransition(nextSong, targetIndex);
      }
    });

    return () => {
      unsubQueueEnded();
      unsubChanged();
    };
  }, []);

  // Native Android: poll ExoPlayer playback state for position & duration
  useEffect(() => {
    if (!RaagaXNativePlayer.isNative() || !isPlaying) return;
    const interval = setInterval(async () => {
      if (Date.now() - lastSeekTimeRef.current < 1500) {
        return; // Skip updating while native seek is settling
      }
      const state = await RaagaXNativePlayer.getPlaybackState();
      if (state && state.positionMs >= 0) {
        usePlayerStore.getState().setCurrentTime(state.positionMs / 1000, true);
        if (state.durationMs > 0) {
          usePlayerStore.getState().setDuration(state.durationMs / 1000);
        }
        if (usePlayerStore.getState().isActiveDevice) {
          import('@/lib/connect/PlaybackStateSync').then(({ PlaybackStateSync }) => {
            PlaybackStateSync.getInstance().broadcastState(false);
          });
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Restore Instant Playback Session
  useEffect(() => {
    restoreLocalSession();
  }, [restoreLocalSession]);

  // Lifecycle listeners: Persist latest state immediately when app is backgrounded or tab closed
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const flushPersist = () => {
      const state = usePlayerStore.getState();
      if (state.currentSong) {
        import('@/lib/localDatabase').then(({ LocalDatabase }) => {
          LocalDatabase.getInstance().savePlaybackSession({
            currentSong: state.currentSong,
            currentTime: state.currentTime,
            queue: state.queue,
            queueIndex: state.queueIndex,
            historySongIds: state.historySongIds,
            likedSongIds: state.likedSongIds,
            searchHistory: LocalDatabase.getInstance().getSearchHistory(),
            preferredLanguage: state.preferredLanguage,
            sessionLanguage: state.sessionLanguage || state.preferredLanguage,
            wasPlaying: false, // HARD RULE: Always false on unload/dismiss so next launch NEVER auto-plays
            playbackState: 'STOPPED',
            deviceState: 'TASK_REMOVED',
            timestamp: Date.now(),
          });
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPersist();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushPersist);
    window.addEventListener('beforeunload', flushPersist);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushPersist);
      window.removeEventListener('beforeunload', flushPersist);
    };
  }, []);

  // Watch for explicit seek targets from UI
  useEffect(() => {
    if (seekTarget !== null) {
      console.log('[SEEK] Store target:', seekTarget, 'ms:', seekTarget * 1000);
      lastSeekTimeRef.current = Date.now();
      
      PlaybackService.getInstance().seek(seekTarget);
      LyricsEngine.getInstance().seek(seekTarget * 1000);
      usePlayerStore.setState({ seekTarget: null });
    }
  }, [seekTarget]);

  // Auto-refill queue (Continuous Radio Mode)
  useEffect(() => {
    const remaining = queue.length - (queueIndex + 1);
    if (!isAutoplayEnabled || remaining >= QUEUE_REFILL_THRESHOLD || isRefilling.current || !currentSong) return;

    isRefilling.current = true;
    const existingIds = queue.map(s => s.id);
    const genre = currentSong.genre || 'TELUGU HITS';
    const language = genre.split(' ')[0] || 'Telugu';
    const validLangs = ['Telugu', 'Kannada', 'Tamil', 'Hindi', 'Malayalam', 'English'];
    const lang = validLangs.find(l => l.toUpperCase() === language.toUpperCase()) || 'Telugu';

    const lastArtists = queue
      .slice(Math.max(0, queueIndex - 5), queueIndex)
      .map(s => s.artist)
      .filter(Boolean) as string[];

    fetch(`/api/queue-refill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        language: lang, 
        excludeIds: existingIds, 
        likedIds: likedSongIds,
        historyIds: historySongIds,
        currentSong: currentSong,
        lastArtists: lastArtists,
        playbackContext: usePlayerStore.getState().playbackContext,
        count: 10 
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.data?.songs)) {
          const newSongs: Song[] = data.data.songs;
          newSongs.forEach(s => addToQueue(s));
        }
      })
      .catch(() => {})
      .finally(() => { isRefilling.current = false; });
  }, [queueIndex, queue, currentSong, isAutoplayEnabled, addToQueue, historySongIds, likedSongIds]);

  // Handle Play/Pause State Synchronization
  useEffect(() => {
    const shouldRenderAudio = activeRenderer === 'audio' && isActiveDevice;
    const store = usePlayerStore.getState();
    const canPlay = isPlaying && store.playbackIntent === 'PLAYING';

    if (RaagaXNativePlayer.isNative()) {
      // Native path: route to ExoPlayer foreground service
      if (!shouldRenderAudio) {
        RaagaXNativePlayer.pause();
        LyricsEngine.getInstance().setPlaying(false);
      } else {
        if (canPlay) {
          RaagaXNativePlayer.resume();
          LyricsEngine.getInstance().setPlaying(true);
        } else {
          RaagaXNativePlayer.pause();
          LyricsEngine.getInstance().setPlaying(false);
        }
      }
      return;
    }

    // Web path: HTMLAudioElement
    const activeAudio = PlaybackService.getInstance().getActiveAudio();
    if (!activeAudio) return;

    if (!shouldRenderAudio) {
      if (!activeAudio.paused) {
        activeAudio.pause();
      }
      LyricsEngine.getInstance().setPlaying(false);
    } else {
      if (canPlay && activeAudio.paused) {
        PlaybackService.getInstance().play();
        LyricsEngine.getInstance().setPlaying(true);
      } else if (!canPlay && !activeAudio.paused) {
        PlaybackService.getInstance().pause();
        LyricsEngine.getInstance().setPlaying(false);
      }
    }
  }, [isPlaying, isActiveDevice, activeRenderer]);

  const songStartTimeRef = useRef<number>(Date.now());

  // Handle currentSong change — native: send to ExoPlayer; web: audio graph
  useEffect(() => {
    if (!currentSong?.id) {
      LyricsEngine.getInstance().clear();
      prevSongIdRef.current = null;
      return;
    }

    if (prevSongIdRef.current === currentSong.id) {
      return;
    }
    prevSongIdRef.current = currentSong.id;
    songStartTimeRef.current = Date.now();

    LyricsEngine.getInstance().loadTrack(currentSong.id);

    // Trigger asynchronous adaptive dynamic zone update (+2 through +6)
    import('@/lib/queue/AdaptiveQueueController').then(({ AdaptiveQueueController }) => {
      AdaptiveQueueController.getInstance().regenerateDynamicZone();
    });

    if (RaagaXNativePlayer.isNative()) {
      // Native ExoPlayer is autonomous and driven by setQueue / loadQueueContext in PlaybackService.
      // The UI component MUST NOT trigger single-track play commands on mount or currentSong change!
    } else {
      WebAudioGraph.getInstance().resume();
    }
  }, [currentSong?.id]);

  // Handle Volume & Mute dynamically
  useEffect(() => {
    const effectiveVolume = isMuted ? 0 : volume;
    if (RaagaXNativePlayer.isNative()) {
      RaagaXNativePlayer.setVolume(effectiveVolume);
    } else {
      const tm = TransitionManager.getInstance();
      if (tm.getState() === 'CROSSFADING') return;
      const activeAudio = PlaybackService.getInstance().getActiveAudio();
      if (activeAudio) activeAudio.volume = effectiveVolume;
    }
  }, [volume, isMuted]);

  // Handle Sleep Timer
  useEffect(() => {
    const interval = setInterval(() => {
      const { sleepTimerEndsAt, sleepTimerMode, isPlaying, setIsPlaying, setSleepTimer, setToastMessage } = usePlayerStore.getState();
      if (!isPlaying) return;

      if (sleepTimerMode === 'duration' && sleepTimerEndsAt && Date.now() >= sleepTimerEndsAt) {
        setIsPlaying(false);
        setSleepTimer(null);
        setToastMessage('Sleep Timer Ended — Playback has been paused');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Remote Device Clock Interpolation
  useEffect(() => {
    if (isActiveDevice || !isPlaying) return;
    
    const interval = setInterval(() => {
       const store = usePlayerStore.getState();
       if (!store.lastSyncDbTime || store.lastSyncPositionMs === null) return;

       const dbTime = new Date(store.lastSyncDbTime).getTime();
       const elapsed = Date.now() - dbTime;
       const livePositionSeconds = (store.lastSyncPositionMs + elapsed) / 1000;
       
       if (livePositionSeconds <= store.duration) {
         usePlayerStore.setState({ currentTime: livePositionSeconds });
       }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActiveDevice, isPlaying]);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (audio === PlaybackService.getInstance().getActiveAudio()) {
      setDuration(audio.duration);
    }
  };

  return (
    <>
      <audio
        ref={audioRefA}
        onLoadedMetadata={handleLoadedMetadata}
        preload="auto"
        playsInline
        className="hidden"
      />
      <audio
        ref={audioRefB}
        onLoadedMetadata={handleLoadedMetadata}
        preload="auto"
        playsInline
        className="hidden"
      />
    </>
  );
}
