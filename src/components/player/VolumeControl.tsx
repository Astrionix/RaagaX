'use client';

/**
 * VolumeControl — Spotify-style volume slider + mute toggle
 * Features smooth real-time visual progress, always-visible thumb indicator,
 * and percentage display so volume changes (local, keyboard, or remote Connect)
 * are immediately and clearly reflected in the UI.
 */

import React, { useCallback } from 'react';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useThemeStore } from '@/context/useThemeStore';

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

  const safeVolume = typeof volume === 'number' && !isNaN(volume) ? volume : 0.8;
  const effectiveVol = isMuted ? 0 : safeVolume;
  const pct = Math.round(effectiveVol * 100);

  const Icon =
    isMuted || effectiveVol === 0
      ? VolumeX
      : effectiveVol < 0.5
      ? Volume1
      : Volume2;

  const iconColor = isMuted || effectiveVol === 0 ? '#FA233B' : isLight ? '#64748B' : 'rgba(255,255,255,0.7)';

  const handleVolumeChange = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
  }, [setVolume]);

  const handleMuteToggle = useCallback(() => {
    toggleMute();
  }, [toggleMute]);

  return (
    <div
      className={`group/vol flex items-center gap-2.5 ${className}`}
      title={`Volume: ${pct}%`}
    >
      {/* Mute toggle */}
      <button
        onClick={handleMuteToggle}
        className="flex-shrink-0 cursor-pointer transition-transform active:scale-90 hover:opacity-100 opacity-80"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        <Icon
          style={{ width: compact ? 14 : 16, height: compact ? 14 : 16, color: iconColor }}
        />
      </button>

      {/* Track + filled overlay + interactive thumb */}
      <div
        className="flex-1 relative flex items-center cursor-pointer"
        style={{ height: compact ? 12 : 16 }}
      >
        {/* Background track */}
        <div
          className="absolute inset-x-0 rounded-full transition-all duration-150"
          style={{
            height: compact ? 3 : 4,
            background: isLight ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.2)',
          }}
        />

        {/* Filled active portion */}
        <div
          className="absolute left-0 rounded-full pointer-events-none transition-all duration-75"
          style={{
            width: `${pct}%`,
            height: compact ? 3 : 4,
            background: isLight ? '#0F172A' : '#ffffff',
            boxShadow: isLight ? 'none' : '0 0 6px rgba(255,255,255,0.4)',
          }}
        />

        {/* Circular thumb indicator (always positioned dynamically with volume) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full pointer-events-none transition-all duration-75 shadow-[0_1px_4px_rgba(0,0,0,0.5)] group-hover/vol:scale-125"
          style={{
            left: `${pct}%`,
            width: compact ? 10 : 12,
            height: compact ? 10 : 12,
            background: isLight ? '#0F172A' : '#ffffff',
          }}
        />

        {/* Invisible native range input for accurate mouse & touch events */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={effectiveVol}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          aria-label="Volume slider"
        />
      </div>

      {/* Percentage text */}
      <span
        className="font-mono text-[10px] sm:text-[11px] font-semibold min-w-[28px] sm:min-w-[32px] text-right select-none"
        style={{ color: isLight ? '#64748B' : 'rgba(255,255,255,0.7)' }}
      >
        {isMuted ? '0%' : `${pct}%`}
      </span>
    </div>
  );
}
