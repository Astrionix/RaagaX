'use client';

/**
 * RaagaX Connect — ConnectedPlayerFooter Component
 *
 * Renders the Spotify-style green device routing pill, real-time interpolated progress bar,
 * and remote transport control buttons when playing on another device.
 */

import React from 'react';
import { useRemoteSessionHydration } from '@/hooks/useRemoteSessionHydration';
import { useConnectStore } from '@/context/useConnectStore';
import { Speaker, Laptop, Smartphone, Tv, Play, Pause, SkipForward, SkipBack, Volume2 } from 'lucide-react';

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
    if (type === 'tv') return <Tv className="w-4 h-4 text-emerald-400" />;
    if (type === 'mobile') return <Smartphone className="w-4 h-4 text-emerald-400" />;
    if (type === 'desktop') return <Laptop className="w-4 h-4 text-emerald-400" />;
    return <Speaker className="w-4 h-4 text-emerald-400" />;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetMs = Math.round(ratio * durationMs);
    sendSeek(targetMs);
  };

  return (
    <div className="w-full bg-[#1db954] text-black px-4 py-1.5 flex items-center justify-between shadow-lg text-xs font-semibold select-none transition-all duration-300">
      {/* Device Indicator Pill */}
      <div
        onClick={() => toggleConnectModal(true)}
        className="flex items-center gap-2 cursor-pointer hover:opacity-90 active:scale-95 transition-transform"
      >
        <div className="relative flex items-center justify-center">
          {getDeviceIcon()}
          {isPlaying && (
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
            </span>
          )}
        </div>
        <span className="truncate max-w-[200px] sm:max-w-xs">
          Listening on <span className="font-bold underline underline-offset-2">{activeDeviceName}</span>
        </span>
      </div>

      {/* Mini Scrubber & Transport for Remote Playback */}
      <div className="hidden md:flex items-center gap-3 flex-1 max-w-md mx-6">
        <span className="text-[10px] font-mono text-black/80">{formatTime(interpolatedPositionMs)}</span>
        <div
          onClick={handleSeek}
          className="relative flex-1 h-1.5 bg-black/20 rounded-full cursor-pointer overflow-hidden group"
        >
          <div
            className="h-full bg-black rounded-full transition-[width] duration-75"
            style={{ width: `${progressRatio * 100}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-black/80">{formatTime(durationMs)}</span>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 mr-2">
          <button
            onClick={() => sendPrev()}
            className="p-1 hover:bg-black/10 rounded-full active:scale-90 transition-transform"
            title="Previous"
          >
            <SkipBack className="w-3.5 h-3.5 fill-current" />
          </button>
          <button
            onClick={() => (isPlaying ? sendPause() : sendPlay())}
            className="p-1 hover:bg-black/10 rounded-full active:scale-90 transition-transform"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
          <button
            onClick={() => sendNext()}
            className="p-1 hover:bg-black/10 rounded-full active:scale-90 transition-transform"
            title="Next"
          >
            <SkipForward className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>

        {/* Play on this device CTA */}
        <button
          onClick={() => takeoverPlayback()}
          className="px-2.5 py-1 bg-black text-white hover:bg-black/90 active:scale-95 text-[11px] font-medium rounded-full shadow transition-all flex items-center gap-1"
        >
          <Laptop className="w-3 h-3" />
          <span>Play Here</span>
        </button>
      </div>
    </div>
  );
}
