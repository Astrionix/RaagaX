'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Sparkles,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  MessageSquare,
  Mic2,
  ListMusic,
  Disc3,
  Maximize2,
  MonitorSpeaker,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SeekBar } from '@/components/player/SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';

export function PlayerBar() {
  const [mounted, setMounted] = useState(false);
  const [palette, setPalette] = useState<ChameleonPalette | null>(null);

  const {
    currentSong,
    isPlaying,
    volume,
    isMuted,
    shuffleMode,
    repeatMode,
    togglePlayPause,
    playNext,
    playPrev,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    toggleLyrics,
    toggleQueue,
    isQueueOpen,
    setQueueOpen,
    rightPanelMode,
    setRightPanelMode,
    isLyricsOpen,
    isPlayerExpanded,
    togglePlayerExpanded,
    toggleCastModal,
    isCastModalOpen,
    isLocalPlayback,
    activePlaybackDeviceName,
  } = usePlayerStore();

  useEffect(() => {
    setMounted(true);
    import('@/lib/playback/PlaybackService').then(({ PlaybackService }) => {
      PlaybackService.getInstance().syncLivePlayingState();
    }).catch(() => {});
  }, []);

  // Dynamic Tab Title Synchronization (Spotify / Apple Music standard)
  useEffect(() => {
    import('@/lib/sync/TabSyncCoordinator').then(({ TabSyncCoordinator }) => {
      TabSyncCoordinator.getInstance().updateDocumentTitle(currentSong, isPlaying);
    }).catch(() => {});
  }, [currentSong?.id, isPlaying]);

  const handleToggleQueue = () => {
    if (isQueueOpen && rightPanelMode === 'queue') {
      setQueueOpen(false);
    } else {
      setRightPanelMode('queue');
      setQueueOpen(true);
    }
  };

  const handleToggleConnect = () => {
    if (isQueueOpen && (rightPanelMode === 'connect' || rightPanelMode === 'jam')) {
      setQueueOpen(false);
    } else {
      setRightPanelMode('connect');
      setQueueOpen(true);
    }
  };

  const activeSong = currentSong;
  const isPlayingActive = isPlaying;

  const handleTogglePlayPause = () => {
    togglePlayPause();
  };

  const handlePlayNext = () => {
    playNext();
  };

  const handlePlayPrev = () => {
    playPrev();
  };

  // Extract subtle dominant ambient glow from artwork
  useEffect(() => {
    let isSubscribed = true;
    if (activeSong?.coverUrl && !activeSong.coverUrl.includes('/null/')) {
      ArtworkColorExtractor.getInstance()
        .extractPalette(activeSong.coverUrl)
        .then((p) => {
          if (isSubscribed) setPalette(p);
        })
        .catch(() => {});
    } else {
      setPalette(null);
    }
    return () => {
      isSubscribed = false;
    };
  }, [activeSong?.coverUrl]);



  if (!mounted || isPlayerExpanded) return null;

  const themeColor = palette?.primary || '#FA233B';
  const glowColor = palette?.glow || 'rgba(250, 35, 59, 0.2)';

  const repeatState = (() => {
    const r = ((repeatMode || 'OFF') as string).toUpperCase();
    return r === 'ONE' || r === 'TRACK' ? 'ONE' : r === 'ALL' || r === 'CONTEXT' ? 'ALL' : 'OFF';
  })();

  const cleanTitle = activeSong ? SongFormatter.cleanSongTitle(activeSong.title) : 'Select a track to play';
  const cleanArtist = activeSong ? (SongFormatter.decodeHtml(activeSong.artist) || activeSong.artist || 'Unknown Artist') : '';
  const cleanAlbum = activeSong?.album ? SongFormatter.cleanAlbumTitle(activeSong.album) : '';
  const subtitle = cleanArtist && cleanAlbum ? `${cleanArtist} — ${cleanAlbum}` : (cleanArtist || cleanAlbum);

  return (
    <>
      <aside
        aria-label="Floating Media Player"
        className={`hidden md:flex fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] z-40 group/player select-none items-center justify-between px-4 py-2 backdrop-blur-3xl backdrop-saturate-[180%] rounded-full transition-all duration-300 w-[94vw] max-w-[820px] lg:max-w-[880px] h-[64px] gap-3 -translate-x-1/2
          bg-neutral-950/65 hover:bg-neutral-950/75
          border border-white/[0.12] hover:border-white/[0.2]
          shadow-[0_20px_50px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.18)]
          ${isQueueOpen ? 'left-[calc(50%+8rem)] xl:left-[calc(50%+8rem-180px)]' : 'left-[calc(50%+8rem)]'}
        `}
      >
        {/* ── 0. AMBIENT BLURRED ARTWORK GLOW ── */}
        {activeSong?.coverUrl && (
          <>
            {/* External diffuse ambient halo behind pill */}
            <div
              className="absolute -inset-2 -z-20 rounded-full opacity-35 blur-2xl transition-all duration-700 pointer-events-none"
              style={{
                background: palette?.primary
                  ? `radial-gradient(ellipse at center, ${palette.primary}45 0%, transparent 72%)`
                  : 'radial-gradient(ellipse at center, rgba(255,255,255,0.15) 0%, transparent 72%)',
              }}
            />
            {/* Internal blurred artwork texture inside glass */}
            <div className="absolute inset-0 -z-10 overflow-hidden rounded-full pointer-events-none opacity-20 blur-2xl scale-125 transform-gpu transition-all duration-700">
              <img
                src={activeSong.coverUrl}
                alt=""
                className="w-full h-full object-cover filter saturate-150"
              />
            </div>
          </>
        )}

        {/* Specular glass highlight reflection sheen */}
        <div className="absolute inset-0 rounded-full pointer-events-none bg-gradient-to-b from-white/[0.08] via-transparent to-black/25" />

        {/* ── 1. LEFT: Track Info & Artwork ── */}
        <div className="flex items-center gap-3 min-w-0 w-[230px] lg:w-[260px] flex-shrink-0 z-10">
          {activeSong ? (
            <>
              <div
                onClick={togglePlayerExpanded}
                className="relative w-10 h-10 rounded-xl overflow-hidden shadow-md border border-white/15 cursor-pointer group/art flex-shrink-0 bg-neutral-900 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                title="Expand Player (F)"
              >
                <OptimizedImage
                  src={activeSong.coverUrl}
                  alt={activeSong.title}
                  size="thumb"
                  imageFit="cover"
                  className="w-full h-full object-cover group-hover/art:scale-110 transition-transform duration-300"
                  fallbackSrc="/app-icon.png"
                />
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover/art:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                  <Maximize2 className="w-3.5 h-3.5 text-white" />
                </div>
              </div>

              <div className="min-w-0 flex-1 overflow-hidden text-left">
                <h4
                  onClick={togglePlayerExpanded}
                  className="text-[13px] font-semibold text-white truncate hover:underline cursor-pointer transition-colors leading-tight tracking-tight"
                  title={cleanTitle}
                >
                  {cleanTitle}
                </h4>
                <p
                  className="text-[11px] text-[#D0D0D0] truncate leading-tight mt-0.5 font-medium"
                  title={subtitle}
                >
                  <span>{subtitle}</span>
                </p>
                {!isLocalPlayback && (
                  <button
                    onClick={toggleCastModal}
                    className="flex items-center gap-1 text-[10px] font-semibold text-[#1DB954] hover:underline cursor-pointer mt-0.5"
                    title={`Playing on ${activePlaybackDeviceName}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-pulse" />
                    <span className="truncate">{activePlaybackDeviceName}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 text-[#D0D0D0] hover:text-white transition-colors">
                <DownloadStatusIndicator song={activeSong} size="sm" showCloudIcon />
                <SongActionMenu song={activeSong} />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-[#A8A8A8] text-xs font-medium truncate">
              <Disc3 className="w-4 h-4 text-white animate-spin flex-shrink-0" style={{ animationDuration: '8s' }} />
              <span className="truncate">Select a track to play</span>
            </div>
          )}
        </div>

        {/* ── 2. CENTER: Centered Branding & Minimal Monochrome Controls ── */}
        <div className="flex flex-col items-center justify-center flex-1 min-w-0 px-2 z-10">
          {/* Centered Branding Pill */}
          <div className="flex items-center gap-1.5 mb-1 opacity-75 hover:opacity-100 transition-opacity">
            <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
            <span className="text-[9px] font-black tracking-[0.25em] text-[#D0D0D0] uppercase">
              RAAGAX
            </span>
          </div>

          {/* Minimal Monochrome Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Shuffle */}
            <button
              onClick={toggleShuffle}
              aria-label="Shuffle"
              title={`Shuffle: ${shuffleMode}`}
              className={`p-1.5 rounded-full transition-all cursor-pointer relative ${
                shuffleMode !== 'OFF'
                  ? 'text-white bg-white/15'
                  : 'text-[#A8A8A8] hover:text-white hover:bg-white/10'
              }`}
            >
              {shuffleMode === 'SMART' ? (
                <div className="relative">
                  <Shuffle className="w-3.5 h-3.5" />
                  <Sparkles className="w-2 h-2 absolute -top-1 -right-1 text-white" />
                </div>
              ) : (
                <Shuffle className="w-3.5 h-3.5" />
              )}
              {shuffleMode !== 'OFF' && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
              )}
            </button>

            {/* Previous */}
            <button
              onClick={handlePlayPrev}
              aria-label="Previous track"
              title="Previous (K)"
              className="p-1.5 text-[#D0D0D0] hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 cursor-pointer"
            >
              <SkipBack className="w-4 h-4 fill-current stroke-none" />
            </button>

            {/* Play / Pause - Minimal Monochrome Solid White Circle */}
            <button
              onClick={handleTogglePlayPause}
              aria-label={isPlayingActive ? 'Pause' : 'Play'}
              title={isPlayingActive ? 'Pause (Space)' : 'Play (Space)'}
              className="w-8 h-8 rounded-full bg-white text-black hover:bg-neutral-100 flex items-center justify-center shadow-[0_2px_12px_rgba(255,255,255,0.25)] active:scale-90 transition-all cursor-pointer hover:scale-105 flex-shrink-0"
            >
              {isPlayingActive ? (
                <Pause className="w-4 h-4 fill-black text-black stroke-none" />
              ) : (
                <Play className="w-4 h-4 fill-black text-black stroke-none ml-0.5" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={handlePlayNext}
              aria-label="Next track"
              title="Next (J)"
              className="p-1.5 text-[#D0D0D0] hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 cursor-pointer"
            >
              <SkipForward className="w-4 h-4 fill-current stroke-none" />
            </button>

            {/* Repeat */}
            <button
              onClick={cycleRepeatMode}
              aria-label="Repeat mode"
              title={`Repeat: ${repeatState}`}
              className={`p-1.5 rounded-full transition-all cursor-pointer relative ${
                repeatState !== 'OFF'
                  ? 'text-white bg-white/15'
                  : 'text-[#A8A8A8] hover:text-white hover:bg-white/10'
              }`}
            >
              {repeatState === 'ONE' ? (
                <Repeat1 className="w-3.5 h-3.5" />
              ) : (
                <Repeat className="w-3.5 h-3.5" />
              )}
              {repeatState !== 'OFF' && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
              )}
            </button>
          </div>
        </div>

        {/* ── 3. RIGHT: Secondary Minimal Monochrome Controls & Volume ── */}
        <div className="flex items-center gap-1 sm:gap-1.5 w-[230px] lg:w-[260px] justify-end flex-shrink-0 z-10">
          {/* Lyrics */}
          <button
            onClick={toggleLyrics}
            aria-label="Karaoke & Synced Lyrics"
            title="Karaoke & Synced Lyrics (L)"
            className={`p-1.5 rounded-full transition-all cursor-pointer relative ${
              isLyricsOpen
                ? 'text-white bg-white/15'
                : 'text-[#A8A8A8] hover:text-white hover:bg-white/10'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            {isLyricsOpen && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
            )}
          </button>

          {/* Queue */}
          <button
            onClick={handleToggleQueue}
            aria-label="Open queue"
            title="Queue (Q)"
            className={`p-1.5 rounded-full transition-all cursor-pointer relative ${
              isQueueOpen && rightPanelMode === 'queue'
                ? 'text-white bg-white/15'
                : 'text-[#A8A8A8] hover:text-white hover:bg-white/10'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            {isQueueOpen && rightPanelMode === 'queue' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
            )}
          </button>

          {/* Spotify Connect Device Button (at the right side of Queue) */}
          <button
            onClick={handleToggleConnect}
            aria-label="Connect to a device"
            title={isLocalPlayback ? "Connect to a device" : `Listening on ${activePlaybackDeviceName}`}
            className={`relative p-1.5 rounded-full transition-colors cursor-pointer ${
              !isLocalPlayback || (isQueueOpen && (rightPanelMode === 'connect' || rightPanelMode === 'jam')) || isCastModalOpen
                ? 'text-[#1DB954] bg-[#1DB954]/15 hover:bg-[#1DB954]/25'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <MonitorSpeaker className="w-3.5 h-3.5" />
            {!isLocalPlayback && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#1DB954] ring-2 ring-black animate-pulse" />
            )}
          </button>

          {/* Volume Control (Minimal Monochrome) */}
          <div className="flex items-center gap-1.5 pl-1.5 border-l border-white/10">
            <button
              onClick={() => toggleMute()}
              aria-label="Volume"
              title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer flex-shrink-0"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-white/40" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>

            <div className="relative w-16 sm:w-20 h-4 flex items-center group/vol cursor-pointer">
              <div className="absolute left-0 right-0 h-1 rounded-full bg-white/15 group-hover/vol:h-1.5 group-hover/vol:bg-white/25 transition-all" />
              <div
                className="absolute left-0 h-1 group-hover/vol:h-1.5 rounded-full pointer-events-none transition-all bg-white"
                style={{
                  width: `${(isMuted ? 0 : volume) * 100}%`,
                }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-sm pointer-events-none transition-all opacity-0 group-hover/vol:opacity-100 group-hover/vol:scale-125"
                style={{
                  left: `${(isMuted ? 0 : volume) * 100}%`,
                }}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (isMuted && val > 0) {
                    toggleMute();
                  }
                }}
                aria-label="Volume slider"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>
          </div>
        </div>

        {/* ── 4. INTEGRATED PROGRESS BAR (Along Bottom Edge of Pill) ── */}
        {activeSong && (
          <div className="absolute left-7 right-7 bottom-0.5 z-30 pointer-events-auto h-2 flex items-center">
            <SeekBar
              className="w-full !py-0 h-2 flex items-center"
              height="h-[2px] group-hover/player:h-[3px] transition-all"
              thumbSize="w-2.5 h-2.5 opacity-0 group-hover/player:opacity-100"
              activeColor="bg-white"
            />
          </div>
        )}
      </aside>
    </>
  );
}
