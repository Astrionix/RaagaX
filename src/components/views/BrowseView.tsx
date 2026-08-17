'use client';

import React from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CarouselShelf } from '@/components/home/CarouselShelf';
import { Compass, TrendingUp, Sparkles, Film, Disc, RefreshCw, WifiOff, Users, Music } from 'lucide-react';
import { ShelfItem } from '@/types/home';
import { RaagaDB, STORES } from '@/lib/storage/IndexedDB';
import { SkeletonGrid } from '@/components/ui/SkeletonLoader';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { AlbumCatalogEngine } from '@/lib/albumCatalog';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { getApiUrl } from '@/lib/config/apiConfig';
import useSWR from 'swr';

async function getOfflineBrowseFallback(lang: string) {
  const sections: any[] = [];

  // 1. Check for downloaded tracks from OfflineCatalog
  try {
    const offlineCatalog = OfflineCatalog.getInstance();
    const downloadedTracks = await offlineCatalog.getAllTracks();
    if (downloadedTracks && downloadedTracks.length > 0) {
      const items: ShelfItem[] = downloadedTracks.slice(0, 20).map((t) => ({
        id: t.trackId,
        title: t.title,
        subtitle: t.artist,
        imageUrl: t.artworkUrl || '/app-icon.png',
        type: 'song',
        actionData: t.trackId,
        rawItem: {
          id: t.trackId,
          title: t.title,
          artist: t.artist,
          album: t.album,
          coverUrl: t.artworkUrl || '/app-icon.png',
          duration: t.durationMs ? Math.round(t.durationMs / 1000) : 0,
          audioUrl: t.audioUrl || '',
          source: 'local',
        },
      }));

      sections.push({
        id: 'downloaded_tracks',
        title: 'Downloaded Songs',
        status: 'ready',
        items,
      });
    }
  } catch (e) {
    console.warn('[BrowseView] Failed to read downloaded tracks:', e);
  }

  // 2. Load Local Seed Albums for the preferred language
  try {
    const seedAlbums = AlbumCatalogEngine.getAlbumsForLanguage(lang);
    if (seedAlbums && seedAlbums.length > 0) {
      const items: ShelfItem[] = seedAlbums.map((alb) => ({
        id: alb.id,
        title: alb.title,
        subtitle: `${alb.artist} • ${alb.releaseYear}`,
        imageUrl: alb.coverUrl || '/app-icon.png',
        type: 'album',
        actionData: alb.id,
        rawItem: alb,
      }));

      sections.push({
        id: 'local_albums',
        title: `Popular ${lang} Albums`,
        status: 'ready',
        items,
      });
    }
  } catch (e) {
    console.warn('[BrowseView] Failed to load local albums:', e);
  }

  // 3. Load Popular Artists
  try {
    if (POPULAR_ARTISTS && POPULAR_ARTISTS.length > 0) {
      const items: ShelfItem[] = POPULAR_ARTISTS.map((artist) => ({
        id: artist.id,
        title: artist.name,
        subtitle: artist.genres?.join(', ') || 'Artist',
        imageUrl: artist.image || '/app-icon.png',
        type: 'artist',
        actionData: artist.id,
      }));

      sections.push({
        id: 'popular_artists',
        title: 'Featured Artists',
        status: 'ready',
        items,
      });
    }
  } catch (e) {
    console.warn('[BrowseView] Failed to load popular artists:', e);
  }

  return {
    success: true,
    isOffline: true,
    sections,
  };
}

