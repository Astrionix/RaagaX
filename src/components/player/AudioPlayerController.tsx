'use client';

import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

const FALLBACK_AUDIO_URL = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
const QUEUE_REFILL_THRESHOLD = 3;

export function AudioPlayerController() {
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);
  
  const activePlayerRef = useRef<'A' | 'B'>('A');
  const prevSongIdRef = useRef<string | null>(null);
  const crossfadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredCrossfadeRef = useRef(false);
  const isRefilling = useRef(false);
  const seekTarget = usePlayerStore(state => state.seekTarget);

  // Watch for explicit seek targets from the UI
  useEffect(() => {
    if (seekTarget !== null) {
      const activeAudio = getActiveAudio();
      if (activeAudio) {
        activeAudio.currentTime = seekTarget;
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
    isVideoModeActive,
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
  } = usePlayerStore();

  const getActiveAudio = () => activePlayerRef.current === 'A' ? audioRefA.current : audioRefB.current;
  const getInactiveAudio = () => activePlayerRef.current === 'A' ? audioRefB.current : audioRefA.current;

  // Restore Instant Playback Session
  useEffect(() => {
    restoreLocalSession();
  }, [restoreLocalSession]);

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

    if (isVideoModeActive || !isActiveDevice) {
      audio.pause();
    } else {
      if (isPlaying) {
        if (Math.abs(audio.currentTime - currentTime) > 2) {
          audio.currentTime = currentTime;
        }
        audio.play().catch(err => {
          if (err.name !== 'AbortError') {
            setIsPlaying(false);
          }
        });
      } else {
        audio.pause();
      }
    }
  }, [isPlaying, isActiveDevice, isVideoModeActive]);

  // Handle Song Changes and Crossfading
  useEffect(() => {
    if (!currentSong) return;
    
    hasTriggeredCrossfadeRef.current = false;
    const isNewSong = prevSongIdRef.current !== currentSong.id;
    prevSongIdRef.current = currentSong.id;

    if (isNewSong) {
      const oldAudio = getActiveAudio();
      const newAudioId = activePlayerRef.current === 'A' ? 'B' : 'A';
      activePlayerRef.current = newAudioId;
      const newAudio = getActiveAudio();

      if (!oldAudio || !newAudio) return;

      const newSrc = currentSong.audioUrl || FALLBACK_AUDIO_URL;
      if (!newAudio.src.includes(newSrc)) {
         newAudio.src = newSrc;
         newAudio.load();
      }

      if (crossfadeSec > 0 && oldAudio.currentTime > 0 && !oldAudio.paused && isPlaying && isActiveDevice) {
        // Start Crossfade
        newAudio.volume = 0;
        newAudio.play().catch(() => {});

        if (crossfadeIntervalRef.current) clearInterval(crossfadeIntervalRef.current);
        const steps = 20; 
        const intervalMs = 1000 / steps;
        const totalSteps = crossfadeSec * steps;
        let currentStep = 0;

        crossfadeIntervalRef.current = setInterval(() => {
          currentStep++;
          const fadeOutVol = Math.max(0, volume * (1 - currentStep / totalSteps));
          const fadeInVol = Math.min(volume, volume * (currentStep / totalSteps));
          
          if (!isMuted) {
             oldAudio.volume = fadeOutVol;
             newAudio.volume = fadeInVol;
          } else {
             oldAudio.volume = 0;
             newAudio.volume = 0;
          }

          if (currentStep >= totalSteps) {
            clearInterval(crossfadeIntervalRef.current!);
            oldAudio.pause();
            oldAudio.currentTime = 0;
            if (!isMuted) newAudio.volume = volume;
          }
        }, intervalMs);

      } else {
        // Immediate switch
        oldAudio.pause();
        oldAudio.currentTime = 0;
        newAudio.volume = isMuted ? 0 : volume;
        if (isPlaying && isActiveDevice && !isVideoModeActive) {
          newAudio.play().catch(console.warn);
        }
      }

      // Media Session updates
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album || 'RaagaX',
          artwork: [
            { src: currentSong.coverUrl || '', sizes: '96x96', type: 'image/jpeg' },
            { src: currentSong.coverUrl || '', sizes: '256x256', type: 'image/jpeg' },
            { src: currentSong.coverUrl || '', sizes: '512x512', type: 'image/jpeg' },
          ]
        });
        navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
        navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
      }
    }
  }, [currentSong?.id]); 

  // Handle Volume & Mute dynamically (outside of crossfade)
  useEffect(() => {
    if (crossfadeIntervalRef.current) return; // Don't interrupt crossfade ramp
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

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    if (!isActiveDevice) return;
    const audio = e.currentTarget;
    
    // Only dispatch time updates if this is the active player
    const isActive = audio === getActiveAudio();
    if (isActive) {
      setCurrentTime(audio.currentTime);

      // Trigger early next track for crossfade
      if (crossfadeSec > 0 && audio.duration > 0 && queue.length > 0) {
        const timeRemaining = audio.duration - audio.currentTime;
        if (timeRemaining <= crossfadeSec && !hasTriggeredCrossfadeRef.current) {
          // Prevent early trigger on last song if repeat is off
          const isLastSong = queueIndex === queue.length - 1;
          const repeatMode = usePlayerStore.getState().repeatMode;
          if (!isLastSong || repeatMode === 'all') {
             hasTriggeredCrossfadeRef.current = true;
             playNext();
          }
        }
      }
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
    // Standard skip if crossfade didn't trigger
    if (e.currentTarget === getActiveAudio() && !hasTriggeredCrossfadeRef.current) {
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

