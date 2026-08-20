'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Minimize2, Music, Heart, Disc3, Mic2, Tv, ChevronLeft, ChevronRight,
  Shuffle, Repeat, Repeat1
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { MediaHandoffManager } from '@/lib/playback/MediaHandoffManager';
import { VideoResolver, ResolvedVideoInfo } from '@/lib/video/VideoResolver';
import { LyricsEngine } from '@/lib/lyrics/LyricsEngine';
import { Song } from '@/types/music';

interface DesktopVideoPlayerProps {
  song: Song;
  onClose?: () => void;
  onSelectMode?: (mode: 'art' | 'video' | 'lyrics') => void;
}

export function DesktopVideoPlayer({
  song,
  onClose,
  onSelectMode,
}: DesktopVideoPlayerProps) {
  const {
    isPlaying,
    currentTime,
    duration,
    setCurrentTime,
    volume,
    isMuted,
    setVolume,
    toggleMute,
    likedSongIds,
    toggleLikeSong,
    shuffleMode,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
    setToastMessage,
    playNext,
    playPrev,
  } = usePlayerStore();

  const [videoInfo, setVideoInfo] = useState<ResolvedVideoInfo | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isLiked = likedSongIds.includes(song.id);

  // 1. Resolve Video Stream metadata when song changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingVideo(true);

    VideoResolver.getInstance()
      .resolve(song)
      .then((info) => {
        if (!isCancelled) {
          if (info && info.available) {
            setVideoInfo(info);
          } else {
            MediaHandoffManager.getInstance().onVideoError('No video stream available');
          }
          setIsLoadingVideo(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          MediaHandoffManager.getInstance().onVideoError('Failed to fetch video');
          setIsLoadingVideo(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [song.id, song.title, song.artist]);

  // 2. Control YouTube IFrame Play/Pause
  const handleTogglePlayPause = useCallback(() => {
    const nextPlaying = !isPlaying;
    usePlayerStore.getState().setIsPlaying(nextPlaying, true);
    if (iframeRef.current?.contentWindow) {
      const command = nextPlaying ? 'playVideo' : 'pauseVideo';
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: command, args: [] }),
        '*'
      );
    }
  }, [isPlaying]);

  // Synchronize store isPlaying state from outside (e.g. MediaKeys, Notifications, Remote) to YouTube iframe
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      const command = isPlaying ? 'playVideo' : 'pauseVideo';
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: command, args: [] }),
        '*'
      );
    }
  }, [isPlaying]);

  // 3. Control YouTube IFrame Seek
  const handleSeek = useCallback((targetPos: number) => {
    setCurrentTime(targetPos);
    LyricsEngine.getInstance().seek(targetPos);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [targetPos, true] }),
        '*'
      );
    }
  }, [setCurrentTime]);

  // 4. Synchronize Volume & Mute to YouTube IFrame
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      const vol = isMuted ? 0 : Math.round(volume * 100);
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: isMuted ? 'mute' : 'unMute', args: [] }),
        '*'
      );
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }),
        '*'
      );
    }
  }, [volume, isMuted]);

  // 5. Listen to YouTube IFrame State Messages & Auto Advance / Repeat One
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          if (data.event === 'infoDelivery' && data.info) {
            if (typeof data.info.currentTime === 'number') {
              setCurrentTime(data.info.currentTime);
              LyricsEngine.getInstance().seek(data.info.currentTime);
            }
            if (typeof data.info.playerState === 'number') {
              // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
              if (data.info.playerState === 1 && !usePlayerStore.getState().isPlaying) {
                usePlayerStore.getState().setIsPlaying(true, true);
              } else if (data.info.playerState === 2 && usePlayerStore.getState().isPlaying) {
                usePlayerStore.getState().setIsPlaying(false, true);
              } else if (data.info.playerState === 0) {
                // Check Repeat Mode
                const rep = ((usePlayerStore.getState().repeatMode || 'OFF') as string).toUpperCase();
                if (rep === 'ONE' || rep === 'TRACK') {
                  handleSeek(0);
                  if (iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage(
                      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                      '*'
                    );
                  }
                } else {
                  playNext();
                }
              }
            }
          }
        }
      } catch { }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [handleSeek, playNext, setCurrentTime]);

  // 6. Keyboard Shortcuts (Space, Left/Right, N for Next, P for Prev, M, F, V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handleTogglePlayPause();
          break;
        case 'KeyN':
          e.preventDefault();
          playNext();
          break;
        case 'KeyP':
          e.preventDefault();
          playPrev();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            playPrev();
          } else {
            const targetPos = Math.max(0, currentTime - 5);
            handleSeek(targetPos);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            playNext();
          } else {
            const targetPos = Math.min(duration || 300, currentTime + 5);
            handleSeek(targetPos);
          }
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyV':
          e.preventDefault();
          handleSwitchToAudio();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentTime, duration, handleSeek, handleTogglePlayPause, playNext, playPrev, toggleMute]);

  // 7. Auto-hide HUD on idle during playback
  const handleMouseMove = useCallback(() => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setIsControlsVisible(false);
      }
    }, 3000);
  }, [isPlaying]);

  // 8. Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => { });
      setIsFullscreen(false);
    }
  };

  // 9. Seamless Switch back to Audio
  const handleSwitchToAudio = async () => {
    await MediaHandoffManager.getInstance().switchToAudio(song.duration);
    setToastMessage('🎵 Switched to Audio');
    if (onSelectMode) {
      onSelectMode('art');
    }
  };

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Stable initial start time captured once per video to prevent iframe URL reloads
  const initialStartSecRef = useRef(Math.max(0, Math.floor(usePlayerStore.getState().currentTime)));
  useEffect(() => {
    initialStartSecRef.current = Math.max(0, Math.floor(usePlayerStore.getState().currentTime));
  }, [videoInfo?.videoId]);

  const embedSourceUrl = useMemo(() => {
    if (!videoInfo?.videoId) return '';
    const startSec = initialStartSecRef.current;
    return `https://www.youtube-nocookie.com/embed/${videoInfo.videoId}?autoplay=1&start=${startSec}&enablejsapi=1&rel=0&modestbranding=1&iv_load_policy=3&cc_load_policy=0&cc_lang_pref=&controls=0&playsinline=1`;
  }, [videoInfo?.videoId]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative w-full h-full bg-black text-white flex flex-col justify-end overflow-hidden select-none animate-in fade-in duration-300 rounded-3xl border border-white/10 ${isFullscreen ? 'fixed inset-0 z-[110] rounded-none border-0' : ''
        }`}
    >
      {/* ── CINEMA FULL-SCREEN VIDEO CANVAS (100% Expansive) ────────────────── */}
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
        {isLoadingVideo ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-12 h-12 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            <p className="text-xs font-semibold tracking-wider text-slate-300">Connecting Video Stream...</p>
          </div>
        ) : videoInfo?.videoId ? (
          <div className="w-full h-full relative flex items-center justify-center">
            <iframe
              ref={iframeRef}
              src={embedSourceUrl}
              title={videoInfo.title || `${song.title} Video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => {
                try {
                  if (iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage(
                      JSON.stringify({ event: 'command', func: 'unloadModule', args: ['captions'] }),
                      '*'
                    );
                  }
                } catch { }
              }}
              className="w-full h-full border-0 pointer-events-auto object-cover"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-400 p-6 text-center">
            <Tv className="w-12 h-12 text-slate-600 mb-1" />
            <h4 className="text-base font-bold text-white">Video Unavailable</h4>
            <p className="text-xs max-w-sm text-slate-400">
              Music video could not be loaded for this track.
            </p>
            <button
              onClick={handleSwitchToAudio}
              className="mt-2 px-5 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer"
            >
              Continue in Audio Mode
            </button>
          </div>
        )}
      </div>

      {/* ── HOVER SIDE QUICK-NAV CONTROLS (Next / Prev Overlays) ───────────── */}
      <div
        className={`absolute inset-y-0 left-0 w-24 flex items-center justify-start pl-4 z-20 transition-opacity duration-300 pointer-events-none ${isControlsVisible ? 'opacity-100' : 'opacity-0'
          }`}
      >
        <button
          onClick={playPrev}
          className="p-3 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md border border-white/15 text-white/70 hover:text-white transition-all active:scale-90 pointer-events-auto shadow-2xl hover:scale-110 cursor-pointer"
          title="Previous in RaagaX Queue (P)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      <div
        className={`absolute inset-y-0 right-0 w-24 flex items-center justify-end pr-4 z-20 transition-opacity duration-300 pointer-events-none ${isControlsVisible ? 'opacity-100' : 'opacity-0'
          }`}
      >
        <button
          onClick={playNext}
          className="p-3 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md border border-white/15 text-white/70 hover:text-white transition-all active:scale-90 pointer-events-auto shadow-2xl hover:scale-110 cursor-pointer"
          title="Next in RaagaX Queue (N)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Floating Fullscreen Exit Button (Only when native fullscreen is active) */}
      {isFullscreen && (
        <div
          className={`absolute top-4 right-4 z-40 transition-opacity duration-300 ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
        >
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 text-white transition-all active:scale-95 cursor-pointer shadow-2xl"
            title="Exit Fullscreen (F)"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── BOTTOM HUD CONTROLS BAR (Exact Wireframe Architecture) ─────────── */}
      <div
        className={`relative z-30 p-5 sm:p-7 bg-gradient-to-t from-black/95 via-black/80 to-transparent transition-opacity duration-300 space-y-3.5 ${isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >
        {/* Row 1: Track Title & Artist */}
        <div className="flex items-baseline justify-between gap-4 px-1">
          <h2 className="text-base sm:text-lg font-black text-white truncate drop-shadow-md">
            {song.title}
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-slate-300 truncate drop-shadow-md">
            {song.artist}
          </p>
        </div>

        {/* Row 2: Sleek Seek Timeline */}
        <div className="w-full flex items-center gap-3 px-1">
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              const targetPos = ratio * (duration || song.duration || 300);
              handleSeek(targetPos);
            }}
            className="relative flex-1 h-1.5 bg-white/20 hover:h-2 rounded-full cursor-pointer group transition-all"
          >
            <div
              className="h-full bg-white rounded-full relative"
              style={{
                width: `${Math.min(100, Math.max(0, (currentTime / (duration || song.duration || 300)) * 100))}%`,
              }}
            >
              <div className="w-3.5 h-3.5 bg-white rounded-full absolute right-0 top-1/2 -translate-y-1/2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-300 min-w-[75px] text-right">
            {formatTime(currentTime)} / {formatTime(duration || song.duration || 210)}
          </span>
        </div>

        {/* Row 3: Centered Main Controls: ⏮ Previous | ⏸/▶ Play/Pause | ⏭ Next */}
        <div className="flex items-center justify-center gap-6 sm:gap-8 py-0.5">
          <button
            onClick={playPrev}
            className="p-2.5 text-slate-300 hover:text-white transition-all active:scale-90 hover:scale-110 cursor-pointer rounded-full hover:bg-white/10"
            title="Previous in RaagaX Queue (P)"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          <button
            onClick={handleTogglePlayPause}
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white hover:bg-slate-200 text-black flex items-center justify-center shadow-2xl transition-all active:scale-95 hover:scale-105 cursor-pointer"
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-black" />
            ) : (
              <Play className="w-6 h-6 fill-black ml-0.5" />
            )}
          </button>

          <button
            onClick={playNext}
            className="p-2.5 text-slate-300 hover:text-white transition-all active:scale-90 hover:scale-110 cursor-pointer rounded-full hover:bg-white/10"
            title="Next in RaagaX Queue (N)"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>
        </div>

        {/* Row 4: Secondary Actions: [ ♡ Like  🔀 Shuffle  🔁 Repeat ]  ...  [ 🔊 Volume  🎵 Audio Only ] */}
        <div className="flex items-center justify-between pt-0.5 px-1">
          {/* Left: Like, Shuffle, Repeat */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => toggleLikeSong(song.id)}
              className="p-2 text-slate-300 hover:text-white transition-transform hover:scale-110 active:scale-95 cursor-pointer rounded-full hover:bg-white/10"
              title="Like Song"
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'text-red-500 fill-red-500' : ''}`} />
            </button>

            <button
              onClick={toggleShuffle}
              className={`p-2 rounded-full transition-all cursor-pointer ${shuffleMode !== 'OFF' ? 'text-red-400 bg-red-500/15' : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              title={`Shuffle: ${shuffleMode}`}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            {(() => {
              const normRepeat = ((repeatMode || 'OFF') as string).toUpperCase() === 'ONE' || ((repeatMode || 'OFF') as string).toUpperCase() === 'TRACK'
                ? 'ONE'
                : ((repeatMode || 'OFF') as string).toUpperCase() === 'ALL' || ((repeatMode || 'OFF') as string).toUpperCase() === 'CONTEXT'
                  ? 'ALL'
                  : 'OFF';
              return (
                <button
                  onClick={cycleRepeatMode}
                  className={`p-2 rounded-full transition-all cursor-pointer ${normRepeat === 'ALL' || normRepeat === 'ONE' ? 'text-red-400 bg-red-500/15' : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  title={`Repeat: ${normRepeat === 'ONE' ? 'Repeat One' : normRepeat === 'ALL' ? 'Repeat All' : 'Off'}`}
                >
                  {normRepeat === 'ONE' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </button>
              );
            })()}
          </div>

          {/* Right: Volume & Audio Only Button */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <button onClick={toggleMute} className="p-1 text-slate-300 hover:text-white">
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
              />
            </div>

            <button
              onClick={handleSwitchToAudio}
              className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white/90 hover:text-white transition-all backdrop-blur-md active:scale-95 cursor-pointer shadow-sm flex items-center gap-1.5"
              title="Switch to Audio (V)"
            >
              <Music className="w-3.5 h-3.5 text-emerald-400" />
              <span>🎵 Audio Only</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