const fetcherWithCache = async (url: string) => {
  const fullUrl = getApiUrl(url);
  const urlObj = new URL(fullUrl);
  const lang = urlObj.searchParams.get('lang') || 'Telugu';
  const db = RaagaDB.getInstance();
  const cacheKey = `browse_${lang}`;

  try {
    const res = await fetch(fullUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('Browse fetch failed');
    const data = await res.json();
    
    // Store in IndexedDB for instant loads next time (only if populated with items)
    if (data.success && data.sections?.some((s: any) => s.items && s.items.length > 0)) {
      await db.put(STORES.BROWSE_CACHE, { id: cacheKey, data, updatedAt: Date.now() });
    }
    return { ...data, isOffline: false };
  } catch (err) {
    // 1. Try to return from IndexedDB browse cache first
    try {
      const cached = await db.get<any>(STORES.BROWSE_CACHE, cacheKey);
      if (cached && cached.data?.sections?.some((s: any) => s.items && s.items.length > 0)) {
        return { ...cached.data, isOffline: true };
      }
    } catch {}

    // 2. If no IndexedDB network cache exists, construct offline local catalog
    return await getOfflineBrowseFallback(lang);
  }
};

const albumsFetcher = async (url: string) => {
  const fullUrl = getApiUrl(url);
  const urlObj = new URL(fullUrl);
  const lang = urlObj.searchParams.get('lang') || 'Telugu';

  try {
    const res = await fetch(fullUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      return { ...data, isOffline: false };
    }
  } catch {}

  // Fallback to local albums for the language
  const seedAlbums = AlbumCatalogEngine.getAlbumsForLanguage(lang);
  const items: ShelfItem[] = (seedAlbums || []).map((alb) => ({
    id: alb.id,
    title: alb.title,
    subtitle: `${alb.artist} • ${alb.releaseYear}`,
    imageUrl: alb.coverUrl || '/app-icon.png',
    type: 'album',
    actionData: alb.id,
    rawItem: alb,
  }));

  return {
    success: true,
    isOffline: true,
    sections: items.length > 0 ? [
      {
        id: 'seed_soundtracks',
        title: `${lang} Soundtracks & Collections`,
        items,
      }
    ] : [],
  };
};

export function BrowseView() {
  const { preferredLanguage } = usePlayerStore();
  
  const { data, isLoading, mutate } = useSWR(`/api/browse?lang=${preferredLanguage}`, fetcherWithCache, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    refreshInterval: (latestData) => {
      const isAnyLoading = latestData?.sections?.some((s: any) => s.status === 'loading');
      return isAnyLoading ? 3000 : 0;
    },
    dedupingInterval: 5000,
  });

  const { data: albumData, isLoading: albumsLoading, mutate: mutateAlbums } = useSWR(
    `/api/browse/albums?lang=${preferredLanguage}`, 
    albumsFetcher, 
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 mins
    }
  );

  const handleRefresh = () => {
    mutate();
    mutateAlbums();
  };

  const isOfflineMode = data?.isOffline || albumData?.isOffline;

  return (
    <div className="space-y-8 pb-10 text-white select-none max-w-7xl mx-auto w-full pt-4">
      {/* Header Title */}
      <div className="flex items-center justify-between gap-4 px-4 sm:px-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#fa233b]/20 flex items-center justify-center text-[#fa233b]">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Browse</h1>
            <p className="text-xs text-slate-400">Discover playlists, top albums and trending tracks</p>
          </div>
        </div>

        {isOfflineMode && (
          <button
            onClick={handleRefresh}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 active:scale-95 border border-white/10"
            title="Refresh Catalog"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reconnect</span>
          </button>
        )}
      </div>

      {/* Offline Mode Banner */}
      {isOfflineMode && (
        <div className="mx-4 sm:mx-0 flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Offline Catalog Mode — Showing available local albums, artists &amp; downloads</span>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold rounded-lg transition-all flex items-center gap-1 shrink-0 ml-2"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Browse Catalog Content */}
      <div className="space-y-8 mt-8">
        
        {/* Playlists & Offline Sections */}
        {data?.sections?.map((section: any) => {
          if (section.status === 'loading' && (!section.items || section.items.length === 0)) {
            return (
              <div key={section.id} className="space-y-3 px-4 sm:px-0">
                <div className="h-4 bg-white/10 rounded w-44 animate-pulse" />
                <SkeletonGrid count={5} />
              </div>
            );
          }
          
          if (!section.items || section.items.length === 0) return null;

          return (
            <CarouselShelf 
              key={section.id}
              title={section.title} 
              pagination={section.sourceId ? {
                enabled: true,
                source: {
                  type: 'spotify_playlist',
                  id: section.sourceId
                },
                initialHasMore: section.hasMore,
                total: section.total
              } : undefined}
              showPlayAll={section.id === 'downloaded_tracks' || section.id === 'trending'}
              icon={
                section.id === 'downloaded_tracks' ? <Music className="w-5 h-5 text-[#fa233b]" /> :
                section.id === 'trending' ? <TrendingUp className="w-5 h-5 text-[#fa233b]" /> :
                section.id === 'new_releases' ? <Sparkles className="w-5 h-5 text-[#fa233b]" /> :
                section.id === 'popular_artists' ? <Users className="w-5 h-5 text-[#fa233b]" /> :
                <Disc className="w-5 h-5 text-[#fa233b]" />
              }
              items={section.items} 
            />
          );
        })}

        {/* Albums */}
        {albumsLoading && !albumData && (
          <div className="space-y-3 px-4 sm:px-0">
            <div className="h-4 bg-white/10 rounded w-44 animate-pulse" />
            <SkeletonGrid count={5} />
          </div>
        )}

        {albumData?.sections?.map((section: any) => (
          <CarouselShelf 
            key={section.id}
            title={section.title} 
            showPlayAll={false}
            icon={<Film className="w-5 h-5 text-[#fa233b]" />}
            items={section.items} 
          />
        ))}

        {/* Global Loading state ONLY if no data exists yet */}
        {isLoading && !data && (
          <div className="space-y-8 pt-4 px-4 sm:px-0">
            <div className="space-y-3">
              <div className="h-4 bg-white/10 rounded w-44 animate-pulse" />
              <SkeletonGrid count={5} />
            </div>
          </div>
        )}

        {/* Graceful empty state if nothing was loaded anywhere */}
        {!isLoading && (!data?.sections || data.sections.length === 0) && (!albumData?.sections || albumData.sections.length === 0) && (
          <div className="w-full text-center py-20 text-slate-400 space-y-3 px-4">
            <Compass className="w-10 h-10 mx-auto text-slate-500 opacity-60" />
            <p className="text-base font-semibold text-slate-300">You're Offline</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Connect to the internet to discover new online playlists, tracks, and releases.
            </p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-[#fa233b] hover:bg-[#fa233b]/80 text-white text-xs font-bold rounded-full transition-all inline-flex items-center gap-1.5 active:scale-95 shadow-md mt-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
