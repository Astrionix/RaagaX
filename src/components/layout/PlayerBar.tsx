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
  ListMusic,
  Disc3,
  Maximize2,
  Radio,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useJamStore } from '@/context/useJamStore';
import { useConnectStore } from '@/context/useConnectStore';
import { ConnectButton } from '@/components/connect/ConnectButton';
import { SeekBar } from '@/components/player/SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { SongActionMenu } from '@/components/common/SongActionMenu';
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
    isLyricsOpen,
    isPlayerExpanded,
    togglePlayerExpanded,
  } = usePlayerStore();

  const { isInJam, session, diagnostics, participantState, toggleJamModal } = useJamStore();
  const { isRemoteMode, activePlaybackDevice, remoteSession, sendPlay, sendPause, sendNext, sendPrev, sendVolume } = useConnectStore();

  useEffect(() => {
    setMounted(true);
    import('@/lib/playback/PlaybackService').then(({ PlaybackService }) => {
      PlaybackService.getInstance().syncLivePlayingState();
    }).catch(() => {});
  }, []);

  const activeSong = (isRemoteMode && remoteSession?.currentSong)
    ? remoteSession.currentSong
    : (isInJam && session?.currentSong)
    ? session.currentSong
    : currentSong;

  const isPlayingActive = (isRemoteMode && remoteSession)
    ? remoteSession.isPlaying
    : (isInJam && session)
    ? session.state === 'PLAYING'
    : isPlaying;

  const handleTogglePlayPause = () => {
    if (isRemoteMode) {
      if (isPlayingActive) {
        sendPause();
      } else {
        sendPlay();
      }
      return;
    }
    togglePlayPause();
  };

  const handlePlayNext = () => {
    if (isRemoteMode) {
      sendNext();
      return;
    }
    playNext();
  };

  const handlePlayPrev = () => {
    if (isRemoteMode) {
      sendPrev();
      return;
    }
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

  // Spacebar Desktop Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const tagName = target.tagName?.toLowerCase();
        const isInputField =
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target.isContentEditable;

        if (!isInputField) {
          e.preventDefault();
          usePlayerStore.getState().togglePlayPause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!mounted || !activeSong || isPlayerExpanded) return null;

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
    <aside
      aria-label="Floating Media Player"
      className={`hidden md:flex fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] z-40 group/player select-none items-center justify-between px-3.5 sm:px-4 py-1.5 bg-[#1c1c1e]/90 hover:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-white/10 hover:border-white/15 rounded-full shadow-[0_12px_36px_rgba(0,0,0,0.65)] ring-1 ring-white/5 transition-all duration-300 max-w-[calc(100vw-18rem)] md:max-w-[760px] lg:max-w-[840px] w-auto h-[54px] gap-2.5 sm:gap-4 -translate-x-1/2 ${
        isQueueOpen
          ? 'left-[calc(50%+8rem)] xl:left-[calc(50%+8rem-180px)]'
          : 'left-[calc(50%+8rem)]'
      }`}
      style={{
        boxShadow: `0 12px 36px rgba(0,0,0,0.7), 0 0 25px ${glowColor}`,
      }}
    >
        {/* ── 1. LEFT CONTROLS: Shuffle, Prev, Play/Pause, Next, Repeat ── */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <button
            onClick={toggleShuffle}
            aria-label="Shuffle"
            title={`Shuffle: ${shuffleMode}`}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              shuffleMode !== 'OFF'
                ? 'text-[#FA233B] bg-[#FA233B]/15'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {shuffleMode === 'SMART' ? (
              <div className="relative">
                <Shuffle className="w-3.5 h-3.5" />
                <Sparkles className="w-2 h-2 absolute -top-1 -right-1 text-yellow-400" />
              </div>
            ) : (
              <Shuffle className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={handlePlayPrev}
            aria-label="Previous track"
            title="Previous (K)"
            className="p-1.5 text-zinc-300 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 cursor-pointer"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={handleTogglePlayPause}
            aria-label={isPlayingActive ? 'Pause' : 'Play'}
            title={isPlayingActive ? 'Pause (Space)' : 'Play (Space)'}
            className="p-1.5 text-white hover:scale-110 active:scale-95 transition-all cursor-pointer rounded-full hover:bg-white/10 flex items-center justify-center"
          >
            {isPlayingActive ? (
              <Pause className="w-4 h-4 fill-white text-white" />
            ) : (
              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
            )}
          </button>

          <button
            onClick={handlePlayNext}
            aria-label="Next track"
            title="Next (J)"
            className="p-1.5 text-zinc-300 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 cursor-pointer"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={cycleRepeatMode}
            aria-label="Repeat mode"
            title={`Repeat: ${repeatState}`}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              repeatState !== 'OFF'
                ? 'text-[#FA233B] bg-[#FA233B]/15'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {repeatState === 'ONE' ? (
              <Repeat1 className="w-3.5 h-3.5" />
            ) : (
              <Repeat className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* ── 2. CENTER: Album Art, Title, Artist • Album & More Menu ── */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 max-w-[280px] sm:max-w-[340px]">
          {activeSong ? (
            <>
              <div
                onClick={togglePlayerExpanded}
                className="relative w-8 h-8 rounded-md overflow-hidden shadow-sm border border-white/10 cursor-pointer group/art flex-shrink-0"
                title="Expand Player (F)"
              >
                <OptimizedImage
                  src={activeSong.coverUrl}
                  alt={activeSong.title}
                  size="thumb"
                  className="w-full h-full object-cover group-hover/art:scale-110 transition-transform duration-300"
                  fallbackSrc="/app-icon.png"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/art:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="w-3 h-3 text-white" />
                </div>
              </div>

              <div className="min-w-0 flex-1 overflow-hidden text-left">
                <h4
                  onClick={togglePlayerExpanded}
                  className="text-[12px] sm:text-[13px] font-semibold text-white truncate hover:underline cursor-pointer transition-colors leading-tight"
                  title={cleanTitle}
                >
                  {cleanTitle}
                </h4>
                <p
                  className="text-[10px] sm:text-[11px] text-zinc-400 truncate leading-tight mt-0.5 font-normal"
                  title={subtitle}
                >
                  {isRemoteMode ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                      <span className="truncate">🔊 {activePlaybackDevice?.deviceName || 'Speaker'}: {subtitle}</span>
                    </span>
                  ) : (
                    <span>{subtitle}</span>
                  )}
                </p>
              </div>

              <div className="flex-shrink-0 text-zinc-400 hover:text-white transition-colors">
                <SongActionMenu song={activeSong} />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium truncate">
              <Disc3 className="w-4 h-4 text-[#FA233B] animate-spin flex-shrink-0" style={{ animationDuration: '8s' }} />
              <span className="truncate">Select a track to play</span>
            </div>
          )}
        </div>

        {/* ── 3. RIGHT CONTROLS: Jam, Lyrics, Queue, Volume ── */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <button
            onClick={() => toggleJamModal(true)}
            aria-label="Remote Jam Party"
            title={
              isInJam
                ? `Jam Party (${diagnostics.syncState === 'SYNCHRONIZED' ? 'Synced' : diagnostics.syncState || 'Active'})`
                : 'Remote Jam Party'
            }
            className={`relative p-1.5 rounded-full transition-all cursor-pointer ${
              isInJam
                ? 'text-[#FA233B] bg-[#FA233B]/15 hover:bg-[#FA233B]/25'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isInJam ? 'animate-pulse' : ''}`} />
            {isInJam && (
              <span
                className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full border border-black/80 ${
                  diagnostics.syncState === 'SYNCHRONIZED'
                    ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse'
                    : diagnostics.syncState === 'SYNCHRONIZING' || participantState === 'SYNCING'
                    ? 'bg-amber-400 animate-bounce'
                    : 'bg-rose-500 animate-ping'
                }`}
              />
            )}
          </button>

          {/* RaagaX Connect: Remote Device Control & Playback Switcher */}
          <ConnectButton />

          <button
            onClick={toggleLyrics}
            aria-label="Open lyrics"
            title="Lyrics (L)"
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isLyricsOpen
                ? 'text-[#FA233B] bg-[#FA233B]/15'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleQueue}
            aria-label="Open queue"
            title="Queue (Q)"
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isQueueOpen
                ? 'text-[#FA233B] bg-[#FA233B]/15'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-1 pl-1">
            <button
              onClick={() => {
                if (isRemoteMode) {
                  const currentV = remoteSession?.volume ?? 0.8;
                  sendVolume(currentV > 0 ? 0 : 0.8);
                } else {
                  toggleMute();
                }
              }}
              aria-label="Volume"
              title={
                isRemoteMode
                  ? `Speaker Volume: ${Math.round((remoteSession?.volume ?? 0.8) * 100)}%`
                  : isMuted || volume === 0
                  ? 'Unmute'
                  : 'Mute'
              }
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer flex-shrink-0"
            >
              {(isRemoteMode ? (remoteSession?.volume ?? 0.8) === 0 : isMuted || volume === 0) ? (
                <VolumeX className={`w-3.5 h-3.5 ${isRemoteMode ? 'text-emerald-400' : 'text-[#FA233B]'}`} />
              ) : (
                <Volume2 className={`w-3.5 h-3.5 ${isRemoteMode ? 'text-emerald-400' : ''}`} />
              )}
            </button>

            <div className="relative w-16 sm:w-20 h-4 flex items-center group/vol cursor-pointer">
              <div className="absolute left-0 right-0 h-1 rounded-full bg-white/20 group-hover/vol:h-1.5 transition-all" />
              <div
                className={`absolute left-0 h-1 group-hover/vol:h-1.5 rounded-full pointer-events-none transition-all ${
                  isRemoteMode ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-[#FA233B]'
                }`}
                style={{
                  width: `${(isRemoteMode ? (remoteSession?.volume ?? 0.8) : isMuted ? 0 : volume) * 100}%`,
                }}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isRemoteMode ? (remoteSession?.volume ?? 0.8) : isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (isRemoteMode) {
                    sendVolume(val);
                  } else {
                    setVolume(val);
                    if (isMuted && val > 0) {
                      toggleMute();
                    }
                  }
                }}
                aria-label="Volume slider"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title={
                  isRemoteMode
                    ? `Speaker Volume (${activePlaybackDevice?.deviceName || 'Remote'}): ${Math.round(
                        (remoteSession?.volume ?? 0.8) * 100
                      )}%`
                    : `Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`
                }
              />
            </div>
          </div>
        </div>

        {/* ── 4. INTEGRATED PROGRESS BAR (Along Bottom Edge) ── */}
        {activeSong && (
          <div className="absolute left-5 right-5 -bottom-[1px] z-30 pointer-events-auto">
            <SeekBar
              className="w-full"
              height="h-[2px] group-hover/player:h-[3px] transition-all"
              thumbSize="w-2 h-2 opacity-0 group-hover/player:opacity-100"
              activeColor="bg-[#FA233B]"
            />
          </div>
        )}
      </aside>
  );
}
