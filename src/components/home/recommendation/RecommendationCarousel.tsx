'use client';

import React from 'react';
import { RecommendationResult, FeedbackSignal } from '@/types/recommendation';
import { RecommendationSongCard } from './RecommendationSongCard';

interface RecommendationCarouselProps {
  results: RecommendationResult[];
  currentSongId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  onPlay: (result: RecommendationResult) => void;
  onFeedback: (signal: FeedbackSignal, result: RecommendationResult) => void;
  removingIds: Set<string>;
}

const SKELETON_COUNT = 8;

export function RecommendationCarousel({
  results,
  currentSongId,
  isPlaying,
  isLoading,
  onPlay,
  onFeedback,
  removingIds,
}: RecommendationCarouselProps) {
  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading && results.length === 0) {
    return (
      <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pt-2 pb-3 sm:pt-2.5 sm:pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[140px] sm:w-[164px] rounded-2xl p-2.5 sm:p-3 bg-white/4 border border-white/6 animate-pulse"
          >
            <div className="w-full aspect-square rounded-xl bg-white/8 mb-2.5" />
            <div className="h-3 w-3/4 rounded bg-white/8 mb-1.5" />
            <div className="h-2.5 w-1/2 rounded bg-white/6" />
          </div>
        ))}
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!isLoading && results.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 rounded-2xl border border-white/6 bg-white/3">
        <div className="text-center">
          <p className="text-slate-400 text-sm font-medium">No recommendations yet</p>
          <p className="text-slate-600 text-xs mt-1">Play a song to generate personalized suggestions</p>
        </div>
      </div>
    );
  }

  // ── Full carousel ────────────────────────────────────────────────────────
  return (
    <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pt-2 pb-3 sm:pt-2.5 sm:pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
      {results.map((result) => (
        <RecommendationSongCard
          key={result.id}
          result={result}
          isCurrentlyPlaying={result.id === currentSongId}
          isPlaying={isPlaying}
          onPlay={onPlay}
          onFeedback={onFeedback}
          isRemoving={removingIds.has(result.id)}
        />
      ))}

      {/* Trailing skeleton cards when refreshing mid-session */}
      {isLoading && (
        <>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`loading-${i}`}
              className="flex-shrink-0 w-[140px] sm:w-[164px] rounded-2xl p-2.5 sm:p-3 bg-white/4 border border-white/6 animate-pulse"
            >
              <div className="w-full aspect-square rounded-xl bg-white/8 mb-2.5" />
              <div className="h-3 w-3/4 rounded bg-white/8 mb-1.5" />
              <div className="h-2.5 w-1/2 rounded bg-white/6" />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
