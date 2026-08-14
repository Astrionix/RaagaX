'use client';

import React from 'react';

interface RaagaXWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  tagline?: string;
  subEdition?: string;
}

export function RaagaXWordmark({
  className = '',
  size = 'md',
  showTagline = false,
  tagline = 'Music That Moves With You',
  subEdition,
}: RaagaXWordmarkProps) {
  const sizeClasses = {
    sm: 'text-sm tracking-wider',
    md: 'text-base tracking-widest',
    lg: 'text-xl tracking-widest',
    xl: 'text-3xl tracking-widest',
  }[size];

  return (
    <div className={`inline-flex flex-col select-none ${className}`}>
      <div className={`font-black font-sans leading-none flex items-baseline ${sizeClasses}`}>
        <span className="text-[var(--text-primary)]">RAAGA</span>
        <span className="text-[#F20D18]">X</span>
      </div>

      {subEdition && (
        <span className="text-[9px] font-bold text-[#F20D18] uppercase tracking-widest leading-none mt-1">
          {subEdition}
        </span>
      )}

      {showTagline && (
        <span className="text-[11px] font-medium text-slate-400 tracking-normal mt-1">
          {tagline}
        </span>
      )}
    </div>
  );
}
