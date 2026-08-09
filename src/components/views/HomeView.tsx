'use client';

import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { HomePayload, HomeSection, ShelfItem } from '@/types/home';
import { QuickAccessGrid } from '@/components/home/QuickAccessGrid';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { CarouselShelf } from '@/components/home/CarouselShelf';
import { ChartListShelf } from '@/components/home/ChartListShelf';
import { Disc3 } from 'lucide-react';

export function HomeView() {
  const [payload, setPayload] = useState<HomePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { preferredLanguage } = usePlayerStore();

  useEffect(() => {
    async function fetchHome() {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        
        const userName = session?.user?.user_metadata?.full_name ? encodeURIComponent(session.user.user_metadata.full_name.split(' ')[0]) : '';
        const url = session?.user?.id 
          ? `/api/home?userId=${session.user.id}&lang=${preferredLanguage}&name=${userName}`
          : `/api/home?lang=${preferredLanguage}`;
          
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          // Set payload immediately so the UI stops loading fast
          setPayload(data);
          setIsLoading(false);

          // Inject "This Week's Releases" dynamically in the background without blocking the UI
          try {
            const { getPlaylistId } = await import('@/lib/homePlaylists');
            const newReleasesId = getPlaylistId(preferredLanguage, 'New Releases', '1266094331');
            
            RealMusicEngine.getInstance().getPlaylistDetails(newReleasesId).then(async playlist => {
              const rawItems = playlist?.songs || [];
              if (rawItems.length > 0) {
                // Ensure all items are playable songs. If it's an album (indicated by fallback pixabay audio), fetch a real song for it
                const playableSongsPromises = rawItems.slice(0, 15).map(async (s) => {
                  if (s.audioUrl.includes('pixabay')) {
                    try {
                      // It's an album or unplayable track. Fetch a real song using its title as requested.
                      const realSongs = await RealMusicEngine.getInstance().searchRealSongs(s.title, 1);
                      if (realSongs && realSongs.length > 0) {
                        return realSongs[0];
                      }
                    } catch (e) {}
                  }
                  return s;
                });
                
                const thisWeekSongs = await Promise.all(playableSongsPromises);
                
                setPayload((prevPayload) => {
                  if (!prevPayload) return prevPayload;
                  // Make sure we don't duplicate it
                  if (prevPayload.sections.some(s => s.id === 'this_week_releases')) return prevPayload;
                  
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
                  
                  const newSections = [...prevPayload.sections];
                  newSections.splice(1, 0, newSection);
                  return { ...prevPayload, sections: newSections };
                });
              }
            });
          } catch (e) {
            console.error('Failed to inject new releases', e);
          }
        } else {
          setIsLoading(false);
        }
      } catch (e) {
        console.error('Failed to fetch home payload:', e);
        setIsLoading(false);
      }
    }
    fetchHome();
  }, [preferredLanguage]);

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
