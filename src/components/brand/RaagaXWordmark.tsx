'use client';

import React from 'react';

interface RaagaXWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showTagline?: boolean;
  tagline?: string;
  subEdition?: string;
  themeOverride?: 'light' | 'dark';
}

/**
 * RaagaX Wordmark (2026 Core Identity)
 * - Lowercase "raagax"
 * - Signature crimson red "x" accent
 * - Tagline: "FEEL EVERY NOTE"
 */
export function RaagaXWordmark({
  className = '',
  size = 'md',
  showTagline = false,
  tagline = 'FEEL EVERY NOTE',
  subEdition,
  themeOverride,
}: RaagaXWordmarkProps) {
  const sizeClasses = {
    sm: 'text-sm tracking-tight',
    md: 'text-lg tracking-tight',
    lg: 'text-2xl tracking-tight',
    xl: 'text-3xl tracking-tight',
    '2xl': 'text-4xl tracking-tight',
  }[size];

  return (
    <div className={`inline-flex flex-col select-none ${className}`}>
      <div className={`font-black font-display leading-none flex items-baseline ${sizeClasses}`}>
        <span className="text-[var(--text-primary)]">raaga</span>
        <span className="text-[#E50914] drop-shadow-[0_0_12px_rgba(229,9,20,0.65)]">x</span>
      </div>

      {subEdition && (
        <span className="text-[9px] font-mono font-bold text-[#E50914] uppercase tracking-widest leading-none mt-1">
          {subEdition}
        </span>
      )}

      {showTagline && (
        <span className="text-[9px] sm:text-[10px] font-display font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)] opacity-80 mt-1">
          {tagline}
        </span>
      )}
    </div>
  );
}
