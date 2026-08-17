'use client';

import React from 'react';
import useSWR from 'swr';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Users, ShieldCheck } from 'lucide-react';
import { getApiUrl } from '@/lib/config/apiConfig';

const fetcher = (url: string) => fetch(getApiUrl(url)).then(r => r.json()).catch(() => null);

export function ArtistsView() {
  const { preferredLanguage, setActiveTab, setSelectedArtistId } = usePlayerStore();
  
  const { data, isLoading, error } = useSWR(`/api/home/artists?lang=${preferredLanguage}&limit=20`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
  });

  const artists = data?.data || [];

  return (
    <div className="space-y-6 pb-8 select-none pt-4">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#fa233b]/20 rounded-xl">
          <Users className="w-6 h-6 text-[#fa233b]" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Popular Artists</h1>
          <p className="text-sm text-slate-400">Discover top artists in {preferredLanguage}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1,2,3,4,5,6,7,8,9,10].map(i => (
            <div key={i} className="flex flex-col items-center gap-3 w-full animate-pulse">
              <div className="w-full aspect-square rounded-full bg-white/5" />
              <div className="h-4 w-3/4 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      ) : (
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
              <div className="relative w-full aspect-square rounded-full overflow-hidden shadow-lg border border-white/5 group-hover:border-[#fa233b]/30 group-hover:shadow-[0_0_20px_rgba(250,35,59,0.2)] transition-all">
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
                <h3 className="text-sm font-bold text-white truncate w-full group-hover:text-[#fa233b] transition-colors flex items-center justify-center gap-1">
                  {artist.name}
                  {artist.isVerified && <ShieldCheck className="w-3 h-3 text-[#fa233b] flex-shrink-0" />}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 capitalize">Artist</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
