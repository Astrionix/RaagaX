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
    if (currentSong.albumId) return currentSong.albumId;
    const match = AlbumCatalogEngine.getAllAlbums().find(
      (a) => a.title.toLowerCase() === currentSong.album?.toLowerCase()
    );
    return match?.id || null;
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
        className="absolute inset-0 opacity-65 scale-125 pointer-events-none transition-all duration-1000 ease-out"
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
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-[130%] h-[560px] rounded-full blur-3xl pointer-events-none transition-all duration-1000 opacity-75"
            style={{
              background: `radial-gradient(ellipse at 50% 25%, ${palette.primary} 0%, ${palette.secondary} 45%, transparent 75%)`,
            }}
          />

          {/* Secondary Ambient Accent (Side Atmosphere) */}
          <div
            className="absolute top-32 -left-16 w-[80%] h-[420px] rounded-full blur-3xl pointer-events-none transition-all duration-1000 opacity-50"
            style={{
              background: `radial-gradient(circle at 30% 40%, ${palette.secondary} 0%, transparent 65%)`,
            }}
          />

          {/* Highlight Bloom (Radiating Behind Foreground Artwork) */}
          <div
            className="absolute top-20 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full blur-2xl pointer-events-none transition-all duration-1000 opacity-40"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${palette.highlight} 0%, transparent 60%)`,
            }}
          />
        </>
      )}

      {/* Layer C: Dark Glass / Vignette Scrim (Ensures Crisp Artwork & Neutral Glass Readability) */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, rgba(6,7,10,0.15) 0%, rgba(6,7,10,0.55) 55%, rgba(6,7,10,0.92) 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(6,7,10,0.20) 0%, rgba(6,7,10,0.30) 35%, rgba(6,7,10,0.72) 75%, rgba(6,7,10,0.96) 92%, #06070A 100%)',
        }}
      />

      {/* ── Top Grab Handle Indicator (Mobile Drag-Down Affordance) ── */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-9 h-1 rounded-full bg-white/25 z-40 md:hidden pointer-events-none" />

      {/* ── 2. DESKTOP & MOBILE TOP BAR ────────────────────────────────────── */}
      <div className="relative z-30 flex items-center justify-between px-5 sm:px-8 pt-3 sm:pt-4 w-full flex-shrink-0">
        {/* Left: Minimize / Chevron Down */}
        <button
          onClick={() => {
            haptics.lightImpact();
            togglePlayerExpanded();
          }}
          className="p-2 sm:p-2.5 -ml-2 text-white/70 hover:text-white rounded-full bg-white/[0.04] hover:bg-white/10 border border-white/5 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
          aria-label="Minimize Player"
          title="Minimize Player (Esc)"
        >
          <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Center: Subtle Now Playing Title / Context */}
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[#F0444F] font-mono">
            {playbackContext?.type === 'radio' ? 'Radio Stream' : 'Now Playing'}
          </span>
          <span className="text-xs sm:text-sm font-bold text-white/90 truncate max-w-[200px] sm:max-w-[360px]">
            {playbackContext?.title || currentSong.album || 'RaagaX Master Audio'}
          </span>
        </div>

        {/* Right: Quick Close Button on Desktop */}
        <button
          onClick={() => {
            haptics.lightImpact();
            togglePlayerExpanded();
          }}
          className="p-2 sm:p-2.5 -mr-2 text-white/70 hover:text-white rounded-full bg-white/[0.04] hover:bg-white/10 border border-white/5 transition-all active:scale-95 cursor-pointer hidden md:flex items-center justify-center"
          aria-label="Close"
          title="Close Player (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="w-6 md:hidden" />
      </div>

      {/* ── 3. MAIN WORKSPACE (CENTRAL STAGE + OPTIONAL SLIDING QUEUE PANEL) ─ */}
      <div className="relative z-20 flex-1 flex items-center justify-center w-full max-w-7xl mx-auto px-4 sm:px-8 py-1 min-h-0 overflow-hidden">
        
        {/* Central Stage (Artwork + Metadata + Controls) */}
        <div className={`flex-1 flex flex-col justify-between items-center h-full w-full transition-all duration-300 min-h-0 py-1 sm:py-2 gap-2 sm:gap-2.5 ${
          isDesktopQueueOpen ? 'max-w-[460px] lg:max-w-[500px]' : 'max-w-[440px] lg:max-w-[480px]'
        }`}>
          
          {/* A. ARTWORK / LYRICS STAGE */}
          {viewMode === 'art' ? (
            /* Large 3D Artwork (strictly responsive and never overflowing into metadata) */
            <div className="w-full flex-1 flex items-center justify-center py-1 px-2 min-h-0 overflow-hidden">
              <div
                key={songTransitionKey}
                className="relative h-full max-h-[min(380px,36vh)] aspect-square rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.9),0_10px_30px_rgba(0,0,0,0.6)] border border-white/15 group transition-transform duration-500 hover:scale-[1.02] animate-in zoom-in-95 fade-in duration-300 flex-shrink-0"
              >
                <OptimizedImage
                  src={coverUrl}
                  alt={currentSong.title}
                  size="full"
                  className="w-full h-full object-cover select-none"
                />
                {/* 3D Specular Liquid Top Reflection */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent pointer-events-none" />
                {/* Subtle Inner Glow Border */}
                <div className="absolute inset-0 rounded-[24px] sm:rounded-[28px] ring-1 ring-inset ring-white/20 pointer-events-none" />
              </div>
            </div>
          ) : (
            /* SYNCHRONIZED LYRICS STAGE */
            <div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden py-1 px-2">
              <div className="flex items-center justify-between px-3 pb-2 mb-1 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs font-black text-white">
                  <Mic2 className="w-4 h-4 text-[#F0444F]" /> Live Synced Lyrics
                </div>
                <button
                  onClick={() => setViewMode('art')}
                  className="text-xs font-bold text-white/80 hover:text-white px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                >
                  Show Artwork (L)
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
                            ? 'text-xl sm:text-2xl lg:text-3xl font-black text-[#F0444F] scale-[1.03]'
                            : isPassed
                            ? 'text-sm sm:text-base font-bold text-white/35 opacity-40'
                            : 'text-sm sm:text-base font-bold text-white/70 hover:text-white'
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

          {/* B. PLAYBACK METADATA & ACTIONS (Title, Artist, Like, More) */}
          <div className="w-full pt-1 px-1 flex-shrink-0">
            <div className="flex items-center justify-between gap-4">
              {/* Title & Artist */}
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight leading-tight truncate" title={currentSong.title}>
                  {currentSong.title}
                </h1>
                <p
                  onClick={() => {
                    if (exactArtistId) {
                      navigateFromPlayer({ tab: 'artist', artistId: exactArtistId });
                    }
                  }}
                  className={`text-xs sm:text-sm md:text-base font-semibold text-[#A8B2C2] hover:text-white transition-colors truncate mt-0.5 ${
                    exactArtistId ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  title={currentSong.artist}
                >
                  {currentSong.artist}
                </p>
              </div>

              {/* Heart (Like) & More (⋯) */}
              <div className="flex items-center gap-2.5 flex-shrink-0 relative" ref={menuRef}>
                <LiquidGlass
                  level={2}
                  shape="circle"
                  interactive
                  refractionColor={isLiked ? 'rgba(240,68,79,0.15)' : undefined}
                  onClick={() => {
                    haptics.lightImpact();
                    toggleLikeSong(currentSong.id);
                    setToastMessage(isLiked ? 'Removed from Liked Songs' : 'Saved to Liked Songs');
                  }}
                  className="w-[42px] h-[42px] sm:w-[46px] sm:h-[46px] cursor-pointer hover:scale-105 transition-transform"
                  title={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                >
                  <Heart
                    className={`w-5 h-5 transition-colors ${
                      isLiked ? 'fill-[#F0444F] text-[#F0444F]' : 'text-slate-300 hover:text-white'
                    }`}
                    strokeWidth={2.2}
                  />
                </LiquidGlass>

                <LiquidGlass
                  level={2}
                  shape="circle"
                  interactive
                  onClick={() => {
                    haptics.lightImpact();
                    setIsMenuOpen(!isMenuOpen);
                  }}
                  className="w-[42px] h-[42px] sm:w-[46px] sm:h-[46px] cursor-pointer text-slate-300 hover:text-white hover:scale-105 transition-transform"
                  title="More Options"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </LiquidGlass>

                {/* More Options Popover */}
                {isMenuOpen && (
                  <div
                    className="absolute right-0 bottom-full mb-2 w-60 bg-[#14161E]/95 backdrop-blur-xl border border-white/15 rounded-2xl p-1.5 shadow-2xl z-50 text-xs text-white divide-y divide-white/5 animate-in fade-in zoom-in-95 duration-150"
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

          {/* C. PROGRESS BAR WITH HOVER PREVIEW */}
          <div className="w-full space-y-1 pt-1 pb-0.5 px-1 flex-shrink-0">
            <SeekBar
              height="h-1.5"
              thumbSize="w-4 h-4"
              accentGradient={palette ? `linear-gradient(90deg, ${palette.highlight} 0%, ${palette.accent} 100%)` : undefined}
              accentGlow={palette ? `0 0 10px ${palette.glow}` : undefined}
            />
            <div className="flex items-center justify-between text-xs font-mono text-[#A8B2C2] font-semibold px-0.5">
              <span>{formatTime(currentTime)}</span>
              <span>-{formatTime(remainingTime)}</span>
            </div>
          </div>

          {/* D. UNIFIED FROSTED GLASS PLAYBACK CONTROLS CARD */}
          <div className="w-full pt-1 pb-0.5 px-1 flex-shrink-0">
            <div className="p-2.5 sm:p-3.5 rounded-3xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl space-y-2">
              
              {/* Playback Controls Row (Shuffle, Prev, HERO PLAY/PAUSE, Next, Repeat) */}
              <div className="flex items-center justify-between w-full px-1">
                {/* Shuffle Button (44px) */}
                <LiquidGlass
                  level={2}
                  shape="circle"
                  interactive
                  onClick={toggleShuffle}
                  refractionColor={shuffleMode !== 'OFF' ? 'rgba(240,68,79,0.2)' : undefined}
                  className="w-[40px] h-[40px] sm:w-[44px] sm:h-[44px] cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                  title={`Shuffle: ${shuffleMode} (S)`}
                >
                  <Shuffle className={`w-4.5 h-4.5 ${shuffleMode !== 'OFF' ? 'text-[#F0444F]' : 'text-slate-400 hover:text-white'}`} />
                </LiquidGlass>

                {/* Previous Track (50-54px) */}
                <LiquidGlass
                  level={3}
                  shape="circle"
                  interactive
                  onClick={() => { haptics.lightImpact(); playPrev(); }}
                  className="w-[48px] h-[48px] sm:w-[54px] sm:h-[54px] cursor-pointer text-white hover:scale-105 active:scale-95 transition-transform"
                  title="Previous Track (←)"
                >
                  <SkipBack className="w-5 h-5 sm:w-6 sm:h-6 fill-white text-white" />
                </LiquidGlass>

                {/* HERO PLAY / PAUSE BUTTON (72–78px, Glowing High-Gloss 3D Glass) */}
                <button
                  onClick={() => { haptics.mediumImpact(); togglePlayPause(); }}
                  className="relative w-[70px] h-[70px] sm:w-[76px] sm:h-[76px] rounded-full cursor-pointer flex-shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center bg-gradient-to-b from-white via-[#F5F7FB] to-[#D8DEEE] border-2 border-white/90 shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_30px_rgba(255,255,255,0.35),inset_0_2px_1px_#ffffff,inset_0_-2px_4px_rgba(0,0,0,0.12)] group"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {/* Top Specular High-Gloss Droplet Reflection */}
                  <div className="absolute top-1 left-3.5 right-3.5 h-[38%] bg-gradient-to-b from-white to-transparent rounded-full pointer-events-none opacity-90" />

                  {/* Icon */}
                  {isPlaying ? (
                    <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-[#11131E] text-[#11131E] transition-transform group-hover:scale-105" strokeWidth={0} />
                  ) : (
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-[#11131E] text-[#11131E] ml-1 transition-transform group-hover:scale-105" strokeWidth={0} />
                  )}
                </button>

                {/* Next Track (50-54px) */}
                <LiquidGlass
                  level={3}
                  shape="circle"
                  interactive
                  onClick={() => { haptics.lightImpact(); playNext(); }}
                  className="w-[48px] h-[48px] sm:w-[54px] sm:h-[54px] cursor-pointer text-white hover:scale-105 active:scale-95 transition-transform"
                  title="Next Track (→)"
                >
                  <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 fill-white text-white" />
                </LiquidGlass>

                {/* Repeat Button (44px) */}
                <LiquidGlass
                  level={2}
                  shape="circle"
                  interactive
                  onClick={cycleRepeatMode}
                  refractionColor={(normRepeat === 'ALL' || normRepeat === 'ONE') ? 'rgba(240,68,79,0.2)' : undefined}
                  className="w-[40px] h-[40px] sm:w-[44px] sm:h-[44px] cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                  title={`Repeat: ${normRepeat} (R)`}
                >
                  {normRepeat === 'ONE' ? (
                    <Repeat1 className="w-4.5 h-4.5 text-[#F0444F]" />
                  ) : (
                    <Repeat className={`w-4.5 h-4.5 ${normRepeat !== 'OFF' ? 'text-[#F0444F]' : 'text-slate-400 hover:text-white'}`} />
                  )}
                </LiquidGlass>
              </div>

              {/* Volume Slider Bar */}
              <div className="w-full flex items-center gap-3 px-2 pt-0.5">
                <button
                  onClick={toggleMute}
                  className="flex-shrink-0 active:scale-90 hover:scale-110 transition-transform cursor-pointer text-slate-400 hover:text-white"
                  title="Mute / Unmute (M)"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-[#F0444F]" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-slate-300" />
                  )}
                </button>
                <div className="relative flex-1 h-5 flex items-center group cursor-pointer">
                  <div
                    className="absolute left-0 right-0 h-1.5 rounded-full bg-white/10 group-hover:h-2 transition-all"
                    style={{
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                    }}
                  />
                  <div
                    className="absolute left-0 h-1.5 group-hover:h-2 rounded-full pointer-events-none transition-all"
                    style={{
                      width: `${(isMuted ? 0 : volume) * 100}%`,
                      background: palette ? `linear-gradient(90deg, ${palette.highlight} 0%, ${palette.accent} 100%)` : 'linear-gradient(90deg, #d93845 0%, #F0444F 100%)',
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
                    title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}% (↑/↓)`}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* E. SINGLE TRANSLUCENT GLASS CONTROL BAR [ Lyrics | Device | Queue ] */}
          <div className="w-full pt-1 pb-1 sm:pb-2 px-1 flex-shrink-0">
            <div className="w-full p-1 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 flex items-center justify-between gap-1.5 shadow-lg">
              
              {/* Lyrics Button */}
              <button
                onClick={() => {
                  haptics.lightImpact();
                  setViewMode(viewMode === 'lyrics' ? 'art' : 'lyrics');
                }}
                className={`flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'lyrics'
                    ? 'bg-[#F0444F]/25 text-white border border-[#F0444F]/40 shadow-md shadow-[#F0444F]/20'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Synchronized Lyrics (L)"
              >
                <Mic2 className={`w-4 h-4 ${viewMode === 'lyrics' ? 'text-[#F0444F]' : 'text-slate-400'}`} />
                <span>Lyrics</span>
              </button>

              {/* Device Connect Button */}
              <button
                onClick={() => {
                  haptics.lightImpact();
                  toggleDeviceModal();
                }}
                className="flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                title="Connect Device / Spotify-Style Handoff"
              >
                <Cast className="w-4 h-4 text-slate-400" />
                <span className="truncate">{activeDeviceId && activeDeviceId !== deviceId ? (remoteDeviceName || 'Remote') : 'Device'}</span>
              </button>

              {/* Queue Button */}
              <button
                onClick={() => {
                  haptics.lightImpact();
                  // On desktop, toggle inline side panel; on mobile, open standard drawer
                  if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                    setIsDesktopQueueOpen(!isDesktopQueueOpen);
                  } else {
                    toggleQueue();
                  }
                }}
                className={`flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  isDesktopQueueOpen
                    ? 'bg-purple-500/25 text-white border border-purple-500/40 shadow-md shadow-purple-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Playback Queue (Q)"
              >
                <ListMusic className={`w-4 h-4 ${isDesktopQueueOpen ? 'text-purple-400' : 'text-slate-400'}`} />
                <span>Queue ({upNextTracks.length})</span>
              </button>
            </div>
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
