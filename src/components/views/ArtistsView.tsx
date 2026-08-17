'use client';

import React from 'react';
import useSWR from 'swr';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Users, ShieldCheck } from 'lucide-react';
import { getApiUrl } from '@/lib/config/apiConfig';
import { HomeFeedGenerator } from '@/lib/home/HomeFeedGenerator';
import { ArtistAvatar } from '@/components/common/ArtistAvatar';

const fetcher = (url: string) => fetch(getApiUrl(url)).then(r => r.json()).catch(() => null);

export function ArtistsView() {
  const { preferredLanguage, setActiveTab, setSelectedArtistId } = usePlayerStore();
  const currentLang = preferredLanguage || 'Telugu';
  const fallbackArtists = HomeFeedGenerator.getArtistsForLanguage(currentLang, 20);
  
  const { data, isLoading } = useSWR(`/api/home/artists?lang=${currentLang}&limit=20`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
    fallbackData: { success: true, data: fallbackArtists }
  });

  const artists = data?.data && data.data.length > 0 ? data.data : fallbackArtists;

  return (
    <div className="space-y-6 pb-8 select-none pt-4">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#fa233b]/20 rounded-xl">
          <Users className="w-6 h-6 text-[#fa233b]" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Popular Artists</h1>
          <p className="text-sm text-slate-400">Discover top artists in {currentLang}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {artists.map((artist: any) => (
          <div
            key={artist.id}
            onClick={() => {
              setSelectedArtistId(artist.id);
              setActiveTab('artist');
            }}
            className="group flex flex-col items-center gap-3 w-full cursor-pointer transition-transform hover:scale-105"
          >
            <ArtistAvatar 
              name={artist.name}
              id={artist.id}
              imageUrl={artist.imageUrl}
              language={currentLang}
              className="w-28 h-28 sm:w-36 sm:h-36 shadow-lg border border-white/5 group-hover:border-[#fa233b]/40 group-hover:shadow-[0_0_25px_rgba(250,35,59,0.25)] transition-all"
            />
            <div className="text-center px-1">
              <h3 className="text-sm font-bold text-white truncate w-full group-hover:text-[#fa233b] transition-colors flex items-center justify-center gap-1">
                {artist.name}
                {artist.isVerified && <ShieldCheck className="w-3 h-3 text-[#fa233b] flex-shrink-0" />}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 capitalize">Artist</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
