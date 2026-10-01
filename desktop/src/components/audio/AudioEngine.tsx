"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "@/stores/player-store";
import { useAuthStore } from "@/stores/auth-store";
import { useSettingsStore } from "@/stores/settings-store";
import { syncClient } from "@/services/connect/raaga-sync-client";
import { discordPresence } from "@/services/discord/presence";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function AudioEngine() {
  const {
    currentSong,
    isPlaying,
    volume,
    isMuted,
    repeatMode,
    currentTime,
    duration,
    setCurrentTime,
    setDuration,
    next,
    prev,
    togglePlay,
    seek,
    setVolume,
    playSong,
    applyRemoteState,
    playbackSpeed,
    equalizer,
  } = usePlayerStore();

  const { recordHistory } = useAuthStore();
  const { discordRpcEnabled } = useSettingsStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);

  const [isYtReady, setIsYtReady] = useState(false);
  const isDirectAudio = Boolean(currentSong?.streamUrl);

  // 1. Initialize YouTube IFrame API Script
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.YT && window.YT.Player) {
      setIsYtReady(true);
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setIsYtReady(true);
    };
  }, []);

  // Electron Desktop Global Media Keys Integration
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).electronAPI) return;
    const api = (window as any).electronAPI;
    api.onMediaTogglePlay?.(() => togglePlay());
    api.onMediaNext?.(() => next());
    api.onMediaPrev?.(() => prev());
  }, [togglePlay, next, prev]);

  // 2. Setup YouTube Player container
  useEffect(() => {
    if (!isYtReady || ytPlayerRef.current) return;

    try {
      ytPlayerRef.current = new window.YT.Player("raaga-youtube-frame", {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            const effectiveVol = isMuted ? 0 : volume * 100;
            event.target.setVolume(effectiveVol);
            if (currentSong && !isDirectAudio) {
              const videoId = currentSong.videoId;
              event.target.loadVideoById(videoId);
              if (isPlaying) event.target.playVideo();
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED = 0
            if (event.data === 0) {
              if (repeatMode === "ONE") {
                event.target.seekTo(0);
                event.target.playVideo();
              } else {
                next();
              }
            }
          },
          onError: (event: any) => {
            console.warn("YouTube Player error:", event.data);
            if ([2, 5, 100, 101, 150].includes(event.data)) {
              next();
            }
          },
        },
      });
    } catch (err) {
      console.warn("YouTube Player initialization error:", err);
    }
  }, [isYtReady]);

  // 3. Handle Song Changes
  useEffect(() => {
    if (!currentSong) return;

    // Record to history
    recordHistory(currentSong);

    if (isDirectAudio) {
      // Pause YouTube player if running
      if (ytPlayerRef.current?.pauseVideo) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch {}
      }

      if (audioRef.current && currentSong.streamUrl) {
        audioRef.current.src = currentSong.streamUrl;
        audioRef.current.load();
        if (isPlaying) {
          audioRef.current.play().catch((e) => console.warn("Audio play blocked:", e));
        }
      }
    } else {
      // Pause HTML5 audio
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const ytVideoId = currentSong.videoId;
      if (ytPlayerRef.current?.loadVideoById) {
        try {
          ytPlayerRef.current.loadVideoById(ytVideoId);
          if (isPlaying) {
            ytPlayerRef.current.playVideo();
          }
        } catch (e) {
          console.warn("YT load error:", e);
        }
      }
    }
  }, [currentSong?.videoId, currentSong?.streamUrl]);

  // 4. Handle Play/Pause
  useEffect(() => {
    if (isDirectAudio && audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    } else if (ytPlayerRef.current) {
      try {
        if (isPlaying) {
          ytPlayerRef.current.playVideo?.();
        } else {
          ytPlayerRef.current.pauseVideo?.();
        }
      } catch {}
    }
  }, [isPlaying, isDirectAudio]);

  // 5. Handle Volume & Mute
  useEffect(() => {
    const effectiveVol = isMuted ? 0 : volume;

    if (audioRef.current) {
      audioRef.current.volume = effectiveVol;
    }
    if (ytPlayerRef.current?.setVolume) {
      try {
        ytPlayerRef.current.setVolume(effectiveVol * 100);
      } catch {}
    }
  }, [volume, isMuted]);

  // 5.5 Playback Speed Synchronization
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
    if (ytPlayerRef.current?.setPlaybackRate) {
      try {
        ytPlayerRef.current.setPlaybackRate(playbackSpeed);
      } catch {}
    }
  }, [playbackSpeed]);

  // 5.6 Hardware Web Audio DSP Equalizer Processing
  useEffect(() => {
    if (typeof window === "undefined" || !audioRef.current) return;

    if (!audioCtxRef.current) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        const source = ctx.createMediaElementSource(audioRef.current);

        const bass = ctx.createBiquadFilter();
        bass.type = "lowshelf";
        bass.frequency.value = 100;

        const mid = ctx.createBiquadFilter();
        mid.type = "peaking";
        mid.frequency.value = 1000;
        mid.Q.value = 1.0;

        const treble = ctx.createBiquadFilter();
        treble.type = "highshelf";
        treble.frequency.value = 3000;

        source.connect(bass);
        bass.connect(mid);
        mid.connect(treble);
        treble.connect(ctx.destination);

        audioCtxRef.current = ctx;
        bassFilterRef.current = bass;
        midFilterRef.current = mid;
        trebleFilterRef.current = treble;
      } catch (_) {}
    }

    if (audioCtxRef.current?.state === "suspended" && isPlaying) {
      audioCtxRef.current.resume().catch(() => {});
    }

    if (bassFilterRef.current && midFilterRef.current && trebleFilterRef.current) {
      if (equalizer.enabled) {
        bassFilterRef.current.gain.value = equalizer.bass;
        midFilterRef.current.gain.value = equalizer.mid;
        trebleFilterRef.current.gain.value = equalizer.treble;
      } else {
        bassFilterRef.current.gain.value = 0;
        midFilterRef.current.gain.value = 0;
        trebleFilterRef.current.gain.value = 0;
      }
    }
  }, [equalizer.enabled, equalizer.bass, equalizer.mid, equalizer.treble, isPlaying]);

  // 6. Time and Progress Polling
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPlaying || !currentSong) return;

      if (isDirectAudio && audioRef.current) {
        const cur = audioRef.current.currentTime || 0;
        const dur = audioRef.current.duration || 0;
        setCurrentTime(cur);
        if (dur > 0) setDuration(dur);
      } else if (ytPlayerRef.current?.getCurrentTime) {
        try {
          const cur = ytPlayerRef.current.getCurrentTime() || 0;
          const dur = ytPlayerRef.current.getDuration() || 0;
          setCurrentTime(cur);
          if (dur > 0) setDuration(dur);
        } catch {}
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying, isDirectAudio, currentSong?.videoId]);

  // 7. Media Session API (Lock Screen & OS Media Keys)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || !currentSong) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist,
      album: currentSong.albumName || "Raaga",
      artwork: [
        {
          src: currentSong.thumbnailUrl || "/logo.png",
          sizes: "512x512",
          type: "image/jpeg",
        },
      ],
    });

    navigator.mediaSession.setActionHandler("play", () => togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => togglePlay());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined) {
        seek(details.seekTime);
        if (isDirectAudio && audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
        } else if (ytPlayerRef.current?.seekTo) {
          ytPlayerRef.current.seekTo(details.seekTime, true);
        }
      }
    });
  }, [currentSong?.videoId, isDirectAudio]);

  // 7.5. Discord Rich Presence Synchronization
  useEffect(() => {
    discordPresence.updatePresence(
      currentSong,
      isPlaying,
      currentTime,
      duration,
      playbackSpeed,
      {
        enabled: discordRpcEnabled,
        showButtons: true,
        showAudioQuality: true,
      }
    );
  }, [currentSong?.videoId, isPlaying, playbackSpeed, discordRpcEnabled]);

  // 8. Connect Sync WebSocket Remote Commands Listener
  useEffect(() => {
    const unsubscribe = syncClient.subscribe((event) => {
      if (event.type === "CONNECT_COMMAND" && event.payload) {
        const cmd = event.payload;
        if (cmd === "PLAY" || cmd.type === "Play") {
          usePlayerStore.getState().resume();
        } else if (cmd === "PAUSE" || cmd.type === "Pause") {
          usePlayerStore.getState().pause();
        } else if (cmd.type === "Seek" || typeof cmd.positionMs === "number") {
          const sec = (cmd.positionMs || 0) / 1000;
          seek(sec);
          if (isDirectAudio && audioRef.current) {
            audioRef.current.currentTime = sec;
          } else if (ytPlayerRef.current?.seekTo) {
            ytPlayerRef.current.seekTo(sec, true);
          }
        } else if (cmd.type === "Volume" || typeof cmd.volume === "number") {
          setVolume(cmd.volume);
        } else if (cmd === "NEXT" || cmd.type === "Next") {
          next();
        } else if (cmd === "PREVIOUS" || cmd.type === "Previous") {
          prev();
        } else if (cmd.type === "SwitchPlayback" || cmd.videoId) {
          playSong({
            videoId: cmd.videoId,
            title: cmd.title || "Remote Track",
            artist: cmd.artist || "Unknown Artist",
            thumbnailUrl: cmd.thumbnailUrl || "",
          });
        }
      } else if (event.type === "STATE_UPDATED" || event.type === "SESSION_UPDATE") {
        applyRemoteState(event.payload);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isDirectAudio]);

  return (
    <>
      {/* HTML5 Audio Element for high-res direct streams */}
      <audio
        ref={audioRef}
        onEnded={() => {
          if (repeatMode === "ONE") {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play();
            }
          } else {
            next();
          }
        }}
        preload="auto"
        className="hidden"
      />

      {/* Official YouTube IFrame Player (Audio Output Engine - Offscreen) */}
      <div
        id="raaga-youtube-frame"
        aria-hidden="true"
        className="w-0 h-0 opacity-0 pointer-events-none overflow-hidden absolute -top-[9999px] -left-[9999px]"
      />
    </>
  );
}
