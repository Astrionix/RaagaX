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
  Speaker,
  Volume2,
  VolumeX,
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
  Music,
  Clock,
  Calendar,
  Disc3,
  Plus,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { useLyricsStore } from '@/context/useLyricsStore';
import { SeekBar } from './SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { haptics } from '@/lib/haptics/HapticEngine';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';
import { LiquidGlass } from '@/components/common/LiquidGlass';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { AlbumCatalogEngine } from '@/lib/albumCatalog';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { VolumeControl } from '@/components/player/VolumeControl';
import { PlaybackService } from '@/lib/playback/PlaybackService';

export function ExpandedPlayerModal() {
  const { playlists, addSongToPlaylist } = usePlaylistStore();
  const { saveForOffline } = useDownloadStore();
  const [palette, setPalette] = useState<ChameleonPalette | null>(null);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [viewMode, setViewMode] = useState<'art' | 'lyrics' | 'queue' | 'timer'>('art');
  const [desktopView, setDesktopView] = useState<'info' | 'lyrics' | 'upnext'>('info');
  const [desktopTab, setDesktopTab] = useState<'lyrics' | 'upnext' | 'related'>('lyrics');
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
    currentSong: localCurrentSong,
    isPlaying: localIsPlaying,
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
    toggleQueue,
    toggleSleepTimerModal,
    setSleepTimer,
    cancelSleepTimer,
    sleepTimerMinutes,
    sleepTimerEndsAt,
    sleepTimerMode,
    toggleConnectModal,
  } = usePlayerStore();

  const currentSong = localCurrentSong;
  const isPlaying = localIsPlaying;

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

  const handleTogglePlay = () => {
    togglePlayPause();
  };

  const handlePlayNext = () => {
    playNext();
  };

  const handlePlayPrev = () => {
    playPrev();
  };

  const navigateFromPlayer = (nav: { tab: any; artistId?: string; albumId?: string; playlistId?: string }) => {
    togglePlayerExpanded(false);
    if (nav.artistId) setSelectedArtistId(nav.artistId);
    if (nav.albumId) setSelectedAlbumId(nav.albumId);
    if (nav.playlistId) setSelectedPlaylistId(nav.playlistId);
    setActiveTab(nav.tab);
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
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const [displaySec, setDisplaySec] = useState<number>(currentTime || 0);
  const lastGoodSecRef = useRef<number>(currentTime || 0);

  // Instantly reset displayed seconds when track changes
  useEffect(() => {
    const storeTime = usePlayerStore.getState().currentTime || 0;
    const initialPos = storeTime > 0 ? storeTime : 0;
    lastGoodSecRef.current = initialPos;
    setDisplaySec(initialPos);
    if (initialPos > 0 && storeTime === 0) {
      usePlayerStore.setState({ currentTime: initialPos });
    }
  }, [currentSong?.id]);

  useEffect(() => {
    let animFrame: number;
    let cancelled = false;
    let lastSecFloor = -1;

    const tick = () => {
      if (cancelled) return;
      let liveSec = lastGoodSecRef.current;
      let activeAudio: HTMLAudioElement | null = null;
      try {
        activeAudio = PlaybackService.getInstance().getActiveAudio();
      } catch {}

      if (activeAudio && !activeAudio.paused && !activeAudio.seeking && !isNaN(activeAudio.currentTime) && activeAudio.currentTime >= 0) {
        liveSec = activeAudio.currentTime;
        lastGoodSecRef.current = liveSec;
      } else {
        const store = usePlayerStore.getState();
        if (!store.isLocalPlayback && store.isPlaying && store.lastPositionTimestamp) {
          const elapsed = (performance.now() - store.lastPositionTimestamp) / 1000;
          liveSec = (store.currentTime || 0) + elapsed;
        } else {
          liveSec = store.currentTime || 0;
        }
        lastGoodSecRef.current = liveSec;
      }

      const secFloor = Math.floor(liveSec);
      if (secFloor !== lastSecFloor) {
        lastSecFloor = secFloor;
        setDisplaySec(liveSec);
      }
      if (!cancelled) {
        animFrame = requestAnimationFrame(tick);
      }
    };

    animFrame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrame);
    };
  }, [currentSong?.id]);

  const exactDuration = useMemo(() => {
    if (currentSong?.duration && currentSong.duration > 0) {
      return currentSong.duration;
    }
    try {
      const active = PlaybackService.getInstance().getActiveAudio();
      if (active && !isNaN(active.duration) && Number.isFinite(active.duration) && active.duration > 0) {
        return active.duration;
      }
    } catch {}
    if (Number.isFinite(duration) && duration > 0) {
      return duration;
    }
    return 0;
  }, [currentSong?.duration, duration]);

  const songDuration = exactDuration;
  const remainingTime = Math.max(0, songDuration - displaySec);

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

  const composer = (currentSong?.credits?.composer && currentSong.credits.composer !== 'Various Artists')
    ? currentSong.credits.composer
    : (currentSong?.artist || 'Various Artists');
  const rawLyricist = currentSong?.credits?.lyricist;
  const lyricist = (rawLyricist && rawLyricist !== 'RaagaX Catalog')
    ? rawLyricist
    : (currentSong?.artist || 'Various Artists');
  const label = currentSong?.credits?.label || 'Sony / Aditya Music';
  const releaseYear = currentSong?.releaseYear || (currentSong?.releaseDate ? parseInt(currentSong.releaseDate.slice(0, 4)) : 2026);

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
        // NOTE: Space (play/pause) is intentionally NOT handled here.
        // It is handled globally by useGlobalKeyboardShortcuts (registered once
        // at the app root in page.tsx). Handling it here too caused a
        // double-toggle: pause → immediately resume from one physical key press.
        case 'ArrowLeft':
          e.preventDefault();
          haptics.lightImpact();
          if (e.shiftKey) {
            const newTime = Math.max(0, currentTime - 5);
            usePlayerStore.getState().setCurrentTime(newTime, true);
            usePlayerStore.getState().setSeekTarget(newTime);
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
            usePlayerStore.getState().setSeekTarget(newTime);
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

        {/* Center: Context Info (Always raw album name) */}
        <div className="flex flex-col items-center justify-center text-center px-2 min-w-0">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/50 font-sans">
            Playing From
          </span>
          <span className="text-xs sm:text-sm font-semibold text-white/90 truncate max-w-[200px] sm:max-w-[340px]">
            {SongFormatter.decodeHtml(currentSong.album) || currentSong.album || 'Single'}
          </span>
        </div>

        {/* Right placeholder to balance header symmetry */}
        <div className="w-9 h-9 sm:w-10 sm:h-10 pointer-events-none" />
      </div>

      {/* ── 3. MAIN WORKSPACE (CENTRAL UNBOXED STAGE + OPTIONAL DESKTOP QUEUE) ─ */}
      <div className="relative z-20 flex-1 flex items-center justify-center w-full max-w-7xl mx-auto px-5 sm:px-10 py-1 min-h-0 overflow-hidden">

        {/* ── DESKTOP STAGE (MD+) ───────────────────────────────────────── */}
        {desktopView === 'info' ? (
          /* ── 1. DEFAULT DESKTOP VIEW (EXACT SIDE-BY-SIDE METADATA & FULL CONTROLS) ── */
          <div className="hidden md:flex flex-1 flex-col justify-between items-center h-full w-full max-w-5xl mx-auto transition-all duration-300 min-h-0 py-2 sm:py-3 gap-3">
            {/* Top 2-Column Row (Artwork on Left, Song Info & Structured Metadata & Actions on Right) */}
            <div className="flex-1 flex flex-row items-center justify-center gap-10 lg:gap-16 w-full my-auto min-h-0">

              {/* Left: Album Artwork (Pure raw cover, no surrounding dark frame or letterbox) */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  key={`desk-info-${songTransitionKey}`}
                  className="relative w-[340px] md:w-[380px] lg:w-[420px] xl:w-[450px] max-w-full max-h-[48vh] aspect-square rounded-[14px] overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.85)] flex-shrink-0 transition-transform duration-300 hover:scale-[1.01]"
                >
                  {coverUrl && coverUrl !== '/app-icon.png' ? (
                    <img
                      src={coverUrl}
                      alt={currentSong.title}
                      className="w-full h-full object-cover select-none rounded-[14px]"
                      loading="eager"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/30 gap-2 bg-white/[0.04] rounded-[14px]">
                      <Disc className="w-12 h-12 stroke-[1.2]" />
                      <span className="text-[11px] font-medium tracking-wide uppercase font-mono">Artwork Unavailable</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Info, Structured Metadata Table & Actions */}
              <div className="flex-1 flex flex-col justify-center min-w-0 max-w-[460px] lg:max-w-[500px]">
                {/* Song Title (Raw title only without category/search context) */}
                <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black text-white tracking-tight leading-tight line-clamp-2" title={currentSong.title}>
                  {SongFormatter.cleanSongTitle(currentSong.title)}
                </h1>

                {/* Artist */}
                <p
                  onClick={() => {
                    if (exactArtistId) {
                      navigateFromPlayer({ tab: 'artist', artistId: exactArtistId });
                    }
                  }}
                  className={`text-base lg:text-lg font-medium text-white/70 hover:text-white transition-colors truncate mt-1 ${exactArtistId ? 'cursor-pointer' : ''
                    }`}
                  title={currentSong.artist}
                >
                  {SongFormatter.decodeHtml(currentSong.artist) || currentSong.artist}
                </p>

                {/* Metadata Details Table (Muted labels on left, bright values on right) */}
                <div className="mt-5 space-y-2.5 text-xs lg:text-sm">
                  {/* Album */}
                  <div className="flex items-center">
                    <div className="flex items-center gap-2.5 w-28 lg:w-32 text-white/45 flex-shrink-0">
                      <Disc className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white/40" />
                      <span>Album</span>
                    </div>
                    <span className="text-white/90 font-medium truncate">
                      {SongFormatter.cleanAlbumTitle(currentSong.album, currentSong.title) || 'Single'}
                    </span>
                  </div>

                  {/* Artist */}
                  <div className="flex items-center">
                    <div className="flex items-center gap-2.5 w-28 lg:w-32 text-white/45 flex-shrink-0">
                      <User className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white/40" />
                      <span>Artist</span>
                    </div>
                    <span className="text-white/90 font-medium truncate">
                      {SongFormatter.decodeHtml(currentSong.artist) || currentSong.artist}
                    </span>
                  </div>

                  {/* Composer */}
                  {composer && composer !== 'Various Artists' && (
                    <div className="flex items-center">
                      <div className="flex items-center gap-2.5 w-28 lg:w-32 text-white/45 flex-shrink-0">
                        <Music className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white/40" />
                        <span>Composer</span>
                      </div>
                      <span className="text-white/90 font-medium truncate">{SongFormatter.decodeHtml(composer)}</span>
                    </div>
                  )}

                  {/* Lyricist */}
                  {lyricist && lyricist !== 'RaagaX Catalog' && (
                    <div className="flex items-center">
                      <div className="flex items-center gap-2.5 w-28 lg:w-32 text-white/45 flex-shrink-0">
                        <Mic2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white/40" />
                        <span>Lyricist</span>
                      </div>
                      <span className="text-white/90 font-medium truncate">{SongFormatter.decodeHtml(lyricist)}</span>
                    </div>
                  )}

                  {/* Duration */}
                  {songDuration > 0 && (
                    <div className="flex items-center">
                      <div className="flex items-center gap-2.5 w-28 lg:w-32 text-white/45 flex-shrink-0">
                        <Clock className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white/40" />
                        <span>Duration</span>
                      </div>
                      <span className="text-white/90 font-medium">{formatTime(songDuration)}</span>
                    </div>
                  )}

                  {/* Release Year */}
                  {releaseYear && releaseYear > 1950 && (
                    <div className="flex items-center">
                      <div className="flex items-center gap-2.5 w-28 lg:w-32 text-white/45 flex-shrink-0">
                        <Calendar className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white/40" />
                        <span>Release Year</span>
                      </div>
                      <span className="text-white/90 font-medium">{releaseYear}</span>
                    </div>
                  )}

                  {/* Label */}
                  {label && label !== 'Unknown' && (
                    <div className="flex items-center">
                      <div className="flex items-center gap-2.5 w-28 lg:w-32 text-white/45 flex-shrink-0">
                        <Disc3 className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white/40" />
                        <span>Label</span>
                      </div>
                      <span className="text-white/90 font-medium truncate">{label}</span>
                    </div>
                  )}
                </div>

                {/* Actions: Add to Queue, Like, More Options */}
                <div className="flex items-center gap-2.5 mt-5">
                  <button
                    onClick={() => {
                      addToQueue(currentSong);
                      setToastMessage(`Added "${currentSong.title}" to queue`);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/10 text-white font-semibold text-xs flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Queue</span>
                  </button>

                  <button
                    onClick={() => {
                      haptics.lightImpact();
                      toggleLikeSong(currentSong.id);
                      setToastMessage(isLiked ? 'Removed from Liked Songs' : 'Saved to Liked Songs');
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/10 text-white font-semibold text-xs flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-[#FA233B] text-[#FA233B]' : 'text-white/70'}`} />
                    <span>{isLiked ? 'Liked' : 'Like'}</span>
                  </button>

                  <SongActionMenu
                    song={currentSong}
                    triggerClassName="w-8 h-8 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/10 flex items-center justify-center transition-all text-white/70 hover:text-white hover:scale-105 active:scale-95 cursor-pointer"
                    iconClassName="w-3.5 h-3.5"
                    horizontal
                  />
                </div>
              </div>
            </div>

            {/* Bottom Controls Area */}
            <div className="w-full max-w-3xl flex flex-col items-center gap-3">
              {/* Seekbar */}
              <div className="w-full space-y-1.5">
                <SeekBar
                  height="h-1"
                  thumbSize="w-3.5 h-3.5"
                  accentGradient={palette ? `linear-gradient(90deg, ${palette.highlight} 0%, ${palette.accent} 100%)` : 'linear-gradient(90deg, #F0444F 0%, #FA233B 100%)'}
                  accentGlow={palette ? `0 0 8px ${palette.glow}` : undefined}
                />
                <div className="flex items-center justify-between text-xs font-mono text-white/50 font-medium px-0.5">
                  <span>{formatTime(displaySec)}</span>
                  <span>{songDuration > 0 ? `-${formatTime(remainingTime)}` : '--:--'}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="w-full flex items-center justify-center gap-6 sm:gap-8">
                <button
                  onClick={toggleShuffle}
                  className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 cursor-pointer ${shuffleMode !== 'OFF' ? 'text-[#F0444F]' : 'text-white/40 hover:text-white'
                    }`}
                  title={`Shuffle: ${shuffleMode} (S)`}
                >
                  <Shuffle className="w-5 h-5" />
                </button>

                <button
                  onClick={() => { haptics.lightImpact(); handlePlayPrev(); }}
                  className="w-12 h-12 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md"
                  title="Previous Track (←)"
                >
                  <SkipBack className="w-5 h-5 fill-white text-white" />
                </button>

                <button
                  onClick={() => { haptics.mediumImpact(); handleTogglePlay(); }}
                  className="relative w-16 h-16 rounded-full cursor-pointer flex-shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center bg-white text-black shadow-[0_12px_36px_rgba(0,0,0,0.6),0_0_24px_rgba(255,255,255,0.25)] border-2 border-white/90 group"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 fill-black text-black" strokeWidth={0} />
                  ) : (
                    <Play className="w-7 h-7 fill-black text-black ml-1" strokeWidth={0} />
                  )}
                </button>

                <button
                  onClick={() => { haptics.lightImpact(); handlePlayNext(); }}
                  className="w-12 h-12 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md"
                  title="Next Track (→)"
                >
                  <SkipForward className="w-5 h-5 fill-white text-white" />
                </button>

                <button
                  onClick={cycleRepeatMode}
                  className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 cursor-pointer ${normRepeat !== 'OFF' ? 'text-[#F0444F]' : 'text-white/40 hover:text-white'
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

              {/* Volume Slider (Desktop only) */}
              <VolumeControl className="hidden md:flex w-full max-w-md px-3" />

              {/* Bottom Utilities Pills [ Lyrics | Queue | Sleep Timer ] */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 pt-1 flex-wrap">

                {/* Lyrics Button */}
                <button
                  onClick={() => {
                    haptics.lightImpact();
                    setDesktopView('lyrics');
                    setDesktopTab('lyrics');
                  }}
                  className="px-3.5 sm:px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/10"
                  title="Synchronized Lyrics (L)"
                >
                  <Mic2 className="w-3.5 h-3.5" />
                  <span>Lyrics</span>
                </button>

                {/* Connect to Device Button */}
                <button
                  onClick={() => {
                    haptics.lightImpact();
                    toggleConnectModal(true);
                  }}
                  className="px-3.5 sm:px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/10"
                  title="Connect to Device"
                >
                  <Speaker className="w-3.5 h-3.5" />
                  <span>Devices</span>
                </button>

                {/* Queue Button */}
                <button
                  onClick={() => {
                    haptics.lightImpact();
                    setDesktopView('lyrics');
                    setDesktopTab('upnext');
                  }}
                  className="px-3.5 sm:px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/10"
                  title="Up Next Queue (Q)"
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span>Queue</span>
                  {upNextTracks.length > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-mono rounded-full bg-white/20 text-white">
                      {upNextTracks.length}
                    </span>
                  )}
                </button>

                {/* Sleep Timer Button */}
                <button
                  onClick={() => {
                    haptics.lightImpact();
                    toggleSleepTimerModal(true);
                  }}
                  className={`px-3.5 sm:px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${sleepTimerEndsAt || sleepTimerMode
                      ? 'bg-purple-500/25 text-purple-300 border-purple-400/40 shadow-sm'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/10'
                    }`}
                  title="Sleep Timer"
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Timer</span>
                  {(sleepTimerEndsAt || sleepTimerMode) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ── 2. TOGGLED LYRICS / QUEUE DESKTOP VIEW (LEFT PLAYER + RIGHT TABS) ── */
          <div className="hidden md:flex flex-1 flex-row items-center justify-center gap-10 lg:gap-16 w-full max-w-6xl mx-auto h-full min-h-0 py-2 animate-in fade-in duration-200">
            {/* Left: Player with Artwork, Seekbar & Controls */}
            <div className="w-[340px] lg:w-[400px] flex flex-col justify-between items-center h-full max-h-[82vh] py-1 flex-shrink-0 gap-3">
              {/* Artwork */}
              <div
                key={`desk-lyr-${songTransitionKey}`}
                className="relative w-full max-w-[320px] lg:max-w-[360px] aspect-square rounded-[14px] overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.85)] flex-shrink-0 transition-transform duration-300 hover:scale-[1.01]"
              >
                {coverUrl && coverUrl !== '/app-icon.png' ? (
                  <img
                    src={coverUrl}
                    alt={currentSong.title}
                    className="w-full h-full object-cover select-none rounded-[14px]"
                    loading="eager"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/30 gap-2 bg-white/[0.04] rounded-[14px]">
                    <Disc className="w-10 h-10 stroke-[1.2]" />
                    <span className="text-[10px] font-medium tracking-wide uppercase font-mono">Artwork Unavailable</span>
                  </div>
                )}
              </div>

              {/* Title & Artist Row */}
              <div className="w-full flex items-center justify-between gap-3 px-1 flex-shrink-0">
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl lg:text-2xl font-black text-white tracking-tight leading-tight truncate" title={currentSong.title}>
                    {currentSong.title}
                  </h1>
                  <p
                    onClick={() => exactArtistId && navigateFromPlayer({ tab: 'artist', artistId: exactArtistId })}
                    className={`text-sm lg:text-base font-medium text-white/70 hover:text-white transition-colors truncate mt-0.5 ${exactArtistId ? 'cursor-pointer' : ''
                      }`}
                    title={currentSong.artist}
                  >
                    {currentSong.artist}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 relative">
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
                      className={`w-5 h-5 transition-colors ${isLiked ? 'fill-[#F0444F] text-[#F0444F]' : 'text-white/70 hover:text-white'
                        }`}
                      strokeWidth={2}
                    />
                  </button>

                  <SongActionMenu
                    song={currentSong}
                    triggerClassName="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 flex items-center justify-center transition-all text-white/70 hover:text-white hover:scale-105 active:scale-95 cursor-pointer"
                    iconClassName="w-5 h-5"
                    horizontal
                  />
                </div>
              </div>

              {/* Seekbar */}
              <div className="w-full space-y-1 px-1 flex-shrink-0">
                <SeekBar
                  height="h-1"
                  thumbSize="w-3.5 h-3.5"
                  accentGradient={palette ? `linear-gradient(90deg, ${palette.highlight} 0%, ${palette.accent} 100%)` : 'linear-gradient(90deg, #F0444F 0%, #FA233B 100%)'}
                  accentGlow={palette ? `0 0 8px ${palette.glow}` : undefined}
                />
                <div className="flex items-center justify-between text-xs font-mono text-white/50 font-medium px-0.5">
                  <span>{formatTime(displaySec)}</span>
                  <span>{songDuration > 0 ? `-${formatTime(remainingTime)}` : '--:--'}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="w-full flex items-center justify-between px-2 flex-shrink-0">
                <button
                  onClick={toggleShuffle}
                  className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 cursor-pointer ${shuffleMode !== 'OFF' ? 'text-[#F0444F]' : 'text-white/40 hover:text-white'
                    }`}
                  title={`Shuffle: ${shuffleMode} (S)`}
                >
                  <Shuffle className="w-5 h-5" />
                </button>

                <button
                  onClick={() => { haptics.lightImpact(); handlePlayPrev(); }}
                  className="w-12 h-12 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md"
                  title="Previous Track (←)"
                >
                  <SkipBack className="w-5 h-5 fill-white text-white" />
                </button>

                <button
                  onClick={() => { haptics.mediumImpact(); handleTogglePlay(); }}
                  className="relative w-16 h-16 rounded-full cursor-pointer flex-shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center bg-white text-black shadow-[0_12px_36px_rgba(0,0,0,0.6),0_0_24px_rgba(255,255,255,0.25)] border-2 border-white/90 group"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 fill-black text-black" strokeWidth={0} />
                  ) : (
                    <Play className="w-7 h-7 fill-black text-black ml-1" strokeWidth={0} />
                  )}
                </button>

                <button
                  onClick={() => { haptics.lightImpact(); handlePlayNext(); }}
                  className="w-12 h-12 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md"
                  title="Next Track (→)"
                >
                  <SkipForward className="w-5 h-5 fill-white text-white" />
                </button>

                <button
                  onClick={cycleRepeatMode}
                  className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 cursor-pointer ${normRepeat !== 'OFF' ? 'text-[#F0444F]' : 'text-white/40 hover:text-white'
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

              {/* Volume */}
              <VolumeControl className="w-full px-2 flex-shrink-0" />

              {/* Mode Pills [ Lyrics | Queue | Sleep Timer ] */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 pt-1 flex-shrink-0">
                {/* Lyrics Button */}
                <button
                  onClick={() => {
                    haptics.lightImpact();
                    if (desktopTab === 'lyrics') {
                      setDesktopView('info');
                    } else {
                      setDesktopTab('lyrics');
                    }
                  }}
                  className={`px-3.5 sm:px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${desktopTab === 'lyrics'
                      ? 'bg-white/20 text-white border-white/30 shadow-sm'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/10'
                    }`}
                  title="Lyrics (L)"
                >
                  <Mic2 className="w-3.5 h-3.5" />
                  <span>Lyrics</span>
                </button>

                {/* Queue Button */}
                <button
                  onClick={() => {
                    haptics.lightImpact();
                    if (desktopTab === 'upnext') {
                      setDesktopView('info');
                    } else {
                      setDesktopTab('upnext');
                    }
                  }}
                  className={`px-3.5 sm:px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${desktopTab === 'upnext'
                      ? 'bg-white/20 text-white border-white/30 shadow-sm'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/10'
                    }`}
                  title="Up Next Queue (Q)"
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span>Queue</span>
                  {upNextTracks.length > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-mono rounded-full bg-white/20 text-white">
                      {upNextTracks.length}
                    </span>
                  )}
                </button>

                {/* Sleep Timer Button */}
                <button
                  onClick={() => {
                    haptics.lightImpact();
                    toggleSleepTimerModal(true);
                  }}
                  className={`px-3.5 sm:px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${sleepTimerEndsAt || sleepTimerMode
                      ? 'bg-purple-500/25 text-purple-300 border-purple-400/40 shadow-sm'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/10'
                    }`}
                  title="Sleep Timer"
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Timer</span>
                  {(sleepTimerEndsAt || sleepTimerMode) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                  )}
                </button>
              </div>
            </div>

            {/* Right: Tabs Pane (UP NEXT | LYRICS | RELATED) */}
            <div className="flex-1 flex flex-col h-full max-h-[82vh] min-w-0 max-w-[540px] pl-4">
              {/* Header */}
              <div className="flex items-center gap-8 border-b border-white/10 pb-3 flex-shrink-0">
                <button
                  onClick={() => { haptics.lightImpact(); setDesktopTab('upnext'); }}
                  className={`text-xs font-bold uppercase tracking-wider relative pb-1 transition-all cursor-pointer ${desktopTab === 'upnext' ? 'text-white' : 'text-white/40 hover:text-white/80'
                    }`}
                >
                  UP NEXT
                  {desktopTab === 'upnext' && (
                    <span className="absolute left-0 right-0 -bottom-[13px] h-[2px] bg-[#F0444F] rounded-full" />
                  )}
                </button>

                <button
                  onClick={() => { haptics.lightImpact(); setDesktopTab('lyrics'); }}
                  className={`text-xs font-bold uppercase tracking-wider relative pb-1 transition-all cursor-pointer ${desktopTab === 'lyrics' ? 'text-white' : 'text-white/40 hover:text-white/80'
                    }`}
                >
                  LYRICS
                  {desktopTab === 'lyrics' && (
                    <span className="absolute left-0 right-0 -bottom-[13px] h-[2px] bg-[#F0444F] rounded-full" />
                  )}
                </button>

                <button
                  onClick={() => { haptics.lightImpact(); setDesktopTab('related'); }}
                  className={`text-xs font-bold uppercase tracking-wider relative pb-1 transition-all cursor-pointer ${desktopTab === 'related' ? 'text-white' : 'text-white/40 hover:text-white/80'
                    }`}
                >
                  RELATED
                  {desktopTab === 'related' && (
                    <span className="absolute left-0 right-0 -bottom-[13px] h-[2px] bg-[#F0444F] rounded-full" />
                  )}
                </button>

                {desktopTab === 'lyrics' && hasTransliteration && (
                  <button
                    onClick={() => {
                      haptics.lightImpact();
                      setScriptMode(scriptMode === 'transliteration' ? 'native' : 'transliteration');
                    }}
                    className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
                  >
                    {scriptMode === 'transliteration' ? 'Original Script' : 'English Transliteration'}
                  </button>
                )}

                <button
                  onClick={() => setDesktopView('info')}
                  className={`p-1 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer ${desktopTab !== 'lyrics' || !hasTransliteration ? 'ml-auto' : 'ml-2'
                    }`}
                  title="Close and return to song info"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto no-scrollbar py-6 min-h-0">
                {/* 1. Lyrics */}
                {desktopTab === 'lyrics' && (
                  <div ref={modalLyricsScrollRef} className="space-y-4 pr-4">
                    <div className="text-3xl font-serif text-[#F0444F] font-bold select-none mb-2">
                      “
                    </div>

                    {lyricsStatus === 'loading' && (
                      <div className="py-16 flex flex-col items-center justify-center text-white/50 gap-3">
                        <Loader2 className="w-6 h-6 text-[#F0444F] animate-spin" />
                        <p className="text-xs font-medium">Syncing lyrics...</p>
                      </div>
                    )}

                    {lyricsStatus === 'unavailable' || lyricsLines.length === 0 ? (
                      <div className="py-16 text-center text-white/50 space-y-2">
                        <p className="text-base font-bold text-white">Lyrics unavailable</p>
                        <p className="text-xs text-white/40">No synchronized lyrics found for this track.</p>
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
                                usePlayerStore.getState().setSeekTarget(sec);
                              }
                            }}
                            className={`cursor-pointer transition-all duration-300 transform origin-left leading-relaxed ${isActive
                                ? 'text-xl lg:text-2xl font-black text-white scale-[1.02]'
                                : isPassed
                                  ? 'text-sm lg:text-base font-medium text-white/30 hover:text-white/60'
                                  : 'text-sm lg:text-base font-medium text-white/50 hover:text-white'
                              }`}
                          >
                            {mainContent}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 2. Up Next Queue */}
                {desktopTab === 'upnext' && (
                  <div className="space-y-3 pr-2">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <span className="text-xs font-bold text-white/60">{upNextTracks.length} tracks in queue</span>
                      {upNextTracks.length > 0 && (
                        <button
                          onClick={() => {
                            clearQueue();
                            setToastMessage('Queue cleared');
                          }}
                          className="text-xs text-red-400 hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    {upNextTracks.length === 0 ? (
                      <div className="py-16 text-center text-white/40 text-xs">
                        Queue is empty. Search and add songs to up next.
                      </div>
                    ) : (
                      upNextTracks.map((song, index) => (
                        <div
                          key={`${song.id}-${index}`}
                          onClick={() => playSong(song)}
                          className="group flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.08] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-5 text-xs font-mono text-white/30 text-center">{index + 1}</span>
                            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                              <OptimizedImage
                                src={song.coverUrl}
                                alt={song.title}
                                size="thumb"
                                className="w-full h-full"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate group-hover:text-[#F0444F] transition-colors">
                                {song.title}
                              </p>
                              <p className="text-xs text-white/50 truncate">{song.artist}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-white/40">{formatTime(song.duration)}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromQueue(song.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-red-400 transition-all cursor-pointer"
                              title="Remove from queue"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. Related */}
                {desktopTab === 'related' && (
                  <div className="space-y-4 pr-2">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Song Information</h3>

                    <div className="space-y-3 text-xs lg:text-sm">
                      <div className="flex items-center">
                        <div className="flex items-center gap-2.5 w-32 text-white/50 flex-shrink-0">
                          <Disc className="w-4 h-4 text-white/40" />
                          <span>Album</span>
                        </div>
                        <span className="text-white/90 font-medium truncate">{currentSong.album || 'Single'}</span>
                      </div>

                      <div className="flex items-center">
                        <div className="flex items-center gap-2.5 w-32 text-white/50 flex-shrink-0">
                          <User className="w-4 h-4 text-white/40" />
                          <span>Artist</span>
                        </div>
                        <span className="text-white/90 font-medium truncate">{currentSong.artist}</span>
                      </div>

                      <div className="flex items-center">
                        <div className="flex items-center gap-2.5 w-32 text-white/50 flex-shrink-0">
                          <Music className="w-4 h-4 text-white/40" />
                          <span>Composer</span>
                        </div>
                        <span className="text-white/90 font-medium truncate">{composer}</span>
                      </div>

                      <div className="flex items-center">
                        <div className="flex items-center gap-2.5 w-32 text-white/50 flex-shrink-0">
                          <Mic2 className="w-4 h-4 text-white/40" />
                          <span>Lyricist</span>
                        </div>
                        <span className="text-white/90 font-medium truncate">{lyricist}</span>
                      </div>

                      <div className="flex items-center">
                        <div className="flex items-center gap-2.5 w-32 text-white/50 flex-shrink-0">
                          <Clock className="w-4 h-4 text-white/40" />
                          <span>Duration</span>
                        </div>
                        <span className="text-white/90 font-medium">{formatTime(songDuration)}</span>
                      </div>

                      <div className="flex items-center">
                        <div className="flex items-center gap-2.5 w-32 text-white/50 flex-shrink-0">
                          <Calendar className="w-4 h-4 text-white/40" />
                          <span>Release Year</span>
                        </div>
                        <span className="text-white/90 font-medium">{releaseYear}</span>
                      </div>

                      <div className="flex items-center">
                        <div className="flex items-center gap-2.5 w-32 text-white/50 flex-shrink-0">
                          <Disc3 className="w-4 h-4 text-white/40" />
                          <span>Label</span>
                        </div>
                        <span className="text-white/90 font-medium truncate">{label}</span>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={() => {
                          addToQueue(currentSong);
                          setToastMessage(`Added "${currentSong.title}" to queue`);
                        }}
                        className="px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white font-medium text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add to Queue</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── MOBILE STAGE (VERTICAL UNBOXED VIEW ON MOBILE < MD) ─────────── */}
        <div className={`flex md:hidden flex-1 flex-col justify-between items-center h-full w-full transition-all duration-300 min-h-0 py-1 sm:py-2 gap-2 sm:gap-4 max-w-[390px] sm:max-w-[440px]`}>

          {/* A. HERO ARTWORK / SYNCHRONIZED LYRICS / QUEUE / SLEEP TIMER */}
          {viewMode === 'art' ? (
            /* Large Unboxed Hero Artwork with Deep Cinematic Shadow */
            <div className="w-full flex-1 flex items-center justify-center py-0.5 sm:py-1 min-h-0 overflow-hidden">
              <div
                key={`mob-${songTransitionKey}`}
                className="relative w-full max-w-[min(340px,78vw)] max-h-[min(340px,44vh)] aspect-square rounded-[14px] overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.85)] flex-shrink-0 transition-transform duration-300 hover:scale-[1.01]"
              >
                {coverUrl && coverUrl !== '/app-icon.png' ? (
                  <img
                    src={coverUrl}
                    alt={currentSong.title}
                    className="w-full h-full object-cover select-none rounded-[14px]"
                    loading="eager"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/30 gap-2 bg-white/[0.04] rounded-[14px]">
                    <Disc className="w-10 h-10 stroke-[1.2]" />
                    <span className="text-[10px] font-medium tracking-wide uppercase font-mono">Artwork Unavailable</span>
                  </div>
                )}
              </div>
            </div>
          ) : viewMode === 'lyrics' ? (
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
                            usePlayerStore.getState().setSeekTarget(sec);
                          }
                        }}
                        className={`w-full text-left transition-all duration-300 transform origin-left cursor-pointer py-1.5 ${isActive
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
          ) : viewMode === 'queue' ? (
            /* UP NEXT QUEUE STAGE (MOBILE) */
            <div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden py-1">
              <div className="flex items-center justify-between px-3 pb-2 mb-1 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <ListMusic className="w-4 h-4 text-[#F0444F]" />
                  <span>Up Next ({upNextTracks.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  {upNextTracks.length > 0 && (
                    <button
                      onClick={() => {
                        haptics.lightImpact();
                        clearQueue();
                        setToastMessage('Queue cleared');
                      }}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 px-2 py-0.5 rounded transition-all cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    onClick={() => setViewMode('art')}
                    className="text-xs font-semibold text-white/80 hover:text-white px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                  >
                    Show Artwork
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar py-2 px-2 space-y-2">
                {/* Currently playing card */}
                <div className="p-2.5 rounded-xl bg-white/[0.08] border border-white/15 flex items-center gap-3">
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 shadow">
                    <OptimizedImage
                      src={coverUrl}
                      alt={currentSong.title}
                      size="thumb"
                      className="w-full h-full object-cover"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="flex items-end gap-0.5 h-3.5">
                          <span className="w-0.5 h-full bg-[#F0444F] animate-pulse" />
                          <span className="w-0.5 h-2/3 bg-[#F0444F] animate-pulse delay-75" />
                          <span className="w-0.5 h-4/5 bg-[#F0444F] animate-pulse delay-150" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-[#F0444F]">Now Playing</span>
                    <h4 className="text-xs font-bold text-white truncate">{currentSong.title}</h4>
                    <p className="text-[11px] text-white/60 truncate">{currentSong.artist}</p>
                  </div>
                </div>

                {/* Queue track items */}
                {upNextTracks.length === 0 ? (
                  <div className="py-12 text-center text-white/40 text-xs">
                    Queue is empty. Select more songs to queue.
                  </div>
                ) : (
                  upNextTracks.map((song, idx) => (
                    <div
                      key={`${song.id}-${idx}`}
                      onClick={() => {
                        haptics.lightImpact();
                        playSong(song);
                      }}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.08] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="w-4 text-[11px] font-mono text-white/30 text-center flex-shrink-0">{idx + 1}</span>
                        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
                          <OptimizedImage
                            src={song.coverUrl}
                            alt={song.title}
                            size="thumb"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate group-hover:text-[#F0444F] transition-colors">
                            {song.title}
                          </p>
                          <p className="text-[11px] text-white/50 truncate">{song.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] font-mono text-white/40">{formatTime(song.duration)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            haptics.lightImpact();
                            removeFromQueue(song.id);
                          }}
                          className="p-1 text-white/40 hover:text-red-400 transition-colors cursor-pointer"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* SLEEP TIMER STAGE (MOBILE) */
            <div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden py-1">
              <div className="flex items-center justify-between px-3 pb-2 mb-1 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Moon className="w-4 h-4 text-purple-400" /> Sleep Timer
                </div>
                <button
                  onClick={() => setViewMode('art')}
                  className="text-xs font-semibold text-white/80 hover:text-white px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                >
                  Show Artwork
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar py-3 px-3 space-y-4 flex flex-col items-center justify-center">
                {/* Active Timer Countdown Banner */}
                {(sleepTimerEndsAt || sleepTimerMode) ? (
                  <div className="w-full p-4 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 text-purple-400">
                      <Clock className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-wider">Timer Running</span>
                    </div>
                    <p className="text-sm font-bold text-white">
                      {sleepTimerMode === 'end_of_song'
                        ? 'Stopping at the end of current track'
                        : sleepTimerMode === 'end_of_queue'
                          ? 'Stopping when queue finishes'
                          : sleepTimerEndsAt
                            ? `Stopping in ~${Math.max(1, Math.round((sleepTimerEndsAt - Date.now()) / 60000))} minutes`
                            : 'Active'}
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        onClick={() => {
                          haptics.lightImpact();
                          cancelSleepTimer();
                          setToastMessage('Sleep timer turned off');
                        }}
                        className="px-4 py-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-semibold transition-all cursor-pointer"
                      >
                        Cancel Timer
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-white/50 text-center">
                    Select when you want music playback to automatically stop.
                  </p>
                )}

                {/* Preset Options Grid */}
                <div className="w-full grid grid-cols-2 gap-2.5">
                  {[
                    { label: '15 Minutes', mins: 15, mode: 'duration' as const },
                    { label: '30 Minutes', mins: 30, mode: 'duration' as const },
                    { label: '45 Minutes', mins: 45, mode: 'duration' as const },
                    { label: '60 Minutes', mins: 60, mode: 'duration' as const },
                    { label: 'End of Track', mins: -1, mode: 'end_of_song' as const },
                    { label: 'End of Queue', mins: -1, mode: 'end_of_queue' as const },
                  ].map((preset, idx) => {
                    const isSelected =
                      preset.mode === 'duration'
                        ? sleepTimerMinutes === preset.mins && (sleepTimerEndsAt || 0) > Date.now()
                        : sleepTimerMode === preset.mode;

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          haptics.lightImpact();
                          setSleepTimer(preset.mins, preset.mode);
                          setToastMessage(`Sleep timer set to ${preset.label}`);
                          setViewMode('art');
                        }}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center cursor-pointer ${isSelected
                            ? 'bg-purple-500/25 border-purple-400 text-white shadow-lg'
                            : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-white/80 hover:text-white'
                          }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
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
                  className={`text-sm sm:text-base font-medium text-white/70 hover:text-white transition-colors truncate mt-0.5 ${exactArtistId ? 'cursor-pointer' : 'cursor-default'
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
                    className={`w-5 h-5 transition-colors ${isLiked ? 'fill-[#F0444F] text-[#F0444F]' : 'text-white/70 hover:text-white'
                      }`}
                    strokeWidth={2}
                  />
                </button>

                <SongActionMenu
                  song={currentSong}
                  triggerClassName="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 flex items-center justify-center transition-all text-white/70 hover:text-white active:scale-95 cursor-pointer"
                  iconClassName="w-5 h-5"
                  horizontal
                />
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
              <span>{formatTime(displaySec)}</span>
              <span>{songDuration > 0 ? `-${formatTime(remainingTime)}` : '--:--'}</span>
            </div>
          </div>

          {/* D. UNBOXED MAIN PLAYBACK CONTROLS (Apple-Style Hierarchy) */}
          <div className="w-full flex items-center justify-between px-2 sm:px-4 flex-shrink-0">
            {/* Shuffle */}
            <button
              onClick={toggleShuffle}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 cursor-pointer ${shuffleMode !== 'OFF' ? 'text-[#F0444F]' : 'text-white/40 hover:text-white'
                }`}
              title={`Shuffle: ${shuffleMode} (S)`}
            >
              <Shuffle className="w-5 h-5" />
            </button>

            {/* Previous Track */}
            <button
              onClick={() => { haptics.lightImpact(); handlePlayPrev(); }}
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md"
              title="Previous Track (←)"
            >
              <SkipBack className="w-6 h-6 fill-white text-white" />
            </button>

            {/* HERO PLAY / PAUSE BUTTON (Circular, Bright Frosted 3D Surface with Subtle Depth) */}
            <button
              onClick={() => { haptics.mediumImpact(); handleTogglePlay(); }}
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
              onClick={() => { haptics.lightImpact(); handlePlayNext(); }}
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md"
              title="Next Track (→)"
            >
              <SkipForward className="w-6 h-6 fill-white text-white" />
            </button>

            {/* Repeat */}
            <button
              onClick={cycleRepeatMode}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 cursor-pointer ${normRepeat !== 'OFF' ? 'text-[#F0444F]' : 'text-white/40 hover:text-white'
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
          <VolumeControl className="w-full px-3 flex-shrink-0" />

          {/* F. BOTTOM UTILITIES ROW [ Lyrics | Queue | Sleep Timer ] (Unboxed Minimal Pills) */}
          <div className="w-full flex items-center justify-center gap-2 sm:gap-3 pt-1 pb-1 sm:pb-2 px-2 flex-shrink-0">
            {/* Lyrics Button */}
            <button
              onClick={() => {
                haptics.lightImpact();
                setViewMode(viewMode === 'lyrics' ? 'art' : 'lyrics');
              }}
              className={`px-3.5 sm:px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'lyrics'
                  ? 'bg-white/20 text-white border-white/30 shadow-sm'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/10'
                }`}
              title="Synchronized Lyrics (L)"
            >
              <Mic2 className="w-3.5 h-3.5" />
              <span>Lyrics</span>
            </button>

            {/* Queue Button */}
            <button
              onClick={() => {
                haptics.lightImpact();
                setViewMode(viewMode === 'queue' ? 'art' : 'queue');
              }}
              className={`px-3.5 sm:px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'queue'
                  ? 'bg-white/20 text-white border-white/30 shadow-sm'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/10'
                }`}
              title="Up Next Queue (Q)"
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Queue</span>
              {upNextTracks.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-mono rounded-full bg-white/20 text-white">
                  {upNextTracks.length}
                </span>
              )}
            </button>



            {/* Sleep Timer Button (Mobile) */}
            <button
              onClick={() => {
                haptics.lightImpact();
                toggleSleepTimerModal(true);
              }}
              className={`px-3 sm:px-3.5 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${sleepTimerEndsAt || sleepTimerMode
                  ? 'bg-purple-500/25 text-purple-300 border-purple-400/40 shadow-sm'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/10'
                }`}
              title="Sleep Timer"
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Timer</span>
              {(sleepTimerEndsAt || sleepTimerMode) && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
              )}
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
