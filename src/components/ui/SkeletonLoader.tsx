'use client';

import React from 'react';

export function SkeletonCard() {
  return (
    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-3 animate-pulse">
      <div className="w-full aspect-square rounded-xl bg-white/10" />
      <div className="h-3 bg-white/10 rounded w-3/4" />
      <div className="h-2 bg-white/5 rounded w-1/2" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between animate-pulse">
      <div className="flex items-center gap-3.5 flex-1">
        <div className="w-12 h-12 rounded-xl bg-white/10 flex-shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 bg-white/10 rounded w-1/3" />
          <div className="h-2 bg-white/5 rounded w-1/4" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
