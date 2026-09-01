'use client';

/**
 * RaagaX Connect — ConnectedPlayerFooter Component (Device X UI)
 *
 * Modern Spotify Connect style remote routing banner.
 * Seamlessly docks above the floating PlayerBar on desktop, and above
 * bottom navigation on mobile — zero visual overlap or collision.
 */

import React from 'react';
import { useRemoteSessionHydration } from '@/hooks/useRemoteSessionHydration';
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
  Radio,
  LogOut,
  Sparkles,
} from 'lucide-react';

export function ConnectedPlayerFooter() {
  const {
    isRemoteMode,
    activeDeviceName,
    interpolatedPositionMs,
    progressRatio,
    durationMs,
    isPlaying,
    takeoverPlayback,
    sendPlay,
    sendPause,
    sendSeek,
    sendNext,
    sendPrev,
  } = useRemoteSessionHydration();

  const toggleConnectModal = useConnectStore((s) => s.toggleConnectModal);
  const activePlaybackDevice = useConnectStore((s) => s.activePlaybackDevice);
  const disconnect = useConnectStore((s) => s.disconnect);
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);

  if (!isRemoteMode || !activeDeviceName) {
    return null;
  }

  const formatTime = (ms: number) => {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDeviceIcon = () => {
    const type = activePlaybackDevice?.deviceType;
    if (type === 'tv') return <Tv className="w-3.5 h-3.5" />;
    if (type === 'mobile') return <Smartphone className="w-3.5 h-3.5" />;
    if (type === 'tablet') return <Tablet className="w-3.5 h-3.5" />;
    if (type === 'desktop') return <Laptop className="w-3.5 h-3.5" />;
    return <Speaker className="w-3.5 h-3.5" />;
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
      {/* ── DESKTOP: Floating Pill Docked Above PlayerBar ── */}
      <div
        className={`hidden md:flex fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-40 select-none items-center justify-between px-4 py-1.5 bg-[#121214]/95 hover:bg-[#16161a] backdrop-blur-2xl border border-[#1db954]/30 hover:border-[#1db954]/50 rounded-full shadow-[0_12px_32px_rgba(0,0,0,0.7),0_0_20px_rgba(29,185,84,0.15)] transition-all duration-300 max-w-[calc(100vw-18rem)] md:max-w-[760px] lg:max-w-[840px] w-auto h-[38px] gap-3 -translate-x-1/2 animate-in slide-in-from-bottom-2 ${
          isQueueOpen
            ? 'left-[calc(50%+8rem)] xl:left-[calc(50%+8rem-180px)]'
            : 'left-[calc(50%+8rem)]'
        }`}
      >
        {/* Device indicator pill */}
        <div
          onClick={() => toggleConnectModal(true)}
          className="flex items-center gap-2 cursor-pointer group flex-shrink-0"
          title="Change output device"
        >
          <div className="relative w-6 h-6 rounded-full bg-[#1db954]/15 flex items-center justify-center text-[#1db954] group-hover:bg-[#1db954]/25 transition-colors">
            {getDeviceIcon()}
            {isPlaying && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1db954] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#1db954]"></span>
              </span>
            )}
          </div>
          <div className="text-[11px] font-medium text-zinc-300 group-hover:text-white transition-colors truncate max-w-[200px]">
            <span>Listening on </span>
            <span className="text-[#1db954] font-semibold underline underline-offset-2">
              {activeDeviceName}
            </span>
          </div>
        </div>

        {/* Live Mini Scrubber */}
        <div className="hidden lg:flex items-center gap-2 flex-1 max-w-[260px] mx-2">
          <span className="text-[10px] font-mono text-zinc-400">
            {formatTime(interpolatedPositionMs)}
          </span>
          <div
            onClick={handleSeek}
            className="relative flex-1 h-1 bg-white/10 hover:h-1.5 rounded-full cursor-pointer overflow-hidden transition-all group"
          >
            <div
              className="h-full bg-[#1db954] rounded-full transition-[width] duration-75"
              style={{ width: `${progressRatio * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-zinc-400">
            {formatTime(durationMs)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => disconnect()}
            className="px-2.5 py-0.5 text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer"
            title="Detach controller (speaker keeps playing)"
          >
            Disconnect
          </button>
          <button
            onClick={() => takeoverPlayback()}
            className="px-3 py-1 bg-[#1db954] hover:bg-[#1ed760] active:scale-95 text-black text-[11px] font-bold rounded-full shadow transition-all flex items-center gap-1 cursor-pointer"
            title="Transfer audio to this device"
          >
            <Laptop className="w-3 h-3" />
            <span>Play Here</span>
          </button>
        </div>
      </div>

      {/* ── MOBILE: Docked bottom bar ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#121214]/95 backdrop-blur-xl border-t border-[#1db954]/30 px-3.5 py-2 flex items-center justify-between text-xs select-none shadow-2xl">
        <div
          onClick={() => toggleConnectModal(true)}
          className="flex items-center gap-2 min-w-0 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-[#1db954]/15 flex items-center justify-center text-[#1db954] flex-shrink-0">
            {getDeviceIcon()}
          </div>
          <div className="min-w-0 truncate">
            <div className="text-[11px] font-semibold text-white truncate">
              Listening on <span className="text-[#1db954]">{activeDeviceName}</span>
            </div>
            <div className="text-[10px] text-zinc-400 truncate">
              {isPlaying ? 'Playing remotely' : 'Paused remotely'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <button
            onClick={() => (isPlaying ? sendPause() : sendPlay())}
            className="p-1.5 text-white hover:bg-white/10 rounded-full transition-all"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
          <button
            onClick={() => takeoverPlayback()}
            className="px-2.5 py-1 bg-[#1db954] text-black text-[11px] font-bold rounded-full shadow transition-all flex items-center gap-1 cursor-pointer"
          >
            Play Here
          </button>
        </div>
      </div>
    </>
  );
}
