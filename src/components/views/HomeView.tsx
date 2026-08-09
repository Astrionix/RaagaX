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

  useEffect(() => {
    async function fetchHome() {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        
        const url = session?.user?.id 
          ? `/api/home?userId=${session.user.id}`
          : '/api/home';
          
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          
          // Inject "This Week's Releases" dynamically on the client
          try {
            const thisWeekSongs = await RealMusicEngine.getInstance().searchRealSongs('New Telugu Songs', 12);
            if (thisWeekSongs.length > 0) {
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
              // Insert after the quick access grid
              data.sections.splice(1, 0, newSection);
            }
          } catch (e) {
            console.error('Failed to inject new releases', e);
          }

          setPayload(data);
        }
      } catch (e) {
        console.error('Failed to fetch home payload:', e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchHome();
  }, []);

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
