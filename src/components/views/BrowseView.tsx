'use client';

import React, { useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CarouselShelf } from '@/components/home/CarouselShelf';
import { Search, ChevronDown, Compass, TrendingUp, Music, Sparkles, Film, Mic2, Disc } from 'lucide-react';
import { ShelfItem } from '@/types/home';
import { RaagaDB, STORES } from '@/lib/storage/IndexedDB';
import { SkeletonGrid } from '@/components/ui/SkeletonLoader';

import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';

const fetcherWithCache = async (url: string) => {
  const urlObj = new URL(url, window.location.origin);
  const lang = urlObj.searchParams.get('lang') || 'Telugu';
  const db = RaagaDB.getInstance();
  const cacheKey = `browse_${lang}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    
    // Store in IndexedDB for instant loads next time
    if (data.success) {
      await db.put(STORES.BROWSE_CACHE, { id: cacheKey, data, updatedAt: Date.now() });
    }
    return data;
  } catch (err) {
    // If network fails, try to return from IndexedDB
    const cached = await db.get<any>(STORES.BROWSE_CACHE, cacheKey);
    if (cached) return cached.data;
    throw err;
  }
};

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function BrowseView() {
  const { preferredLanguage, setPreferredLanguage, searchQuery, setSearchQuery } = usePlayerStore();
  
  const { data, error, isLoading } = useSWR(`/api/browse?lang=${preferredLanguage}`, fetcherWithCache, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const { data: albumData, isLoading: albumsLoading } = useSWR(`/api/browse/albums?lang=${preferredLanguage}`, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 mins
  });

  return (
    <div className="space-y-8 pb-10 text-white select-none max-w-7xl mx-auto w-full pt-4">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 sm:px-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#fa233b]/20 flex items-center justify-center text-[#fa233b]">
            <Compass className="w-5 h-5" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Browse</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim() !== '') {
                  usePlayerStore.getState().setActiveTab('search');
                }
              }}
              placeholder="Search music, artists, albums..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-400 focus:bg-white/10 focus:border-[#fa233b] focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Browse Catalog Content */}
      <div className="space-y-8 mt-8">
        
        {error && !data && (
          <div className="w-full text-center py-20 text-red-400">
            Failed to load catalog. Please try again.
          </div>
        )}

        {/* Playlists */}
        {data?.sections?.map((section: any) => {
          if (section.status === 'loading') {
            return (
              <div key={section.id} className="space-y-3 px-4 sm:px-0">
                <div className="h-4 bg-white/10 rounded w-44 animate-pulse" />
                <SkeletonGrid count={5} />
              </div>
            );
          }
          
          if (section.items?.length === 0) return null;

          return (
            <CarouselShelf 
              key={section.id}
              title={section.title} 
              pagination={{
                enabled: true,
                source: {
                  type: 'spotify_playlist',
                  id: section.sourceId
                },
                initialHasMore: section.hasMore,
                total: section.total
              }}
              showPlayAll={true}
              icon={
                section.id === 'trending' ? <TrendingUp className="w-5 h-5 text-[#fa233b]" /> :
                section.id === 'new_releases' ? <Sparkles className="w-5 h-5 text-[#fa233b]" /> :
                section.id === 'classics' ? <Disc className="w-5 h-5 text-[#fa233b]" /> :
                <Disc className="w-5 h-5 text-[#fa233b]" />
              }
              items={section.items} 
            />
          );
        })}

        {/* Albums */}
        {albumsLoading && !albumData && (
          <div className="space-y-3 px-4 sm:px-0">
            <div className="h-4 bg-white/10 rounded w-44 animate-pulse" />
            <SkeletonGrid count={5} />
          </div>
        )}

        {albumData?.sections?.map((section: any) => (
          <CarouselShelf 
            key={section.id}
            title={section.title} 
            showPlayAll={false}
            icon={<Film className="w-5 h-5 text-[#fa233b]" />}
            items={section.items} 
          />
        ))}

        {/* Global Loading state ONLY if no data exists yet */}
        {isLoading && !data && (
          <div className="space-y-8 pt-4 px-4 sm:px-0">
            <div className="space-y-3">
              <div className="h-4 bg-white/10 rounded w-44 animate-pulse" />
              <SkeletonGrid count={5} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
