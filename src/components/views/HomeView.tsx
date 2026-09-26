'use client';

import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { HomePayload, HomeSection, ShelfItem } from '@/types/home';
import { CarouselShelf } from '@/components/home/CarouselShelf';
import { ChartListShelf } from '@/components/home/ChartListShelf';
import { HomeLoadingSkeleton } from '@/components/home/HomeLoadingSkeleton';
import {
  Play, Pause, Shuffle, Heart, Clock, ListMusic, Users,
  Headphones, Sparkles, Flame, Disc, Radio, ChevronRight,
  WifiOff, HardDrive, CheckCircle2, Repeat, Compass,
} from 'lucide-react';
import { Song } from '@/types/music';
import useSWR from 'swr';
import { getApiUrl } from '@/lib/config/apiConfig';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { getCuratedPlaylists } from '@/constants/playlists';
import { PersonalizationEngine, PersonalizedHomeFeed } from '@/lib/recommendation/PersonalizationEngine';
import { HomeFeedGenerator } from '@/lib/home/HomeFeedGenerator';
import { RecapBanner } from '@/components/home/RecapBanner';
import { RaagaDB, STORES } from '@/lib/storage/IndexedDB';
import { supabase } from '@/lib/supabase';
import { UserLifecycleManager } from '@/lib/lifecycle/UserLifecycleManager';
import { FollowedArtistsNewReleasesShelf } from '@/components/home/FollowedArtistsNewReleasesShelf';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { haptics } from '@/lib/haptics/HapticEngine';
import { FriendActivityEngine } from '@/lib/social/FriendActivityEngine';
import type { FriendActivityState } from '@/lib/social/FriendActivityEngine';
import { useTimeAwareTheme } from '@/context/useTimeAwareTheme';
import { ContinueListeningShelf, ContinueListeningSession } from '@/components/home/ContinueListeningShelf';
import { LivingSkyBackdrop } from '@/components/home/LivingSkyBackdrop';
import { LiquidMotionBackground } from '@/components/player/LiquidMotionBackground';

const EMPTY_SHELF_ITEMS: ShelfItem[] = [];

// Module-level in-memory cache for instant 0ms home feed hydration
const memoryHomePayloadCache = new Map<string, HomePayload>();

const homeFetcher = async (url: string, preferredLanguage: string) => {
  const db = RaagaDB.getInstance();
  const cacheKey = `home_${preferredLanguage}`;
  const defaultSections = HomeFeedGenerator.getHomeSectionsForLanguage(preferredLanguage);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const phase = UserLifecycleManager.getInstance().getData().phase;
    const userName = session?.user?.user_metadata?.full_name
      ? encodeURIComponent(session.user.user_metadata.full_name.split(' ')[0])
      : '';
    const fullUrl = session?.user?.id
      ? `${url}&userId=${session.user.id}&name=${userName}&phase=${phase}`
      : `${url}&phase=${phase}`;

    const res = await fetch(getApiUrl(fullUrl));
    if (res.ok) {
      const data: HomePayload = await res.json();
      // Strip trending from Home — that belongs exclusively in New
      if (data?.sections) {
        data.sections = data.sections.filter(
          (s) => !s.title?.toLowerCase().includes('trending')
        );
      }
      if (data?.sections && data.sections.length > 0) {
        memoryHomePayloadCache.set(cacheKey, data);
        await db.put(STORES.BROWSE_CACHE, { id: cacheKey, data, updatedAt: Date.now() }).catch(() => {});
        return data;
      }
    }
  } catch (e) {
    console.warn('[HomeView] Home fetch failed:', e);
  }

  try {
    const cached = await db.get<any>(STORES.BROWSE_CACHE, cacheKey);
    if (cached?.data?.sections?.length > 0) {
      memoryHomePayloadCache.set(cacheKey, cached.data);
      return cached.data;
    }
  } catch {}

  const fallback: HomePayload = { greeting: 'Welcome to RaagaX 🎵', sections: defaultSections };
  memoryHomePayloadCache.set(cacheKey, fallback);
  return fallback;
};

