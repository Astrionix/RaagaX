'use client';

import React, { useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CarouselShelf } from '@/components/home/CarouselShelf';
import { Search, ChevronDown, Compass, TrendingUp, Music, Sparkles, Film, Mic2, Disc } from 'lucide-react';
import { ShelfItem } from '@/types/home';

const LANGUAGES = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English', 'All Languages'];

export function BrowseView() {
  const { preferredLanguage, setPreferredLanguage, searchQuery, setSearchQuery } = usePlayerStore();
  
  // You can decouple this from global preferredLanguage if you want it to be distinct,
  // but updating preferredLanguage is a nice way to globally pivot the app.
  const [browseLang, setBrowseLang] = useState(preferredLanguage);

  // Generate Mock Data for Shelves
  const generateMocks = (prefix: string, type: 'song' | 'playlist' | 'album' | 'artist', count: number = 10) => {
    return Array.from({ length: count }).map((_, i) => ({
      id: `${prefix}_${i}`,
      title: `${browseLang === 'All Languages' ? 'Global' : browseLang} ${prefix} ${i + 1}`,
      subtitle: type === 'song' ? 'Artist Name' : 'RaagaX',
      type: type,
      imageUrl: `https://picsum.photos/seed/${browseLang}${prefix}${i}/300/300`
    })) as ShelfItem[];
  };

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
              onChange={(e) => setSearchQuery(e.target.value)}
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
        
        <div className="flex items-center gap-2 mb-[-1.5rem]">
          <TrendingUp className="w-5 h-5 text-[#fa233b]" />
          <h2 className="text-xl font-bold">Trending</h2>
        </div>
        <CarouselShelf title="" items={generateMocks('Trending', 'song', 15)} />

        <div className="flex items-center gap-2 mb-[-1.5rem]">
          <Sparkles className="w-5 h-5 text-[#fa233b]" />
          <h2 className="text-xl font-bold">New Releases</h2>
        </div>
        <CarouselShelf title="" items={generateMocks('New Release', 'song', 15)} />

        <div className="flex items-center gap-2 mb-[-1.5rem]">
          <TrendingUp className="w-5 h-5 text-[#fa233b]" />
          <h2 className="text-xl font-bold">Charts</h2>
        </div>
        <CarouselShelf title="" items={generateMocks('Top 100', 'playlist', 10)} />

        <div className="flex items-center gap-2 mb-[-1.5rem]">
          <Music className="w-5 h-5 text-[#fa233b]" />
          <h2 className="text-xl font-bold">Moods & Genres</h2>
        </div>
        <CarouselShelf title="" items={generateMocks('Mood', 'playlist', 12)} />

        <div className="flex items-center gap-2 mb-[-1.5rem]">
          <Film className="w-5 h-5 text-[#fa233b]" />
          <h2 className="text-xl font-bold">Movies</h2>
        </div>
        <CarouselShelf title="" items={generateMocks('Movie Album', 'album', 10)} />

        <div className="flex items-center gap-2 mb-[-1.5rem]">
          <Mic2 className="w-5 h-5 text-[#fa233b]" />
          <h2 className="text-xl font-bold">Popular Artists</h2>
        </div>
        <CarouselShelf title="" items={generateMocks('Artist', 'artist', 12)} />

        <div className="flex items-center gap-2 mb-[-1.5rem]">
          <Disc className="w-5 h-5 text-[#fa233b]" />
          <h2 className="text-xl font-bold">Albums</h2>
        </div>
        <CarouselShelf title="" items={generateMocks('Album', 'album', 10)} />

      </div>
    </div>
  );
}
