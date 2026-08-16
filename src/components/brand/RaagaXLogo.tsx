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

/**
 * RaagaX Master Symbol (2026 Core Identity)
 * Intelligent geometric combination of:
 * - Letter 'R'
 * - Sound wave / acoustic frequency bars
 * - Inner play-button playback trigger
 * - Kinetic forward-motion velocity kick
 */
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

  // Micro Favicon / Minimal Version (16px - 28px)
  if (variant === 'micro') {
    return (
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none ${className}`}
        aria-label="RaagaX Micro Icon"
      >
        <rect x="20" y="18" width="12" height="64" rx="6" fill={isDark ? '#FFFFFF' : '#0F172A'} />
        <path d="M38 18H58C71.2548 18 82 28.7452 82 42C82 55.2548 71.2548 66 58 66H38V18Z" fill="#E50914" />
        <path d="M50 31L66 42L50 53V31Z" fill={isDark ? '#060709' : '#FFFFFF'} />
        <path d="M46 59L68 82H84L60 55C55 55 50 57 46 59Z" fill="#FF1E27" />
      </svg>
    );
  }

  // Monochrome Single Tone Variants
  if (variant === 'monochrome-red' || variant === 'monochrome-black' || variant === 'monochrome-white') {
    const monoFill = 
      variant === 'monochrome-red' ? '#E50914' :
      variant === 'monochrome-black' ? '#0F172A' : '#FFFFFF';

    return (
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none ${className}`}
        aria-label="RaagaX Monochrome Symbol"
      >
        <rect x="20" y="18" width="12" height="64" rx="6" fill={monoFill} />
        <path d="M38 18H58C71.2548 18 82 28.7452 82 42C82 55.2548 71.2548 66 58 66H38V18Z" fill={monoFill} />
        <path d="M50 31L66 42L50 53V31Z" fill={variant === 'monochrome-white' ? '#000000' : '#FFFFFF'} />
        <path d="M46 59L68 82H84L60 55C55 55 50 57 46 59Z" fill={monoFill} />
      </svg>
    );
  }

  // Flat Minimal Vector (No filters)
  if (variant === 'flat') {
    return (
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none ${className}`}
        aria-label="RaagaX Flat Symbol"
      >
        <rect x="20" y="18" width="12" height="64" rx="6" fill={isDark ? '#FFFFFF' : '#0F172A'} />
        <path d="M38 18H58C71.2548 18 82 28.7452 82 42C82 55.2548 71.2548 66 58 66H38V18Z" fill="#E50914" />
        <path d="M50 31L66 42L50 53V31Z" fill={isDark ? '#060709' : '#FFFFFF'} />
        <path d="M46 59L68 82H84L60 55C55 55 50 57 46 59Z" fill="#FF1E27" />
      </svg>
    );
  }

  // Primary Full Master Identity (Rich Gradients & Dynamic Atmospheric Glow)
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
        className="w-full h-full"
        aria-label="RaagaX Master Brand Emblem"
      >
        <defs>
          <linearGradient id="rxRedGlowGrad" x1="20" y1="18" x2="84" y2="82" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF2E38" />
            <stop offset="0.6" stopColor="#E50914" />
            <stop offset="1" stopColor="#A80008" />
          </linearGradient>

          <filter id="rxSymbolGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow 
              dx="0" 
              dy="4" 
              stdDeviation="5" 
              floodColor="#E50914" 
              floodOpacity={isDark ? 0.45 : 0.2} 
            />
          </filter>
        </defs>

        {/* 1. Left Vertical Soundwave Stem of 'R' */}
        <rect 
          x="20" 
          y="18" 
          width="12" 
          height="64" 
          rx="6" 
          fill={isDark ? '#FFFFFF' : '#0F172A'} 
        />

        {/* 2. Upper Sound Resonance Arc (Letter R Loop) with Glow */}
        <path 
          d="M38 18H58C71.2548 18 82 28.7452 82 42C82 55.2548 71.2548 66 58 66H38V18Z" 
          fill="url(#rxRedGlowGrad)" 
          filter="url(#rxSymbolGlow)"
        />

        {/* 3. Integrated Inner Play Triad Negative */}
        <path 
          d="M50 31L66 42L50 53V31Z" 
          fill={isDark ? '#060709' : '#FFFFFF'} 
        />

        {/* 4. Kinetic Forward Motion Kick */}
        <path 
          d="M46 59L68 82H84L60 55C55 55 50 57 46 59Z" 
          fill="#FF1E27" 
          filter="url(#rxSymbolGlow)"
        />
      </svg>
    </div>
  );
}
