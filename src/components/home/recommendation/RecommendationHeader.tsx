'use client';

import React from 'react';
import { Headphones, Play, Shuffle } from 'lucide-react';

interface RecommendationHeaderProps {
  seedSongTitle: string;
  isLoading: boolean;
  onPlayAll: () => void;
  onShuffle: () => void;
  hasItems: boolean;
}

export function RecommendationHeader({
  seedSongTitle,
  isLoading,
  onPlayAll,
  onShuffle,
  hasItems,
}: RecommendationHeaderProps) {
  return (
    <div className="flex items-center justify-between pt-1.5 sm:pt-2 mb-3 pr-1 sm:pr-2">
      {/* Left: Icon + Title + Subtitle */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
        <div className="relative flex-shrink-0">
          <Headphones className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-cyan-400" />
          {isLoading && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#E50914] animate-pulse" />
          )}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-[18px] sm:text-[20px] font-bold leading-normal text-[var(--text-primary)] tracking-tight truncate whitespace-nowrap">
            More Like What You Heard
          </h2>
          <p
            key={seedSongTitle} // key forces re-mount → plays the fade-in animation
            className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5 truncate animate-[fadeSlideIn_0.35s_ease_both]"
          >
            {seedSongTitle
              ? `Based on "${seedSongTitle}"`
              : 'Songs inspired by your recent listening'}
          </p>
        </div>
      </div>

      {/* Right: Play All + Shuffle */}
      {hasItems && (
        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
          <button
            id="rec-play-all-btn"
            onClick={onPlayAll}
            disabled={isLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#E50914] hover:bg-[#FF1E27] text-white text-[11px] font-semibold transition-all hover:scale-105 active:scale-95 shadow-md disabled:opacity-50 cursor-pointer"
            title="Play All Recommendations"
          >
            <Play className="w-3 h-3 fill-white text-white ml-0.5" />
            <span className="hidden sm:inline">Play All</span>
          </button>
          <button
            id="rec-shuffle-btn"
            onClick={onShuffle}
            disabled={isLoading}
            className="p-1.5 sm:p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95 border border-white/10 disabled:opacity-50 cursor-pointer"
            title="Shuffle Play"
          >
            <Shuffle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
