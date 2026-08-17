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
import { getApiUrl } from '@/lib/config/apiConfig';

const fetcherWithCache = async (url: string) => {
  const fullUrl = getApiUrl(url);
  const urlObj = new URL(fullUrl);
  const lang = urlObj.searchParams.get('lang') || 'Telugu';
  const db = RaagaDB.getInstance();
  const cacheKey = `browse_${lang}`;

  try {
    const res = await fetch(fullUrl);
    if (!res.ok) throw new Error('Browse fetch failed');
    const data = await res.json();
    
    // Store in IndexedDB for instant loads next time (only if populated with items)
    if (data.success && data.sections?.some((s: any) => s.items && s.items.length > 0)) {
      await db.put(STORES.BROWSE_CACHE, { id: cacheKey, data, updatedAt: Date.now() });
    }
    return data;
  } catch (err) {
    // If network fails, try to return from IndexedDB
    const cached = await db.get<any>(STORES.BROWSE_CACHE, cacheKey);
    if (cached && cached.data?.sections?.some((s: any) => s.items && s.items.length > 0)) {
      return cached.data;
    }
    throw err;
  }
};

const fetcher = (url: string) => fetch(getApiUrl(url)).then(res => res.json()).catch(() => null);

export function BrowseView() {
  const { preferredLanguage, setPreferredLanguage, searchQuery, setSearchQuery } = usePlayerStore();
  
  const { data, error, isLoading, mutate } = useSWR(`/api/browse?lang=${preferredLanguage}`, fetcherWithCache, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    refreshInterval: (latestData) => {
      const isAnyLoading = latestData?.sections?.some((s: any) => s.status === 'loading');
      return isAnyLoading ? 3000 : 0;
    },
    dedupingInterval: 5000,
  });

  const { data: albumData, isLoading: albumsLoading } = useSWR(`/api/browse/albums?lang=${preferredLanguage}`, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 mins
  });

  return (
    <div className="space-y-8 pb-10 text-white select-none max-w-7xl mx-auto w-full pt-4">
      {/* Header Title */}
      <div className="flex items-center justify-between gap-4 px-4 sm:px-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#fa233b]/20 flex items-center justify-center text-[#fa233b]">
            <Compass className="w-5 h-5" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Browse</h1>
        </div>
      </div>

      {/* Browse Catalog Content */}
      <div className="space-y-8 mt-8">
        
        {error && !data && (
          <div className="w-full text-center py-16 text-slate-400 space-y-3">
            <p className="text-sm">Unable to load online catalog. Please check your internet connection.</p>
            <button
              onClick={() => mutate()}
              className="px-4 py-2 bg-[#fa233b] hover:bg-[#fa233b]/80 text-white text-xs font-bold rounded-full transition-all inline-flex items-center gap-1.5 active:scale-95 shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Playlists */}
        {data?.sections?.map((section: any) => {
          if (section.status === 'loading' && (!section.items || section.items.length === 0)) {
            return (
              <div key={section.id} className="space-y-3 px-4 sm:px-0">
                <div className="h-4 bg-white/10 rounded w-44 animate-pulse" />
                <SkeletonGrid count={5} />
              </div>
            );
          }
          
          if (!section.items || section.items.length === 0) return null;

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
