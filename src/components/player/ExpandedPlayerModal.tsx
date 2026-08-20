'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X, ChevronDown, Heart, Download, Play, Pause, SkipBack, SkipForward,
  Disc3, Mic2, Tv, Shuffle, Repeat, Repeat1,
  ListMusic, MoreHorizontal, Share2,
  ListPlus, Radio, Sparkles, FolderPlus, Plus, Moon,
  Clock, Volume2, VolumeX, Loader2, Cast,
  Maximize2, Minimize2, Trash2, MonitorSmartphone
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { AudioSettingsDrawer } from './AudioSettingsDrawer';
import { useLyricsStore } from '@/context/useLyricsStore';
import { SeekBar } from './SeekBar';
import { PlaybackEngine } from '@/lib/playback/PlaybackEngine';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { AudioReactiveWaveform } from './AudioReactiveWaveform';
import { RecommendationEngine } from '@/lib/recommendation/RecommendationEngine';
import { haptics } from '@/lib/haptics/HapticEngine';

import { DesktopVideoPlayer } from './DesktopVideoPlayer';
import { VideoResolver } from '@/lib/video/VideoResolver';
import { MediaHandoffManager } from '@/lib/playback/MediaHandoffManager';

export function ExpandedPlayerModal() {
  const { playlists, addSongToPlaylist } = usePlaylistStore();
  const { tasks } = useDownloadStore();
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [viewMode, setViewMode] = useState<'art' | 'video' | 'lyrics'>('art');
  const [isQueuePanelOpen, setIsQueuePanelOpen] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

  const {
    status: lyricsStatus,
    lines: lyricsLines,
    currentLineIndex: lyricsIndex,
    scriptMode,
    setScriptMode,
    hasTransliteration
  } = useLyricsStore();
  const modalLyricsScrollRef = useRef<HTMLDivElement>(null);

  const {
    isPlayerExpanded,
    togglePlayerExpanded,
    deviceId,
    volume,
    isMuted,
    setVolume,
    toggleMute,
    activeRenderer,
    currentSong,
    isPlaying,
    togglePlayPause,
    currentTime,
    duration,
    playNext,
    playPrev,
    queue,
    queueIndex,
    playSong,
    shuffleMode,
    toggleShuffle,
    repeatMode,
    setRepeatMode,
    likedSongIds,
    toggleLikeSong,
    downloadedSongIds,
    setToastMessage,
    addToQueue,
    setCreatePlaylistModalOpen,
    setActiveTab,
    setSelectedArtistId,
    setSelectedAlbumId,
    onlineDevices,
    activeDeviceId,
    isActiveDevice,
    toggleDeviceModal,
    remoteDeviceName,
    sleepTimerEndsAt,
    sleepTimerMode,
    toggleSleepTimerModal
  } = usePlayerStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sync sleep timer remaining countdown
  useEffect(() => {
    const updateCountdown = () => {
      if (sleepTimerEndsAt && sleepTimerEndsAt > Date.now()) {
        const remainingSec = Math.max(0, Math.floor((sleepTimerEndsAt - Date.now()) / 1000));
        const m = Math.floor(remainingSec / 60);
        const s = remainingSec % 60;
        setSleepTimerRemaining(`${m}:${s.toString().padStart(2, '0')}`);
      } else if (sleepTimerMode === 'end_of_song') {
        setSleepTimerRemaining('Song End');
      } else if (sleepTimerMode === 'end_of_queue') {
        setSleepTimerRemaining('Queue End');
      } else {
        setSleepTimerRemaining(null);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndsAt, sleepTimerMode]);

  // Click outside to close menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setShowPlaylists(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Auto-scroll lyrics smoothly in lyrics view
  useEffect(() => {
    if (viewMode === 'lyrics' && modalLyricsScrollRef.current && lyricsIndex >= 0) {
      const activeLineEl = document.getElementById(`modal-lyric-line-${lyricsIndex}`);
      if (activeLineEl) {
        activeLineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [lyricsIndex, viewMode]);

  // Synchronize viewMode with activeRenderer state
  useEffect(() => {
    if (activeRenderer === 'video') {
      setViewMode('video');
    } else if (viewMode === 'video') {
      setViewMode('art');
    }
  }, [activeRenderer]);

  // Synchronous: derived immediately from song.matchedVideo or song.sources.youtube.videoId — no async API call
  const hasVideo = useMemo(() => {
    if (!currentSong) return false;
    return VideoResolver.getInstance().resolveSync(currentSong).available;
  }, [currentSong?.id, currentSong?.matchedVideo, currentSong?.sources?.youtube?.videoId]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsBrowserFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsBrowserFullscreen(false);
    }
  };

  const handleCloseModal = useCallback(() => {
    if (activeRenderer === 'video') {
      MediaHandoffManager.getInstance().switchToAudio(currentSong?.duration);
    }
    setViewMode('art');
    togglePlayerExpanded();
  }, [activeRenderer, currentSong?.duration, togglePlayerExpanded]);

  if (!isPlayerExpanded || !currentSong) return null;

  const isLiked = likedSongIds.includes(currentSong.id);
  const isDownloaded = downloadedSongIds.includes(currentSong.id);
  const normRepeat = repeatMode.toUpperCase();

  const cycleRepeatMode = () => {
    haptics.lightImpact();
    if (normRepeat === 'OFF') {
      setRepeatMode('ALL');
      setToastMessage('Repeat Queue');
    } else if (normRepeat === 'ALL') {
      setRepeatMode('ONE');
      setToastMessage('Repeat 1 Song');
    } else {
      setRepeatMode('OFF');
      setToastMessage('Repeat Off');
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeDeviceObj = onlineDevices.find((d) => d.id === activeDeviceId);
  const localDeviceObj = onlineDevices.find((d) => d.id === deviceId);
  const localDeviceName = localDeviceObj?.name || 'This Computer';

  const activeName = !isActiveDevice
    ? (remoteDeviceName || activeDeviceObj?.name || 'Remote Device')
    : localDeviceName;

  return (
    <div className="fixed inset-0 z-[100] w-full h-[100dvh] bg-[#06070a]/95 backdrop-blur-[60px] p-4 sm:p-6 md:p-8 flex flex-col text-white select-none overflow-hidden justify-between animate-in fade-in duration-200">
      
      {/* Dynamic Chameleon Ambient Background Glow */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none blur-[120px] scale-[1.2] transition-all duration-1000"
        style={{
          backgroundImage: `url(${currentSong.coverUrl || '/app-icon.png'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="absolute inset-0 bg-black/60 pointer-events-none" />

      {/* ── TOP BAR (Clean 3-Column Desktop Header) ────────────────────────── */}
      <div className="relative z-50 flex items-center justify-between w-full max-w-6xl mx-auto flex-shrink-0 h-12">
        {/* Left: Minimize */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCloseModal}
            className="p-2 -ml-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-95 cursor-pointer"
            title="Minimize Player (Esc)"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
          <span className="hidden sm:inline-block font-black text-xs tracking-widest text-white/40 uppercase">
            RAAGAX
          </span>
        </div>

        {/* Center: Audio | Video | Lyrics Mode Selector */}
        <div className="flex items-center p-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl text-xs font-bold shadow-lg">
          <button
            onClick={() => {
              if (activeRenderer === 'video') {
                MediaHandoffManager.getInstance().switchToAudio(currentSong.duration);
              }
              setViewMode('art');
            }}
            className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'art' && activeRenderer !== 'video'
                ? 'bg-white/20 text-white font-black shadow'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Disc3 className="w-3.5 h-3.5" />
            <span>Audio</span>
          </button>

          {hasVideo && (
            <button
              onClick={() => {
                setViewMode('video');
                if (activeRenderer !== 'video') {
                  MediaHandoffManager.getInstance().switchToVideo(currentSong.duration);
                }
              }}
              className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'video' || activeRenderer === 'video'
                  ? 'bg-red-500/30 text-red-300 font-black border border-red-500/40 shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5 text-red-400" />
              <span>Video</span>
            </button>
          )}

          <button
            onClick={() => {
              if (activeRenderer === 'video') {
                MediaHandoffManager.getInstance().switchToAudio(currentSong.duration);
              }
              setViewMode('lyrics');
            }}
            className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'lyrics'
                ? 'bg-white/20 text-white font-black shadow'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Lyrics</span>
          </button>
        </div>

        {/* Right: Fullscreen, Cast, More Options, Close */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleFullscreen}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95 cursor-pointer"
            title={isBrowserFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
          >
            {isBrowserFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (viewMode === 'video' || activeRenderer === 'video') {
                setToastMessage('Connect to another device is available for audio playback.');
              }
              toggleDeviceModal();
            }}
            className={`p-2 rounded-full transition-all flex items-center justify-center active:scale-95 cursor-pointer relative ${
              !isActiveDevice
                ? 'text-white bg-emerald-500 shadow-lg shadow-emerald-500/40'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
            title="Connect to Device (Audio Playback)"
          >
            <Cast className="w-5 h-5" />
          </button>

          {/* More options menu */}
          <div className="relative inline-block" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95 cursor-pointer"
              title="More options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {isMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-64 bg-[#12131a]/98 backdrop-blur-3xl border border-white/15 rounded-2xl p-2 shadow-[0_25px_70px_rgba(0,0,0,0.95)] z-[999] text-xs text-white select-none animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    toggleLikeSong(currentSong.id);
                    setToastMessage(isLiked ? 'Removed from Liked Songs' : 'Saved to Liked Songs');
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#fa233b] text-[#fa233b]' : 'text-white/60'}`} />
                    <span className="font-bold">{isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    addToQueue(currentSong);
                    setToastMessage(`Added "${currentSong.title}" to queue`);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ListPlus className="w-4 h-4 text-white/60" />
                    <span className="font-bold">Add to queue</span>
                  </div>
                </button>

                <div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPlaylists(!showPlaylists);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FolderPlus className="w-4 h-4 text-white/60" />
                      <span className="font-bold">Add to playlist</span>
                    </div>
                    <span className={`text-white/40 text-xs transition-transform ${showPlaylists ? 'rotate-90' : ''}`}>▸</span>
                  </button>

                  {showPlaylists && (
                    <div className="my-1 ml-4 pl-3 border-l border-white/10 space-y-1 max-h-40 overflow-y-auto">
                      <button
                        onClick={() => {
                          setCreatePlaylistModalOpen(true);
                          setIsMenuOpen(false);
                          setShowPlaylists(false);
                        }}
                        className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-[#fa233b] hover:bg-white/5 font-bold flex items-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> New playlist
                      </button>

                      {playlists && playlists.length > 0 ? (
                        playlists.map((pl) => (
                          <button
                            key={pl.id}
                            onClick={async () => {
                              await addSongToPlaylist(pl.id, currentSong);
                              setToastMessage(`Added "${currentSong.title}" to ${pl.title}`);
                              setIsMenuOpen(false);
                              setShowPlaylists(false);
                            }}
                            className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-white/80 hover:text-white hover:bg-white/5 truncate font-medium block"
                          >
                            {pl.title}
                          </button>
                        ))
                      ) : (
                        <p className="text-[11px] text-white/40 py-1">No playlists yet</p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={async () => {
                    setIsMenuOpen(false);
                    try {
                      const res = await fetch(`/api/recommendations?seedId=${currentSong.id}&limit=20`);
                      const data = await res.json();
                      const radioTracks = data?.songs || [];
                      if (radioTracks.length > 0) {
                        usePlayerStore.getState().playSong(radioTracks[0], radioTracks);
                        setToastMessage(`Started Radio based on "${currentSong.title}"`);
                      }
                    } catch {
                      setToastMessage(`Started Radio based on "${currentSong.title}"`);
                    }
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Radio className="w-4 h-4 text-white/60" />
                    <span className="font-bold">Start track radio</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    const artistTarget = currentSong.artistId || currentSong.artist;
                    if (artistTarget) {
                      setSelectedArtistId(artistTarget);
                      setActiveTab('artist');
                      handleCloseModal();
                    }
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <span className="font-bold">Go to artist</span>
                </button>

                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: currentSong.title,
                        text: `Listening to "${currentSong.title}" by ${currentSong.artist} on RaagaX`,
                        url: window.location.href,
                      }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      setToastMessage('Link copied to clipboard');
                    }
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Share2 className="w-4 h-4 text-white/60" />
                    <span className="font-bold">Share</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    toggleSleepTimerModal();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Moon className={`w-4 h-4 ${sleepTimerEndsAt || sleepTimerMode ? 'text-[#fa233b] fill-[#fa233b]' : 'text-white/60'}`} />
                    <span className="font-bold">Sleep timer</span>
                  </div>
                  {sleepTimerRemaining && (
                    <span className="text-[10px] font-mono text-[#fa233b] font-bold px-1.5 py-0.5 rounded bg-[#fa233b]/10">
                      {sleepTimerRemaining}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={handleCloseModal}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-95 cursor-pointer ml-1"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── MAIN VIEWPORT (Video Cinema vs Audio/Lyrics Stage) ─────────────── */}
      {viewMode === 'video' ? (
        <div className="relative z-10 flex-1 w-full h-full min-h-0 flex flex-col py-2">
          <DesktopVideoPlayer
            song={currentSong}
            onClose={handleCloseModal}
            onSelectMode={(mode) => setViewMode(mode)}
          />
        </div>
      ) : (
        <div className="relative z-10 flex-1 min-h-0 flex flex-col md:flex-row items-center justify-center w-full max-w-6xl mx-auto py-2 gap-6 md:gap-10">

          {/* Center Column: Artwork & Player Controls */}
          <div className="flex-1 min-h-0 w-full max-w-xl mx-auto flex flex-col justify-between items-center h-full">

            {/* ARTWORK MODE */}
            {viewMode === 'art' ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center w-full py-2 select-none">
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.75)] border border-white/15 transition-transform duration-300 hover:scale-[1.01]">
                  <OptimizedImage
                    src={currentSong.coverUrl}
                    alt={currentSong.title}
                    size="full"
                    className="w-full h-full object-cover"
                  />
                  {isPlaying && (
                    <div className="absolute top-3.5 right-3.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-[11px] font-bold text-white flex items-center gap-2 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-[#fa233b] animate-ping" />
                      <span>Playing</span>
                    </div>
                  )}
                </div>

                {/* Audio-Reactive Waveform */}
                <div className="w-full max-w-[280px] sm:max-w-[340px] mt-4 mb-1">
                  <AudioReactiveWaveform isPlaying={isPlaying} barCount={32} />
                </div>
              </div>
            ) : (
              /* LYRICS MODE */
              <div className="flex-1 min-h-0 w-full max-w-2xl mx-auto flex flex-col relative overflow-hidden py-1 sm:py-2">
                <div className="flex items-center justify-between px-3 pb-2 mb-1 border-b border-white/10">
                  <div className="flex items-center gap-2 text-xs font-black text-white/90">
                    <Mic2 className="w-4 h-4 text-[#fa233b]" /> Live Synced Lyrics
                  </div>

                  {hasTransliteration && (
                    <div className="flex items-center p-0.5 rounded-lg border border-white/10 bg-white/5 text-[11px] font-bold">
                      <button
                        onClick={() => setScriptMode('native')}
                        className={`px-2.5 py-1 rounded-md transition-all ${scriptMode === 'native' ? 'bg-white/20 text-white font-black' : 'text-white/50 hover:text-white'}`}
                      >
                        Native
                      </button>
                      <button
                        onClick={() => setScriptMode('transliteration')}
                        className={`px-2.5 py-1 rounded-md transition-all ${scriptMode === 'transliteration' ? 'bg-white/20 text-white font-black' : 'text-white/50 hover:text-white'}`}
                      >
                        Romanized
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setViewMode('art')}
                    className="text-xs font-bold text-white/80 hover:text-white px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                  >
                    Show Art
                  </button>
                </div>

                <div
                  ref={modalLyricsScrollRef}
                  className="flex-1 overflow-y-auto scrollbar-hide py-16 px-3 sm:px-4 space-y-6 flex flex-col items-start"
                >
                  {lyricsStatus === 'loading' && (
                    <div className="w-full flex flex-col items-center justify-center py-16 text-white/60 gap-3">
                      <Loader2 className="w-6 h-6 text-[#fa233b] animate-spin" />
                      <p className="text-sm font-semibold">Syncing lyrics...</p>
                    </div>
                  )}
                  {lyricsStatus === 'unavailable' || lyricsLines.length === 0 ? (
                    <div className="w-full text-center py-16 text-white/60 flex flex-col items-center gap-2">
                      <p className="text-base font-bold text-white">Lyrics unavailable</p>
                      <p className="text-xs">No synchronized lyrics found for this song.</p>
                    </div>
                  ) : (
                    lyricsLines.map((line, idx) => {
                      const isActive = idx === lyricsIndex;
                      const isPassed = idx < lyricsIndex;
                      const mainContent = (scriptMode === 'transliteration' && line.romanizedText)
                        ? line.romanizedText
                        : (line.nativeText || line.text);

                      return (
                        <div
                          key={line.id}
                          id={`modal-lyric-line-${idx}`}
                          onClick={() => {
                            if (line.startMs !== undefined && line.startMs >= 0) {
                              const sec = line.startMs / 1000;
                              usePlayerStore.getState().setCurrentTime(sec, true);
                              import('@/lib/lyrics/LyricsEngine').then(({ LyricsEngine }) => {
                                LyricsEngine.getInstance().seek(line.startMs);
                              }).catch(() => {});
                            }
                          }}
                          className={`w-full text-left transition-all duration-300 transform origin-left cursor-pointer select-none py-1 ${
                            isActive
                              ? 'text-2xl sm:text-3xl font-black text-[#fa233b] drop-shadow-[0_0_20px_rgba(250,35,59,0.8)] scale-[1.02]'
                              : isPassed
                              ? 'text-base sm:text-xl font-bold text-white/35 opacity-40 hover:opacity-75'
                              : 'text-base sm:text-xl font-bold text-white/65 hover:text-white opacity-70'
                          }`}
                        >
                          <div className="tracking-tight break-words">{mainContent}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* CONTROLS SECTION */}
            <div className="flex-shrink-0 flex flex-col gap-3 w-full mt-auto">

              {/* Track Info & Like */}
              <div className="flex items-center justify-between gap-4 w-full px-1">
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug truncate">
                    {currentSong.title}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <p
                      onClick={() => {
                        const artistTarget = currentSong.artistId || currentSong.artist;
                        if (artistTarget) {
                          setSelectedArtistId(artistTarget);
                          setActiveTab('artist');
                          handleCloseModal();
                        }
                      }}
                      className="text-sm font-semibold text-white/75 truncate cursor-pointer hover:text-white hover:underline transition-colors"
                    >
                      {currentSong.artist}
                    </p>
                    <span className="text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/15 uppercase flex-shrink-0">
                      {isDownloaded ? 'Offline • 320K' : 'Lossless • 24-bit'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    toggleLikeSong(currentSong.id);
                    setToastMessage(isLiked ? 'Removed from Liked Songs' : 'Saved to Liked Songs');
                  }}
                  className="p-2 rounded-full hover:bg-white/10 transition-transform active:scale-125 flex-shrink-0 cursor-pointer"
                  title={isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}
                >
                  <Heart className={`w-7 h-7 transition-colors duration-200 ${isLiked ? 'fill-[#fa233b] text-[#fa233b]' : 'text-white/70 hover:text-white'}`} />
                </button>
              </div>

              {/* Timeline & Timestamps */}
              <div className="w-full space-y-1 px-1">
                <SeekBar height="h-1.5" thumbSize="w-3.5 h-3.5" activeColor="bg-[#fa233b]" />
                <div className="flex items-center justify-between text-[11px] font-mono text-white/50 font-bold px-0.5">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(Number.isFinite(duration) && duration > 0 ? duration : (Number.isFinite(currentSong?.duration) && currentSong.duration > 0 ? currentSong.duration : -1))}</span>
                </div>
              </div>

              {/* Main Playback 5 Controls */}
              <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-6 w-full px-1">
                <button
                  onClick={toggleShuffle}
                  className={`p-2.5 transition-all hover:scale-110 active:scale-95 cursor-pointer ${shuffleMode !== 'OFF' ? 'text-[#fa233b]' : 'text-white/60 hover:text-white'}`}
                  title={`Shuffle: ${shuffleMode}`}
                >
                  <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <button
                  onClick={playPrev}
                  className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
                  title="Previous Track"
                >
                  <SkipBack className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
                </button>

                <button
                  onClick={togglePlayPause}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-[#fa233b] to-[#ff4d6d] text-white hover:scale-105 active:scale-95 flex items-center justify-center shadow-[0_0_30px_rgba(250,35,59,0.5)] transition-all cursor-pointer"
                  title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                >
                  {isPlaying ? <Pause className="w-7 h-7 fill-white text-white" /> : <Play className="w-7 h-7 fill-white text-white ml-0.5" />}
                </button>

                <button
                  onClick={playNext}
                  className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
                  title="Next Track"
                >
                  <SkipForward className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
                </button>

                <button
                  onClick={cycleRepeatMode}
                  className={`p-2.5 transition-all hover:scale-110 active:scale-95 cursor-pointer ${normRepeat === 'ALL' || normRepeat === 'ONE' ? 'text-[#fa233b]' : 'text-white/60 hover:text-white'}`}
                  title={`Repeat: ${normRepeat}`}
                >
                  {normRepeat === 'ONE' ? <Repeat1 className="w-5 h-5 sm:w-6 sm:h-6" /> : <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>
              </div>

              {/* Volume & Queue Bar */}
              <div className="flex items-center justify-between w-full px-1 pb-1 gap-2">
                <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                  <button onClick={toggleMute} className="text-white/60 hover:text-white" title="Mute (M)">
                    {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-[#fa233b]" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-[#fa233b]"
                  />
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={toggleSleepTimerModal}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                      sleepTimerEndsAt || sleepTimerMode
                        ? 'border-[#fa233b] text-[#fa233b] bg-[#fa233b]/10 shadow-[0_0_15px_rgba(250,35,59,0.3)]'
                        : 'border-white/10 bg-white/5 text-white/80 hover:text-white'
                    }`}
                    title={sleepTimerEndsAt || sleepTimerMode ? `Sleep Timer Active (${sleepTimerRemaining || 'On'})` : "Sleep Timer"}
                  >
                    <Moon className={`w-3.5 h-3.5 ${sleepTimerEndsAt || sleepTimerMode ? 'fill-[#fa233b]' : ''}`} />
                    <span>{sleepTimerRemaining || (sleepTimerMode === 'end_of_song' ? 'Song End' : sleepTimerMode === 'end_of_queue' ? 'Queue End' : 'Sleep Timer')}</span>
                  </button>

                  <button
                    onClick={() => setIsQueuePanelOpen(q => !q)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                      isQueuePanelOpen
                        ? 'border-[#fa233b] text-[#fa233b] bg-[#fa233b]/10'
                        : 'border-white/10 bg-white/5 text-white/80 hover:text-white'
                    }`}
                    title="Up Next Queue"
                  >
                    <ListMusic className="w-3.5 h-3.5" />
                    <span>Queue {queue.length > 1 ? `(${queue.length})` : ''}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT SIDE PANEL: SLIDE-OUT UP NEXT QUEUE */}
          {isQueuePanelOpen && (
            <div className="hidden md:flex flex-col w-[340px] lg:w-[380px] h-[520px] bg-[#12131a]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 shadow-2xl animate-in slide-in-from-right-4 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-2">
                <div className="flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-[#fa233b]" />
                  <h3 className="text-sm font-bold text-white">Up Next</h3>
                  <span className="text-[10px] text-white/40 font-mono">({queue.length} songs)</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => usePlayerStore.setState(state => ({ queue: state.currentSong ? [state.currentSong] : [] }))}
                    className="p-1 text-white/40 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                    title="Clear Queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsQueuePanelOpen(false)}
                    className="p-1 text-white/40 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Close Queue"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-hide">
                {queue.map((track, idx) => {
                  const isCurrent = idx === queueIndex;
                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      onClick={() => playSong(track, queue)}
                      className={`flex items-center gap-2.5 p-2 rounded-2xl cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-[#fa233b]/15 border border-[#fa233b]/30 text-white'
                          : 'hover:bg-white/5 text-white/70 hover:text-white'
                      }`}
                    >
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
                        <OptimizedImage
                          src={track.coverUrl || '/app-icon.png'}
                          alt={track.title}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                        {isCurrent && isPlaying && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Disc3 className="w-4 h-4 text-[#fa233b] animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-xs font-bold truncate ${isCurrent ? 'text-[#fa233b]' : 'text-white'}`}>
                          {track.title}
                        </h4>
                        <p className="text-[10px] text-white/40 truncate">{track.artist}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          usePlayerStore.setState(state => ({
                            queue: state.queue.filter((_, i) => i !== idx),
                          }));
                        }}
                        className="p-1 text-white/30 hover:text-white rounded-lg transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── BOTTOM RAAGAX CONNECT BAR ──────────────────────────────────────── */}
      <div
        onClick={() => {
          if (viewMode === 'video' || activeRenderer === 'video') {
            setToastMessage('Connect to another device is available for audio playback.');
          }
          toggleDeviceModal();
        }}
        className="relative z-10 -mx-4 sm:-mx-6 md:-mx-8 -mb-4 sm:-mb-6 md:-mb-8 bg-[#fa233b] text-white px-5 py-2 flex items-center justify-between font-black text-xs cursor-pointer hover:bg-[#d91533] transition-colors shadow-[0_-5px_20px_rgba(250,35,59,0.3)] mt-2"
      >
        <div className="flex items-center gap-2 max-w-xl truncate">
          <MonitorSmartphone className="w-3.5 h-3.5 animate-pulse flex-shrink-0" />
          <span className="truncate">Playing on {activeName}</span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider opacity-90 flex-shrink-0">
          RaagaX Connect ↗
        </span>
      </div>

      <AudioSettingsDrawer />
    </div>
  );
}
