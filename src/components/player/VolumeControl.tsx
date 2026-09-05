'use client';

/**
 * VolumeControl — Spotify-style local volume slider + mute toggle
 */

import React, { useCallback, useRef } from 'react';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useThemeStore } from '@/context/useThemeStore';

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
  .light .rxv-track::-webkit-slider-runnable-track,
  [data-theme="light"] .rxv-track::-webkit-slider-runnable-track {
    background: rgba(15,23,42,0.15);
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
  .light .rxv-track::-webkit-slider-thumb,
  [data-theme="light"] .rxv-track::-webkit-slider-thumb {
    background: #0F172A;
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
  .light .rxv-track::-moz-range-track,
  [data-theme="light"] .rxv-track::-moz-range-track {
    background: rgba(15,23,42,0.15);
  }
  .rxv-track::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    border: none;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }
  .light .rxv-track::-moz-range-thumb,
  [data-theme="light"] .rxv-track::-moz-range-thumb {
    background: #0F172A;
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
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const { resolvedTheme } = useThemeStore();
  const isLight = resolvedTheme === 'light';

  const effectiveVol = isMuted ? 0 : volume;
  const pct = Math.round(effectiveVol * 100);

  const Icon =
    isMuted || effectiveVol === 0
      ? VolumeX
      : effectiveVol < 0.5
      ? Volume1
      : Volume2;

  const iconColor = isMuted || effectiveVol === 0 ? '#F0444F' : isLight ? '#64748B' : 'rgba(255,255,255,0.6)';

  const handleVolumeChange = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    import('@/lib/playback/SpeakerVolumeGainManager').then(({ SpeakerVolumeGainManager }) => {
      SpeakerVolumeGainManager.getInstance().setSmoothVolume(clamped);
    }).catch(() => {});
  }, [setVolume]);

  const handleMuteToggle = useCallback(() => {
    toggleMute();
  }, [toggleMute]);

  return (
    <>
      <StyleOnce />
      <div
        className={`rxv-wrap flex items-center gap-2.5 ${className}`}
        title={`Volume: ${pct}%`}
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
              background: '#fff',
              opacity: 0.7,
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
      </div>
    </>
  );
}
