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
const FALLBACK_AUDIO_URL = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
const QUEUE_REFILL_THRESHOLD = 3;

export function AudioPlayerController() {
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);
  
  const activePlayerRef = useRef<'A' | 'B'>('A');
  const prevSongIdRef = useRef<string | null>(null);
  const isRefilling = useRef(false);
  const seekTarget = usePlayerStore(state => state.seekTarget);

  // Watch for explicit seek targets from the UI
  useEffect(() => {
    if (seekTarget !== null) {
      const activeAudio = getActiveAudio();
      if (activeAudio) {
        activeAudio.currentTime = seekTarget;
        LyricsEngine.getInstance().seek(seekTarget * 1000);
      }
      usePlayerStore.setState({ seekTarget: null });
    }
  }, [seekTarget]);

  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    activeRenderer,
    queue,
    queueIndex,
    likedSongIds,
    historySongIds,
    crossfadeSec,
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
    isGaplessEnabled,
  } = usePlayerStore();

  const getActiveAudio = () => activePlayerRef.current === 'A' ? audioRefA.current : audioRefB.current;
  const getInactiveAudio = () => activePlayerRef.current === 'A' ? audioRefB.current : audioRefA.current;

  // Initialize Web Audio Graph
  useEffect(() => {
    if (audioRefA.current && audioRefB.current) {
      WebAudioGraph.getInstance().init(audioRefA.current, audioRefB.current);
    }
  }, [audioRefA.current, audioRefB.current]);

  // Restore Instant Playback Session
  useEffect(() => {
    restoreLocalSession();
  }, [restoreLocalSession]);

  // Wire up to the new Hybrid Architecture
  useEffect(() => {
    const activeAudio = getActiveAudio();
    if (activeAudio) {
      const rendererManager = RendererManager.getInstance();
      rendererManager.registerRenderer('audio', activeAudio);
      
      // If we are the active renderer, attach to engine
      if (activeRenderer === 'audio') {
         rendererManager.acquireLease('audio');
         PlaybackEngine.getInstance().attachMediaElement(activeAudio);
         BufferMonitor.getInstance().attach(activeAudio);
      }
    }
  }, [activePlayerRef.current, activeRenderer]);

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

  // Handle Play/Pause and Seek Syncing
  useEffect(() => {
    const audio = getActiveAudio();
    if (!audio) return;

    const shouldRenderAudio = activeRenderer === 'audio' && isActiveDevice;

    if (!shouldRenderAudio) {
      audioRefA.current?.pause();
      audioRefB.current?.pause();
      LyricsEngine.getInstance().setPlaying(false);
    } else {
      if (isPlaying) {
        if (Math.abs(audio.currentTime - currentTime) > 2) {
          audio.currentTime = currentTime;
        }
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            LyricsEngine.getInstance().setPlaying(true);
            AudioFocusManager.getInstance().requestFocus();
          }).catch(e => {
            console.error("Audio playback failed:", e);
            usePlayerStore.setState({ isPlaying: false });
            LyricsEngine.getInstance().setPlaying(false);
          });
        }
      } else {
        audio.pause();
        LyricsEngine.getInstance().setPlaying(false);
        AudioFocusManager.getInstance().releaseFocus();
      }
    }
  }, [isPlaying, isActiveDevice, activeRenderer]);

  // Handle currentSong change for lyrics
  useEffect(() => {
    if (currentSong?.id) {
      LyricsEngine.getInstance().loadTrack(currentSong.id);
    } else {
      LyricsEngine.getInstance().clear();
    }
  }, [currentSong?.id]);

  // Handle Song Changes and Crossfading
  useEffect(() => {
    if (!currentSong) return;
    
    // Resume WebAudio context on first play
    WebAudioGraph.getInstance().resume();

    const isNewSong = prevSongIdRef.current !== currentSong.id;
    prevSongIdRef.current = currentSong.id;

    if (isNewSong) {
      const initNewSong = async () => {
        // For non-crossfade: keep using the active player, just update its src
        const audio = getActiveAudio();
        if (!audio) return;

        // Enterprise Playback Source Resolution
        let finalSrc = FALLBACK_AUDIO_URL;
        if (currentSong) {
          try {
            const { PlaybackSourceResolver } = await import('@/lib/playbackSourceResolver');
            const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(currentSong);

            if (!source) {
              console.warn(`[AudioPlayerController] Song unavailable. Auto-skipping...`);
              setIsPlaying(false);
              setTimeout(() => {
                usePlayerStore.getState().playNext();
              }, 1000);
              return;
            }

            if (source.type === 'remote') {
              finalSrc = source.url || FALLBACK_AUDIO_URL;
            } else if (source.type === 'offline') {
              finalSrc = FALLBACK_AUDIO_URL;
              console.log(`[AudioPlayerController] Playing offline copy:`, currentSong.title);
            }
          } catch(e) {
            console.error('[AudioPlayerController] Failed to resolve playable source:', e);
            finalSrc = currentSong.audioUrl || FALLBACK_AUDIO_URL;
          }
        }

        // Pause any other playing audio
        const otherAudio = getInactiveAudio();
        if (otherAudio) {
          otherAudio.pause();
          otherAudio.currentTime = 0;
        }

        // Set source and play
        audio.src = finalSrc;
        audio.currentTime = 0;
        audio.volume = isMuted ? 0 : volume;

        if (isPlaying && isActiveDevice && activeRenderer === 'audio') {
          audio.play().catch(console.warn);
        }
      };

      initNewSong();

      // Media Session updates
      const mediaSession = MediaSessionManager.getInstance();
      mediaSession.updateMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album || 'RaagaX',
        artwork: [
          { src: currentSong.coverUrl || '', sizes: '96x96', type: 'image/jpeg' },
          { src: currentSong.coverUrl || '', sizes: '256x256', type: 'image/jpeg' },
          { src: currentSong.coverUrl || '', sizes: '512x512', type: 'image/jpeg' },
        ]
      });

      mediaSession.setActionHandlers({
        onPlay: () => {
           InterruptionCoordinator.getInstance().clearInterruption();
           setIsPlaying(true);
        },
        onPause: () => {
           InterruptionCoordinator.getInstance().reportUserPause();
           setIsPlaying(false);
        },
        onNext: () => playNext(),
        onPrev: () => playPrev(),
        onSeek: (time: number) => {
           usePlayerStore.getState().setCurrentTime(time);
           usePlayerStore.getState().setSeekTarget(time);
        }
      });
    }
  }, [currentSong?.id]); 

  // Handle Volume & Mute dynamically (outside of crossfade)
  // Handle Volume & Mute dynamically
  useEffect(() => {
    const tm = TransitionManager.getInstance();
    if (tm.getState() === 'CROSSFADING') return; // Don't interrupt crossfade ramp
    const effectiveVolume = isMuted ? 0 : volume;
    const activeAudio = getActiveAudio();
    if (activeAudio) activeAudio.volume = effectiveVolume;
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
    
    // We are remote and playing. 
    // We should tick the currentTime based on lastSyncDbTime.
    const interval = setInterval(() => {
       const store = usePlayerStore.getState();
       if (!store.lastSyncDbTime || store.lastSyncPositionMs === null) return;

       const dbTime = new Date(store.lastSyncDbTime).getTime();
       const elapsed = Date.now() - dbTime;
       const livePositionSeconds = (store.lastSyncPositionMs + elapsed) / 1000;
       
       if (livePositionSeconds <= store.duration) {
         // Update the store directly without triggering a DB sync loop
         usePlayerStore.setState({ currentTime: livePositionSeconds });
       }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActiveDevice, isPlaying]);

  const lastZustandUpdateTimeRef = useRef(0);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    if (!isActiveDevice) return;
    const audio = e.currentTarget;
    
    // Only dispatch time updates if this is the active player
    const isActive = audio === getActiveAudio();
    if (isActive) {
      const now = Date.now();
      if (now - lastZustandUpdateTimeRef.current > 500) {
        setCurrentTime(audio.currentTime);
        lastZustandUpdateTimeRef.current = now;
      }

      // Trigger early next track for crossfade
      // Check boundaries via TransitionManager
      TransitionManager.getInstance().checkBoundary(audio, getInactiveAudio()!, () => {
         // This runs when transition commits
         // The AudioPlayerController state will naturally re-sync because currentSong will change.
         // Wait, we need to advance the queue state!
         const isLastSong = queueIndex === queue.length - 1;
         const repeatMode = usePlayerStore.getState().repeatMode;
         if (!isLastSong || repeatMode === 'all') {
            playNext();
         }
      });
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (audio === getActiveAudio()) {
      setDuration(audio.duration);
      if (isActiveDevice && Math.abs(audio.currentTime - currentTime) > 2) {
        audio.currentTime = currentTime;
      }
    }
  };

  const handleEnded = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    // If Gapless didn't trigger perfectly on time (e.g., background tab delay), fallback to normal next.
    if (e.currentTarget === getActiveAudio() && TransitionManager.getInstance().getState() === 'IDLE') {
      playNext();
    }
  };

  const handleError = async (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (audio !== getActiveAudio()) return;

    if (audio.src === FALLBACK_AUDIO_URL) {
      setIsPlaying(false);
      return;
    }

    try {
      // Audio Streaming Resilience: Attempt Bitrate Downgrade
      if (audio.src.includes('320')) {
        console.warn('320kbps stream failed, downgrading to 160kbps...');
        audio.src = audio.src.replace('320', '160');
        if (isPlaying && isActiveDevice) audio.play().catch(() => {});
        return;
      }
      
      if (audio.src.includes('160')) {
        console.warn('160kbps stream failed, downgrading to 96kbps...');
        audio.src = audio.src.replace('160', '96');
        if (isPlaying && isActiveDevice) audio.play().catch(() => {});
        return;
      }

      // If all JioSaavn streams fail, attempt YouTube / Proxy resolution
      console.warn('Primary streams failed, attempting resilient stream resolution...');
      const { StreamResolver } = await import('@/lib/streamResolver');
      const resolved = await StreamResolver.getInstance().resolveTrackStream(currentSong?.title || '');
      
      if (resolved && resolved.song.audioUrl && resolved.song.audioUrl !== audio.src) {
        audio.src = resolved.song.audioUrl;
        if (isPlaying && isActiveDevice) audio.play().catch(() => {});
        return;
      }
    } catch (err) {
      console.error('Stream fallback failed:', err);
    }

    // Ultimate Fallback
    audio.src = FALLBACK_AUDIO_URL;
    if (isPlaying && isActiveDevice) audio.play().catch(() => setIsPlaying(false));
  };

  return (
    <>
      <audio
        ref={audioRefA}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
        className="hidden"
      />
      <audio
        ref={audioRefB}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
        className="hidden"
      />
    </>
  );
}
