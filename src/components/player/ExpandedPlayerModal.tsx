'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, ChevronDown, Heart, Download, Play, Pause, SkipBack, SkipForward,
  Disc3, Mic2, Music, Tv, RefreshCw, ExternalLink, Shuffle, Repeat, Repeat1,
  ListMusic, Settings2, MonitorSmartphone, Check, MoreHorizontal, Share2,
  User, Disc, ListPlus, Radio, Sparkles, FolderPlus, Ban, Plus, Moon,
  Clock, Volume2, VolumeX, ShieldCheck, Loader2, Sliders, Car, Cast,
  Maximize2, Minimize2, Trash2, Layers
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { DeviceSelector } from '@/components/providers/DeviceSyncProvider';
import { AudioSettingsDrawer } from './AudioSettingsDrawer';
import { useLyricsStore } from '@/context/useLyricsStore';
import { SeekBar } from './SeekBar';
import { PlaybackEngine } from '@/lib/playback/PlaybackEngine';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { Spatial3DArtwork } from './Spatial3DArtwork';
import { AudioReactiveWaveform } from './AudioReactiveWaveform';
import { RecommendationEngine } from '@/lib/recommendation/RecommendationEngine';
import { haptics } from '@/lib/haptics/HapticEngine';

export function ExpandedPlayerModal() {
  const { playlists, addSongToPlaylist } = usePlaylistStore();
  const { tasks } = useDownloadStore();
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [viewMode, setViewMode] = useState<'art' | 'lyrics'>('art');
  const [visualMode, setVisualMode] = useState<'immersive' | 'standard'>('immersive');
  const [isQueuePanelOpen, setIsQueuePanelOpen] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

  const {
    status: lyricsStatus,
    type: lyricsType,
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
    currentTime,
    duration,
    setCurrentTime,
    togglePlayPause,
    playNext,
    playPrev,
    playSong,
    likedSongIds,
    toggleLikeSong,
    downloadedSongIds,
    toggleSettingsModal,
    toggleLyrics,
    toggleQueue,
    shuffleMode,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
    queue,
    queueIndex,
    addToQueue,
    removeFromQueue,
    clearQueue,
    setActiveTab,
    setToastMessage,
    isActiveDevice,
    activeDeviceId,
    remoteDeviceName,
    onlineDevices,
    toggleDeviceModal,
    toggleSleepTimerModal,
    sleepTimerMinutes,
    sleepTimerEndsAt,
    setSleepTimer,
    setSelectedArtistId,
    setSelectedAlbumId,
    setCreatePlaylistModalOpen,
    toggleEqualizer,
    toggleCarMode,
    cloudDownloadedSongIds = [],
  } = usePlayerStore();

  const normRepeat = ((repeatMode || 'OFF') as string).toUpperCase() === 'ONE' || ((repeatMode || 'OFF') as string).toUpperCase() === 'TRACK'
    ? 'ONE'
    : ((repeatMode || 'OFF') as string).toUpperCase() === 'ALL' || ((repeatMode || 'OFF') as string).toUpperCase() === 'CONTEXT'
      ? 'ALL'
      : 'OFF';

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [visualTime, setVisualTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // Sync browser fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsBrowserFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn('[ExpandedPlayerModal] Fullscreen API unavailable, using app full-screen modal:', err);
    }
  }, []);

  // Desktop Keyboard Shortcuts
  useEffect(() => {
    if (!isPlayerExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if inside text inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          {
            const targetTime = Math.max(0, currentTime - 5);
            setCurrentTime(targetTime, true);
            usePlayerStore.setState({ seekTarget: targetTime });
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          {
            const effectiveDur = duration || currentSong?.duration || 240;
            const targetTime = Math.min(effectiveDur, currentTime + 5);
            setCurrentTime(targetTime, true);
            usePlayerStore.setState({ seekTarget: targetTime });
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyN':
          e.preventDefault();
          playNext();
          break;
        case 'KeyP':
          e.preventDefault();
          playPrev();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyL':
          e.preventDefault();
          setViewMode(v => v === 'lyrics' ? 'art' : 'lyrics');
          break;
        case 'KeyQ':
          e.preventDefault();
          setIsQueuePanelOpen(q => !q);
          break;
        case 'Escape':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            togglePlayerExpanded();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPlayerExpanded,
    currentTime,
    duration,
    currentSong,
    volume,
    togglePlayPause,
    setCurrentTime,
    setVolume,
    toggleMute,
    playNext,
    playPrev,
    toggleFullscreen,
    togglePlayerExpanded,
  ]);

  // Pre-load lyrics for current track
  useEffect(() => {
    if (currentSong?.id) {
      import('@/lib/lyrics/LyricsEngine').then(({ LyricsEngine }) => {
        LyricsEngine.getInstance().loadTrack(currentSong.id);
      });
    }
  }, [currentSong?.id]);

  // Auto-scroll lyrics smoothly when active line changes in lyrics view
  useEffect(() => {
    if (viewMode !== 'lyrics' || lyricsIndex < 0 || lyricsLines.length === 0) return;
    const activeEl = document.getElementById(`modal-lyric-line-${lyricsIndex}`);
    if (activeEl && modalLyricsScrollRef.current) {
      const container = modalLyricsScrollRef.current;
      const targetScrollTop = activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
      container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
    }
  }, [lyricsIndex, viewMode, lyricsLines]);

  // Live Position Tracking for UI Display
  useEffect(() => {
    if (!isPlayerExpanded || isSeeking) return;
    let frame: number;
    const tick = () => {
      const engine = PlaybackEngine.getInstance();
      if (engine.isPlayingLocally()) {
        setVisualTime(engine.getCanonicalPositionMs() / 1000);
      } else {
        setVisualTime(currentTime);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlayerExpanded, isSeeking, currentTime]);

  const [liveTimerStr, setLiveTimerStr] = useState<string | null>(null);

  // Sleep Timer Countdown Display
  useEffect(() => {
    const { sleepTimerMode } = usePlayerStore.getState();
    if (!sleepTimerEndsAt && sleepTimerMode !== 'end_of_song' && sleepTimerMode !== 'end_of_queue') {
      setLiveTimerStr(null);
      return;
    }
    if (sleepTimerMode === 'end_of_song') {
      setLiveTimerStr('Song End');
      return;
    }
    if (sleepTimerMode === 'end_of_queue') {
      setLiveTimerStr('Queue End');
      return;
    }
    const updateCountdown = () => {
      const endsAt = usePlayerStore.getState().sleepTimerEndsAt;
      if (!endsAt) {
        setLiveTimerStr(null);
        return;
      }
      const diffSec = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      setLiveTimerStr(`${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndsAt]);

  // Close context menu on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleCloseModal = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    togglePlayerExpanded();
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isPlayerExpanded || !currentSong) return null;

  const isLiked = likedSongIds.includes(currentSong.id);
  const isDownloaded = downloadedSongIds.includes(currentSong.id);
  const isCloudRecorded = (cloudDownloadedSongIds || []).includes(currentSong.id);

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '--:--';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeDeviceObj = onlineDevices.find((d) => d.id === activeDeviceId);
  const localDeviceObj = onlineDevices.find((d) => d.id === deviceId);
  const localDeviceName = localDeviceObj?.name || 'This Computer';
  const downloadTask = currentSong ? tasks[currentSong.id] : null;
  const isDownloading = downloadTask && (downloadTask.status === 'DOWNLOADING' || downloadTask.status === 'QUEUED');
  const downloadPct = downloadTask?.progress || 0;

  const activeName = !isActiveDevice
    ? (remoteDeviceName || activeDeviceObj?.name || 'Remote Device')
    : localDeviceName;

  return (
    <div
      className="fixed inset-0 z-[100] w-full h-[100dvh] bg-[#06070a]/95 backdrop-blur-[60px] p-4 sm:p-6 md:p-8 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex flex-col text-white select-none animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
    >
      {/* Dynamic Chameleon Ambient Background Lighting */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none blur-[140px] scale-[1.35] transition-all duration-1000 saturate-[200%]"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 35%, var(--chameleon-primary, #fa233b) 0%, var(--chameleon-secondary, #8b5cf6) 45%, var(--chameleon-dark, #06070a) 80%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-30 pointer-events-none blur-[110px] scale-[1.2] transition-all duration-1000"
        style={{
          backgroundImage: `url(${currentSong.coverUrl || '/app-icon.png'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/90 pointer-events-none" />

      {/* TOP BAR / DESKTOP FULL-SCREEN HEADER */}
      <div className="relative z-50 flex items-center justify-between w-full pt-1 pb-2 sm:pb-3 max-w-6xl mx-auto flex-shrink-0">
        
        {/* Left: Minimize or Brand */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCloseModal}
            className="p-2 -ml-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-95 cursor-pointer"
            title="Minimize Player (Esc)"
          >
            <ChevronDown className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
          <span className="hidden sm:inline-block font-black text-sm tracking-wider text-white/40 uppercase">
            RaagaX Full Screen
          </span>
        </div>

        {/* Center: Playing From */}
        <div
          onClick={() => {
            const albumTarget = currentSong.albumId || currentSong.album;
            if (albumTarget) {
              setSelectedAlbumId(albumTarget);
              setActiveTab('album');
              handleCloseModal();
            }
          }}
          className={`text-center min-w-0 px-3 max-w-[55%] ${(currentSong.albumId || currentSong.album) ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'pointer-events-none'}`}
          title={currentSong.album ? `Go to album: ${currentSong.album}` : undefined}
        >
          <p className="text-[10px] text-white/50 font-black uppercase tracking-widest mb-0.5">
            PLAYING FROM
          </p>
          <h3 className="text-xs sm:text-sm font-extrabold text-white truncate tracking-tight">
            {currentSong.album || currentSong.genre || 'Trending Hits'}
          </h3>
        </div>

        {/* Right Tools: Visual Mode + Fullscreen Toggle + More */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          
          {/* Visual Mode Toggle (Immersive vs Standard/Split) */}
          <button
            onClick={() => setVisualMode(m => m === 'immersive' ? 'standard' : 'immersive')}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer ${
              visualMode === 'immersive'
                ? 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10'
                : 'border-white/15 text-white/80 hover:text-white bg-white/5'
            }`}
            title="Switch Visual Mode"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="capitalize">{visualMode}</span>
          </button>

          {/* Browser Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95 cursor-pointer"
            title={isBrowserFullscreen ? "Exit Browser Full Screen (F)" : "Expand Browser Full Screen (F)"}
          >
            {isBrowserFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          {/* Cast / Connect Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleDeviceModal();
            }}
            className={`p-2 rounded-full transition-all flex items-center justify-center active:scale-95 cursor-pointer relative ${
              !isActiveDevice
                ? 'text-white bg-emerald-500 shadow-lg shadow-emerald-500/40 ring-1 ring-emerald-400'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
            title={remoteDeviceName ? `Connected: ${remoteDeviceName}` : 'Cast to Device / Connect'}
          >
            <Cast className="w-5 h-5" />
            {!isActiveDevice && (
              <span className="w-2 h-2 rounded-full bg-white absolute top-1 right-1 animate-ping" />
            )}
          </button>

          {/* Context Dropdown Trigger */}
          <div className="relative inline-block" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95 cursor-pointer"
              title="More options"
            >
              <MoreHorizontal className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Menu Popover */}
            {isMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-64 bg-[#12131a]/98 backdrop-blur-3xl border border-white/15 rounded-2xl p-2 shadow-[0_25px_70px_rgba(0,0,0,0.95)] z-[999] text-xs text-white select-none animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    toggleLikeSong(currentSong.id);
                    setToastMessage(isLiked ? 'Removed from Liked Songs' : 'Saved to your Liked Songs');
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#fa233b] text-[#fa233b]' : 'text-white/60'}`} />
                    <span className="font-bold">{isLiked ? 'Remove from Liked Songs' : 'Save to your Liked Songs'}</span>
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
                    <div className="my-1 ml-4 pl-3 border-l border-white/10 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150 max-h-40 overflow-y-auto">
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
                        <p className="text-[10px] text-white/40 py-1 px-2 italic">No playlists yet</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="h-px bg-white/10 my-1" />

                <button
                  onClick={() => {
                    const artistTarget = currentSong.artistId || currentSong.artist;
                    if (artistTarget) setSelectedArtistId(artistTarget);
                    setActiveTab('artist');
                    handleCloseModal();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-white/60" />
                    <span className="font-bold">Go to artist</span>
                  </div>
                  <span className="text-white/40 text-xs">▸</span>
                </button>

                <button
                  onClick={() => {
                    const albumTarget = currentSong.albumId || currentSong.album;
                    if (albumTarget) setSelectedAlbumId(albumTarget);
                    setActiveTab('album');
                    handleCloseModal();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Disc className="w-4 h-4 text-white/60" />
                    <span className="font-bold">Go to album</span>
                  </div>
                  <span className="text-white/40 text-xs">▸</span>
                </button>

                <div className="h-px bg-white/10 my-1" />

                {/* Sleep Timer */}
                <button
                  onClick={() => {
                    toggleSleepTimerModal();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Moon className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold">Sleep Timer</span>
                  </div>
                  {liveTimerStr && <span className="text-[10px] text-indigo-400 font-mono font-bold">{liveTimerStr}</span>}
                </button>

                {/* Equalizer */}
                <button
                  onClick={() => {
                    toggleEqualizer(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Sliders className="w-4 h-4 text-[#FA233B]" />
                    <span className="font-bold">Equalizer & Spatial</span>
                  </div>
                  <span className="text-white/40 text-xs">▸</span>
                </button>

                <button
                  onClick={() => {
                    playNext();
                    setToastMessage(`Won't recommend "${currentSong.title}" again`);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors text-red-400"
                >
                  <div className="flex items-center gap-3">
                    <Ban className="w-4 h-4 text-red-400" />
                    <span className="font-bold">Don't play this song</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Close X */}
          <button
            onClick={handleCloseModal}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-95 cursor-pointer ml-1"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* MAIN VIEWPORT: IMMERSIVE OR SPLIT */}
      <div className="relative z-0 flex-1 min-h-0 flex flex-col md:flex-row items-center justify-between w-full max-w-6xl mx-auto py-1 sm:py-2 gap-4 md:gap-8">

        {/* LEFT / CENTER STAGE: 3D ARTWORK & DETAILS */}
        <div className={`flex-1 min-h-0 w-full flex flex-col justify-between items-center transition-all duration-300 ${
          isQueuePanelOpen || (visualMode === 'standard' && viewMode === 'lyrics') ? 'md:max-w-[50%]' : 'max-w-4xl mx-auto'
        }`}>

          {viewMode === 'art' ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center w-full py-2 select-none">
              <Spatial3DArtwork
                currentSong={currentSong}
                isPlaying={isPlaying}
                onSwipeLeft={playNext}
                onSwipeRight={playPrev}
                onTap={() => setViewMode('lyrics')}
                onLongPress={() => setIsMenuOpen(true)}
                isLiked={isLiked}
                isDownloaded={isDownloaded}
                isDownloading={Boolean(isDownloading)}
                downloadProgress={downloadPct}
                className="w-full flex-1 flex items-center justify-center max-h-[420px]"
              />

              {/* Audio-Reactive Waveform */}
              <div className="w-full max-w-[280px] sm:max-w-[340px] mt-1 mb-1">
                <AudioReactiveWaveform isPlaying={isPlaying} barCount={32} />
              </div>
            </div>
          ) : (
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
          <div className="flex-shrink-0 flex flex-col gap-3 sm:gap-4 w-full mt-auto">

            {/* SONG INFO + LIKE */}
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

            {/* TIMELINE */}
            <div className="w-full space-y-1 px-1">
              <SeekBar height="h-1.5" thumbSize="w-3.5 h-3.5" activeColor="bg-[#fa233b]" />
              <div className="flex items-center justify-between text-[11px] font-mono text-white/50 font-bold px-0.5">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(Number.isFinite(duration) && duration > 0 ? duration : (Number.isFinite(currentSong?.duration) && currentSong.duration > 0 ? currentSong.duration : -1))}</span>
              </div>
            </div>

            {/* MAIN 5 CONTROLS */}
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
                title="Previous Track (P)"
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
                title="Next Track (N)"
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

            {/* QUICK ACTIONS BAR */}
            <div className="flex items-center justify-between w-full px-1 pb-1 gap-2">
              <button
                onClick={() => setViewMode(v => v === 'lyrics' ? 'art' : 'lyrics')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${
                  viewMode === 'lyrics' ? 'bg-[#fa233b] text-white' : 'bg-white/10 hover:bg-white/20 text-white/90'
                }`}
                title="Lyrics (L)"
              >
                <Mic2 className="w-3.5 h-3.5" />
                <span>Lyrics</span>
              </button>

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
                  className="w-16 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-[#fa233b]"
                />
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={async () => {
                    if (isDownloaded) {
                      await useDownloadStore.getState().removeDownload(currentSong.id);
                      setToastMessage(`Removed "${currentSong.title}" from offline storage`);
                    } else {
                      await useDownloadStore.getState().saveForOffline(currentSong);
                      setToastMessage(`Saving "${currentSong.title}" for offline playback...`);
                    }
                  }}
                  className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                    isDownloaded
                      ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                      : 'border-white/10 bg-white/5 text-white/70 hover:text-white'
                  }`}
                  title={isDownloaded ? "Downloaded ✓" : "Download Offline"}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setIsQueuePanelOpen(q => !q)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                    isQueuePanelOpen
                      ? 'border-[#fa233b] text-[#fa233b] bg-[#fa233b]/10'
                      : 'border-white/10 bg-white/5 text-white/80 hover:text-white'
                  }`}
                  title="Up Next Queue (Q)"
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span>Queue {queue.length > 1 ? `(${queue.length})` : ''}</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT SIDE PANEL: SLIDE-OUT UP NEXT QUEUE (DESKTOP) */}
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

      {/* BOTTOM RAAGAX CONNECT BAR */}
      <div
        onClick={toggleDeviceModal}
        className="relative z-10 -mx-4 sm:-mx-6 md:-mx-8 -mb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-[#fa233b] text-white px-5 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-between font-black text-xs cursor-pointer hover:bg-[#d91533] transition-colors shadow-[0_-5px_20px_rgba(250,35,59,0.3)] mt-2"
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
