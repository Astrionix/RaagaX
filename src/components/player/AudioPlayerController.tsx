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
const FALLBACK_AUDIO_URL = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
const QUEUE_REFILL_THRESHOLD = 3;

import { PlaybackService } from '@/lib/playback/PlaybackService';

export function AudioPlayerController() {
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);
  
  const prevSongIdRef = useRef<string | null>(null);
  const isRefilling = useRef(false);
  const seekTarget = usePlayerStore(state => state.seekTarget);

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
  }, [audioRefA.current, audioRefB.current]);

  // Native Android: hook into ExoPlayer track-ended event to advance queue
  useEffect(() => {
    if (!RaagaXNativePlayer.isNative()) return;
    const unsub = RaagaXNativePlayer.addTrackEndedListener(() => {
      usePlayerStore.getState().playNext();
    });
    return unsub;
  }, []);

  // Restore Instant Playback Session
  useEffect(() => {
    restoreLocalSession();
  }, [restoreLocalSession]);

  // Watch for explicit seek targets from UI
  useEffect(() => {
    if (seekTarget !== null) {
      if (RaagaXNativePlayer.isNative()) {
        RaagaXNativePlayer.seekTo(seekTarget * 1000);
      } else {
        PlaybackService.getInstance().seek(seekTarget);
      }
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
  }, [queueIndex, queue.length, currentSong?.id, isAutoplayEnabled]);

  // Handle Play/Pause State Synchronization
  useEffect(() => {
    const shouldRenderAudio = activeRenderer === 'audio' && isActiveDevice;

    if (RaagaXNativePlayer.isNative()) {
      // Native path: route to ExoPlayer foreground service
      if (!shouldRenderAudio) {
        RaagaXNativePlayer.pause();
        LyricsEngine.getInstance().setPlaying(false);
      } else {
        if (isPlaying) {
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
      PlaybackService.getInstance().pause();
      LyricsEngine.getInstance().setPlaying(false);
    } else {
      if (isPlaying && activeAudio.paused) {
        PlaybackService.getInstance().play();
        LyricsEngine.getInstance().setPlaying(true);
      } else if (!isPlaying && !activeAudio.paused) {
        PlaybackService.getInstance().pause();
        LyricsEngine.getInstance().setPlaying(false);
      }
    }
  }, [isPlaying, isActiveDevice, activeRenderer]);

  // Handle currentSong change — native: send to ExoPlayer; web: audio graph
  useEffect(() => {
    if (currentSong?.id) {
      LyricsEngine.getInstance().loadTrack(currentSong.id);
      prevSongIdRef.current = currentSong.id;

      if (RaagaXNativePlayer.isNative()) {
        // Route directly to native ExoPlayer with full metadata
        if (currentSong.audioUrl && isPlaying && isActiveDevice) {
          RaagaXNativePlayer.play({
            url: currentSong.audioUrl,
            title: currentSong.title ?? 'Unknown Title',
            artist: currentSong.artist ?? 'Unknown Artist',
            artworkUrl: currentSong.coverArt ?? currentSong.thumbnail ?? '',
          });
        }
      } else {
        WebAudioGraph.getInstance().resume();
      }
    } else {
      LyricsEngine.getInstance().clear();
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
    if (!sleepTimerEndsAt) return;
    const interval = setInterval(() => {
      if (Date.now() >= sleepTimerEndsAt) {
        setIsPlaying(false);
        setSleepTimer(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndsAt, setIsPlaying, setSleepTimer]);

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
      if (isActiveDevice && Math.abs(audio.currentTime - currentTime) > 2) {
        audio.currentTime = currentTime;
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
