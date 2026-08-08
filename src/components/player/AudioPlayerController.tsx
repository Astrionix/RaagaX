'use client';

import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { AudioEngine } from '@/lib/audioEngine';

const FALLBACK_AUDIO_URL = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';

export function AudioPlayerController() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    currentSong,
    isPlaying,
    currentTime,
    volume,
    isMuted,
    eqSettings,
    isVideoModeActive,
    playNext,
    playPrev,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    sleepTimerEndsAt,
    setSleepTimer,
    restoreLocalSession,
  } = usePlayerStore();

  // Restore Instant Playback Session from Local Database
  useEffect(() => {
    restoreLocalSession();
  }, [restoreLocalSession]);

  // Initialize Web Audio Engine once element is ready
  useEffect(() => {
    if (audioRef.current) {
      AudioEngine.getInstance().init(audioRef.current);
    }
  }, []);

  // Mute/pause audio element when video mode is active so only YouTube audio plays
  useEffect(() => {
    if (!audioRef.current) return;
    if (isVideoModeActive) {
      audioRef.current.pause();
    } else if (isPlaying) {
      audioRef.current.play().catch(() => {});
    }
  }, [isVideoModeActive]);

  // Update source & MediaSession metadata when current song changes
  useEffect(() => {
    if (audioRef.current && currentSong) {
      audioRef.current.src = currentSong.audioUrl || FALLBACK_AUDIO_URL;

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

      if (isPlaying) {
        audioRef.current
          .play()
          .then(() => {
            AudioEngine.getInstance().resume();
          })
          .catch((err) => {
            console.warn('Playback interrupted:', err);
          });
      }
    }
  }, [currentSong]);

  // Handle Play/Pause state
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        AudioEngine.getInstance().resume();
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

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
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
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
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
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
      className="hidden"
    />
  );
}
