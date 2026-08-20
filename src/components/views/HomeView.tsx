'use client';

import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { HomePayload, HomeSection, ShelfItem } from '@/types/home';
import { CarouselShelf } from '@/components/home/CarouselShelf';
import { ChartListShelf } from '@/components/home/ChartListShelf';
import { SkeletonGrid } from '@/components/ui/SkeletonLoader';
import {
  Play, Pause, Clock, Sparkles, Disc, Shuffle, Download, Heart,
  Flame, Radio, Headphones, ListMusic, User, Users, Compass, ChevronRight
} from 'lucide-react';
import { ArtistDiscoveryShelves } from '@/components/home/ArtistDiscoveryShelves';
import { Song } from '@/types/music';
import useSWR from 'swr';
import { getApiUrl } from '@/lib/config/apiConfig';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { getCuratedPlaylists } from '@/constants/playlists';
import { RecommendationEngine, PersonalizedHomeFeed } from '@/lib/recommendation/RecommendationEngine';
import { HomeFeedGenerator } from '@/lib/home/HomeFeedGenerator';
import { RecapBanner } from '@/components/home/RecapBanner';
import { RaagaDB, STORES } from '@/lib/storage/IndexedDB';
import { supabase } from '@/lib/supabase';
import { UserLifecycleManager } from '@/lib/lifecycle/UserLifecycleManager';
import { NewReleasesEngine } from '@/lib/catalog/NewReleasesEngine';
import { StrictNewReleasesShelf } from '@/components/home/StrictNewReleasesShelf';
import { MoreLikeWhatYouHeardShelf } from '@/components/home/MoreLikeWhatYouHeardShelf';
import { FollowedArtistsNewReleasesShelf } from '@/components/home/FollowedArtistsNewReleasesShelf';

const homeFetcher = async (url: string, preferredLanguage: string) => {
  const db = RaagaDB.getInstance();
  const cacheKey = `home_${preferredLanguage}`;

  const defaultSections = HomeFeedGenerator.getHomeSectionsForLanguage(preferredLanguage);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const phase = UserLifecycleManager.getInstance().getData().phase;

    const userName = session?.user?.user_metadata?.full_name ? encodeURIComponent(session.user.user_metadata.full_name.split(' ')[0]) : '';
    const fullUrl = session?.user?.id
      ? `${url}&userId=${session.user.id}&name=${userName}&phase=${phase}`
      : `${url}&phase=${phase}`;

    const res = await fetch(getApiUrl(fullUrl));
    if (res.ok) {
      const data: HomePayload = await res.json();
      if (data?.sections) {
        data.sections = data.sections.filter(s => !s.title?.toLowerCase().includes('trending'));
      }
      if (data?.sections && data.sections.length > 0) {
        await db.put(STORES.BROWSE_CACHE, { id: cacheKey, data, updatedAt: Date.now() }).catch(() => { });
        return data;
      }
    }
  } catch (e) {
    console.warn('[HomeView] Online home fetch failed, falling back to local cache/generator:', e);
  }

  // Offline / Local Cached Fallback
  try {
    const cached = await db.get<any>(STORES.BROWSE_CACHE, cacheKey);
    if (cached && cached.data?.sections && cached.data.sections.length > 0) {
      return cached.data;
    }
  } catch { }

  return { greeting: 'Welcome to RaagaX 🎵', sections: defaultSections };
};

function songsToShelfItems(songs: Song[]): ShelfItem[] {
  return songs.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.artist,
    imageUrl: s.coverUrl,
    type: 'song',
    rawItem: s,
  }));
}

function newReleasesToShelfItems(songs: Song[]): ShelfItem[] {
  return songs.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: NewReleasesEngine.getReleaseDateBadge(s),
    imageUrl: s.coverUrl,
    type: 'song',
    rawItem: s,
  }));
};

