'use client';

import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { AudioEngine } from '@/lib/audioEngine';
import { Song } from '@/types/music';

const FALLBACK_AUDIO_URL = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
const QUEUE_REFILL_THRESHOLD = 3; // refill when fewer than this many tracks remain after current

export function AudioPlayerController() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isRefilling = useRef(false);

  const {
    currentSong,
    isPlaying,
    currentTime,
    volume,
    isMuted,
    eqSettings,
    isVideoModeActive,
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
  } = usePlayerStore();

  // Restore Instant Playback Session from Local Database
  useEffect(() => {
    restoreLocalSession();
  }, [restoreLocalSession]);

  // Auto-refill queue when fewer than QUEUE_REFILL_THRESHOLD tracks remain
  useEffect(() => {
    const remaining = queue.length - (queueIndex + 1);
    if (remaining >= QUEUE_REFILL_THRESHOLD || isRefilling.current || !currentSong) return;

    isRefilling.current = true;

    const existingIds = queue.map(s => s.id);
    // Detect language from current song genre
    const genre = currentSong.genre || 'TELUGU HITS';
    const language = genre.split(' ')[0] || 'Telugu';
    const validLangs = ['Telugu', 'Kannada', 'Tamil', 'Hindi', 'Malayalam', 'English'];
    const lang = validLangs.find(l => l.toUpperCase() === language.toUpperCase()) || 'Telugu';

    fetch(`/api/queue-refill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        language: lang, 
        excludeIds: existingIds, 
        likedIds: likedSongIds,
        historyIds: historySongIds,
        count: 10 
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.data?.songs)) {
          const newSongs: Song[] = data.data.songs;
          newSongs.forEach(s => addToQueue(s));
          console.log(`[QUEUE] Refilled +${newSongs.length} ${lang} tracks`);
        }
      })
      .catch(() => {})
      .finally(() => { isRefilling.current = false; });
  }, [queueIndex, queue.length]);

  // Initialize Web Audio Engine once element is ready
  useEffect(() => {
    if (audioRef.current) {
      AudioEngine.getInstance().init(audioRef.current);
    }
  }, []);

  // Mute/pause audio element when video mode is active or when this device is a remote control
  useEffect(() => {
    if (!audioRef.current) return;
    if (isVideoModeActive || !isActiveDevice) {
      audioRef.current.pause();
    } else if (isPlaying) {
      // If we just became the active device, sync the playback time to match the remote state
      if (Math.abs(audioRef.current.currentTime - currentTime) > 2) {
        audioRef.current.currentTime = currentTime;
      }
      audioRef.current.play().catch((err) => {
        console.warn('Playback blocked on handoff:', err);
        setIsPlaying(false);
      });
    }
  }, [isVideoModeActive, isActiveDevice, isPlaying]);

  // Update source & MediaSession metadata when current song changes
  useEffect(() => {
    if (audioRef.current && currentSong) {
      const newSrc = currentSong.audioUrl || FALLBACK_AUDIO_URL;
      
      // Only set src if it actually changed, or if the audio element is fresh (HMR)
      if (!audioRef.current.src.includes(newSrc)) {
        audioRef.current.src = newSrc;
        
        // IMPORTANT FIX: If this was a Hot Reload (HMR), the store's currentTime will be > 0.
        // We must restore it immediately so it doesn't play from 0:00.
        if (currentTime > 0) {
          audioRef.current.currentTime = currentTime;
        }
      }

      // Enable Mobile Background Playback & Lockscreen Control (MediaSession API)
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album,
          artwork: [
            { src: currentSong.coverUrl, sizes: '96x96', type: 'image/jpeg' },
            { src: currentSong.coverUrl, sizes: '256x256', type: 'image/jpeg' },
            { src: currentSong.coverUrl, sizes: '512x512', type: 'image/jpeg' },
          ]
        });

        navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
        navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
      }

      if (isPlaying && isActiveDevice && !isVideoModeActive) {
        audioRef.current
          .play()
          .then(() => {
            AudioEngine.getInstance().resume();
          })
          .catch((err) => {
            console.warn('Playback interrupted on new song:', err);
            setIsPlaying(false);
          });
      }
    }
  }, [currentSong, isActiveDevice, isVideoModeActive]);

  // Handle Play/Pause state
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && isActiveDevice && !isVideoModeActive) {
        AudioEngine.getInstance().resume();
        audioRef.current.play().catch((err) => {
          console.warn('Playback blocked on state change:', err);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, isActiveDevice, isVideoModeActive]);

  // Handle Volume & Mute
  useEffect(() => {
    const effectiveVolume = isMuted ? 0 : volume;
    if (audioRef.current) {
      audioRef.current.volume = effectiveVolume;
    }
    AudioEngine.getInstance().setVolume(effectiveVolume);
  }, [volume, isMuted]);

  // Sync EQ Settings with AudioEngine
  useEffect(() => {
    if (eqSettings.enabled) {
      AudioEngine.getInstance().setEQBand('low', eqSettings.bands.low);
      AudioEngine.getInstance().setEQBand('midLow', eqSettings.bands.midLow);
      AudioEngine.getInstance().setEQBand('mid', eqSettings.bands.mid);
      AudioEngine.getInstance().setEQBand('midHigh', eqSettings.bands.midHigh);
      AudioEngine.getInstance().setEQBand('high', eqSettings.bands.high);
    } else {
      AudioEngine.getInstance().setEQBand('low', 0);
      AudioEngine.getInstance().setEQBand('midLow', 0);
      AudioEngine.getInstance().setEQBand('mid', 0);
      AudioEngine.getInstance().setEQBand('midHigh', 0);
      AudioEngine.getInstance().setEQBand('high', 0);
    }
  }, [eqSettings]);

  // Handle Sleep Timer
  useEffect(() => {
    if (!sleepTimerEndsAt) return;

    const interval = setInterval(() => {
      if (Date.now() >= sleepTimerEndsAt) {
        setIsPlaying(false);
        setSleepTimer(null);
        alert('Sleep timer triggered: Playback paused.');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerEndsAt, setIsPlaying, setSleepTimer]);

  const handleTimeUpdate = () => {
    if (audioRef.current && isActiveDevice) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      
      // Ensure seamless handoff by seeking to the remote current time when the track loads
      if (isActiveDevice && Math.abs(audioRef.current.currentTime - currentTime) > 2) {
        audioRef.current.currentTime = currentTime;
      }
    }
  };

  const handleEnded = () => {
    playNext();
  };

  // Robust Error Handling for Audio Streams
  const handleError = () => {
    console.warn('Audio stream error detected. Switching to CORS fallback stream...');
    if (audioRef.current && audioRef.current.src !== FALLBACK_AUDIO_URL) {
      audioRef.current.src = FALLBACK_AUDIO_URL;
      if (isPlaying && isActiveDevice && !isVideoModeActive) {
        audioRef.current.play().catch((err) => {
          console.warn('Fallback stream blocked:', err);
          setIsPlaying(false);
        });
      }
    }
  };

  return (
    <audio
      ref={audioRef}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onEnded={handleEnded}
      onError={handleError}
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
      className="hidden"
    />
  );
}
