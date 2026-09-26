'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

interface HomeLoadingSkeletonProps {
  greeting?: string;
}

export function HomeLoadingSkeleton({ greeting = 'Welcome to RaagaX' }: HomeLoadingSkeletonProps) {
  return (
    <div className="space-y-7 pb-8 select-none w-full animate-in fade-in duration-500" suppressHydrationWarning>
      {/* ── 1. Luxury Header & Greeting Bar ───────────────────────────────── */}
      <div className="pt-2 flex flex-col gap-1.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] backdrop-blur-md w-fit">
          <Sparkles className="w-3.5 h-3.5 text-[#FA233B] animate-pulse" />
          <span className="text-xs font-semibold text-white/90 tracking-wide" suppressHydrationWarning>
            {greeting}
          </span>
        </div>
        <div className="h-4 w-44 sm:w-56 rounded-md bg-white/[0.04] luxury-shimmer mt-1" />
      </div>

      {/* ── 2. Shelf 1: "Your Playlists" Carousel Mirror ─────────────────── */}
      <div className="space-y-3">
        {/* Shelf Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-white/[0.06] luxury-shimmer" />
            <div className="h-4 w-32 rounded-md bg-white/[0.08] luxury-shimmer" />
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-white/[0.04] luxury-shimmer" />
            <div className="w-7 h-7 rounded-full bg-white/[0.04] luxury-shimmer" />
          </div>
        </div>

        {/* Horizontal Carousel Row */}
        <div className="flex gap-3 sm:gap-4 overflow-x-hidden no-scrollbar pt-1 pb-3 -mx-3.5 px-3.5 sm:-mx-8 sm:px-8">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={`skel-shelf-1-${i}`}
              className="p-3 sm:p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] w-[140px] sm:w-[172px] flex-shrink-0 space-y-2.5"
            >
              {/* Artwork Square */}
              <div className="relative w-full aspect-square rounded-xl bg-white/[0.05] luxury-shimmer overflow-hidden shadow-inner" />
              {/* Title Pill */}
              <div className="h-3 w-4/5 rounded-md bg-white/[0.07] luxury-shimmer" />
              {/* Subtitle Pill */}
              <div className="h-2.5 w-1/2 rounded-md bg-white/[0.04] luxury-shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Shelf 2: "Popular in Your Language" Carousel Mirror ───────── */}
      <div className="space-y-3">
        {/* Shelf Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-white/[0.06] luxury-shimmer" />
            <div className="h-4 w-40 rounded-md bg-white/[0.08] luxury-shimmer" />
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-white/[0.04] luxury-shimmer" />
            <div className="w-7 h-7 rounded-full bg-white/[0.04] luxury-shimmer" />
          </div>
        </div>

        {/* Horizontal Carousel Row */}
        <div className="flex gap-3 sm:gap-4 overflow-x-hidden no-scrollbar pt-1 pb-3 -mx-3.5 px-3.5 sm:-mx-8 sm:px-8">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={`skel-shelf-2-${i}`}
              className="p-3 sm:p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] w-[140px] sm:w-[172px] flex-shrink-0 space-y-2.5"
            >
              {/* Artwork Square */}
              <div className="relative w-full aspect-square rounded-xl bg-white/[0.05] luxury-shimmer overflow-hidden shadow-inner" />
              {/* Title Pill */}
              <div className="h-3 w-3/4 rounded-md bg-white/[0.07] luxury-shimmer" />
              {/* Subtitle Pill */}
              <div className="h-2.5 w-3/5 rounded-md bg-white/[0.04] luxury-shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. Shelf 3: "Recommended Playlists" Carousel Mirror ──────────── */}
      <div className="space-y-3">
        {/* Shelf Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-white/[0.06] luxury-shimmer" />
            <div className="h-4 w-48 rounded-md bg-white/[0.08] luxury-shimmer" />
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-white/[0.04] luxury-shimmer" />
            <div className="w-7 h-7 rounded-full bg-white/[0.04] luxury-shimmer" />
          </div>
        </div>

        {/* Horizontal Carousel Row */}
        <div className="flex gap-3 sm:gap-4 overflow-x-hidden no-scrollbar pt-1 pb-3 -mx-3.5 px-3.5 sm:-mx-8 sm:px-8">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={`skel-shelf-3-${i}`}
              className="p-3 sm:p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] w-[140px] sm:w-[172px] flex-shrink-0 space-y-2.5"
            >
              {/* Artwork Square */}
              <div className="relative w-full aspect-square rounded-xl bg-white/[0.05] luxury-shimmer overflow-hidden shadow-inner" />
              {/* Title Pill */}
              <div className="h-3 w-2/3 rounded-md bg-white/[0.07] luxury-shimmer" />
              {/* Subtitle Pill */}
              <div className="h-2.5 w-1/2 rounded-md bg-white/[0.04] luxury-shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
