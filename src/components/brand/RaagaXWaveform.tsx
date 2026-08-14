'use client';

import React from 'react';

export type WaveformState = 
  | 'idle'
  | 'loading'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'error'
  | 'offline';

interface RaagaXWaveformProps {
  state?: WaveformState;
  barCount?: number;
  height?: number;
  className?: string;
}

export function RaagaXWaveform({
  state = 'playing',
  barCount = 7,
  height = 20,
  className = '',
}: RaagaXWaveformProps) {
  // Height ratios for visualizer curve (symmetrical envelope)
  const defaultRatios = [0.35, 0.6, 0.85, 1.0, 0.85, 0.6, 0.35];

  // Dynamic color depending on state
  const getBarColor = () => {
    switch (state) {
      case 'playing':
        return 'bg-[#F20D18] shadow-[0_0_8px_rgba(242,13,24,0.4)]';
      case 'buffering':
        return 'bg-[#FF252D]/80';
      case 'paused':
        return 'bg-[#F20D18]/70';
      case 'loading':
        return 'bg-slate-400 animate-pulse';
      case 'error':
        return 'bg-[#700008]';
      case 'offline':
        return 'bg-slate-500/50';
      case 'idle':
      default:
        return 'bg-slate-400/40';
    }
  };

  return (
    <div
      style={{ height: `${height}px` }}
      className={`inline-flex items-end justify-center gap-[2.5px] select-none ${className}`}
      aria-label={`Waveform state: ${state}`}
    >
      {Array.from({ length: barCount }).map((_, index) => {
        const ratio = defaultRatios[index % defaultRatios.length] || 0.5;
        const barHeight = Math.max(4, Math.round(height * ratio));

        // State animations
        let animationStyle: React.CSSProperties = {};
        if (state === 'playing') {
          animationStyle = {
            animation: `rxWaveBounce 0.9s ease-in-out infinite alternate`,
            animationDelay: `${index * 0.12}s`,
            height: `${barHeight}px`,
          };
        } else if (state === 'buffering') {
          animationStyle = {
            animation: `rxWavePulse 1.2s ease-in-out infinite alternate`,
            animationDelay: `${index * 0.15}s`,
            height: `${Math.round(height * 0.6)}px`,
          };
        } else {
          animationStyle = {
            height: `${barHeight}px`,
          };
        }

        return (
          <div
            key={index}
            style={animationStyle}
            className={`w-[3px] rounded-full transition-all duration-300 ${getBarColor()}`}
          />
        );
      })}
    </div>
  );
}
