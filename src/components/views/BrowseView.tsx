'use client';

import React, { useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CarouselShelf } from '@/components/home/CarouselShelf';
import { Search, ChevronDown, Compass, TrendingUp, Music, Sparkles, Film, Mic2, Disc } from 'lucide-react';
import { ShelfItem } from '@/types/home';

const LANGUAGES = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English', 'All Languages'];

import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function BrowseView() {
  const { preferredLanguage, setPreferredLanguage, searchQuery, setSearchQuery } = usePlayerStore();
  
  const [browseLang, setBrowseLang] = useState(preferredLanguage || 'Telugu');

  const { data, error, isLoading } = useSWR(`/api/browse?lang=${browseLang}`, fetcher);

  return (
    <div className="space-y-8 pb-10 text-white select-none max-w-7xl mx-auto w-full pt-4">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#fa233b]/20 flex items-center justify-center text-[#fa233b]">
            <Compass className="w-5 h-5" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Browse</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Search Input for Browse */}
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

          {/* Language Selector */}
          <div className="relative group">
            <select
              value={browseLang}
              onChange={(e) => {
                setBrowseLang(e.target.value);
                if (e.target.value !== 'All Languages') {
                  setPreferredLanguage(e.target.value);
                }
              }}
              className="appearance-none bg-[#fa233b] text-white font-bold text-sm py-2 pl-4 pr-10 rounded-xl cursor-pointer hover:bg-[#d91e32] transition-colors focus:outline-none"
            >
              {LANGUAGES.map(lang => (
                <option key={lang} value={lang} className="bg-[#161618] text-white">
                  {lang}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Browse Catalog Content */}
      <div className="space-y-8 mt-8">
        
        {isLoading && (
          <div className="w-full flex flex-col items-center justify-center py-20 opacity-50">
            <RefreshCw className="w-8 h-8 animate-spin text-[#fa233b] mb-4" />
            <p className="text-sm font-medium text-slate-400">Discovering real albums...</p>
          </div>
        )}

        {error && (
          <div className="w-full text-center py-20 text-red-400">
            Failed to load catalog. Please try again.
          </div>
        )}

        {!isLoading && !error && data?.sections && data.sections.map((section: any) => (
          <CarouselShelf 
            key={section.id}
            title={section.title} 
            showPlayAll={true}
            icon={
              section.id === 'trending' ? <TrendingUp className="w-5 h-5 text-[#fa233b]" /> :
              section.id === 'new_releases' ? <Sparkles className="w-5 h-5 text-[#fa233b]" /> :
              section.id === 'charts' ? <TrendingUp className="w-5 h-5 text-[#fa233b]" /> :
              section.id === 'moods' ? <Music className="w-5 h-5 text-[#fa233b]" /> :
              section.id === 'movies' ? <Film className="w-5 h-5 text-[#fa233b]" /> :
              <Disc className="w-5 h-5 text-[#fa233b]" />
            }
            items={section.items} 
          />
        ))}
      </div>
    </div>
  );
}
