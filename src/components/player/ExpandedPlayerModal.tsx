'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronDown,
  Heart,
  Download,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
  MoreHorizontal,
  Share2,
  ListPlus,
  Mic2,
  Moon,
  Volume2,
  VolumeX,
  Cast,
  User,
  Disc,
  Info,
  Check,
  Loader2,
  Sparkles,
  Layers,
  Flame,
  Radio,
  X,
  Trash2,
  GripVertical,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { useLyricsStore } from '@/context/useLyricsStore';
import { SeekBar } from './SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { haptics } from '@/lib/haptics/HapticEngine';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';
import { LiquidGlass } from '@/components/common/LiquidGlass';
import { RadioEngine } from '@/lib/radio/RadioEngine';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { AlbumCatalogEngine } from '@/lib/albumCatalog';
import { SongActionMenu } from '@/components/common/SongActionMenu';

export function ExpandedPlayerModal() {
  const { playlists, addSongToPlaylist } = usePlaylistStore();
  const { saveForOffline } = useDownloadStore();
  const [palette, setPalette] = useState<ChameleonPalette | null>(null);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [viewMode, setViewMode] = useState<'art' | 'lyrics'>('art');
  const [isDesktopQueueOpen, setIsDesktopQueueOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [songTransitionKey, setSongTransitionKey] = useState<string>('');

  const {
    status: lyricsStatus,
    lines: lyricsLines,
    currentLineIndex: lyricsIndex,
    scriptMode,
    setScriptMode,
    hasTransliteration,
  } = useLyricsStore();
  const modalLyricsScrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    isPlayerExpanded,
    togglePlayerExpanded,
    deviceId,
    volume,
    isMuted,
    setVolume,
    toggleMute,
    currentSong,
    isPlaying,
    togglePlayPause,
    currentTime,
    duration,
    playNext,
    playPrev,
    queue,
    queueIndex,
    shuffleMode,
    toggleShuffle,
    repeatMode,
    setRepeatMode,
    likedSongIds = [],
    toggleLikeSong,
    downloadedSongIds = [],
    playbackContext,
    playbackContextData,
    setToastMessage,
    addToQueue,
    removeFromQueue,
    clearQueue,
    playSong,
    setActiveTab,
    setSelectedArtistId,
    setSelectedAlbumId,
    setSelectedPlaylistId,
    navigateFromPlayer,
    toggleDeviceModal,
    activeDeviceId,
    isActiveDevice,
    remoteDeviceName,
    onlineDevices,
    toggleQueue,
    toggleSleepTimerModal,
    sleepTimerEndsAt,
    sleepTimerMode,
  } = usePlayerStore();

  // Gesture handling for swipe-down to minimize on touch devices
  const touchStartY = useRef<number | null>(null);
  const [touchOffset, setTouchOffset] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const diffY = e.touches[0].clientY - touchStartY.current;
    if (diffY > 0) {
      setTouchOffset(diffY);
    }
  };

  const handleTouchEnd = () => {
    if (touchOffset > 100) {
      haptics.lightImpact();
      togglePlayerExpanded();
    }
    setTouchOffset(0);
    touchStartY.current = null;
  };

  // Close when clicking outside more menu
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

  // Trigger smooth artwork transition on song change
  useEffect(() => {
    if (currentSong?.id) {
      setSongTransitionKey(currentSong.id);
    }
  }, [currentSong?.id]);

  // Auto-scroll synchronized lyrics
  useEffect(() => {
    if (viewMode === 'lyrics' && modalLyricsScrollRef.current && lyricsIndex >= 0) {
      const activeLineEl = document.getElementById(`modal-lyric-line-${lyricsIndex}`);
      if (activeLineEl) {
        activeLineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [lyricsIndex, viewMode]);

  const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
  const isLiked = currentSong ? likedSongIds.includes(currentSong.id) : false;
  const isDownloaded = currentSong ? (downloadedSongIds || []).includes(currentSong.id) : false;

  const coverUrl = currentSong?.coverUrl && !currentSong.coverUrl.includes('/null/') && !currentSong.coverUrl.includes('null/null')
    ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  // Format time helpers
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const songDuration = Number.isFinite(duration) && duration > 0 ? duration : (Number.isFinite(currentSong?.duration) && (currentSong?.duration || 0) > 0 ? (currentSong?.duration || 0) : 0);
  const remainingTime = Math.max(0, songDuration - currentTime);

  // Exact ID-based entity resolution
  const exactArtistId = useMemo(() => {
    if (!currentSong) return null;
    if (currentSong.artistId) return currentSong.artistId;
    const match = POPULAR_ARTISTS.find(
      (a) => a.name.toLowerCase() === currentSong.artist?.toLowerCase()
    );
    return match?.id || null;
  }, [currentSong]);

  const exactAlbumId = useMemo(() => {
    if (!currentSong) return null;
    if (currentSong.albumId && currentSong.albumId !== 'offline' && currentSong.albumId !== 'unknown' && !currentSong.albumId.startsWith('alb-')) {
      return currentSong.albumId;
    }
    const match = AlbumCatalogEngine.getAllAlbums().find(
      (a) => a.title.toLowerCase() === currentSong.album?.toLowerCase()
    );
    if (match?.id && match.id !== 'offline') return match.id;
    if (currentSong.album && currentSong.album !== 'Downloaded' && currentSong.album !== 'RaagaX Music' && currentSong.album !== 'offline') {
      return currentSong.album;
    }
    return null;
  }, [currentSong]);

  // Extract dominant colors from current artwork
  useEffect(() => {
    let isMounted = true;
    if (coverUrl && coverUrl !== '/app-icon.png') {
      ArtworkColorExtractor.getInstance().extractPalette(coverUrl).then((p) => {
        if (isMounted) setPalette(p);
      });
    }
    return () => { isMounted = false; };
  }, [coverUrl]);

  const cycleRepeatMode = useCallback(() => {
    haptics.lightImpact();
    const mode = String(repeatMode).toUpperCase();
    if (mode === 'OFF') setRepeatMode('ALL' as any);
    else if (mode === 'ALL') setRepeatMode('ONE' as any);
    else setRepeatMode('OFF' as any);
  }, [repeatMode, setRepeatMode]);

  const normRepeat = String(repeatMode).toUpperCase();

  // Desktop Keyboard Shortcuts
  useEffect(() => {
    if (!isPlayerExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut if user is typing in an input/textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          haptics.mediumImpact();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          haptics.lightImpact();
          if (e.shiftKey) {
            const newTime = Math.max(0, currentTime - 5);
            usePlayerStore.getState().setCurrentTime(newTime, true);
          } else {
            playPrev();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          haptics.lightImpact();
          if (e.shiftKey) {
            const newTime = Math.min(songDuration, currentTime + 5);
            usePlayerStore.getState().setCurrentTime(newTime, true);
          } else {
            playNext();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, Math.round((volume + 0.05) * 100) / 100));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, Math.round((volume - 0.05) * 100) / 100));
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyS':
          e.preventDefault();
          toggleShuffle();
          break;
        case 'KeyR':
          e.preventDefault();
          cycleRepeatMode();
          break;
        case 'KeyL':
          e.preventDefault();
          setViewMode((prev) => (prev === 'lyrics' ? 'art' : 'lyrics'));
          break;
        case 'KeyQ':
          e.preventDefault();
          setIsDesktopQueueOpen((prev) => !prev);
          break;
        case 'Escape':
          e.preventDefault();
          togglePlayerExpanded();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPlayerExpanded,
    togglePlayPause,
    playPrev,
    playNext,
    currentTime,
    songDuration,
    volume,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    togglePlayerExpanded,
  ]);

  if (!isPlayerExpanded || !currentSong) return null;

  const upNextTracks = queue.slice(queueIndex + 1);

  return (
    <div
      className="fixed inset-0 z-[100] w-full h-[100dvh] bg-[#06070a] text-white select-none flex flex-col justify-between overflow-hidden animate-in fade-in duration-200"
      style={{ transform: `translateY(${touchOffset}px)` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── 1. DYNAMIC ARTWORK ATMOSPHERE (Cover Blur + 2-3 Color Meshes + Dark Glass Scrim) ── */}
      {/* Layer A: Blurred Enlarged Cover Artwork (40-60px blur) */}
      <div
        className="absolute inset-0 opacity-65 scale-125 pointer-events-none transition-all duration-700 ease-out"
        style={{
          backgroundImage: `url(${coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(50px) saturate(175%) brightness(0.50)',
        }}
      />

      {/* Layer B: Dynamic 2-3 Dominant Color Ambient Lighting Meshes */}
      {palette && (
        <>
          {/* Primary Dominant Glow (Top & Center Atmosphere) */}
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-[130%] h-[560px] rounded-full blur-3xl pointer-events-none transition-all duration-700 opacity-75"
            style={{
              background: `radial-gradient(ellipse at 50% 25%, ${palette.primary} 0%, ${palette.secondary} 45%, transparent 75%)`,
            }}
          />

          {/* Secondary Ambient Accent (Side Atmosphere) */}
          <div
            className="absolute top-32 -left-16 w-[80%] h-[420px] rounded-full blur-3xl pointer-events-none transition-all duration-700 opacity-50"
            style={{
              background: `radial-gradient(circle at 30% 40%, ${palette.secondary} 0%, transparent 65%)`,
            }}
          />

          {/* Highlight Bloom (Radiating Behind Foreground Artwork) */}
          <div
            className="absolute top-20 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full blur-2xl pointer-events-none transition-all duration-700 opacity-40"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${palette.highlight} 0%, transparent 60%)`,
            }}
          />
        </>
      )}

      {/* Layer C: Dark Glass / Vignette Scrim (Ensures Crisp Artwork & Neutral Glass Readability) */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, rgba(6,7,10,0.15) 0%, rgba(6,7,10,0.55) 55%, rgba(6,7,10,0.92) 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background:
            'linear-gradient(180deg, rgba(6,7,10,0.20) 0%, rgba(6,7,10,0.30) 35%, rgba(6,7,10,0.72) 75%, rgba(6,7,10,0.96) 92%, #06070A 100%)',
        }}
      />

      {/* ── Top Grab Handle Indicator (Mobile Drag-Down Affordance) ── */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-9 h-1 rounded-full bg-white/25 z-40 md:hidden pointer-events-none" />

      {/* ── 2. DESKTOP & MOBILE MINIMAL TOP BAR ───────────────────────────── */}
      <div className="relative z-30 flex items-center justify-between px-5 sm:px-8 pt-3 sm:pt-4 w-full flex-shrink-0">
        {/* Left: Minimize Chevron */}
        <button
          onClick={() => {
            haptics.lightImpact();
            togglePlayerExpanded();
          }}
          className="w-9 h-9 sm:w-10 sm:h-10 -ml-1 text-white/70 hover:text-white rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
          aria-label="Minimize Player"
          title="Minimize Player (Esc)"
        >
          <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Center: Context Info (Playing from Playlist / Album) */}
        <div className="flex flex-col items-center justify-center text-center px-2 min-w-0">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/50 font-sans">
            {playbackContext?.type === 'radio' ? 'Radio Stream' : 'Playing From'}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-white/90 truncate max-w-[200px] sm:max-w-[340px]">
            {playbackContext?.title || currentSong.album || 'Library'}
          </span>
        </div>

        {/* Right: Sleep Timer & Quick Close on Desktop */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              haptics.lightImpact();
              toggleSleepTimerModal();
            }}
            className={`w-9 h-9 sm:w-10 sm:h-10 text-white/70 hover:text-white rounded-full bg-white/[0.06] hover:bg-white/[0.12] border transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
              sleepTimerEndsAt || sleepTimerMode
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/20'
                : 'border-white/10'
            }`}
            aria-label="Sleep Timer"
            title={sleepTimerEndsAt ? 'Sleep Timer Active' : 'Sleep Timer'}
          >
            <Moon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${sleepTimerEndsAt || sleepTimerMode ? 'text-purple-400 fill-purple-400/30' : ''}`} />
          </button>

          <button
            onClick={() => {
              haptics.lightImpact();
              togglePlayerExpanded();
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 -mr-1 text-white/70 hover:text-white rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-all active:scale-95 cursor-pointer hidden md:flex items-center justify-center"
            aria-label="Close"
            title="Close Player (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── 3. MAIN WORKSPACE (CENTRAL UNBOXED STAGE + OPTIONAL DESKTOP QUEUE) ─ */}
      <div className="relative z-20 flex-1 flex items-center justify-center w-full max-w-7xl mx-auto px-5 sm:px-10 py-1 min-h-0 overflow-hidden">
        
        {/* Central Stage (Fluid, Unboxed Apple-Music Hierarchy) */}
        <div className={`flex-1 flex flex-col justify-between items-center h-full w-full transition-all duration-300 min-h-0 py-2 sm:py-3 gap-3 sm:gap-4 ${
          isDesktopQueueOpen ? 'max-w-[420px] lg:max-w-[460px]' : 'max-w-[390px] sm:max-w-[420px] lg:max-w-[450px]'
        }`}>
          
          {/* A. HERO ARTWORK / SYNCHRONIZED LYRICS */}
          {viewMode === 'art' ? (
            /* Large Unboxed Hero Artwork with Deep Cinematic Shadow */
            <div className="w-full flex-1 flex items-center justify-center py-1 min-h-0 overflow-hidden">
              <div
                key={songTransitionKey}
                className="relative w-full max-w-[min(340px,78vw)] max-h-[min(340px,40vh)] aspect-square rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.85),0_10px_24px_rgba(0,0,0,0.55)] transition-transform duration-500 hover:scale-[1.02] animate-in zoom-in-95 fade-in duration-300 flex-shrink-0"
              >
                <OptimizedImage
                  src={coverUrl}
                  alt={currentSong.title}
                  size="full"
                  className="w-full h-full object-cover select-none"
                />
                {/* 1px Inner Specular Rim Highlight */}
                <div className="absolute inset-0 rounded-[24px] sm:rounded-[28px] ring-1 ring-inset ring-white/20 pointer-events-none" />
              </div>
            </div>
          ) : (
            /* SYNCHRONIZED LYRICS STAGE */
            <div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden py-1">
              <div className="flex items-center justify-between px-3 pb-2 mb-1 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Mic2 className="w-4 h-4 text-[#F0444F]" /> Synced Lyrics
                </div>
                <button
                  onClick={() => setViewMode('art')}
                  className="text-xs font-semibold text-white/80 hover:text-white px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                >
                  Show Artwork
                </button>
              </div>

              <div
                ref={modalLyricsScrollRef}
                className="flex-1 overflow-y-auto no-scrollbar py-6 px-3 space-y-3.5 flex flex-col items-start"
              >
                {lyricsStatus === 'loading' && (
                  <div className="w-full flex flex-col items-center justify-center py-12 text-white/60 gap-3">
                    <Loader2 className="w-6 h-6 text-[#F0444F] animate-spin" />
                    <p className="text-xs font-semibold">Syncing lyrics...</p>
                  </div>
                )}
                {lyricsStatus === 'unavailable' || lyricsLines.length === 0 ? (
                  <div className="w-full text-center py-12 text-white/60 flex flex-col items-center gap-2">
                    <p className="text-sm font-bold text-white">Lyrics unavailable</p>
                    <p className="text-xs text-slate-400">No synchronized lyrics found for this track.</p>
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
                          }
                        }}
                        className={`w-full text-left transition-all duration-300 transform origin-left cursor-pointer py-1.5 ${
                          isActive
                            ? 'text-xl sm:text-2xl font-black text-white scale-[1.03]'
                            : isPassed
                            ? 'text-sm sm:text-base font-medium text-white/30'
                            : 'text-sm sm:text-base font-semibold text-white/60 hover:text-white'
                        }`}
                      >
                        {mainContent}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* B. SONG INFORMATION & ACTIONS (Unboxed Direct Row) */}
          <div className="w-full px-1 flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              {/* Title & Artist */}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight truncate" title={currentSong.title}>
                  {currentSong.title}
                </h1>
                <p
                  onClick={() => {
                    if (exactArtistId) {
                      navigateFromPlayer({ tab: 'artist', artistId: exactArtistId });
                    }
                  }}
                  className={`text-sm sm:text-base font-medium text-white/70 hover:text-white transition-colors truncate mt-0.5 ${
                    exactArtistId ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  title={currentSong.artist}
                >
                  {currentSong.artist}
                </p>
              </div>

              {/* Heart (Like) & More (...) Circular Glass Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0 relative" ref={menuRef}>
                <button
                  onClick={() => {
                    haptics.lightImpact();
                    toggleLikeSong(currentSong.id);
                    setToastMessage(isLiked ? 'Removed from Liked Songs' : 'Saved to Liked Songs');
                  }}
                  className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                >
                  <Heart
                    className={`w-5 h-5 transition-colors ${
                      isLiked ? 'fill-[#F0444F] text-[#F0444F]' : 'text-white/70 hover:text-white'
                    }`}
                    strokeWidth={2}
                  />
                </button>

                <button
                  onClick={() => {
                    haptics.lightImpact();
                    setIsMenuOpen(!isMenuOpen);
                  }}
                  className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 flex items-center justify-center transition-all text-white/70 hover:text-white hover:scale-105 active:scale-95 cursor-pointer"
                  title="More Options"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>

                {/* More Options Popover */}
                {isMenuOpen && (
                  <div
                    className="absolute right-0 bottom-full mb-2 w-56 bg-[#12141C]/95 backdrop-blur-xl border border-white/15 rounded-2xl p-1.5 shadow-2xl z-50 text-xs text-white divide-y divide-white/5 animate-in fade-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-0.5 pb-1">
                      <button
                        onClick={() => {
                          haptics.mediumImpact();
                          RadioEngine.getInstance().startRadio({
                            type: 'song',
                            seedId: currentSong.id,
                            seedTitle: currentSong.title,
                            seedCover: currentSong.coverUrl,
                            initialSong: currentSong,
                          });
                          setToastMessage(`Started "${currentSong.title}" Radio`);
                          setIsMenuOpen(false);
                        }}
                        className="w-full p-2.5 rounded-xl flex items-center gap-2.5 hover:bg-[#F0444F]/20 text-white font-bold transition-colors text-left cursor-pointer"
                      >
                        <Radio className="w-4 h-4 text-[#F0444F]" />
                        <span>Start Song Radio</span>
                      </button>

                      <button
                        onClick={() => {
                          addToQueue(currentSong);
                          setToastMessage(`Added "${currentSong.title}" to queue`);
                          setIsMenuOpen(false);
                        }}
                        className="w-full p-2.5 rounded-xl flex items-center gap-2.5 hover:bg-white/10 transition-colors text-left cursor-pointer"
                      >
                        <ListPlus className="w-4 h-4 text-slate-400" />
                        <span>Add to Queue</span>
                      </button>

                      {isNative && (
                        <button
                          onClick={() => {
                            saveForOffline(currentSong);
                            setToastMessage(`Downloading "${currentSong.title}"`);
                            setIsMenuOpen(false);
                          }}
                          className="w-full p-2.5 rounded-xl flex items-center gap-2.5 hover:bg-white/10 transition-colors text-left cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-slate-400" />
                          <span>Download Song</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          haptics.lightImpact();
                          toggleSleepTimerModal();
                          setIsMenuOpen(false);
                        }}
                        className="w-full p-2.5 rounded-xl flex items-center gap-2.5 hover:bg-purple-500/20 text-white transition-colors text-left cursor-pointer"
                      >
                        <Moon className="w-4 h-4 text-purple-400" />
                        <span>Sleep Timer {sleepTimerEndsAt ? '(Active)' : ''}</span>
                      </button>
                    </div>

                    <div className="space-y-0.5 pt-1">
                      <button
                        onClick={() => {
                          if (exactArtistId) {
                            navigateFromPlayer({ tab: 'artist', artistId: exactArtistId });
                            setIsMenuOpen(false);
                          }
                        }}
                        disabled={!exactArtistId}
                        className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 transition-colors text-left ${
                          exactArtistId
                            ? 'hover:bg-white/10 text-white cursor-pointer'
                            : 'opacity-40 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        <span>Go to Artist</span>
                      </button>

                      <button
                        onClick={() => {
                          if (exactAlbumId) {
                            navigateFromPlayer({ tab: 'album', albumId: exactAlbumId });
                            setIsMenuOpen(false);
                          }
                        }}
                        disabled={!exactAlbumId}
                        className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 transition-colors text-left ${
                          exactAlbumId
                            ? 'hover:bg-white/10 text-white cursor-pointer'
                            : 'opacity-40 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <Disc className="w-4 h-4 text-slate-400" />
                        <span>Go to Album</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* C. THIN ELEGANT PROGRESS BAR (Unboxed) */}
          <div className="w-full space-y-1.5 px-1 flex-shrink-0">
            <SeekBar
              height="h-1"
              thumbSize="w-3.5 h-3.5"
              accentGradient={palette ? `linear-gradient(90deg, ${palette.highlight} 0%, ${palette.accent} 100%)` : 'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 100%)'}
              accentGlow={palette ? `0 0 8px ${palette.glow}` : undefined}
            />
            <div className="flex items-center justify-between text-[11px] font-mono text-white/50 font-medium px-0.5">
              <span>{formatTime(currentTime)}</span>
              <span>{songDuration > 0 ? `-${formatTime(remainingTime)}` : '--:--'}</span>
            </div>
          </div>

          {/* D. UNBOXED MAIN PLAYBACK CONTROLS (Apple-Style Hierarchy) */}
          <div className="w-full flex items-center justify-between px-2 sm:px-4 flex-shrink-0">
            {/* Shuffle */}
            <button
              onClick={toggleShuffle}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 cursor-pointer ${
                shuffleMode !== 'OFF' ? 'text-[#F0444F]' : 'text-white/40 hover:text-white'
              }`}
              title={`Shuffle: ${shuffleMode} (S)`}
            >
              <Shuffle className="w-5 h-5" />
            </button>

            {/* Previous Track */}
            <button
              onClick={() => { haptics.lightImpact(); playPrev(); }}
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md"
              title="Previous Track (←)"
            >
              <SkipBack className="w-6 h-6 fill-white text-white" />
            </button>

            {/* HERO PLAY / PAUSE BUTTON (Circular, Bright Frosted 3D Surface with Subtle Depth) */}
            <button
              onClick={() => { haptics.mediumImpact(); togglePlayPause(); }}
              className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-full cursor-pointer flex-shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center bg-white text-black shadow-[0_12px_36px_rgba(0,0,0,0.6),0_0_24px_rgba(255,255,255,0.25)] border-2 border-white/90 group"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {/* Subtle Top Specular Glass Reflection */}
              <div className="absolute top-1 left-3 right-3 h-[36%] bg-gradient-to-b from-white to-transparent rounded-full pointer-events-none opacity-80" />

              {/* Icon */}
              {isPlaying ? (
                <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-black text-black transition-transform group-hover:scale-105" strokeWidth={0} />
              ) : (
                <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-black text-black ml-1 transition-transform group-hover:scale-105" strokeWidth={0} />
              )}
            </button>

            {/* Next Track */}
            <button
              onClick={() => { haptics.lightImpact(); playNext(); }}
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md"
              title="Next Track (→)"
            >
              <SkipForward className="w-6 h-6 fill-white text-white" />
            </button>

            {/* Repeat */}
            <button
              onClick={cycleRepeatMode}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 cursor-pointer ${
                normRepeat !== 'OFF' ? 'text-[#F0444F]' : 'text-white/40 hover:text-white'
              }`}
              title={`Repeat: ${normRepeat} (R)`}
            >
              {normRepeat === 'ONE' ? (
                <Repeat1 className="w-5 h-5 text-[#F0444F]" />
              ) : (
                <Repeat className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* E. SUBTLE VOLUME SLIDER (Unboxed) */}
          <div className="w-full flex items-center gap-3 px-3 flex-shrink-0">
            <button
              onClick={toggleMute}
              className="flex-shrink-0 text-white/40 hover:text-white transition-colors cursor-pointer"
              title="Mute / Unmute (M)"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-[#F0444F]" />
              ) : (
                <Volume2 className="w-4 h-4 text-white/50" />
              )}
            </button>
            <div className="relative flex-1 h-4 flex items-center group cursor-pointer">
              <div className="absolute left-0 right-0 h-1 rounded-full bg-white/15 group-hover:h-1.5 transition-all" />
              <div
                className="absolute left-0 h-1 group-hover:h-1.5 rounded-full pointer-events-none transition-all"
                style={{
                  width: `${(isMuted ? 0 : volume) * 100}%`,
                  background: palette ? `linear-gradient(90deg, ${palette.highlight} 0%, ${palette.accent} 100%)` : '#FFFFFF',
                }}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>
            <Volume2 className="w-4 h-4 text-white/50 flex-shrink-0" />
          </div>

          {/* F. BOTTOM UTILITIES ROW [ Lyrics | Device | Queue | Sleep Timer ] (Unboxed Minimal Pills) */}
          <div className="w-full flex items-center justify-center gap-2 sm:gap-2.5 pt-1 pb-1 sm:pb-2 px-2 flex-shrink-0">
            {/* Lyrics Button */}
            <button
              onClick={() => {
                haptics.lightImpact();
                setViewMode(viewMode === 'lyrics' ? 'art' : 'lyrics');
              }}
              className={`px-3.5 sm:px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'lyrics'
                  ? 'bg-white/20 text-white border-white/30 shadow-sm'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/10'
              }`}
              title="Synchronized Lyrics (L)"
            >
              <Mic2 className="w-3.5 h-3.5" />
              <span>Lyrics</span>
            </button>

            {/* Device Button */}
            <button
              onClick={() => {
                haptics.lightImpact();
                toggleDeviceModal();
              }}
              className="px-3.5 sm:px-4 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/70 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Connect Device"
            >
              <Cast className="w-3.5 h-3.5" />
              <span className="truncate max-w-[70px] sm:max-w-[90px]">{activeDeviceId && activeDeviceId !== deviceId ? (remoteDeviceName || 'Remote') : 'Device'}</span>
            </button>

            {/* Queue Button */}
            <button
              onClick={() => {
                haptics.lightImpact();
                if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                  setIsDesktopQueueOpen(!isDesktopQueueOpen);
                } else {
                  toggleQueue();
                }
              }}
              className={`px-3.5 sm:px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isDesktopQueueOpen
                  ? 'bg-white/20 text-white border-white/30 shadow-sm'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/10'
              }`}
              title="Playback Queue (Q)"
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Queue ({upNextTracks.length})</span>
            </button>

            {/* Sleep Timer Button */}
            <button
              onClick={() => {
                haptics.lightImpact();
                toggleSleepTimerModal();
              }}
              className={`px-3.5 sm:px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                sleepTimerEndsAt || sleepTimerMode
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/20'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/10'
              }`}
              title={sleepTimerEndsAt ? "Sleep timer active" : "Sleep Timer"}
            >
              <Moon className={`w-3.5 h-3.5 ${sleepTimerEndsAt || sleepTimerMode ? 'text-purple-400 fill-purple-400/30' : ''}`} />
              <span>{sleepTimerEndsAt ? 'Timer On' : 'Timer'}</span>
            </button>
          </div>
        </div>

        {/* ── 4. RIGHT-SIDE SLIDING QUEUE PANEL (DESKTOP) ──────────────────── */}
        {isDesktopQueueOpen && (
          <div className="hidden md:flex flex-col w-[380px] lg:w-[420px] h-full max-h-[84vh] ml-6 bg-[#0E1017]/90 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden animate-in slide-in-from-right-6 fade-in duration-300 z-30">
            
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
                  <ListMusic className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Up Next</h3>
                  <p className="text-[11px] text-slate-400">{upNextTracks.length} tracks in queue</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {upNextTracks.length > 0 && (
                  <button
                    onClick={() => {
                      haptics.lightImpact();
                      clearQueue();
                      setToastMessage('Queue cleared');
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                    title="Clear Queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
                <button
                  onClick={() => setIsDesktopQueueOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close Queue Panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Queue Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-4">
              
              {/* Currently Playing Card */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 px-1">
                  Playing Now
                </span>
                <div className="p-2.5 rounded-2xl bg-white/[0.06] border border-white/15 flex items-center gap-3 shadow-inner">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
                    <OptimizedImage
                      src={coverUrl}
                      alt={currentSong.title}
                      size="thumb"
                      className="w-full h-full object-cover"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="flex items-end gap-0.5 h-4">
                          <span className="w-0.5 h-full bg-[#F0444F] animate-pulse" />
                          <span className="w-0.5 h-2/3 bg-[#F0444F] animate-pulse delay-75" />
                          <span className="w-0.5 h-4/5 bg-[#F0444F] animate-pulse delay-150" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white truncate">{currentSong.title}</h4>
                    <p className="text-[11px] text-[#A8B2C2] truncate">{currentSong.artist}</p>
                  </div>
                  <LiquidGlass
                    level={1}
                    shape="circle"
                    interactive
                    onClick={() => toggleLikeSong(currentSong.id)}
                    className="w-8 h-8 cursor-pointer flex-shrink-0"
                  >
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-[#F0444F] text-[#F0444F]' : 'text-slate-400'}`} />
                  </LiquidGlass>
                </div>
              </div>

              {/* Up Next List */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 px-1">
                  Next In Queue
                </span>

                {upNextTracks.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 space-y-2">
                    <ListMusic className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs font-semibold text-slate-300">No more tracks in queue</p>
                    <p className="text-[10px] text-slate-500">Add songs from albums or search to keep the music playing.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {upNextTracks.map((song, index) => {
                      const actualIdx = queueIndex + 1 + index;
                      const sCover = song.coverUrl ? song.coverUrl.replace('http://', 'https://') : '/app-icon.png';
                      return (
                        <div
                          key={`queue-${song.id}-${actualIdx}`}
                          className="group p-2 rounded-xl hover:bg-white/10 border border-transparent hover:border-white/10 flex items-center gap-2.5 transition-all cursor-pointer"
                          onClick={() => {
                            haptics.lightImpact();
                            playSong(song, queue);
                          }}
                        >
                          <span className="text-[10px] font-mono text-slate-500 w-4 text-center group-hover:hidden">
                            {index + 1}
                          </span>
                          <Play className="w-3.5 h-3.5 fill-white text-white hidden group-hover:block ml-0.5 flex-shrink-0" />

                          <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 shadow">
                            <OptimizedImage
                              src={sCover}
                              alt={song.title}
                              size="thumb"
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-semibold text-white truncate group-hover:text-[#F0444F] transition-colors">
                              {song.title}
                            </h5>
                            <p className="text-[10px] text-slate-400 truncate">{song.artist}</p>
                          </div>

                          <span className="text-[10px] font-mono text-slate-500 hidden group-hover:inline-block">
                            {formatTime(song.duration || 0)}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              haptics.lightImpact();
                              removeFromQueue(song.id);
                            }}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Remove from Queue"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
