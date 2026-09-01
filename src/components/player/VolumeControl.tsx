'use client';

/**
 * VolumeControl — Spotify-style volume slider + mute toggle
 *
 * Works in both modes automatically:
 *  • Local speaker mode  → smooth ramp via SpeakerVolumeGainManager
 *  • Remote controller   → throttled SET_VOLUME dispatch, optimistic UI
 *
 * Props:
 *  className  — optional extra wrapper class
 *  compact    — if true, renders a slimmer horizontal bar (for bottom bar / footer)
 */

import React from 'react';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { useRemoteVolume } from '@/hooks/useRemoteVolume';
import { useConnectStore } from '@/context/useConnectStore';

const SLIDER_CSS = `
  .rxv-track {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    width: 100%;
    height: 4px;
    outline: none;
  }
  .rxv-track::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 99px;
    background: rgba(255,255,255,0.15);
  }
  .rxv-track::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    margin-top: -5px;
    opacity: 0;
    transition: opacity 0.15s, transform 0.12s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }
  .rxv-wrap:hover .rxv-track::-webkit-slider-thumb {
    opacity: 1;
    transform: scale(1.1);
  }
  .rxv-track::-moz-range-track {
    height: 4px;
    border-radius: 99px;
    background: rgba(255,255,255,0.15);
  }
  .rxv-track::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    border: none;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }
`;

function StyleOnce() {
  return <style>{SLIDER_CSS}</style>;
}

interface VolumeControlProps {
  className?: string;
  compact?: boolean;
}

export function VolumeControl({ className = '', compact = false }: VolumeControlProps) {
  const { displayVolume, isMuted, isRemoteMode, handleVolumeChange, handleMuteToggle } =
    useRemoteVolume();

  const activeDevice = useConnectStore((s) => s.activePlaybackDevice);

  const effectiveVol = isMuted ? 0 : displayVolume;
  const pct = Math.round(effectiveVol * 100);

  const Icon =
    isMuted || effectiveVol === 0
      ? VolumeX
      : effectiveVol < 0.5
      ? Volume1
      : Volume2;

  const iconColor = isMuted || effectiveVol === 0 ? '#F0444F' : 'rgba(255,255,255,0.5)';
  const fillColor = isRemoteMode ? '#1db954' : '#fff';

  return (
    <>
      <StyleOnce />
      <div
        className={`rxv-wrap flex items-center gap-2.5 ${className}`}
        title={
          isRemoteMode
            ? `Remote volume on ${activeDevice?.deviceName || 'speaker'}: ${pct}%`
            : `Volume: ${pct}%`
        }
      >
        {/* Mute toggle */}
        <button
          onClick={handleMuteToggle}
          className="flex-shrink-0 cursor-pointer transition-transform active:scale-90"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          <Icon
            style={{ width: compact ? 14 : 16, height: compact ? 14 : 16, color: iconColor }}
          />
        </button>

        {/* Track + filled overlay */}
        <div
          className="flex-1 relative"
          style={{ height: compact ? 3 : 4 }}
        >
          {/* Filled portion */}
          <div
            className="absolute inset-y-0 left-0 rounded-full pointer-events-none transition-none"
            style={{
              width: `${pct}%`,
              background: fillColor,
              opacity: isRemoteMode ? 0.9 : 0.7,
            }}
          />
          {/* Slider input */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={effectiveVol}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="rxv-track absolute inset-0"
            style={{ height: compact ? 3 : 4 }}
            aria-label="Volume"
          />
        </div>

        {/* Max icon */}
        <Volume2
          style={{
            width: compact ? 14 : 16,
            height: compact ? 14 : 16,
            color: 'rgba(255,255,255,0.5)',
            flexShrink: 0,
          }}
        />

        {/* Remote badge (only in controller mode) */}
        {isRemoteMode && activeDevice && !compact && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{
              background: 'rgba(29,185,84,0.15)',
              color: '#1db954',
              border: '1px solid rgba(29,185,84,0.25)',
              maxWidth: 80,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeDevice.deviceName}
          </span>
        )}
      </div>
    </>
  );
}
