'use client';

import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import { ChevronRight } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { getApiUrl } from '@/lib/config/apiConfig';

const LANGUAGES_TO_FETCH = ['Telugu', 'Hindi', 'English', 'Tamil', 'Kannada', 'Malayalam'];

import { HomeFeedGenerator } from '@/lib/home/HomeFeedGenerator';

import { ArtistAvatar } from '@/components/common/ArtistAvatar';

const fetcher = (url: string) => fetch(getApiUrl(url)).then(r => r.json()).catch(() => null);

export function ArtistDiscoveryShelves() {
  const { preferredLanguage } = usePlayerStore();
  const [activeLanguages, setActiveLanguages] = useState<string[]>([preferredLanguage || 'Telugu']);

  useEffect(() => {
    import('@/lib/lifecycle/UserLifecycleManager').then(({ UserLifecycleManager }) => {
      const langs = UserLifecycleManager.getInstance().getData().selectedLanguages;
      if (langs && langs.length > 0) {
        setActiveLanguages(langs);
      } else {
        setActiveLanguages([preferredLanguage || 'Telugu']);
      }
    });
  }, [preferredLanguage]);

  return (
    <div className="space-y-6 pt-2">
      {activeLanguages.map((lang) => (
        <ArtistLanguageShelf key={lang} language={lang} />
      ))}
    </div>
  );
}

function ArtistLanguageShelf({ language }: { language: string }) {
  const { setActiveTab, setSelectedArtistId } = usePlayerStore();
  const fallbackArtists = HomeFeedGenerator.getArtistsForLanguage(language, 8);

  const { data } = useSWR(`/api/home/artists?lang=${language}&limit=8`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 min
    fallbackData: { success: true, data: fallbackArtists }
  });

  const artists = data?.data && data.data.length > 0 ? data.data : fallbackArtists;
  if (!artists || artists.length === 0) return null;

  return (
    <section className="mb-4 sm:mb-6">
      <div className="flex items-center justify-between mb-2.5 px-3 sm:px-0">
        <h2 className="text-[20px] sm:text-xl font-semibold leading-[26px] text-white tracking-tight truncate whitespace-nowrap">
          {language} Artists You May Like
        </h2>
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
            <ArtistAvatar
              name={artist.name}
              id={artist.id}
              imageUrl={artist.imageUrl}
              language={language}
              className="w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] shadow-lg border border-white/5 group-hover:border-white/25 group-hover:shadow-[0_0_25px_rgba(250,35,59,0.25)] transition-all"
            />
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
