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
  const consecutiveErrorsRef = useRef(0);

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

    // Extract recent artists to prevent echo chambers
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
    } else {
      if (isPlaying) {
        // Only sync currentTime on handoff if difference is significant
        if (Math.abs(audioRef.current.currentTime - currentTime) > 2) {
          audioRef.current.currentTime = currentTime;
        }
        
        AudioEngine.getInstance().resume();
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (err.name === 'AbortError') {
              // AbortError simply means the play request was interrupted by a new source load or pause. Safe to ignore.
              return;
            }
            console.warn('Playback blocked:', err);
            setIsPlaying(false);
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, isActiveDevice, isVideoModeActive]);

  // Update source & MediaSession metadata when current song changes
  useEffect(() => {
    if (!audioRef.current || !currentSong) return;

    const audio = audioRef.current;
    const newSrc = currentSong.audioUrl || FALLBACK_AUDIO_URL;
    
    if (currentSong.audioUrl) {
      consecutiveErrorsRef.current = 0;
    }

    // Only set src if it actually changed
    // We check includes because browsers sometimes append absolute domains to src
    if (!audio.src.includes(newSrc)) {
      audio.src = newSrc;
      audio.load();
      
      if (currentTime > 0) {
        audio.currentTime = currentTime;
      }
    }

    // Enable Mobile Background Playback & Lockscreen Control (MediaSession API)
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

    if (isPlaying && isActiveDevice && !isVideoModeActive) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          AudioEngine.getInstance().resume();
        }).catch((err) => {
          if (err.name === 'AbortError') {
            return;
          }
          console.warn('Playback interrupted on new song:', err);
          setIsPlaying(false);
          
          consecutiveErrorsRef.current += 1;
          if (consecutiveErrorsRef.current < 5) {
             setTimeout(() => playNext(), 1000);
          } else {
             console.error("Too many playback errors, stopping playback");
          }
        });
      }
    }
  }, [currentSong]); // Only depend on currentSong here so it doesn't fight the play/pause hook

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