function songsToShelfItems(songs: Song[]): ShelfItem[] {
  return songs.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.artist,
    imageUrl: s.coverUrl,
    type: 'song' as const,
    rawItem: s,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Dedicated Offline Home View — First-Class Offline Experience
// ─────────────────────────────────────────────────────────────────────────────
function OfflineHomeView({
  downloadedSongs,
  likedSongs,
}: {
  downloadedSongs: Song[];
  likedSongs: Song[];
}) {
  const { playSong, currentSong, isPlaying } = usePlayerStore();

  const downloadedAlbums = React.useMemo(() => {
    const map = new Map<string, { title: string; coverUrl: string; songs: Song[] }>();
    downloadedSongs.forEach((song) => {
      const alb = song.album || 'Downloaded Album';
      if (!map.has(alb)) {
        map.set(alb, { title: alb, coverUrl: song.coverUrl, songs: [] });
      }
      map.get(alb)!.songs.push(song);
    });
    return Array.from(map.values());
  }, [downloadedSongs]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Offline Banner Card */}
      <div className="relative overflow-hidden p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-[#0E131F] to-[#0A0D14] border border-emerald-500/20 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <WifiOff className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Offline Mode
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {downloadedSongs.length} {downloadedSongs.length === 1 ? 'Track' : 'Tracks'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-1">Downloaded Music</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Ready to play anytime without an internet connection
              </p>
            </div>
          </div>

          {downloadedSongs.length > 0 && (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  haptics.mediumImpact();
                  playSong(downloadedSongs[0], downloadedSongs, { type: 'downloads', id: 'offline_home', title: 'Downloaded Tracks' });
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black font-bold text-xs hover:scale-105 active:scale-95 transition-transform shadow-lg cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Play All
              </button>
              <button
                onClick={() => {
                  haptics.mediumImpact();
                  usePlayerStore.getState().shufflePlay(downloadedSongs, { contextType: 'DOWNLOADS', title: 'Downloaded Tracks' });
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white font-bold text-xs hover:bg-white/15 active:scale-95 transition-all border border-white/10 cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" /> Shuffle
              </button>
            </div>
          )}
        </div>
      </div>

      {downloadedSongs.length === 0 ? (
        <div className="p-8 text-center rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
          <HardDrive className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No Downloaded Songs Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            When you're online, tap the download icon on any song, album, or playlist to save it for offline listening.
          </p>
        </div>
      ) : (
        <>
          {/* 1. Recently Downloaded Shelf */}
          <section className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-1">
              <Clock className="w-3.5 h-3.5 text-emerald-400" /> Recently Downloaded
            </h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {downloadedSongs.slice(0, 8).map((song) => {
                const isCurrent = currentSong?.id === song.id;
                return (
                  <div
                    key={`offline-recent-${song.id}`}
                    onClick={() => {
                      haptics.lightImpact();
                      playSong(song, downloadedSongs, { type: 'downloads', id: 'offline_home', title: 'Downloaded Music' });
                    }}
                    className="w-32 flex-shrink-0 cursor-pointer group"
                  >
                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-2 bg-slate-800 shadow-md border border-white/5">
                      <OptimizedImage src={song.coverUrl} alt={song.title} size="card" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                          <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                        </div>
                      </div>
                      {isCurrent && isPlaying && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-emerald-500 text-[9px] font-bold text-white uppercase">
                          Playing
                        </div>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">{song.title}</h4>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Downloaded Albums */}
          {downloadedAlbums.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-1">
                <Disc className="w-3.5 h-3.5 text-blue-400" /> Downloaded Albums
              </h2>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {downloadedAlbums.map((album) => (
                  <div
                    key={`offline-alb-${album.title}`}
                    onClick={() => {
                      haptics.lightImpact();
                      playSong(album.songs[0], album.songs, { type: 'album', id: album.title, title: album.title });
                    }}
                    className="w-36 flex-shrink-0 cursor-pointer group"
                  >
                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-2 bg-slate-800 shadow-md border border-white/5">
                      <OptimizedImage src={album.coverUrl} alt={album.title} size="card" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-bold text-white">
                        {album.songs.length} {album.songs.length === 1 ? 'song' : 'songs'}
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">{album.title}</h4>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">Offline Album</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. Your Downloaded Songs List */}
          <section className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> All Downloaded Songs ({downloadedSongs.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {downloadedSongs.map((song, idx) => {
                const isCurrent = currentSong?.id === song.id;
                return (
                  <div
                    key={`offline-track-${song.id}-${idx}`}
                    className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between group ${
                      isCurrent
                        ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg'
                        : 'bg-white/[0.025] border-white/[0.06] hover:border-white/15 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div
                      onClick={() => {
                        haptics.lightImpact();
                        playSong(song, downloadedSongs, { type: 'downloads', id: 'offline_home', title: 'Downloaded Music' });
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm flex-shrink-0 bg-slate-800 border border-white/5">
                        <OptimizedImage src={song.coverUrl} alt={song.title} size="thumb" className="w-full h-full object-cover" />
                        {isCurrent && isPlaying && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-0.5">
                            <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-[pulse_0.4s_infinite_alternate]" />
                            <span className="w-0.5 h-3 bg-white rounded-full animate-[pulse_0.5s_infinite_alternate_0.1s]" />
                            <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-[pulse_0.45s_infinite_alternate_0.2s]" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-xs font-bold truncate transition-colors ${isCurrent ? 'text-emerald-400' : 'text-white group-hover:text-emerald-400'}`}>
                          {song.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[10px] font-mono text-emerald-400/80 font-bold">✓ OFFLINE</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

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
    playSong,
  } = usePlayerStore();

  const { user } = useAuthStore();
  const activeUserId = user?.id || 'guest';

  const [isMounted, setIsMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [friendsActivity, setFriendsActivity] = useState<FriendActivityState[]>([]);

  useEffect(() => {
    const engine = FriendActivityEngine.getInstance();
    engine.init();
    setFriendsActivity(engine.getActiveActivities(true));
    const unsub = engine.onActivitiesUpdated((list) => setFriendsActivity(list));
    return () => { try { unsub(); } catch {} };
  }, []);

  const activeFriend = React.useMemo(() => {
    if (friendsActivity.length === 0) return null;
    let pinnedTags: string[] = [];
    try {
      const raw = localStorage.getItem('raagax_pinned_friends');
      if (raw) {
        pinnedTags = (JSON.parse(raw) as { tag: string }[]).map((p) => p.tag);
      }
    } catch {}

    // Strictly only show if the friend's tag was explicitly added by the user
    if (pinnedTags.length === 0) return null;

    return friendsActivity.find(
      (a) => pinnedTags.includes(a.userTag) && a.isPlaying && a.songTitle
    ) || null;
  }, [friendsActivity]);

  const { tasks, nativeDownloadedTracks, isOfflineMode } = useDownloadStore();

  const downloadedSongs: Song[] = React.useMemo(() => {
    const fromTasks = Object.values(tasks)
      .filter((t) => t.status === 'COMPLETED' && t.song)
      .map((t) => t.song);
    const fromNative: Song[] = Object.values(nativeDownloadedTracks || {}).map((t) => ({
      id: t.songId || t.id,
      title: t.title || 'Downloaded Song',
      artist: t.artist || 'Unknown Artist',
      artistId: 'offline-artist',
      album: t.album || 'Downloaded Album',
      albumId: 'offline-album',
      coverUrl: t.coverUrl || t.artworkUrl || '/app-icon.png',
      audioUrl: t.localPath || '',
      duration: 210,
      genre: 'Soundtrack',
      releaseYear: 2024,
      plays: 1,
      likes: 0,
      category: 'global_trending' as const,
    }));
    const map = new Map<string, Song>();
    fromTasks.forEach((s) => map.set(s.id, s));
    fromNative.forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  }, [tasks, nativeDownloadedTracks]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const displayLang = isMounted ? (preferredLanguage || selectedLanguages?.[0] || '') : '';
  const currentLang = displayLang || 'Hindi';
  const homeCacheKey = `home_${currentLang}`;

  const [cachedPayload, setCachedPayload] = useState<HomePayload | null>(() => {
    return memoryHomePayloadCache.get(homeCacheKey) || null;
  });

  useEffect(() => {
    let isCancelled = false;
    if (!memoryHomePayloadCache.has(homeCacheKey)) {
      RaagaDB.getInstance()
        .get<any>(STORES.BROWSE_CACHE, homeCacheKey)
        .then((cached) => {
          if (!isCancelled && cached?.data?.sections?.length > 0) {
            memoryHomePayloadCache.set(homeCacheKey, cached.data);
            setCachedPayload(cached.data);
          }
        })
        .catch(() => {});
    }
    return () => { isCancelled = true; };
  }, [homeCacheKey]);

  const { data: swrPayload, isLoading } = useSWR(
    `/api/home?lang=${encodeURIComponent(currentLang)}`,
    (url) => homeFetcher(url, currentLang),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      keepPreviousData: true,
      fallbackData: memoryHomePayloadCache.get(homeCacheKey) || undefined,
    }
  );

  const payload = swrPayload || cachedPayload;

  const [feed, setFeed] = useState<PersonalizedHomeFeed | null>(null);
  const { playlists: userPlaylists = [], fetchPlaylists } = usePlaylistStore();

  useEffect(() => { fetchPlaylists(); }, [fetchPlaylists, activeUserId]);

  useEffect(() => {
    setIsMounted(true);
    const cached = PersonalizationEngine.getInstance().getCachedHomeFeedSnapshot(activeUserId, currentLang);
    if (cached) setFeed(cached);
  }, [activeUserId, currentLang]);

  useEffect(() => {
    let isCancelled = false;
    const loadPersonalized = async () => {
      try {
        const data = await PersonalizationEngine.getInstance().getPersonalizedHomeFeed(activeUserId, currentLang);
        if (!isCancelled) setFeed(data);
      } catch (err) {
        console.warn('[HomeView] Personalized feed error:', err);
      }
    };
    loadPersonalized();
    return () => { isCancelled = true; };
  }, [currentLang, activeUserId, currentSong?.id, likedSongs.length]);

  const isActuallyOffline = isMounted && (!isOnline || isOfflineMode);

  const timeTheme = useTimeAwareTheme();
  const greeting = timeTheme.greeting;

  const continueListeningSessions = React.useMemo<ContinueListeningSession[]>(() => {
    if (!feed?.recentlyPlayed || feed.recentlyPlayed.length === 0) return [];
    return feed.recentlyPlayed.slice(0, 6).map((song, idx) => {
      const mockDurations = [268, 224, 195, 310, 240, 180];
      const mockOffsets = [134, 182, 95, 210, 145, 60];
      const duration = song.duration ? Number(song.duration) : mockDurations[idx % mockDurations.length];
      const currentTime = mockOffsets[idx % mockOffsets.length];
      return {
        id: song.id,
        song,
        currentTimeSec: currentTime,
        durationSec: duration,
        lastPlayedAt: Date.now() - idx * 3600000,
      };
    });
  }, [feed?.recentlyPlayed]);

  const recentlyPlayedItems = React.useMemo(() => {
    return feed?.recentlyPlayed && feed.recentlyPlayed.length > 0
      ? songsToShelfItems(feed.recentlyPlayed)
      : [];
  }, [feed?.recentlyPlayed]);

  const recommendedPlaylistItems = React.useMemo(() => {
    const curated = getCuratedPlaylists(preferredLanguage);
    return curated.map((pl, cIdx) => ({
      id: pl.id || `curated-pl-${cIdx}`,
      title: pl.name,
      subtitle: `${pl.badge ? pl.badge + ' • ' : ''}${pl.desc}`,
      imageUrl: pl.coverUrl,
      type: 'playlist' as const,
      rawItem: pl,
    }));
  }, [preferredLanguage]);
  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || user?.user_metadata?.name?.split(' ')[0] || 'Chan';

  const coverUrl = currentSong?.coverUrl && !currentSong.coverUrl.includes('/null/')
    ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  if (isActuallyOffline) {
    return (
      <div className="space-y-5 sm:space-y-6 pb-4 md:pb-6 select-none relative animate-in fade-in duration-300">
        <OfflineHomeView
          downloadedSongs={downloadedSongs}
          likedSongs={likedSongs as Song[]}
        />
      </div>
    );
  }

  // 1. SSR & Hydration Safety Gate:
  // Both server and client render identical deterministic skeleton on initial pass
  if (!isMounted) {
    return (
      <div className="pb-2 select-none relative" suppressHydrationWarning>
        <div className="relative z-10 space-y-5 sm:space-y-6">
          <HomeLoadingSkeleton greeting="Welcome to RaagaX 🎵" />
        </div>
      </div>
    );
  }

  // 2. Coordinated single-pass loading screen (prevents "part by part" flashing)
  const isInitialLoading = !payload && isLoading && !feed;

  return (
    <div className="pb-2 select-none relative animate-in fade-in duration-300" suppressHydrationWarning>

      {/* ── Complete Full-Screen Total Living Gradient Backdrop System (Z-0) ── */}
      <LivingSkyBackdrop timeDetails={timeTheme} />

      {/* ── Main Home Page Content Layer (Z-10) ── */}
      <div className="relative z-10 space-y-5 sm:space-y-6">
        {isInitialLoading ? (
          <HomeLoadingSkeleton greeting={greeting} />
        ) : (
          <div className="space-y-5 sm:space-y-6 transition-all duration-500 ease-out animate-in fade-in">



      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ACTIVE FRIEND ACTIVITY SONG SCROLL TICKER                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeFriend ? (
        <section>
          <div className="relative rounded-2xl p-3.5 sm:p-4 bg-gradient-to-r from-purple-900/40 via-red-950/40 to-slate-900/80 border border-purple-500/30 shadow-xl overflow-hidden flex items-center justify-between gap-4">
            {/* Left Side: Only Song Title & Artist */}
            <div className="flex-1 min-w-0 flex items-center gap-2 text-white font-bold text-xs sm:text-sm overflow-hidden">
              <span className="text-[#FA233B] flex-shrink-0 animate-pulse">🎵</span>
              <span className="truncate">{activeFriend.songTitle}</span>
              <span className="text-slate-400 font-normal truncate">— {activeFriend.artist}</span>
            </div>

            {/* Right Side: Friend Activity Status */}
            <div className="flex items-center gap-2 flex-shrink-0 bg-white/10 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-bold text-white truncate max-w-[130px] sm:max-w-none">
                {activeFriend.userName} is listening live
              </span>
            </div>
          </div>
        </section>
      ) : null}


      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 4. YOUR PLAYLISTS — Prominently displayed user-created playlists       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {userPlaylists.length > 0 && (
        <CarouselShelf
          title="Your Playlists"
          subtitle="Playlists in your library"
          icon={<ListMusic className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-[#FA233B] flex-shrink-0" />}
          items={userPlaylists.map((pl, pIdx) => ({
            id: pl.id || `user-pl-${pIdx}`,
            title: pl.title || (pl as any).name || 'Untitled Playlist',
            subtitle: `${pl.songs?.length || pl.songIds?.length || 0} tracks`,
            imageUrl: pl.coverUrl && pl.coverUrl !== '/app-icon.png' && !pl.coverUrl.includes('default-playlist-cover') ? pl.coverUrl : '',
            type: 'playlist' as const,
            rawItem: pl,
          }))}
          showPlayAll={false}
        />
      )}


      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 6. RECENTLY PLAYED — Compact 2-col list, not carousel                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 7. MORE LIKE WHAT YOU LISTEN TO — Similar songs/artists               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FollowedArtistsNewReleasesShelf covers "Because you follow [artist]"  */}
      <FollowedArtistsNewReleasesShelf />



      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 9. POPULAR IN YOUR LANGUAGE — Strictly language-filtered              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Recap banner placed here before "popular in language" content         */}
      <RecapBanner />

      {/* Dynamic backend sections — these can include Popular in [Language], Trending etc */}
      {!payload && isLoading ? (
        <div className="space-y-6 pt-1">
          <div className="space-y-3">
            <div className="h-4 bg-white/[0.08] rounded-md w-44 luxury-shimmer" />
            <div className="flex gap-3 sm:gap-4 overflow-x-hidden no-scrollbar pt-1 pb-3 -mx-3.5 px-3.5 sm:-mx-8 sm:px-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`dyn-skel-${i}`}
                  className="p-3 sm:p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] w-[140px] sm:w-[172px] flex-shrink-0 space-y-2.5"
                >
                  <div className="relative w-full aspect-square rounded-xl bg-white/[0.05] luxury-shimmer overflow-hidden shadow-inner" />
                  <div className="h-3 w-4/5 rounded-md bg-white/[0.07] luxury-shimmer" />
                  <div className="h-2.5 w-1/2 rounded-md bg-white/[0.04] luxury-shimmer" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : payload?.sections ? (
        <div className="space-y-8">
          {payload.sections.map((section: HomeSection, sIdx: number) => {
            const sectionKey = section.id ? `${section.id}-${sIdx}` : `sec-${sIdx}`;
            if (section.type === 'list_chart') {
              return <ChartListShelf key={sectionKey} title={section.title || ''} items={section.items} />;
            }
            return (
              <CarouselShelf
                key={sectionKey}
                title={section.title || ''}
                items={section.items || EMPTY_SHELF_ITEMS}
              />
            );
          })}
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 10. RECOMMENDED PLAYLISTS — Curated + User playlists                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {homeFeedControls.showPlaylists !== false && recommendedPlaylistItems.length > 0 && (
        <CarouselShelf
          title="Recommended Playlists"
          icon={<ListMusic className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-purple-400 flex-shrink-0" />}
          items={recommendedPlaylistItems}
          showPlayAll={false}
        />
      )}
          </div>
        )}
      </div>
    </div>
  );
}
