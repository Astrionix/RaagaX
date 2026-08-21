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

export function ExpandedPlayerModal() {
  const { playlists, addSongToPlaylist } = usePlaylistStore();
  const { saveForOffline } = useDownloadStore();
  const [palette, setPalette] = useState<ChameleonPalette | null>(null);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [viewMode, setViewMode] = useState<'art' | 'lyrics'>('art');
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
  } = usePlayerStore();

  // Gesture handling for swipe-down to minimize
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

  const cycleRepeatMode = () => {
    haptics.lightImpact();
    const mode = String(repeatMode).toUpperCase();
    if (mode === 'OFF') setRepeatMode('ALL' as any);
    else if (mode === 'ALL') setRepeatMode('ONE' as any);
    else setRepeatMode('OFF' as any);
  };

  const normRepeat = String(repeatMode).toUpperCase();

  if (!isPlayerExpanded || !currentSong) return null;

  return (
    <div
      className="fixed inset-0 z-[100] w-full h-[100dvh] bg-[#06070a] text-white select-none flex flex-col justify-between overflow-hidden animate-in fade-in duration-200"
      style={{ transform: `translateY(${touchOffset}px)` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── 1. DYNAMIC ARTWORK ATMOSPHERE (Blur + Dominant Meshes + Scrim) ── */}
      <div
        className="absolute inset-0 opacity-50 blur-[90px] scale-[1.35] pointer-events-none transition-all duration-700 ease-out"
        style={{
          backgroundImage: `url(${coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(75px) saturate(200%) brightness(0.65)',
        }}
      />

      {/* Dynamic Dominant Color Radial Meshes (Burgundy + Warm Brown + Warm Orange) */}
      {palette && (
        <>
          {/* Layer A: Dominant Primary (Deep Burgundy / Wine Glow at Top-Center) */}
          <div
            className="absolute -top-16 left-1/2 -translate-x-1/2 w-[130%] h-[420px] rounded-full blur-3xl pointer-events-none transition-all duration-700 opacity-75"
            style={{
              background: `radial-gradient(ellipse at 50% 25%, ${palette.primary} 0%, transparent 65%)`,
            }}
          />

          {/* Layer B: Secondary Warm Ambient (Dark Chocolate / Warm Brown Mid-Atmosphere) */}
          <div
            className="absolute top-24 -left-10 w-[80%] h-[380px] rounded-full blur-3xl pointer-events-none transition-all duration-700 opacity-55"
            style={{
              background: `radial-gradient(circle at 40% 45%, ${palette.secondary} 0%, transparent 70%)`,
            }}
          />

          {/* Layer C: Warm Orange / Amber Highlight Bloom (Directly Behind Artwork) */}
          <div
            className="absolute top-28 left-1/2 -translate-x-1/2 w-[340px] h-[340px] rounded-full blur-2xl pointer-events-none transition-all duration-700 opacity-40"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${palette.highlight} 0%, transparent 60%)`,
            }}
          />
        </>
      )}

      {/* Multi-stop vertical readability scrim fading smoothly into RaagaX black bottom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(6,7,10,0.15) 0%, rgba(6,7,10,0.38) 35%, rgba(6,7,10,0.72) 65%, rgba(6,7,10,0.94) 85%, #06070A 100%)',
        }}
      />

      {/* ── 2. TOP SWIPE HANDLE & MINIMIZE BAR ── */}
      <div className="relative z-20 flex items-center justify-between pt-2 px-6 w-full max-w-[428px] mx-auto flex-shrink-0">
        <button
          onClick={() => {
            haptics.lightImpact();
            togglePlayerExpanded();
          }}
          className="p-2 -ml-2 text-white/60 hover:text-white rounded-full transition-all active:scale-95 cursor-pointer"
          aria-label="Minimize Player"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* Minimal Centered Swipe Handle */}
        <div
          onClick={() => {
            haptics.lightImpact();
            togglePlayerExpanded();
          }}
          className="w-10 h-1 rounded-full bg-white/30 hover:bg-white/50 cursor-pointer active:scale-95 transition-all -ml-4"
          title="Swipe down to minimize"
        />

        <div className="w-6" />
      </div>

      {/* ── 3. MAIN CONTENT CONTAINER (24dp horizontal margins) ─────────────── */}
      <div className="relative z-10 flex-1 flex flex-col justify-between items-center w-full max-w-[428px] mx-auto px-6 py-1 min-h-0">
        {viewMode === 'art' ? (
          /* PROPORTIONAL ARTWORK (260-280px max, max 32vh height to avoid crowding controls) */
          <div className="w-full flex-shrink-0 flex items-center justify-center py-2 px-3">
            <div className="relative w-[68vw] max-w-[270px] max-h-[32vh] aspect-square rounded-[24px] overflow-hidden shadow-[0_16px_45px_rgba(0,0,0,0.85)] border border-white/15">
              <OptimizedImage
                src={coverUrl}
                alt={currentSong.title}
                size="full"
                className="w-full h-full object-cover"
              />
              {/* Specular Liquid Edge Reflection */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />
            </div>
          </div>
        ) : (
          /* LYRICS OVERLAY STAGE */
          <div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden py-2">
            <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-white/10">
              <div className="flex items-center gap-1.5 text-xs font-black text-white/90">
                <Mic2 className="w-4 h-4 text-[#F0444F]" /> Live Synced Lyrics
              </div>
              <button
                onClick={() => setViewMode('art')}
                className="text-xs font-bold text-white/80 hover:text-white px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
              >
                Show Artwork
              </button>
            </div>

            <div
              ref={modalLyricsScrollRef}
              className="flex-1 overflow-y-auto no-scrollbar py-10 px-2 space-y-4 flex flex-col items-start"
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
                      className={`w-full text-left transition-all duration-300 transform origin-left cursor-pointer py-1 ${
                        isActive
                          ? 'text-xl sm:text-2xl font-black text-[#F0444F] scale-[1.02]'
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

        {/* ── 4. PLAYBACK METADATA & ACTIONS SECTION ───────────────────────── */}
        <div className="w-full space-y-2 pt-1 pb-1">
          <div className="flex items-center justify-between gap-3">
            {/* Song Title (20-22sp Bold) & Artist (15-16sp #A8B2C2) */}
            <div className="min-w-0 flex-1">
              <h1 className="text-[20px] sm:text-[22px] font-black text-white tracking-tight leading-snug truncate" title={currentSong.title}>
                {currentSong.title}
              </h1>
              <p
                onClick={() => {
                  if (exactArtistId) {
                    navigateFromPlayer({ tab: 'artist', artistId: exactArtistId });
                  }
                }}
                className={`text-[15px] sm:text-[16px] font-semibold text-[#A8B2C2] hover:text-white transition-colors truncate mt-0.5 ${
                  exactArtistId ? 'cursor-pointer' : 'cursor-default'
                }`}
                title={currentSong.artist}
              >
                {currentSong.artist}
              </p>
            </div>

            {/* Actions: 44dp Like ♡ + 44dp More ⋯ */}
            <div className="flex items-center gap-2 flex-shrink-0 relative" ref={menuRef}>
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
                className="w-[42px] h-[42px] sm:w-[44px] sm:h-[44px] cursor-pointer"
                title={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
              >
                <Heart
                  className={`w-5 h-5 transition-colors ${
                    isLiked ? 'fill-[#F0444F] text-[#F0444F]' : 'text-slate-300'
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
                className="w-[42px] h-[42px] sm:w-[44px] sm:h-[44px] cursor-pointer text-slate-300"
                title="More Options"
              >
                <MoreHorizontal className="w-5 h-5" />
              </LiquidGlass>

              {/* More Options Popover Menu */}
              {isMenuOpen && (
                <div
                  className="absolute right-0 bottom-full mb-2 w-60 bg-[#14161E] border border-white/15 rounded-2xl p-1.5 shadow-2xl z-50 text-xs text-white divide-y divide-white/5 animate-in fade-in zoom-in-95 duration-150"
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

        {/* ── 5. PROGRESS BAR (4dp Track, 18dp Thumb, #F0444F Coral Accent) ── */}
        <div className="w-full space-y-1.5 pt-1.5">
          <SeekBar height="h-1" thumbSize="w-4.5 h-4.5" activeColor="bg-[#F0444F]" />
          <div className="flex items-center justify-between text-xs font-mono text-[#A8B2C2] font-semibold px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>-{formatTime(remainingTime)}</span>
          </div>
        </div>

        {/* ── 6. PLAYBACK CONTROLS HIERARCHY (46dp | 54dp | 72dp | 54dp | 46dp) ── */}
        <div className="flex items-center justify-between w-full pt-2 pb-1.5 px-0.5">
          {/* Shuffle Button (46dp) */}
          <LiquidGlass
            level={2}
            shape="circle"
            interactive
            onClick={toggleShuffle}
            refractionColor={shuffleMode !== 'OFF' ? 'rgba(240,68,79,0.15)' : undefined}
            className="w-[44px] h-[44px] sm:w-[46px] sm:h-[46px] cursor-pointer"
            title={`Shuffle: ${shuffleMode}`}
          >
            <Shuffle className={`w-5 h-5 ${shuffleMode !== 'OFF' ? 'text-[#F0444F]' : 'text-[#A8B2C2]'}`} />
          </LiquidGlass>

          {/* Previous Track (54dp) */}
          <LiquidGlass
            level={3}
            shape="circle"
            interactive
            onClick={() => { haptics.lightImpact(); playPrev(); }}
            className="w-[52px] h-[52px] sm:w-[54px] sm:h-[54px] cursor-pointer text-white"
            title="Previous Track"
          >
            <SkipBack className="w-6 h-6 fill-white text-white" />
          </LiquidGlass>

          {/* 3D Radiant High-Gloss White Glass Hero Play / Pause Button (72dp) */}
          <button
            onClick={() => { haptics.mediumImpact(); togglePlayPause(); }}
            className="relative w-[70px] h-[70px] sm:w-[72px] sm:h-[72px] rounded-full cursor-pointer flex-shrink-0 transition-transform active:scale-90 duration-150 flex items-center justify-center bg-gradient-to-b from-white via-[#F8F9FC] to-[#DDE2EE] border-2 border-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.65),0_0_24px_rgba(255,255,255,0.30),inset_0_2px_1px_#ffffff,inset_0_-2px_4px_rgba(0,0,0,0.12)]"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {/* Top specular reflection droplet */}
            <div className="absolute top-1 left-3 right-3 h-[36%] bg-gradient-to-b from-white/95 to-transparent rounded-full pointer-events-none" />

            {/* High-Contrast Bold Black Icon (100% visible on bright white 3D glass) */}
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-[#11131E] text-[#11131E]" strokeWidth={0} />
            ) : (
              <Play className="w-8 h-8 fill-[#11131E] text-[#11131E] ml-1" strokeWidth={0} />
            )}
          </button>

          {/* Next Track (54dp) */}
          <LiquidGlass
            level={3}
            shape="circle"
            interactive
            onClick={() => { haptics.lightImpact(); playNext(); }}
            className="w-[52px] h-[52px] sm:w-[54px] sm:h-[54px] cursor-pointer text-white"
            title="Next Track"
          >
            <SkipForward className="w-6 h-6 fill-white text-white" />
          </LiquidGlass>

          {/* Repeat Button (46dp) */}
          <LiquidGlass
            level={2}
            shape="circle"
            interactive
            onClick={cycleRepeatMode}
            refractionColor={(normRepeat === 'ALL' || normRepeat === 'ONE') ? 'rgba(240,68,79,0.15)' : undefined}
            className="w-[44px] h-[44px] sm:w-[46px] sm:h-[46px] cursor-pointer"
            title={`Repeat: ${normRepeat}`}
          >
            {normRepeat === 'ONE'
              ? <Repeat1 className={`w-5 h-5 ${normRepeat === 'ONE' ? 'text-[#F0444F]' : 'text-[#A8B2C2]'}`} />
              : <Repeat className={`w-5 h-5 ${normRepeat !== 'OFF' ? 'text-[#F0444F]' : 'text-[#A8B2C2]'}`} />
            }
          </LiquidGlass>
        </div>

        {/* ── 7. VOLUME SLIDER ─────────────────────────────────────────────── */}
        <div className="w-full flex items-center gap-3 px-1 py-1">
          <button onClick={toggleMute} className="flex-shrink-0 active:scale-90 transition-transform cursor-pointer" title="Mute">
            {isMuted || volume === 0 ? <VolumeX className="w-4.5 h-4.5 text-[#F0444F]" /> : <Volume2 className="w-4.5 h-4.5 text-[#A8B2C2]" />}
          </button>
          {/* Glass volume track */}
          <div className="relative flex-1 h-8 flex items-center">
            <div
              className="absolute left-0 right-0 h-1.5 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.10)',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), 0 0.5px 0 rgba(255,255,255,0.07)',
              }}
            />
            <div
              className="absolute left-0 h-1.5 rounded-full pointer-events-none"
              style={{
                width: `${(isMuted ? 0 : volume) * 100}%`,
                background: 'linear-gradient(90deg, #d93845 0%, #F0444F 100%)',
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
              title="Volume"
            />
          </div>
          <Volume2 className="w-4.5 h-4.5 text-[#A8B2C2] flex-shrink-0" />
        </div>
      </div>

      {/* ── 8. BOTTOM ACTIONS (LYRICS | DEVICE | QUEUE) — ~100 × 42dp ──────── */}
      <div className="relative z-20 w-full max-w-[428px] mx-auto px-6 pb-5 pt-1 flex items-center justify-between gap-3 flex-shrink-0">
        {/* Lyrics Glass Button */}
        <LiquidGlass
          level={2}
          shape="pill"
          interactive
          refractionColor={viewMode === 'lyrics' ? 'rgba(240,68,79,0.22)' : palette?.refractionRgba}
          glowColor={viewMode === 'lyrics' ? 'rgba(240,68,79,0.35)' : undefined}
          onClick={() => { haptics.lightImpact(); setViewMode(viewMode === 'lyrics' ? 'art' : 'lyrics'); }}
          className="flex-1 h-[42px] min-w-[96px] flex items-center justify-center gap-2 px-3 cursor-pointer"
          style={{ borderRadius: '20px' }}
        >
          <Mic2 className={`w-4 h-4 ${viewMode === 'lyrics' ? 'text-[#F0444F]' : 'text-[#A8B2C2]'}`} />
          <span className={`text-xs font-bold ${viewMode === 'lyrics' ? 'text-white' : 'text-[#A8B2C2]'}`}>Lyrics</span>
        </LiquidGlass>

        {/* Device Glass Button */}
        <LiquidGlass
          level={2}
          shape="pill"
          interactive
          refractionColor={palette?.refractionRgba}
          onClick={() => { haptics.lightImpact(); toggleDeviceModal(); }}
          className="flex-1 h-[42px] min-w-[96px] flex items-center justify-center gap-2 px-3 cursor-pointer"
          style={{ borderRadius: '20px' }}
        >
          <Cast className="w-4 h-4 text-[#A8B2C2]" />
          <span className="text-xs font-bold text-[#A8B2C2]">Device</span>
        </LiquidGlass>

        {/* Queue Glass Button */}
        <LiquidGlass
          level={2}
          shape="pill"
          interactive
          refractionColor={palette?.refractionRgba}
          onClick={() => {
            haptics.lightImpact();
            import('@/context/usePlayerStore').then(() => {
              usePlayerStore.setState({ isQueueOpen: !usePlayerStore.getState().isQueueOpen });
            });
          }}
          className="flex-1 h-[42px] min-w-[96px] flex items-center justify-center gap-2 px-3 cursor-pointer"
          style={{ borderRadius: '20px' }}
        >
          <ListMusic className="w-4 h-4 text-[#A8B2C2]" />
          <span className="text-xs font-bold text-[#A8B2C2]">Queue</span>
        </LiquidGlass>
      </div>
    </div>
  );
}