export function HomeView() {
  const {
    currentSong,
    isPlaying,
    togglePlayPause,
    setActiveTab,
    likedSongs = [],
    preferredLanguage,
    selectedLanguages = [],
    homeFeedControls = {
      showNewReleases: true,
      showTrending: true,
      showRecommended: true,
      showPopularArtists: true,
      showPopularAlbums: true,
      showPlaylists: true,
    },
    toggleOnboarding,
    setSelectedArtistId,
    setSelectedPlaylistId,
    remoteDeviceName,
  } = usePlayerStore();

  const { user } = useAuthStore();
  const activeUserId = user?.id || 'guest';

  const [isMounted, setIsMounted] = useState(false);

  const displayLang = isMounted ? (preferredLanguage || selectedLanguages?.[0] || '') : '';
  const currentLang = displayLang || 'Hindi';

  const { data: payload, isLoading } = useSWR(
    `/api/home?lang=${encodeURIComponent(currentLang)}`,
    (url) => homeFetcher(url, currentLang),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true,
    }
  );

  const [feed, setFeed] = useState<PersonalizedHomeFeed | null>(null);

  const { playlists: userPlaylists = [], fetchPlaylists } = usePlaylistStore();

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists, activeUserId]);

  useEffect(() => {
    setIsMounted(true);
    // Instant hydrate from cached snapshot if state was empty
    const cached = RecommendationEngine.getInstance().getCachedHomeFeedSnapshot(activeUserId, currentLang);
    if (cached) setFeed(cached);
  }, [activeUserId, currentLang]);

  // Load / Revalidate Personalized Recommendation Feed in Background
  useEffect(() => {
    let isCancelled = false;
    const loadPersonalized = async () => {
      try {
        const data = await RecommendationEngine.getInstance().getPersonalizedHomeFeed(activeUserId, currentLang);
        if (!isCancelled) {
          setFeed(data);
        }
      } catch (err) {
        console.warn('[HomeView] Failed to generate personalized feed:', err);
      }
    };
    loadPersonalized();
    return () => { isCancelled = true; };
  }, [currentLang, activeUserId, currentSong?.id, likedSongs.length]);

  const hours = new Date().getHours();
  const greeting = !isMounted
    ? 'Good day'
    : (hours < 12
      ? 'Good morning'
      : hours < 17
        ? 'Good afternoon'
        : hours < 21
          ? 'Good evening'
          : 'Good night');
  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'Listener';

  const coverUrl = currentSong?.coverUrl && !currentSong.coverUrl.includes('/null/')
    ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  return (
    <div className="space-y-4 sm:space-y-6 pb-4 md:pb-6 select-none relative">
      {/* 0. Continuous Atmospheric Glow */}
      {isMounted && currentSong ? (
        <div
          className="fixed top-0 left-0 right-0 h-[420px] pointer-events-none opacity-25 blur-[90px] -z-10 transition-all duration-1000"
          style={{
            backgroundImage: `url(${coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            filter: 'blur(70px) saturate(220%)',
          }}
        />
      ) : null}

      {/* 1. Header & Greeting */}
      <section className="pt-0 flex flex-col gap-2.5">
        {isMounted && currentSong ? (
          <div
            onClick={() => usePlayerStore.getState().togglePlayerExpanded()}
            className="self-start sm:self-center flex items-center gap-2 px-3 py-1 rounded-full lens-floating border border-white/20 cursor-pointer shadow-[0_6px_20px_rgba(0,0,0,0.5)] transition-all hover:scale-[1.02] active:scale-98"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPlaying ? 'bg-[#E50914] opacity-75' : 'bg-slate-400 opacity-40'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaying ? 'bg-[#E50914]' : 'bg-slate-400'}`} />
            </span>
            <span className="text-[11px] font-sans font-bold text-white truncate max-w-[210px] sm:max-w-[320px]">
              {isPlaying ? `▶ ${currentSong.title} · ${currentSong.artist}` : `Ⅱ ${currentSong.title} · Paused`}
            </span>
            {remoteDeviceName && (
              <span className="text-[9px] font-mono font-extrabold text-[#FF1E27] uppercase pl-1.5 border-l border-white/20 flex items-center gap-1">
                <Headphones className="w-3 h-3" />
                {remoteDeviceName}
              </span>
            )}
          </div>
        ) : null}

        <div>
          <h2 suppressHydrationWarning className="text-xl sm:text-3xl font-black text-white tracking-tight leading-none">
            {feed?.greeting || greeting}, {displayName} 👋
          </h2>
          <p suppressHydrationWarning className="text-xs text-slate-400 font-medium mt-1">
            Curated {isMounted && currentLang ? (
              <>in <span suppressHydrationWarning className="text-white font-bold">{currentLang}</span> based on your preferences</>
            ) : (
              <>for your personal taste</>
            )}
          </p>
        </div>

        {/* 1.5 Quick Language Selector Strip */}
        <div suppressHydrationWarning className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 pb-0.5">
          {(isMounted && selectedLanguages.length > 0 ? selectedLanguages : ['Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'English', 'Punjabi']).map((lang) => {
            const isPrimary = isMounted && currentLang.toLowerCase() === lang.toLowerCase();
            return (
              <button
                key={lang}
                suppressHydrationWarning
                onClick={() => {
                  usePlayerStore.getState().setPreferredLanguage(lang);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${isPrimary
                    ? 'bg-[#FA233B] text-white shadow-lg shadow-red-500/30'
                    : 'bg-white/5 hover:bg-white/15 text-slate-300 border border-white/10'
                  }`}
              >
                <span>{lang}</span>
                {isPrimary && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              </button>
            );
          })}

          <button
            onClick={() => toggleOnboarding(true)}
            className="px-3 py-1.5 rounded-full text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-1 flex-shrink-0 transition-colors cursor-pointer"
            title="Manage music languages & interests"
          >
            <span>+ Languages</span>
          </button>
        </div>
      </section>


      {/* 2. Continue Listening Hero */}
      {isMounted && currentSong && (
        <section
          onClick={() => togglePlayPause()}
          className="relative rounded-3xl overflow-hidden lens-crystal p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer group border border-white/20 shadow-[0_24px_60px_rgba(0,0,0,0.85)]"
        >
          <div className="flex items-center gap-4 min-w-0 z-10">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 bg-black/60 border border-white/20 group-hover:scale-105 transition-transform duration-300">
              <img src={coverUrl} alt={currentSong.title || ''} className="w-full h-full object-cover" />
            </div>

            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#E50914] uppercase tracking-widest block mb-1">
                CONTINUE LISTENING
              </span>
              <h3 className="text-base sm:text-lg font-extrabold text-white truncate leading-tight group-hover:text-[#FF1E27] transition-colors">
                {currentSong.title}
              </h3>
              <p className="text-xs text-[#94A3B8] truncate mt-1">{currentSong.artist}</p>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#E50914] hover:bg-[#FF1E27] text-white font-bold text-xs shrink-0 z-10 shadow-[0_6px_25px_rgba(229,9,20,0.55)] transition-transform active:scale-95 cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-white" />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white ml-0.5" />
                <span className="hidden sm:inline">Resume</span>
              </>
            )}
          </button>
        </section>
      )}

      {/* 3. Smart Quick Access Matrix */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={() => {
            if (feed?.recentlyPlayed && feed.recentlyPlayed.length > 0) {
              usePlayerStore.getState().playSong(feed.recentlyPlayed[0], feed.recentlyPlayed);
              usePlayerStore.getState().toggleShuffle();
            }
          }}
          className="flex items-center gap-3 p-3 rounded-2xl lens-floating border border-white/15 text-left transition-all hover:scale-[1.02] active:scale-95 shadow-md cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-[#E50914]/20 border border-[#E50914]/40 flex items-center justify-center text-[#FF1E27]">
            <Shuffle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-white">Shuffle Mix</div>
            <div className="text-[10px] text-slate-400">Personalized radio</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('artist')}
          className="flex items-center gap-3 p-3 rounded-2xl lens-floating border border-white/15 text-left transition-all hover:scale-[1.02] active:scale-95 shadow-md cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Following</div>
            <div className="text-[10px] text-slate-400">Artists & alerts</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className="flex items-center gap-3 p-3 rounded-2xl lens-floating border border-white/15 text-left transition-all hover:scale-[1.02] active:scale-95 shadow-md cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center text-[#E50914]">
            <Heart className="w-4 h-4 fill-[#E50914]" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Favorites</div>
            <div className="text-[10px] text-slate-400">{likedSongs.length} tracks</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className="flex items-center gap-3 p-3 rounded-2xl lens-floating border border-white/15 text-left transition-all hover:scale-[1.02] active:scale-95 shadow-md cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">History</div>
            <div className="text-[10px] text-slate-400">Recently played</div>
          </div>
        </button>
      </section>

      {/* 3.4 New From Artists You Follow Subscription Shelf */}
      <FollowedArtistsNewReleasesShelf />

      {/* 3.5 Recurring Music Recap Banner */}
      <RecapBanner />

      {/* 3.6 MORE LIKE WHAT YOU HEARD — Dynamic Personalized Recommendations */}
      {feed?.moreLikeWhatYouHeard && feed.moreLikeWhatYouHeard.items.length > 0 && (
        <MoreLikeWhatYouHeardShelf
          initialSongs={feed.moreLikeWhatYouHeard.items}
          seedSongTitle={feed.moreLikeWhatYouHeard.seedSongTitle}
          seedSong={feed.moreLikeWhatYouHeard.seedSong}
        />
      )}

      {/* 7. Your Top Artists */}
      {homeFeedControls.showPopularArtists !== false && feed?.topArtists && feed.topArtists.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-[#E50914]" /> Your Top Artists
          </h3>
          <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar">
            {feed.topArtists.map((artist) => (
              <div
                key={artist.id}
                onClick={() => {
                  setSelectedArtistId(artist.id);
                  setActiveTab('artist');
                }}
                className="w-24 sm:w-28 flex-shrink-0 text-center cursor-pointer group"
              >
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden mb-2 border-2 border-white/10 group-hover:border-[#E50914] transition-all shadow-md mx-auto">
                  <img
                    src={artist.coverUrl}
                    alt={artist.name}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <h4 className="text-xs font-bold text-white truncate group-hover:text-[#E50914] transition-colors">
                  {artist.name}
                </h4>
                <p className="text-[10px] text-slate-400">{artist.playCount} plays</p>
              </div>
            ))}
          </div>
        </section>
      )}


      {/* 9. NEW RELEASES — Strict Language + Date Added Ordering (added_at DESC) */}
      {homeFeedControls.showNewReleases !== false && (
        <StrictNewReleasesShelf
          initialSongs={feed?.newReleases || []}
          defaultLanguage={preferredLanguage || 'All'}
        />
      )}

      {/* 10. Playlists & Studio Mixes */}
      {homeFeedControls.showPlaylists !== false && (
        <CarouselShelf
          title="Playlists & Studio Mixes"
          icon={<ListMusic className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-purple-400 flex-shrink-0" />}
          items={[
            ...userPlaylists.map((pl) => ({
              id: pl.id,
              title: pl.title,
              subtitle: `${pl.songs?.length || pl.songIds?.length || 0} tracks • By You`,
              imageUrl: pl.coverUrl || pl.songs?.[0]?.coverUrl || '/app-icon.png',
              type: 'playlist' as const,
              rawItem: pl,
            })),
            ...getCuratedPlaylists(preferredLanguage).map((pl) => ({
              id: pl.id,
              title: pl.name,
              subtitle: `${pl.badge ? pl.badge + ' • ' : ''}${pl.desc}`,
              imageUrl: pl.coverUrl,
              type: 'playlist' as const,
              rawItem: pl,
            })),
          ]}
          showPlayAll={false}
        />
      )}

      {/* 11. Artist Discovery Shelves / Albums */}
      {homeFeedControls.showPopularAlbums !== false && <ArtistDiscoveryShelves />}

      {/* 12. Dynamic Backend Sections */}
      {!payload && isLoading ? (
        <div className="space-y-8 pt-4">
          <div className="space-y-3">
            <div className="h-4 bg-white/10 rounded w-44 animate-pulse" />
            <SkeletonGrid count={6} />
          </div>
        </div>
      ) : payload?.sections ? (
        <div className="space-y-8">
          {payload.sections.map((section: HomeSection) => {
            if (section.type === 'list_chart') {
              return <ChartListShelf key={section.id} title={section.title || ''} items={section.items} />;
            }
            return (
              <CarouselShelf
                key={section.id}
                title={section.title || ''}
                items={section.items}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
