'use client';

import React from 'react';
import { Music, WifiOff, SearchX, Disc3 } from 'lucide-react';

export function SongCardSkeleton() {
  return (
    <div className="p-3.5 rounded-2xl bg-[#161618] border border-white/5 flex items-center justify-between animate-pulse">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-white/10" />
        <div className="space-y-2">
          <div className="w-32 h-3.5 rounded bg-white/10" />
          <div className="w-20 h-2.5 rounded bg-white/5" />
        </div>
      </div>
      <div className="w-8 h-8 rounded-full bg-white/10" />
    </div>
  );
}

export function AlbumCardSkeleton() {
  return (
    <div className="min-w-[140px] max-w-[140px] space-y-3 animate-pulse">
      <div className="w-[140px] h-[140px] rounded-2xl bg-white/10" />
      <div className="space-y-1.5">
        <div className="w-24 h-3.5 rounded bg-white/10" />
        <div className="w-16 h-2.5 rounded bg-white/5" />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  subtitle,
  type = 'empty',
}: {
  title: string;
  subtitle: string;
  type?: 'empty' | 'offline' | 'search';
}) {
  return (
    <div className="py-16 text-center space-y-4 max-w-sm mx-auto select-none">
      <div className="w-16 h-16 rounded-3xl bg-[#EF233C]/10 border border-[#EF233C]/20 flex items-center justify-center mx-auto text-[#EF233C] shadow-lg">
        {type === 'offline' ? (
          <WifiOff className="w-8 h-8" />
        ) : type === 'search' ? (
          <SearchX className="w-8 h-8" />
        ) : (
          <Music className="w-8 h-8" />
        )}
      </div>
      <div>
        <h3 className="text-base font-extrabold text-white">{title}</h3>
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
