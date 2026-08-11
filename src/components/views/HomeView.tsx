'use client';

import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { HomePayload, HomeSection, ShelfItem } from '@/types/home';
import { QuickAccessGrid } from '@/components/home/QuickAccessGrid';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { CarouselShelf } from '@/components/home/CarouselShelf';
import { ChartListShelf } from '@/components/home/ChartListShelf';
import { SkeletonGrid } from '@/components/ui/SkeletonLoader';
import { Disc, ChevronRight, Play } from 'lucide-react';
import { AlbumCatalogEngine } from '@/lib/albumCatalog';
import { ArtistDiscoveryShelves } from '@/components/home/ArtistDiscoveryShelves';

import useSWR from 'swr';

const homeFetcher = async (url: string, preferredLanguage: string) => {
  const { supabase } = await import('@/lib/supabase');
  const { data: { session } } = await supabase.auth.getSession();
  
  const userName = session?.user?.user_metadata?.full_name ? encodeURIComponent(session.user.user_metadata.full_name.split(' ')[0]) : '';
  const fullUrl = session?.user?.id 
    ? `${url}&userId=${session.user.id}&name=${userName}`
    : url;
    
  // Fetch home payload and new releases in parallel
  const [res, releasesRes] = await Promise.all([
    fetch(fullUrl).catch(() => null),
    fetch(`/api/home/new-releases?lang=${preferredLanguage}&limit=100`).catch(() => null)
  ]);

  if (!res || !res.ok) throw new Error('Failed to fetch home');
  const data: HomePayload = await res.json();

  try {
    let usedCache = false;
    
    if (releasesRes && releasesRes.ok) {
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
              rawItem: s,
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
        const thisWeekSongs = rawItems.slice(0, 100);
        if (!data.sections.some(s => s.id === 'this_week_releases')) {
          const newSection: HomeSection = {
            id: 'this_week_releases',
            type: 'carousel',
            title: '🆕 This Week\'s Releases',
            items: thisWeekSongs.map(s => ({
              ...s,
              rawItem: s,
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
  const { 
    preferredLanguage, 
    setPreferredLanguage, 
    setActiveTab, 
    setSelectedAlbumId, 
    playSong, 
    setRemoteState 
  } = usePlayerStore();
  
  const { data: payload, isLoading } = useSWR(
    `/api/home?lang=${preferredLanguage}`,
    (url) => homeFetcher(url, preferredLanguage),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      keepPreviousData: true,
    }
  );

  const [top10Albums, setTop10Albums] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const initial = AlbumCatalogEngine.getTop10Albums(preferredLanguage);
    setTop10Albums(initial);

    AlbumCatalogEngine.fetchRealAlbumsForLanguage(preferredLanguage).then(fetched => {
      if (isMounted && fetched && fetched.length > 0) {
        setTop10Albums(fetched.slice(0, 10));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [preferredLanguage]);

  const handlePlayAlbum = async (e: React.MouseEvent, album: any) => {
    e.stopPropagation();
    let tracks = album.tracks;
    if (!tracks || tracks.length === 0) {
      const { RealMusicEngine } = await import('@/lib/realMusicEngine');
      const details = await RealMusicEngine.getInstance().getPlaylistDetails(`album:${album.id}`);
      tracks = details?.songs || [];
    }
    if (tracks && tracks.length > 0) {
      setRemoteState({ shuffleMode: 'OFF' });
      playSong(tracks[0], tracks);
    }
  };

  return (
    <div className="space-y-8 pb-4 select-none">
      {/* Top 10 Albums Hero Banner */}
      <section className="relative rounded-3xl bg-gradient-to-r from-[#1c0a18] via-[#141026] to-[#090b12] p-6 sm:p-8 border border-white/10 overflow-hidden shadow-2xl">
        <div className="relative z-10 space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#fa233b]/20 border border-[#fa233b]/30 text-[#fa233b] text-xs font-bold uppercase tracking-wider mb-1">
                <Disc className="w-3.5 h-3.5" /> Official Regional Albums
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                Top 10 <span className="text-[#fa233b]">{preferredLanguage}</span> Albums
              </h1>
            </div>

            <button
              onClick={() => setActiveTab('album')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all hover:scale-105 border border-white/15 self-start sm:self-auto cursor-pointer"
            >
              <span>See All 50 Albums</span>
              <ChevronRight className="w-4 h-4 text-[#fa233b]" />
            </button>
          </div>

          {/* Top 10 Albums Showcase Horizontal Side-scroll on Mobile, Grid on Desktop */}
          <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory md:grid md:grid-cols-5 gap-3.5 sm:gap-4 pt-1 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {top10Albums.map((album, idx) => (
              <div
                key={album.id}
                onClick={() => {
                  setSelectedAlbumId(album.id);
                  setActiveTab('album');
                }}
                className="group relative bg-white/5 p-2.5 rounded-2xl border border-white/5 hover:border-white/20 transition-all hover:scale-[1.03] cursor-pointer shadow-lg w-[145px] sm:w-auto flex-shrink-0 snap-start"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2">
                  <img 
                    src={album.coverUrl} 
                    alt={album.title} 
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=500&h=500';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-slate-800" 
                  />

                  <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-black border border-white/10">
                    #{idx + 1}
                  </div>

                  <button
                    onClick={(e) => handlePlayAlbum(e, album)}
                    className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-[#fa233b] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-105 shadow-xl"
                  >
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </button>
                </div>

                <h3 className="font-bold text-xs text-white truncate">{album.title}</h3>
                <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">{album.artist}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 font-medium">
                  <span className="text-white font-bold">{album.trackCount} tracks</span>
                  <span>•</span>
                  <span>{album.releaseYear}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Artist Discovery Shelves */}
      <ArtistDiscoveryShelves />

      {/* Main Content Layout */}
      {isLoading || !payload ? (
        <div className="space-y-8 pt-4">
          <div className="space-y-3">
            <div className="h-4 bg-white/10 rounded w-44 animate-pulse" />
            <SkeletonGrid count={6} />
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-white/10 rounded w-44 animate-pulse" />
            <SkeletonGrid count={6} />
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Dynamic Sections */}
          {payload.sections.map((section: HomeSection) => {
            if (section.type === 'list_chart') {
              return <ChartListShelf key={section.id} title={section.title || ''} items={section.items} />;
            }
            const isNewReleasesSection = Boolean(
              section.id === 'new_releases' || 
              section.id === 'new_week_releases' || 
              (section.title && section.title.toLowerCase().includes('new release')) ||
              (section.title && section.title.toLowerCase().includes('new week')) ||
              (section.title && section.title.toLowerCase().includes('this week'))
            );

            return <CarouselShelf key={section.id} title={section.title || ''} items={section.items} showPlayAll={isNewReleasesSection} />;
          })}
        </div>
      )}
    </div>
  );
}

