'use client';

import React, { useId } from 'react';
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
 * Raaga Music Icon (RaagaX Master Brand Symbol)
 * Neon glowing music note with circle head and vertical-diagonal stem
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
  const rawId = useId();
  const idPrefix = rawId.replace(/:/g, '');

  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  // Micro Favicon / Minimal Version (16px - 28px)
  if (variant === 'micro') {
    return (
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none ${className}`}
        aria-label="Raaga Music Micro Icon"
      >
        <g fill="none" stroke="#ff3157" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="220" cy="326" r="42" />
          <path d="M 262 326 L 262 178 L 330 216" />
        </g>
      </svg>
    );
  }

  // Monochrome Single Tone Variants
  if (variant === 'monochrome-red' || variant === 'monochrome-black' || variant === 'monochrome-white') {
    const monoStroke = 
      variant === 'monochrome-red' ? '#ff3157' :
      variant === 'monochrome-black' ? '#0F172A' : '#FFFFFF';

    return (
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none ${className}`}
        aria-label="Raaga Music Monochrome Symbol"
      >
        <g fill="none" stroke={monoStroke} strokeWidth="20" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="220" cy="326" r="42" />
          <path d="M 262 326 L 262 178 L 330 216" />
        </g>
      </svg>
    );
  }

  // Flat Minimal Vector (No filters)
  if (variant === 'flat') {
    const gradId = `neon-${idPrefix}`;
    return (
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none ${className}`}
        aria-label="Raaga Music Flat Symbol"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff3157" />
            <stop offset="50%" stopColor="#ff174f" />
            <stop offset="100%" stopColor="#ff3157" />
          </linearGradient>
        </defs>
        <g fill="none" stroke={`url(#${gradId})`} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="220" cy="326" r="42" />
          <path d="M 262 326 L 262 178 L 330 216" />
        </g>
      </svg>
    );
  }

  // Primary Full Master Identity (Neon Gradient + Dynamic Atmospheric Glow)
  const gradId = `neon-${idPrefix}`;
  const glowId = `glow-${idPrefix}`;

  return (
    <div
      style={{ width: pixelSize, height: pixelSize }}
      className={`relative inline-flex items-center justify-center select-none flex-shrink-0 ${className} ${
        animated ? 'animate-in fade-in zoom-in-95 duration-500' : ''
      }`}
    >
      <svg
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        aria-label="Raaga Music Master Brand Emblem"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff3157" />
            <stop offset="50%" stopColor="#ff174f" />
            <stop offset="100%" stopColor="#ff3157" />
          </linearGradient>

          <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Music Note Glow Layer */}
        <g
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${glowId})`}
        >
          <circle cx="220" cy="326" r="42" />
          <path d="M 262 326 L 262 178 L 330 216" />
        </g>

        {/* Clean Note Layer */}
        <g
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="220" cy="326" r="42" />
          <path d="M 262 326 L 262 178 L 330 216" />
        </g>
      </svg>
    </div>
  );
}
