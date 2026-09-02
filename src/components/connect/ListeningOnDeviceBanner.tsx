'use client';

/**
 * ListeningOnDeviceBanner — Spotify Connect Persistent Remote Status Bar
 *
 * Renders the signature Spotify green (#1db954) bottom bar when the current device
 * is acting as a Remote Controller driving another physical speaker under the same account.
 *
 * Features:
 * - Active Speaker Icon & Animated Equalizer Indicator
 * - "Listening on [Device Name]" with one-click device switching
 * - 60 FPS Mathematical Scrubber (0 network audio polling)
 * - "Play on this device / This Computer" Instant Takeover Button with Pre-buffer Loader
 * - Headless Remote Transport Controls (Play/Pause/Next/Prev/Seek)
 * - Quick Disconnect action
 */

import React from 'react';
import { useSpotifyConnectEngine } from '@/hooks/useSpotifyConnectEngine';
import { useConnectStore } from '@/context/useConnectStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import {
  Laptop,
  Smartphone,
  Tablet,
  Tv,
  Speaker,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Loader2,
  X,
} from 'lucide-react';

export function ListeningOnDeviceBanner() {
  const {
    isRemoteController,
    activeSpeakerName,
    activeSpeakerType,
    trackTitle,
    durationMs,
    isPaused,
    isBuffering,
    interpolatedPositionMs,
    progressRatio,
    isTakingOver,
    takeoverPlayback,
    disconnect,
    sendPlay,
    sendPause,
    sendSeek,
    sendNext,
    sendPrev,
  } = useSpotifyConnectEngine();

  const toggleConnectModal = useConnectStore((s) => s.toggleConnectModal);
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);

  if (!isRemoteController || !activeSpeakerName) {
    return null;
  }

  const formatTime = (ms: number) => {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDeviceIcon = () => {
    if ((activeSpeakerType as string) === 'tv') return <Tv className="w-4 h-4 text-[#1db954]" />;
    if (activeSpeakerType === 'mobile') return <Smartphone className="w-4 h-4 text-[#1db954]" />;
    if (activeSpeakerType === 'desktop') return <Laptop className="w-4 h-4 text-[#1db954]" />;
    return <Speaker className="w-4 h-4 text-[#1db954]" />;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetMs = Math.round(ratio * durationMs);
    sendSeek(targetMs);
  };

  return (
    <>
      {/* ── DESKTOP: Spotify Connect Green Floating Routing Pill ── */}
      <div
        className={`hidden md:flex fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-40 select-none items-center justify-between px-4 py-2 bg-[#121214]/95 hover:bg-[#16161a] backdrop-blur-2xl border border-[#1db954]/30 hover:border-[#1db954]/50 rounded-full shadow-[0_12px_32px_rgba(0,0,0,0.7),0_0_20px_rgba(29,185,84,0.15)] transition-all duration-300 max-w-[calc(100vw-18rem)] md:max-w-[760px] lg:max-w-[840px] w-auto h-[42px] gap-3 -translate-x-1/2 animate-in slide-in-from-bottom-2 ${
          isQueueOpen
            ? 'left-[calc(50%+8rem)] xl:left-[calc(50%+8rem-180px)]'
            : 'left-[calc(50%+8rem)]'
        }`}
      >
        {/* Device Indicator & Name */}
        <div
          onClick={() => toggleConnectModal(true)}
          className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0"
          title="Switch audio playback device"
        >
          <div className="relative w-7 h-7 rounded-full bg-[#1db954]/15 flex items-center justify-center group-hover:bg-[#1db954]/25 transition-colors">
            {getDeviceIcon()}
            {!isPaused && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1db954] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1db954]"></span>
              </span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1db954]">
              Listening on
            </span>
            <span className="text-xs font-semibold text-white/90 truncate max-w-[130px] lg:max-w-[170px] group-hover:text-white transition-colors">
              {activeSpeakerName}
            </span>
          </div>
        </div>

        {/* Live Scrubber & Remote Transport */}
        <div className="flex items-center gap-3 flex-1 min-w-[200px] max-w-[360px]">
          <span className="text-[10px] font-medium text-white/50 w-7 text-right tabular-nums">
            {formatTime(interpolatedPositionMs)}
          </span>
          <div
            onClick={handleSeek}
            className="group/track relative flex-1 h-1.5 bg-white/10 hover:bg-white/20 rounded-full cursor-pointer overflow-hidden transition-all"
          >
            <div
              className="absolute left-0 top-0 bottom-0 bg-[#1db954] rounded-full transition-[width] duration-75"
              style={{ width: `${progressRatio * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-white/50 w-7 tabular-nums">
            {formatTime(durationMs)}
          </span>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={sendPrev}
              className="p-1 text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
              title="Previous"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={isPaused ? sendPlay : sendPause}
              className="w-6 h-6 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center justify-center transition-transform hover:scale-105"
              title={isBuffering ? 'Buffering...' : isPaused ? 'Play' : 'Pause'}
            >
              {isBuffering ? (
                <Loader2 className="w-3 h-3 animate-spin text-black" />
              ) : isPaused ? (
                <Play className="w-3 h-3 fill-current ml-0.5" />
              ) : (
                <Pause className="w-3 h-3 fill-current" />
              )}
            </button>
            <button
              onClick={sendNext}
              className="p-1 text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
              title="Next"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Takeover Button & Disconnect */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={takeoverPlayback}
            disabled={isTakingOver}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#1db954] hover:bg-[#1ed760] text-black text-xs font-bold rounded-full transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] shadow-sm disabled:opacity-50"
            title="Transfer playback to this computer"
          >
            {isTakingOver ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Buffering...</span>
              </>
            ) : (
              <span>Play on this device</span>
            )}
          </button>
          <button
            onClick={disconnect}
            className="p-1 text-white/40 hover:text-white/80 transition-colors rounded-full hover:bg-white/10"
            title="Disconnect remote control"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
