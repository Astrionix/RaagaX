'use client';

import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { HomePayload, HomeSection, ShelfItem } from '@/types/home';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { CarouselShelf } from '@/components/home/CarouselShelf';
import { ChartListShelf } from '@/components/home/ChartListShelf';
import { SkeletonGrid } from '@/components/ui/SkeletonLoader';
import { Play, Pause, Clock, Sparkles, Disc } from 'lucide-react';
import { ArtistDiscoveryShelves } from '@/components/home/ArtistDiscoveryShelves';
import { Song } from '@/types/music';

import useSWR from 'swr';

const homeFetcher = async (url: string, preferredLanguage: string) => {
  const { supabase } = await import('@/lib/supabase');
  const { UserLifecycleManager } = await import('@/lib/lifecycle/UserLifecycleManager');
  const { data: { session } } = await supabase.auth.getSession();
  const phase = UserLifecycleManager.getInstance().getData().phase;
  
  const userName = session?.user?.user_metadata?.full_name ? encodeURIComponent(session.user.user_metadata.full_name.split(' ')[0]) : '';
  const fullUrl = session?.user?.id 
    ? `${url}&userId=${session.user.id}&name=${userName}&phase=${phase}`
    : `${url}&phase=${phase}`;
    
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

// ─── Convert Song[] → ShelfItem[] for CarouselShelf ─────────────────────────
function songsToShelfItems(songs: Song[]): ShelfItem[] {
  return songs.map(s => ({
    id: s.id,
    title: s.title,
    subtitle: s.artist,
    type: 'song' as const,
    imageUrl: s.coverUrl,
    rawItem: s,
  }));
}

function albumsToShelfItems(albums: any[]): ShelfItem[] {
  return albums.map(alb => ({
    id: alb.id,
    title: alb.title,
    subtitle: `${alb.artist} • ${alb.year || ''}`,
    type: 'album' as const,
    imageUrl: alb.coverUrl || '/app-icon.png',
    rawItem: alb,
  }));
}

import { useAuthStore } from '@/context/useAuthStore';

// ─── HomeView ────────────────────────────────────────────────────────────────
export function HomeView() {
  const { 
    preferredLanguage, 
    currentSong,
    currentTime,
    isPlaying,
    togglePlayPause,
    setActiveTab,
    likedSongs = []
  } = usePlayerStore();
  const { user } = useAuthStore();

  const activeUserId = user?.id || 'guest';
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [recommended, setRecommended] = useState<Song[]>([]);
  
  const { data: payload, isLoading } = useSWR(
    `/api/home?lang=${preferredLanguage}`,
    (url) => homeFetcher(url, preferredLanguage),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      keepPreviousData: true,
    }
  );

  // 1. Recently Played: combines QueueHistory + currentSong + likedSongs
  useEffect(() => {
    const load = async () => {
      try {
        const { QueueHistory } = await import('@/lib/queue/QueueHistory');
        const historyInstance = QueueHistory.getInstance();
        await historyInstance.ensureLoaded();
        let entries = historyInstance.getRecentlyPlayed(30);

        const seen = new Set<string>();
        const songs: Song[] = [];

        // 1. Current playing song
        if (currentSong) {
          seen.add(currentSong.id);
          songs.push(currentSong);
        }

        // 2. Recent listening history (newest first)
        for (let i = entries.length - 1; i >= 0; i--) {
          const s = entries[i].song;
          if (s && !seen.has(s.id)) {
            seen.add(s.id);
            songs.push(s);
          }
        }

        // 3. Liked songs
        for (const s of likedSongs) {
          if (s && !seen.has(s.id)) {
            seen.add(s.id);
            songs.push(s);
          }
        }

        // Strictly cap at 10 items: newest enters at index 0, oldest is dropped
        setRecentlyPlayed(songs.slice(0, 10));
      } catch (e) {
        console.warn('[HomeView] Could not load recently played:', e);
      }
    };
    load();
  }, [currentSong, likedSongs]);

  const [recommendedAlbums, setRecommendedAlbums] = useState<any[]>([]);

  // 2. Recommended For You: random selection of songs & 2-day albums in preferred language
  useEffect(() => {
    const load = async () => {
      try {
        const { UserLifecycleManager } = await import('@/lib/lifecycle/UserLifecycleManager');
        const { RecommendationEngine } = await import('@/lib/recommendation/RecommendationEngine');
        const { AlbumRecommendationEngine } = await import('@/lib/recommendation/AlbumRecommendationEngine');

        const selectedLangs = UserLifecycleManager.getInstance().getData().selectedLanguages ?? (preferredLanguage ? [preferredLanguage] : []);

        // Fetch 3-day stable snapshot recommendations across user selected languages
        const recSongs = await RecommendationEngine.getInstance().getRecommendations(activeUserId, selectedLangs);
        setRecommended(recSongs);

        // Fetch 2-day 10-album stable snapshot recommendations across user selected languages
        const recAlbums = await AlbumRecommendationEngine.getInstance().getRecommendedAlbums(activeUserId, selectedLangs);
        setRecommendedAlbums(recAlbums);
      } catch (e) {
        console.warn('[HomeView] Could not load recommendations:', e);
      }
    };
    load();
  }, [preferredLanguage, activeUserId, payload?.sections?.length]);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const hours = new Date().getHours();
  const greeting = !isMounted ? 'Good day' : (hours < 12 ? 'Good morning' : hours < 17 ? 'Good afternoon' : 'Good evening');
  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'Music Lover';

  return (
    <div className="space-y-8 pb-4 select-none">
      {/* Mobile Native Greeting Header */}
      <div className="md:hidden pt-2 space-y-4">
        <div>
          <span className="text-xs font-semibold text-[#8E92A4] uppercase tracking-wider">{greeting}</span>
          <h1 className="text-2xl font-black text-white tracking-tight">{displayName}</h1>
        </div>

        {/* Mobile Quick Search Bar */}
        <div
          onClick={() => setActiveTab('search')}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/20 text-[#8E92A4] cursor-pointer transition-all active:scale-[0.99]"
        >
          <Sparkles className="w-4 h-4 text-[#F51B3D]" />
          <span className="text-xs font-medium text-slate-400">Search songs, artists, albums...</span>
        </div>
      </div>

      {/* Continue Listening Section (Unfinished track checkpoint) */}
      {isMounted && currentSong && currentTime > 15 && (
        <section 
          onClick={() => togglePlayPause()}
          className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/10 transition-colors group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <img 
              src={currentSong.coverUrl ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500') : ''} 
              alt={currentSong.title || ''}
              className="w-14 h-14 rounded-xl object-cover bg-slate-800 group-hover:scale-105 transition-transform"
            />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-[#fa233b] uppercase tracking-wider block mb-0.5">Continue Listening</span>
              <h3 className="text-sm font-bold text-white truncate">{currentSong.title}</h3>
              <p className="text-xs text-slate-400 truncate mt-0.5">{currentSong.artist}</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#fa233b] hover:bg-[#fa233b]/90 text-white font-bold text-xs shadow-lg shadow-red-500/20 transition-transform hover:scale-105 shrink-0"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-white" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                <span>Resume</span>
              </>
            )}
          </button>
        </section>
      )}

      {/* Recently Played — shown whenever history or liked songs exist */}
      {recentlyPlayed.length > 0 && (
        <CarouselShelf
          title="Recently Played"
          icon={<Clock className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-cyan-400 flex-shrink-0" />}
          items={songsToShelfItems(recentlyPlayed)}
          showPlayAll={true}
        />
      )}

      {/* Recommended For You — shown whenever recommendations are available */}
      {recommended.length > 0 && (
        <CarouselShelf
          title="Recommended For You"
          icon={<Sparkles className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-violet-400 flex-shrink-0" />}
          items={songsToShelfItems(recommended)}
          showPlayAll={true}
        />
      )}

      {/* Suggested Albums For You — 2-Day Refresh */}
      {recommendedAlbums.length > 0 && (
        <CarouselShelf
          title="Suggested Albums For You"
          icon={<Disc className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-amber-400 flex-shrink-0" />}
          items={albumsToShelfItems(recommendedAlbums)}
          showPlayAll={false}
        />
      )}

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
