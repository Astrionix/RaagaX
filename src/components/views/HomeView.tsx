'use client';

import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { HomePayload, HomeSection, ShelfItem } from '@/types/home';
import { QuickAccessGrid } from '@/components/home/QuickAccessGrid';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { CarouselShelf } from '@/components/home/CarouselShelf';
import { ChartListShelf } from '@/components/home/ChartListShelf';
import { Disc3 } from 'lucide-react';

import useSWR from 'swr';

const homeFetcher = async (url: string, preferredLanguage: string) => {
  const { supabase } = await import('@/lib/supabase');
  const { data: { session } } = await supabase.auth.getSession();
  
  const userName = session?.user?.user_metadata?.full_name ? encodeURIComponent(session.user.user_metadata.full_name.split(' ')[0]) : '';
  const fullUrl = session?.user?.id 
    ? `${url}&userId=${session.user.id}&name=${userName}`
    : url;
    
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error('Failed to fetch home');
  const data: HomePayload = await res.json();

  try {
    const releasesRes = await fetch(`/api/home/new-releases?lang=${preferredLanguage}`);
    let usedCache = false;
    
    if (releasesRes.ok) {
      const releasesData = await releasesRes.json();
      if (releasesData.success && releasesData.data && releasesData.data.length > 0) {
        usedCache = true;
        const thisWeekSongs = releasesData.data;
        
        if (!data.sections.some(s => s.id === 'this_week_releases')) {
          const newSection: HomeSection = {
            id: 'this_week_releases',
            type: 'carousel',
            title: '🆕 This Week\'s Releases',
            items: thisWeekSongs.map((s: any) => ({
              ...s,
              type: 'song',
              subtitle: s.artist,
              imageUrl: s.coverUrl
            })) as ShelfItem[]
          };
          data.sections.splice(1, 0, newSection);
        }
      }
    }
    
    if (!usedCache) {
      // Fallback if no cached new releases exist yet
      const { getPlaylistId } = await import('@/lib/homePlaylists');
      const newReleasesId = getPlaylistId(preferredLanguage, 'New Releases', '1266094331');
      const playlist = await RealMusicEngine.getInstance().getPlaylistDetails(newReleasesId);
      const rawItems = playlist?.songs || [];
      
      if (rawItems.length > 0) {
        const thisWeekSongs = rawItems.slice(0, 15);
        if (!data.sections.some(s => s.id === 'this_week_releases')) {
          const newSection: HomeSection = {
            id: 'this_week_releases',
            type: 'carousel',
            title: '🆕 This Week\'s Releases',
            items: thisWeekSongs.map(s => ({
              ...s,
              type: 'song',
              subtitle: s.artist,
              imageUrl: s.coverUrl
            })) as ShelfItem[]
          };
          data.sections.splice(1, 0, newSection);
        }
      }
    }
  } catch (e) {
    console.error('Failed to inject new releases:', e);
  }

  return data;
};

export function HomeView() {
  const { preferredLanguage } = usePlayerStore();
  
  const { data: payload, isLoading } = useSWR(
    `/api/home?lang=${preferredLanguage}`,
    (url) => homeFetcher(url, preferredLanguage),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  if (isLoading || !payload) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-white">
        <Disc3 className="w-10 h-10 animate-spin text-[#fa233b]" style={{ animationDuration: '3s' }} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-6 text-white select-none max-w-7xl mx-auto w-full">
      {/* Dynamic Greeting */}
      <div className="pt-2">
        <h1 className="text-3xl font-black tracking-tight">{payload.greeting}</h1>
      </div>

      {/* Dynamic Engine Sections */}
      {payload.sections.map((section) => {
        switch (section.type) {
          case 'quick_access':
            return <QuickAccessGrid key={section.id} items={section.items} />;
          case 'carousel':
            return <CarouselShelf key={section.id} title={section.title || ''} items={section.items} />;
          case 'list_chart':
            return <ChartListShelf key={section.id} title={section.title || ''} items={section.items} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
