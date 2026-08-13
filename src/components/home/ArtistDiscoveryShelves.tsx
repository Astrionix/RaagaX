'use client';

import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import { ChevronRight } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

const LANGUAGES_TO_FETCH = ['Telugu', 'Hindi', 'English', 'Tamil', 'Kannada', 'Malayalam'];

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function ArtistDiscoveryShelves() {
  const { preferredLanguage } = usePlayerStore();
  const [activeLanguages, setActiveLanguages] = useState<string[]>([preferredLanguage]);

  useEffect(() => {
    import('@/lib/lifecycle/UserLifecycleManager').then(({ UserLifecycleManager }) => {
      const langs = UserLifecycleManager.getInstance().getData().selectedLanguages;
      if (langs && langs.length > 0) {
        setActiveLanguages(langs);
      } else {
        setActiveLanguages([preferredLanguage]);
      }
    });
  }, [preferredLanguage]);

  return (
    <div className="space-y-10 pt-6">
      {activeLanguages.map((lang) => (
        <ArtistLanguageShelf key={lang} language={lang} />
      ))}
    </div>
  );
}

function ArtistLanguageShelf({ language }: { language: string }) {
  const { setActiveTab, setSelectedArtistId } = usePlayerStore();
  const { data, error, isLoading } = useSWR(`/api/home/artists?lang=${language}&limit=8`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 min
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 bg-white/10 rounded animate-pulse" />
        <div className="flex gap-4 overflow-hidden">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="w-[140px] h-[140px] rounded-full bg-white/5 animate-pulse flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.success || !data.data || data.data.length === 0) return null;

  const artists = data.data;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
          {language} Artists You May Like
        </h2>
        <button className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
          See All <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {artists.map((artist: any) => (
          <div
            key={artist.id}
            onClick={() => {
              setSelectedArtistId(artist.id);
              setActiveTab('artist');
            }}
            className="group flex flex-col items-center gap-3 w-[120px] sm:w-[140px] flex-shrink-0 snap-start cursor-pointer transition-transform hover:scale-105"
          >
            <div className="relative w-full aspect-square rounded-full overflow-hidden shadow-lg border border-white/5 group-hover:border-white/20 group-hover:shadow-xl transition-all">
              <img 
                src={artist.imageUrl} 
                alt={artist.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                }}
              />
            </div>
            <div className="text-center px-1">
              <h3 className="text-sm font-bold text-white truncate w-[110px] sm:w-[130px] group-hover:text-[#fa233b] transition-colors">{artist.name}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5 capitalize">Artist</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
