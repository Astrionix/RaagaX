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
import { SeekLock } from '@/lib/playback/SeekLock';
import { QueueManager } from '@/lib/queue/QueueManager';
const QUEUE_REFILL_THRESHOLD = 3;

import { PlaybackRecoveryEngine } from '@/lib/playback/PlaybackRecoveryEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { AdaptiveQueueController } from '@/lib/queue/AdaptiveQueueController';
import { PlaybackSourceResolver } from '@/lib/playbackSourceResolver';
import { PreloadManager } from '@/lib/playback/PreloadManager';
import { ArtworkColorExtractor } from '@/lib/theme/ArtworkColorExtractor';
import { getApiUrl } from '@/lib/config/apiConfig';
import { RadioEngine } from '@/lib/radio/RadioEngine';

export function AudioPlayerController() {
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);
  
  const prevSongIdRef = useRef<string | null>(null);
  const isRefilling = useRef(false);
  const seekTarget = usePlayerStore(state => state.seekTarget);
  const lastSeekTimeRef = useRef<number>(0);
  const lastTrackChangeTimeRef = useRef<number>(Date.now());

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
    duration,
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
      PlaybackService.getInstance().syncLivePlayingState();
    }
  }, []);

  // On cold startup: restore crash-safe playback snapshot
  useEffect(() => {
    try {
      const snapshot = PlaybackRecoveryEngine.getInstance().restoreSnapshot();
      if (snapshot && !usePlayerStore.getState().currentSong) {
        usePlayerStore.setState({
          currentSong: snapshot.song,
          currentTime: snapshot.positionMs / 1000,
          isPlaying: false, // restore in paused state so it doesn't blast audio unexpectedly
        });
      }
    } catch {}
  }, []);

  // Native Android: hook into ExoPlayer queueEnded, trackChanged, and playbackStateChanged events.
  // NOTE: We do NOT trigger playNext() on trackChanged — ExoPlayer auto-advances
  // natively via the full playlist set by setQueue(). We only sync the UI state.
  useEffect(() => {
    if (!RaagaXNativePlayer.isNative()) return;

    // Immediately fetch authoritative native playback state on mount
    RaagaXNativePlayer.getPlaybackState().then((state) => {
      if (state) {
        console.log('[AudioPlayerController] Native initial state on mount:', state);
        const store = usePlayerStore.getState();
        store.setIsPlaying(state.isPlaying, true);
        if (state.positionMs > 0) {
          store.setCurrentTime(state.positionMs / 1000, true);
        }
        if (state.durationMs > 0) {
          store.setDuration(state.durationMs / 1000);
        }
      }
    }).catch(() => {});

    // playbackStateChanged fires whenever ExoPlayer changes between PLAYING and PAUSED
    const unsubPlaybackState = RaagaXNativePlayer.addPlaybackStateListener((data) => {
      console.log('[AudioPlayerController] Native playbackStateChanged — isPlaying:', data.isPlaying, 'durationMs:', data.durationMs, 'positionMs:', data.positionMs);
      const store = usePlayerStore.getState();
      // If store is in the middle of a track transition with PLAYING intent, ignore transient false from buffer init
      if (!data.isPlaying && store.playbackIntent === 'PLAYING') {
        console.log('[AudioPlayerController] Ignoring transient buffer false isPlaying while playbackIntent is PLAYING');
        return;
      }
      store.setIsPlaying(data.isPlaying, true);
      if (typeof data.durationMs === 'number' && data.durationMs > 0) {
        store.setDuration(data.durationMs / 1000);
        // If we now have a valid duration and isPlaying, also ensure isPlaying is set
        // (covers cases where isPlaying: true event was swallowed by the transient guard)
        if (data.isPlaying) {
          store.setIsPlaying(true, true);
        }
      }
      if (typeof data.positionMs === 'number' && data.positionMs >= 0) {
        store.setCurrentTime(data.positionMs / 1000, true);
      }
    });

    // queueEnded fires when the current track finishes playing in ExoPlayer.
    // Trigger store.playNext() to seamlessly advance to the next track in the authoritative queue.
    const unsubQueueEnded = RaagaXNativePlayer.addQueueEndedListener(() => {
      if (Date.now() - lastSeekTimeRef.current < 1500) {
        console.log('[AudioPlayerController] Ignoring native queueEnded during seek settle lock');
        return;
      }
      const timeSinceChange = Date.now() - lastTrackChangeTimeRef.current;
      if (timeSinceChange < 3000) {
        console.log('[AudioPlayerController] Suppressing premature queueEnded (only', timeSinceChange, 'ms since track change)');
        return;
      }
      const store = usePlayerStore.getState();
      if (store.duration > 0 && store.currentTime < store.duration - 5) {
        console.log('[AudioPlayerController] Suppressing premature queueEnded (currentTime', store.currentTime, '< duration', store.duration, ')');
        return;
      }
      console.log('[AudioPlayerController] Native track ended — advancing to next track via playNext()');
      if (store.isActiveDevice) {
        store.playNext();
      }
    });

    const unsubChanged = RaagaXNativePlayer.addTrackChangedListener((data) => {
      lastTrackChangeTimeRef.current = Date.now();
      const currentStoreTrack = usePlayerStore.getState().currentSong;
      const oldTrackId = data.oldTrackId || currentStoreTrack?.id || '';
      const newTrackId = data.trackId || '';
      
      console.log(`[TRACK_TRANSITION]\noldTrackId=${oldTrackId}\nnewTrackId=${newTrackId}\ntitle=${data.title || ''}\nartist=${data.artist || ''}\nartwork=${data.artworkUrl || ''}\nduration=${data.durationMs || 0}`);

      if (data.trackId || data.title) {
        const store = usePlayerStore.getState();
        const incomingId = data.trackId;
        
        // 1. Resolve track object by ID from authoritative queue
        let track = incomingId ? store.queue.find(s => s.id === incomingId) : null;
        let matchIdx = incomingId ? store.queue.findIndex(s => s.id === incomingId) : -1;

        // 2. If not found by ID, match by queueIndex
        if (!track && typeof data.queueIndex === 'number' && data.queueIndex >= 0 && data.queueIndex < store.queue.length) {
          track = store.queue[data.queueIndex];
          matchIdx = data.queueIndex;
        }

        // 3. If not found by index, match by title
        if (!track && data.title) {
          matchIdx = store.queue.findIndex(s => s.title?.trim().toLowerCase() === data.title?.trim().toLowerCase());
          if (matchIdx !== -1) {
            track = store.queue[matchIdx];
          }
        }

        // 4. If still not in existing queue, construct full track model from native payload
        if (!track) {
          track = {
            id: incomingId || `native-${Date.now()}`,
            title: data.title || 'RaagaX Music',
            artist: data.artist || 'Unknown Artist',
            artistId: `art-${incomingId || Date.now()}`,
            album: 'RaagaX Music',
            albumId: `alb-${incomingId || Date.now()}`,
            coverUrl: data.artworkUrl || '/app-icon.png',
            duration: data.durationMs && data.durationMs > 0 ? Math.round(data.durationMs / 1000) : 180,
            audioUrl: data.url || '',
            genre: 'Various',
            category: 'global_trending',
            releaseYear: new Date().getFullYear(),
            plays: 0,
            likes: 0,
          };
          matchIdx = typeof data.queueIndex === 'number' ? data.queueIndex : store.queueIndex;
        }

        const validTrack: Song = track;
        const durationSec = data.durationMs && data.durationMs > 0 
          ? (data.durationMs / 1000) 
          : (validTrack.duration || 0);

        // Single atomic state update to prevent UI flickering / mixed metadata
        usePlayerStore.setState({
          currentSong: validTrack,
          queueIndex: matchIdx !== -1 ? matchIdx : store.queueIndex,
          isPlaying: data.isPlaying !== undefined ? data.isPlaying : true,
          playbackIntent: 'PLAYING',
          currentTime: data.positionMs ? (data.positionMs / 1000) : 0,
          duration: durationSec,
        });

        console.log(`[QUEUE_AUTO_ADVANCE]\noldTrackId=${oldTrackId}\nnewTrackId=${validTrack.id}\noldQueueIndex=${typeof data.queueIndex === 'number' && data.queueIndex > 0 ? data.queueIndex - 1 : 0}\nnewQueueIndex=${matchIdx !== -1 ? matchIdx : data.queueIndex || 0}`);
        console.log(`[QUEUE_TRACK_PLAYING]\ntrackId=${validTrack.id}\nisPlaying=true\nposition=0`);
        console.log(`[PLAYBACK_STATE_PUBLISHED]\ntrackId=${validTrack.id}\ntitle=${validTrack.title}\nartist=${validTrack.artist}\nartwork=${validTrack.coverUrl}\ndurationMs=${durationSec * 1000}\npositionMs=${data.positionMs || 0}\nisPlaying=true`);

        import('@/lib/playback/MediaSessionManager').then(({ MediaSessionManager }) => {
          MediaSessionManager.getInstance().updateSongMetadata(validTrack);
        });

        import('@/lib/playback/PlaybackSession').then(({ SessionManager }) => {
          SessionManager.getInstance().updateSession({
            currentTrack: validTrack,
            currentTrackId: track!.id,
            currentQueueIndex: matchIdx !== -1 ? matchIdx : store.queueIndex,
            position: data.positionMs ? (data.positionMs / 1000) : 0,
            duration: durationSec,
            isPlaying: true,
          });
        }).catch(() => {});

        // Broadcast to follower devices in Spotify Connect session
        if (store.isActiveDevice) {
          import('@/lib/connect/PlaybackStateSync').then(({ PlaybackStateSync }) => {
            PlaybackStateSync.getInstance().broadcastState(true);
          });
        }
      }

      // Proactively poll duration if duration was 0
      const pollDuration = async () => {
        try {
          const state = await RaagaXNativePlayer.getPlaybackState();
          if (state && state.durationMs > 0) {
            const currentDur = usePlayerStore.getState().duration;
            if (currentDur <= 0 || Math.abs(currentDur - (state.durationMs / 1000)) > 2) {
              usePlayerStore.getState().setDuration(state.durationMs / 1000);
            }
          }
        } catch {}
      };
      setTimeout(pollDuration, 300);
      setTimeout(pollDuration, 800);
    });

    // seekComplete fires when ExoPlayer confirms the seek has been applied.
    // Immediately update the UI with the authoritative position so the seekbar
    // doesn't snap back during the 1-second poll gap.
    const unsubSeekComplete = RaagaXNativePlayer.addSeekCompleteListener((data) => {
      console.log('[AudioPlayerController] Native seekComplete confirmed at:', data.positionMs, 'ms | wasPlaying:', data.wasPlaying);
      lastSeekTimeRef.current = Date.now();
      // Apply authoritative position immediately — this replaces the stale pre-seek value
      usePlayerStore.getState().setCurrentTime(data.positionMs / 1000, true);
      // Sync lyrics engine to the new position
      import('@/lib/lyrics/LyricsEngine').then(({ LyricsEngine }) => {
        LyricsEngine.getInstance().seek(data.positionMs);
      });
      // Immediately broadcast authoritative state to followers
      if (usePlayerStore.getState().isActiveDevice) {
        import('@/lib/connect/PlaybackStateSync').then(({ PlaybackStateSync }) => {
          PlaybackStateSync.getInstance().broadcastState(true);
        });
      }
    });

    const unsubActionNext = RaagaXNativePlayer.addActionNextListener(() => {
      console.log('[AudioPlayerController] Native actionNext command received -> playNext()');
      usePlayerStore.getState().playNext();
    });

    const unsubActionPrev = RaagaXNativePlayer.addActionPrevListener(() => {
      console.log('[AudioPlayerController] Native actionPrev command received -> playPrev()');
      usePlayerStore.getState().playPrev();
    });

    return () => {
      unsubPlaybackState();
      unsubQueueEnded();
      unsubChanged();
      unsubSeekComplete();
      unsubActionNext();
      unsubActionPrev();
    };
  }, []);

  // Native Windows Desktop: Connect hardware media keys (Play/Pause, Next, Prev)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const desktop = (window as any).raagaXDesktop;
    if (desktop && typeof desktop.onMediaKey === 'function') {
      console.log('[AudioPlayerController] Initializing Windows Native Media Key Bridge');
      desktop.onMediaKey((action: string) => {
        const store = usePlayerStore.getState();
        if (action === 'TOGGLE_PLAY') {
          store.togglePlayPause();
        } else if (action === 'NEXT') {
          store.playNext();
        } else if (action === 'PREV') {
          store.playPrev();
        } else if (action === 'PAUSE') {
          store.setIsPlaying(false);
        }
      });
    }
  }, []);

  // Native Android: poll ExoPlayer playback state for position & duration
  useEffect(() => {
    if (!RaagaXNativePlayer.isNative() || !isPlaying) return;
    const interval = setInterval(async () => {
      // Block stale position updates while a seek is settling.
      // SeekLock.shouldBlockRemoteUpdate covers both the drag window and the
      // post-release settling period. lastSeekTimeRef provides an additional
      // 2-second hard guard in case SeekLock.endSeeking hasn't been called yet.
      if (SeekLock.shouldBlockRemoteUpdate || Date.now() - lastSeekTimeRef.current < 2000) {
        return;
      }
      const state = await RaagaXNativePlayer.getPlaybackState();
      if (state && state.positionMs >= 0) {
        const store = usePlayerStore.getState();
        // Guard against transient 0ms report while native player is buffering after seek
        if (state.positionMs === 0 && Date.now() - lastSeekTimeRef.current < 4000) {
          console.log('[AudioPlayerController] Suppressing transient 0ms report during post-seek settle');
          return;
        }
        usePlayerStore.getState().setCurrentTime(state.positionMs / 1000, true);
        if (state.durationMs > 0) {
          usePlayerStore.getState().setDuration(state.durationMs / 1000);
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
    if (remaining > QUEUE_REFILL_THRESHOLD || isRefilling.current || !currentSong) return;

    // Check if RadioEngine is active
    const radio = RadioEngine.getInstance();
    if (radio.isRadioActive()) {
      radio.extendQueueIfNeeded(remaining);
      return;
    }

    if (!isAutoplayEnabled) return;

    isRefilling.current = true;

    // On native mobile app or offline mode, generate recommendations client-side to avoid localhost CORS
    if (typeof window !== 'undefined' && ((window as any).Capacitor?.isNativePlatform?.() || !navigator.onLine)) {
      import('@/lib/recommendation/CandidateGenerator').then(({ CandidateGenerator }) => {
        CandidateGenerator.generateCandidates(currentSong, historySongIds, lang, 15).then((songs) => {
          if (songs && songs.length > 0) {
            songs.forEach(s => addToQueue(s));
          }
        }).catch(() => {}).finally(() => {
          isRefilling.current = false;
        });
      }).catch(() => {
        isRefilling.current = false;
      });
      return;
    }

    const existingIds = queue.map(s => s.id);
    const genre = currentSong.genre || 'TELUGU HITS';
    const language = genre.split(' ')[0] || 'Telugu';
    const validLangs = ['Telugu', 'Kannada', 'Tamil', 'Hindi', 'Malayalam', 'English'];
    const lang = validLangs.find(l => l.toUpperCase() === language.toUpperCase()) || 'Telugu';

    const lastArtists = queue
      .slice(Math.max(0, queueIndex - 5), queueIndex)
      .map(s => s.artist)
      .filter(Boolean) as string[];

    fetch(getApiUrl('/api/queue-refill'), {
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
        count: 20 
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

  // Handle Play/Pause State Synchronization with Lyrics & Native bridges
  useEffect(() => {
    const shouldRenderAudio = activeRenderer === 'audio' && isActiveDevice;
    const canPlay = isPlaying && shouldRenderAudio;

    if (RaagaXNativePlayer.isNative()) {
      if (!shouldRenderAudio) {
        RaagaXNativePlayer.pause();
        LyricsEngine.getInstance().setPlaying(false);
      } else {
        if (canPlay) {
          RaagaXNativePlayer.resume();
          LyricsEngine.getInstance().setPlaying(true);
        } else {
          // Strict Guard: Only pause native player if playbackIntent is explicitly PAUSED
          // A transient isPlaying=false during buffering or track transition MUST NOT issue pause()
          const intent = usePlayerStore.getState().playbackIntent;
          if (intent === 'PAUSED') {
            RaagaXNativePlayer.pause();
            LyricsEngine.getInstance().setPlaying(false);
          }
        }
      }
      return;
    }

    // Web path: PlaybackService is the single authority over the HTMLAudioElement.
    // React controller strictly syncs non-audio side-effects (e.g. LyricsEngine).
    LyricsEngine.getInstance().setPlaying(canPlay);
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
    try {
      AdaptiveQueueController.getInstance().regenerateDynamicZone();
    } catch {}

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

  // ── Ultra-Fast Playback Engine: Proactive Background Pre-Caching Next Track ──────────────
  const prebufferedIndexRef = useRef<number>(-1);
  useEffect(() => {
    const effectiveDuration = duration > 0 ? duration : (currentSong?.duration || 0);
    if (!isPlaying || !currentSong) return;

    // Start preloading only after current track is stable (after 3s or 10% progress)
    const progress = effectiveDuration > 0 ? currentTime / effectiveDuration : 0;
    const nextIndex = queueIndex + 1;

    const isEligible = currentTime >= 3 && (progress >= 0.10 || currentTime >= 5);

    if (isEligible && nextIndex < queue.length && prebufferedIndexRef.current !== nextIndex) {
      prebufferedIndexRef.current = nextIndex;
      const nextSong = queue[nextIndex];
      if (nextSong && nextSong.id) {
        console.log('[PRELOAD_ENGINE] Proactively pre-buffering next track:', nextSong.title);
        const standby = PlaybackService.getInstance().getStandbyAudio();
        PreloadManager.getInstance().prepareNextTrack(nextSong, standby).catch(() => {});
      }
    }
  }, [currentTime, duration, isPlaying, queueIndex, queue, currentSong]);

  // ── Chameleon Theme: Extract vibrant palette from active track ──
  useEffect(() => {
    if (currentSong?.coverUrl) {
      ArtworkColorExtractor.getInstance()
        .extractPalette(currentSong.coverUrl)
        .then(palette => ArtworkColorExtractor.getInstance().applyToDocument(palette))
        .catch(() => {});
    }
  }, [currentSong?.coverUrl]);

  // ── Handle Sleep Timer with Gentle 30s Exponential Audio Fade-Out ──
  useEffect(() => {
    const interval = setInterval(() => {
      const { sleepTimerEndsAt, sleepTimerMode, isPlaying, setIsPlaying, setSleepTimer, setToastMessage, volume } = usePlayerStore.getState();
      if (!isPlaying) return;

      if (sleepTimerMode === 'duration' && sleepTimerEndsAt) {
        const msRemaining = sleepTimerEndsAt - Date.now();
        
        // 30-Second gentle exponential audio fade ramp
        if (msRemaining <= 30000 && msRemaining > 0) {
          const fadeProgress = msRemaining / 30000;
          const targetVol = Math.max(0.05, Math.min(1, (volume ?? 0.8) * Math.pow(fadeProgress, 1.5)));
          if (audioRefA.current) audioRefA.current.volume = targetVol;
          if (audioRefB.current) audioRefB.current.volume = targetVol;
        }

        if (msRemaining <= 0) {
          setIsPlaying(false);
          setSleepTimer(null);
          if (audioRefA.current) audioRefA.current.volume = volume ?? 0.8;
          if (audioRefB.current) audioRefB.current.volume = volume ?? 0.8;
          setToastMessage('Sleep Timer Ended — Playback paused with gentle fade');
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Remote Device Clock Interpolation (Follower)
  useEffect(() => {
    if (isActiveDevice || !isPlaying) return;
    
    const interval = setInterval(() => {
       const store = usePlayerStore.getState();
       if (!store.isPlaying || !store.remoteAnchorTimeMs) return;

       const elapsedMs = Date.now() - store.remoteAnchorTimeMs;
       const liveSeconds = (store.remoteAnchorPositionMs + elapsedMs) / 1000;
       
       if (liveSeconds <= (store.duration || Infinity)) {
         usePlayerStore.setState({ currentTime: liveSeconds });
       }
    }, 250);

    return () => clearInterval(interval);
  }, [isActiveDevice, isPlaying]);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (audio === PlaybackService.getInstance().getActiveAudio()) {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
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
