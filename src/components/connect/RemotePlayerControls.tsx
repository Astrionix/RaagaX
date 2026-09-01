'use client';

/**
 * RemotePlayerControls — Headless Remote Transport & Volume Controls
 *
 * Dispatches transport commands (Play, Pause, Skip, Seek, Volume) directly
 * over the Connect network to the Authoritative Speaker without touching
 * the local audio hardware buffer.
 */

import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useRemotePlaybackObserver } from '@/hooks/useRemotePlaybackObserver';
import { useRemoteVolume } from '@/hooks/useRemoteVolume';

interface RemotePlayerControlsProps {
  className?: string;
  showVolume?: boolean;
}

export function RemotePlayerControls({ className = '', showVolume = true }: RemotePlayerControlsProps) {
  const {
    isPaused,
    durationMs,
    interpolatedPositionMs,
    progressRatio,
    sendPlay,
    sendPause,
    sendSeek,
    sendNext,
    sendPrev,
  } = useRemotePlaybackObserver();

  const {
    displayVolume: volume,
    isMuted,
    handleVolumeChange: setVolume,
    handleMuteToggle: toggleMute,
  } = useRemoteVolume();

  const formatTime = (ms: number) => {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetMs = Math.round(ratio * durationMs);
    sendSeek(targetMs);
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className={`flex flex-col items-center gap-3 w-full ${className}`}>
      {/* ── Transport Row (Prev / Play-Pause / Next) ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => sendPrev()}
          className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
          title="Previous Track"
          aria-label="Previous Track"
        >
          <SkipBack className="w-5 h-5 fill-current" />
        </button>

        <button
          onClick={() => (isPaused ? sendPlay() : sendPause())}
          className="w-11 h-11 rounded-full bg-white hover:bg-white/90 active:scale-95 text-black flex items-center justify-center shadow-lg transition-all cursor-pointer"
          title={isPaused ? 'Play' : 'Pause'}
          aria-label={isPaused ? 'Play' : 'Pause'}
        >
          {!isPaused ? (
            <Pause className="w-5 h-5 fill-black" />
          ) : (
            <Play className="w-5 h-5 fill-black ml-0.5" />
          )}
        </button>

        <button
          onClick={() => sendNext()}
          className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
          title="Next Track"
          aria-label="Next Track"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>
      </div>

      {/* ── Seek Bar Scrubber ── */}
      <div className="w-full flex items-center gap-3 max-w-md">
        <span className="text-[11px] font-mono text-zinc-400 min-w-[36px] text-right">
          {formatTime(interpolatedPositionMs)}
        </span>

        <div
          onClick={handleSeek}
          className="relative flex-1 h-1.5 bg-white/10 hover:h-2 rounded-full cursor-pointer overflow-hidden transition-all group"
        >
          <div
            className="h-full bg-[#1db954] rounded-full transition-[width] duration-75"
            style={{ width: `${progressRatio * 100}%` }}
          />
        </div>

        <span className="text-[11px] font-mono text-zinc-400 min-w-[36px]">
          {formatTime(durationMs)}
        </span>
      </div>

      {/* ── Remote Volume Slider (Optional) ── */}
      {showVolume && (
        <div className="w-full max-w-xs flex items-center gap-2.5 pt-1">
          <button
            onClick={toggleMute}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1"
            title="Mute / Unmute"
          >
            <VolumeIcon className="w-4 h-4" />
          </button>

          <div className="relative flex-1 h-1 bg-white/10 hover:h-1.5 rounded-full cursor-pointer overflow-hidden transition-all">
            <div
              className="h-full bg-[#1db954] rounded-full transition-[width] duration-75"
              style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <span className="text-[10px] font-mono text-zinc-400 min-w-[28px] text-right">
            {Math.round((isMuted ? 0 : volume) * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
