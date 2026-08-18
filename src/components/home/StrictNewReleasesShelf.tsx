'use client';

import React, { useState, useEffect } from 'react';
import { Song } from '@/types/music';
import { ShelfItem } from '@/types/home';
import { Sparkles, Loader2 } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { NewReleasesEngine, SUPPORTED_LANGUAGES_LIST } from '@/lib/catalog/NewReleasesEngine';
import { CarouselShelf } from './CarouselShelf';
import { haptics } from '@/lib/haptics/HapticEngine';

interface StrictNewReleasesShelfProps {
  initialSongs?: Song[];
  defaultLanguage?: string;
}

export function StrictNewReleasesShelf({
  initialSongs = [],
  defaultLanguage = 'All',
}: StrictNewReleasesShelfProps) {
  const { preferredLanguage } = usePlayerStore();
  const [selectedLang, setSelectedLang] = useState<string>(preferredLanguage || defaultLanguage || 'All');
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const fetchNewReleases = async () => {
      setIsLoading(true);
      try {
        const engine = NewReleasesEngine.getInstance();
        const results = await engine.getNewReleasesForLanguage(selectedLang, 50);
        if (!isCancelled) {
          if (results && results.length > 0) {
            setSongs(results);
          }
        }
      } catch (err) {
        console.warn('[StrictNewReleasesShelf] Fetch failed:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    fetchNewReleases();
    return () => {
      isCancelled = true;
    };
  }, [selectedLang]);

  const handleLanguageChange = (codeOrName: string) => {
    haptics.lightImpact();
    setSelectedLang(codeOrName);
  };

  const shelfItems: ShelfItem[] = songs.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: NewReleasesEngine.getReleaseDateBadge(s),
    imageUrl: s.coverUrl,
    type: 'song',
    rawItem: s,
  }));

  const displayTitle = selectedLang.toLowerCase() === 'all'
    ? 'New Releases • All Languages'
    : `New Releases • ${selectedLang}`;

  const displaySubtitle = selectedLang.toLowerCase() === 'all'
    ? `Fresh multilingual releases • ${songs.length} songs • Updated recently`
    : `Fresh ${selectedLang} releases • ${songs.length} songs • Updated recently`;

  return (
    <div className="space-y-2 mb-4 select-none">
      {/* ── INTERACTIVE STRICT LANGUAGE FILTER PILLS ─────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {SUPPORTED_LANGUAGES_LIST.map((lang) => {
          const isSelected =
            selectedLang.toLowerCase() === lang.label.toLowerCase() ||
            selectedLang.toLowerCase() === lang.code.toLowerCase();

          return (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.label)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex-shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-[#fa233b] text-white shadow-md shadow-red-500/20 scale-[1.02]'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
              }`}
            >
              {lang.label}
            </button>
          );
        })}
      </div>

      {/* ── SHELF CAROUSEL ──────────────────────────────────────────────── */}
      {isLoading && songs.length === 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-[18px] h-[18px] text-amber-400" />
            <h2 className="text-xl font-semibold text-white tracking-tight">{displayTitle}</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-36 flex-shrink-0 space-y-2 animate-pulse">
                <div className="w-36 h-36 rounded-2xl bg-white/5" />
                <div className="h-3.5 bg-white/10 rounded w-3/4" />
                <div className="h-2.5 bg-white/5 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <CarouselShelf
          title={displayTitle}
          subtitle={displaySubtitle}
          icon={<Sparkles className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-amber-400 flex-shrink-0" />}
          items={shelfItems}
          showPlayAll={true}
        />
      )}
    </div>
  );
}
