'use client';

import React from 'react';
import { useThemeStore } from '@/context/useThemeStore';

export type LogoVariant = 
  | 'full'
  | 'flat'
  | 'monochrome-red'
  | 'monochrome-black'
  | 'monochrome-white'
  | 'micro';

interface RaagaXLogoProps {
  variant?: LogoVariant;
  size?: number | string;
  className?: string;
  themeOverride?: 'light' | 'dark';
  animated?: boolean;
}

export function RaagaXLogo({
  variant = 'full',
  size = 40,
  className = '',
  themeOverride,
  animated = false,
}: RaagaXLogoProps) {
  const { resolvedTheme } = useThemeStore();
  const theme = themeOverride || resolvedTheme;
  const isDark = theme === 'dark';

  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  // Variant F: Micro Mark for Favicon / 16-24px UI
  if (variant === 'micro') {
    return (
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none ${className}`}
        aria-label="RaagaX Icon"
      >
        <circle cx="24" cy="24" r="22" fill={isDark ? '#050505' : '#FFFFFF'} />
        {/* Outer Motion Crescent */}
        <path
          d="M 24 4 A 20 20 0 0 1 44 24 A 20 20 0 0 1 30 42 C 38 38 40 28 36 20 C 32 12 24 8 24 4 Z"
          fill={isDark ? '#171717' : '#CFCFCF'}
        />
        {/* Flowing Note Ribbon */}
        <path
          d="M 24 4 C 14 4 6 12 6 22 C 6 29 11 34 16 38 C 15 39.5 13 41 13 41 C 21 41 27 34 27 27 C 27 18 20 12 24 4 Z"
          fill="#F20D18"
        />
        {/* Note Head */}
        <circle cx="20" cy="34" r="5" fill="#F20D18" />
        {/* Waveform Micro Bars */}
        <rect x="28" y="20" width="2" height="8" rx="1" fill="#F20D18" />
        <rect x="32" y="17" width="2" height="14" rx="1" fill="#F20D18" />
        <rect x="36" y="21" width="2" height="6" rx="1" fill="#F20D18" />
      </svg>
    );
  }

  // Monochrome Variants
  if (variant === 'monochrome-red' || variant === 'monochrome-black' || variant === 'monochrome-white') {
    const monoFill = 
      variant === 'monochrome-red' ? '#F20D18' :
      variant === 'monochrome-black' ? '#171717' : '#FFFFFF';

    return (
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none ${className}`}
        aria-label="RaagaX Symbol"
      >
        {/* Continuity Ring */}
        <path
          d="M 50 10 A 40 40 0 0 1 90 50 A 40 40 0 0 1 65 86 C 80 78 84 60 76 44 C 68 28 52 18 50 10 Z"
          fill={monoFill}
          fillOpacity="0.4"
        />
        {/* Flowing Ribbon Note */}
        <path
          d="M 50 10 C 28 10 12 26 12 48 C 12 62 22 72 32 80 C 30 83 26 86 26 86 C 42 86 54 72 54 58 C 54 38 40 26 50 10 Z"
          fill={monoFill}
        />
        {/* Central Note Head */}
        <circle cx="40" cy="72" r="10" fill={monoFill} />
        {/* Integrated Equalizer Waveform */}
        <g fill={monoFill}>
          <rect x="58" y="44" width="3.5" height="12" rx="1.75" />
          <rect x="64" y="38" width="3.5" height="24" rx="1.75" />
          <rect x="70" y="32" width="3.5" height="36" rx="1.75" />
          <rect x="76" y="38" width="3.5" height="24" rx="1.75" />
          <rect x="82" y="44" width="3.5" height="12" rx="1.75" />
        </g>
      </svg>
    );
  }

  // Flat Variant (Minimal vectors, no heavy shadows/gradients)
  if (variant === 'flat') {
    return (
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none ${className}`}
        aria-label="RaagaX Flat Emblem"
      >
        {/* Secondary Continuity Arc */}
        <path
          d="M 50 10 A 40 40 0 0 1 90 50 A 40 40 0 0 1 65 86 C 80 78 84 60 76 44 C 68 28 52 18 50 10 Z"
          fill={isDark ? '#171717' : '#CFCFCF'}
        />
        {/* Primary Flowing Red Shape */}
        <path
          d="M 50 10 C 28 10 12 26 12 48 C 12 62 22 72 32 80 C 30 83 26 86 26 86 C 42 86 54 72 54 58 C 54 38 40 26 50 10 Z"
          fill="#F20D18"
        />
        {/* Note Head */}
        <circle cx="40" cy="72" r="10" fill="#F20D18" />
        {/* Waveform Equalizer */}
        <g fill="#F20D18">
          <rect x="58" y="44" width="3.5" height="12" rx="1.75" />
          <rect x="64" y="38" width="3.5" height="24" rx="1.75" />
          <rect x="70" y="32" width="3.5" height="36" rx="1.75" />
          <rect x="76" y="38" width="3.5" height="24" rx="1.75" />
          <rect x="82" y="44" width="3.5" height="12" rx="1.75" />
        </g>
      </svg>
    );
  }

  // Variant A: Primary Full Logo (Rich Gradients, 3D Depth, Brand Red Motion Spectrum)
  return (
    <div
      style={{ width: pixelSize, height: pixelSize }}
      className={`relative inline-flex items-center justify-center select-none flex-shrink-0 ${className} ${
        animated ? 'animate-in fade-in zoom-in-95 duration-500' : ''
      }`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
        aria-label="RaagaX Master Brand Emblem"
      >
        <defs>
          {/* Brand Red Motion Gradient: #8F0008 -> #C9000D -> #F20D18 -> #FF252D */}
          <linearGradient id="rxRedMotion" x1="12" y1="10" x2="80" y2="86" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF252D" />
            <stop offset="35%" stopColor="#F20D18" />
            <stop offset="70%" stopColor="#C9000D" />
            <stop offset="100%" stopColor="#8F0008" />
          </linearGradient>

          {/* Deep Red for Note Head & Shadow Accents */}
          <radialGradient id="rxNoteHead" cx="40" cy="72" r="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF2028" />
            <stop offset="70%" stopColor="#F20D18" />
            <stop offset="100%" stopColor="#700008" />
          </radialGradient>

          {/* Silver/Charcoal Continuity Ring Gradient */}
          <linearGradient id="rxContinuityRing" x1="50" y1="10" x2="85" y2="85" gradientUnits="userSpaceOnUse">
            {isDark ? (
              <>
                <stop offset="0%" stopColor="#171717" />
                <stop offset="50%" stopColor="#303030" />
                <stop offset="100%" stopColor="#666666" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="40%" stopColor="#E8E8E8" />
                <stop offset="100%" stopColor="#CFCFCF" />
              </>
            )}
          </linearGradient>

          {/* Waveform Equalizer Gradient */}
          <linearGradient id="rxWaveform" x1="70" y1="32" x2="70" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF252D" />
            <stop offset="50%" stopColor="#F20D18" />
            <stop offset="100%" stopColor="#B4000A" />
          </linearGradient>

          {/* Ambient Glow Filter */}
          <filter id="rxGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#F20D18" floodOpacity={isDark ? "0.35" : "0.15"} />
          </filter>
        </defs>

        {/* Ambient Glow */}
        <circle cx="50" cy="50" r="44" fill="none" filter="url(#rxGlow)" />

        {/* 1. Secondary Continuity Ring / Device Flow */}
        <path
          d="M 50 10 A 40 40 0 0 1 90 50 A 40 40 0 0 1 65 86 C 80 78 84 60 76 44 C 68 28 52 18 50 10 Z"
          fill="url(#rxContinuityRing)"
          stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}
          strokeWidth="0.5"
        />

        {/* 2. Primary Flowing Crimson Ribbon */}
        <path
          d="M 50 10 C 28 10 12 26 12 48 C 12 62 22 72 32 80 C 30 83 26 86 26 86 C 42 86 54 72 54 58 C 54 38 40 26 50 10 Z"
          fill="url(#rxRedMotion)"
        />

        {/* 3. Central Note Head */}
        <circle cx="40" cy="72" r="10.5" fill="url(#rxNoteHead)" />

        {/* 4. Integrated 5-Bar Waveform / Sound Equalizer */}
        <g fill="url(#rxWaveform)">
          <rect x="58" y="44" width="3.5" height="12" rx="1.75" />
          <rect x="64" y="38" width="3.5" height="24" rx="1.75" />
          <rect x="70" y="32" width="3.5" height="36" rx="1.75" />
          <rect x="76" y="38" width="3.5" height="24" rx="1.75" />
          <rect x="82" y="44" width="3.5" height="12" rx="1.75" />
        </g>
      </svg>
    </div>
  );
}
