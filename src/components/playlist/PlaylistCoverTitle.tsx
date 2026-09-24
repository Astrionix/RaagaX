'use client';

import React from 'react';

interface PlaylistCoverTitleProps {
  title: string;
  songCount?: number;
  size?: 'small' | 'medium' | 'large' | 'hero';
}

export function PlaylistCoverTitle({
  title,
  songCount,
  size = 'medium',
}: PlaylistCoverTitleProps) {
  if (size === 'small') {
    // For small avatar/icon sizes (e.g. 48px), show minimal single line title or stylized initial
    return (
      <div className="absolute inset-x-1.5 bottom-1.5 z-20 pointer-events-none">
        <p className="text-[10px] font-bold text-white leading-tight truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {title}
        </p>
      </div>
    );
  }

  const titleSizeClass =
    size === 'hero'
      ? 'text-2xl sm:text-3xl font-black'
      : size === 'large'
      ? 'text-lg sm:text-xl font-extrabold'
      : 'text-sm sm:text-base font-bold';

  const paddingClass =
    size === 'hero' ? 'p-6 sm:p-8' : size === 'large' ? 'p-5 sm:p-6' : 'p-3.5 sm:p-4';

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 pointer-events-none flex flex-col justify-end ${paddingClass} space-y-1`}
    >
      {/* Playlist Name: Max 2 lines with clean ellipsis */}
      <h3
        className={`text-white leading-snug tracking-tight line-clamp-2 drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)] ${titleSizeClass}`}
        title={title}
      >
        {title}
      </h3>

      {/* Optional Metadata: Clean, subtle song count */}
      {typeof songCount === 'number' && (
        <p className="text-[11px] sm:text-xs font-medium text-white/70 tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {songCount} {songCount === 1 ? 'song' : 'songs'}
        </p>
      )}
    </div>
  );
}
