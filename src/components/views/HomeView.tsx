'use client';

import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { HomePayload, HomeSection, ShelfItem } from '@/types/home';
import { CarouselShelf } from '@/components/home/CarouselShelf';
import { ChartListShelf } from '@/components/home/ChartListShelf';
import { SkeletonGrid } from '@/components/ui/SkeletonLoader';
import {
  Play, Pause, Shuffle, Heart, Clock, ListMusic, User, Users,
  Headphones, Sparkles, Flame, Disc, Radio, ChevronRight,
  WifiOff, HardDrive, CheckCircle2,
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
import { MoreLikeWhatYouHeardShelf } from '@/components/home/MoreLikeWhatYouHeardShelf';
import { FollowedArtistsNewReleasesShelf } from '@/components/home/FollowedArtistsNewReleasesShelf';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { haptics } from '@/lib/haptics/HapticEngine';
import { FriendActivityEngine } from '@/lib/social/FriendActivityEngine';
import type { FriendActivityState } from '@/lib/social/FriendActivityEngine';
import { useTimeAwareTheme } from '@/context/useTimeAwareTheme';
import { ContinueListeningShelf, ContinueListeningSession } from '@/components/home/ContinueListeningShelf';

const EMPTY_SHELF_ITEMS: ShelfItem[] = [];

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
        await db.put(STORES.BROWSE_CACHE, { id: cacheKey, data, updatedAt: Date.now() }).catch(() => {});
        return data;
      }
    }
  } catch (e) {
    console.warn('[HomeView] Home fetch failed:', e);
  }

  try {
    const cached = await db.get<any>(STORES.BROWSE_CACHE, cacheKey);
    if (cached?.data?.sections?.length > 0) return cached.data;
  } catch {}

  return { greeting: 'Welcome to RaagaX 🎵', sections: defaultSections };
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

  const { data: payload, isLoading } = useSWR(
    `/api/home?lang=${encodeURIComponent(currentLang)}`,
    (url) => homeFetcher(url, currentLang),
    { revalidateOnFocus: false, dedupingInterval: 30000, keepPreviousData: true }
  );

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

  // Derive "Because You Like [Artist]" section label
  const topArtistName = feed?.topArtists?.[0]?.name;

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

  // Coordinated single-pass loading screen (prevents "part by part" flashing)
  const isInitialLoading = !payload && isLoading && !feed;
  if (isInitialLoading) {
    return (
      <div className="space-y-6 pb-8 select-none animate-in fade-in duration-300 w-full">
        {/* Header Skeleton */}
        <div className="pt-3.5">
          <div className="h-8 w-56 bg-white/10 rounded-lg animate-pulse" />
        </div>

        {/* 4 Made For You Mix Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-3xl p-5 bg-white/[0.03] border border-white/5 h-[165px] animate-pulse flex flex-col justify-between"
            >
              <div className="h-6 w-20 bg-white/[0.06] rounded-full" />
              <div className="space-y-2">
                <div className="h-4 w-3/4 bg-white/[0.08] rounded-lg" />
                <div className="h-3 w-1/2 bg-white/[0.04] rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Shelves Skeletons */}
        <div className="space-y-8 pt-2">
          <div className="space-y-3">
            <div className="h-4 bg-white/10 rounded w-44 animate-pulse" />
            <SkeletonGrid count={6} />
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-white/10 rounded w-40 animate-pulse" />
            <SkeletonGrid count={6} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-2 select-none relative animate-in fade-in duration-300">

      {/* ── Subtle Artwork Atmospheric Glow ── */}
      {isMounted && currentSong && (
        <div
          className="fixed top-0 left-0 right-0 h-[380px] pointer-events-none opacity-20 -z-10 transition-all duration-1000"
          style={{
            backgroundImage: `url(${coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            filter: 'blur(70px) saturate(220%)',
          }}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 1. TIME-AWARE COMPACT HERO                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section
        className="relative pt-8 sm:pt-10 pb-5 sm:pb-6 flex flex-col items-start select-none"
        suppressHydrationWarning
      >
        {/* Atmospheric ambient glow — time-driven via CSS vars */}
        <div
          className="absolute -top-8 -left-12 w-72 h-72 pointer-events-none -z-10 transition-all duration-700"
          style={{ background: 'var(--time-hero-glow)' }}
          aria-hidden
        />

        {/* Greeting: "🌅 GOOD MORNING, CHAN" — single medium-weight line */}
        <h1
          className="flex items-center gap-2.5 text-[22px] sm:text-[26px] md:text-[28px] font-bold text-[var(--text-primary)] tracking-tight leading-snug"
          suppressHydrationWarning
        >
          <span className="text-[20px] sm:text-[22px] shrink-0 select-none" aria-hidden>{timeTheme.icon}</span>
          <span>
            {timeTheme.greeting.split(' ').map((w, i) =>
              <span key={i}>{w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()}{' '}</span>
            )}
            <span className="text-[var(--text-secondary)] font-medium">{displayName}</span>
          </span>
        </h1>

        {/* Subtitle — one arrow, scrolls to Continue Listening */}
        <button
          onClick={() => {
            haptics.lightImpact();
            document.getElementById('continue-listening')?.scrollIntoView({ behavior: 'smooth' });
          }}
          aria-label="Scroll to Continue Listening"
          className="mt-2 flex items-center gap-1.5 text-[13px] sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer group focus-visible:outline-none focus-visible:underline"
        >
          <span>{timeTheme.subtitle}</span>
          <span
            className="text-[var(--accent-crimson)] group-hover:translate-y-px transition-transform"
            aria-hidden
          >↓</span>
        </button>

        {/* Divider */}
        <div className="mt-5 sm:mt-6 h-px w-full bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent" />
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 2. CONTINUE LISTENING RESUME SHELF                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {continueListeningSessions.length > 0 && (
        <ContinueListeningShelf sessions={continueListeningSessions} />
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ACTIVE FRIEND ACTIVITY SONG SCROLL TICKER                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeFriend ? (
        <section className="pr-2 sm:pr-3">
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
      {/* 3. MADE FOR YOU — 4 Big, Interactive, Premium Mix Cards               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-4 pr-2 sm:pr-3">
        {/* Section Header */}
        <div className="flex items-center gap-3 px-0.5">
          <div className="flex items-center justify-center text-[#FA233B] text-2xl font-bold leading-none select-none">✦</div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tracking-tight leading-none">Made For You</h2>
            <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">Personalized mixes, just for you</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {[
            {
              id: 'heavy-rotation',
              label: 'Heavy Rotation',
              badge: 'ON REPEAT',
              badgeIcon: '♨',
              desc: 'Your most played & loved tracks',
              colorClass: 'mfy-pink',
              badgeColorLight: '#f52b4e',
              badgeBorderLight: '#ff5872',
              avatarInitials: ['R', 'A', 'K'],
              avatarMore: '+2',
              icon: <Flame className="w-3.5 h-3.5" />,
              getQueue: () => {
                if (feed?.recentlyPlayed && feed.recentlyPlayed.length > 0) return feed.recentlyPlayed;
                if (feed?.topSongs && feed.topSongs.length > 0) return feed.topSongs;
                if (likedSongs.length > 0) return likedSongs as Song[];
                return feed?.madeForYou || [];
              },
            },
            {
              id: 'daily-mix',
              label: 'Daily Mix',
              badge: 'CURATED',
              badgeIcon: '✨',
              desc: 'Tailored to your current vibe',
              colorClass: 'mfy-purple',
              badgeColorLight: '#9676f6',
              badgeBorderLight: '#a991ff',
              avatarInitials: ['M', 'S', 'V'],
              avatarMore: '+3',
              icon: <Sparkles className="w-3.5 h-3.5" />,
              getQueue: () => {
                if (feed?.dailyMixes?.[0]?.songs?.length) return feed.dailyMixes[0].songs;
                if (feed?.madeForYou && feed.madeForYou.length > 0) return feed.madeForYou;
                const pool = [...(feed?.recentlyPlayed || []), ...(likedSongs as Song[])];
                return pool.length > 0 ? pool : (feed?.topSongs || []);
              },
            },
            {
              id: 'discover-mix',
              label: 'Discover Mix',
              badge: 'NEW FOR YOU',
              badgeIcon: '◉',
              desc: 'Fresh songs you might love',
              colorClass: 'mfy-cyan',
              badgeColorLight: '#22c5bd',
              badgeBorderLight: '#46d6ce',
              avatarInitials: ['D', 'P', 'J'],
              avatarMore: '+4',
              icon: <Radio className="w-3.5 h-3.5" />,
              getQueue: () => {
                if (feed?.newReleases && feed.newReleases.length > 0) return feed.newReleases;
                if (feed?.trendingSongs && feed.trendingSongs.length > 0) return feed.trendingSongs;
                return feed?.madeForYou || [];
              },
            },
            {
              id: 'favorites-mix',
              label: 'Favorites Mix',
              badge: 'LIKED',
              badgeIcon: '♥',
              desc: 'Hearted songs on endless shuffle',
              colorClass: 'mfy-magenta',
              badgeColorLight: '#e95ba9',
              badgeBorderLight: '#ec75bb',
              avatarInitials: ['A', 'N', 'R'],
              avatarMore: '+5',
              icon: <Heart className="w-3.5 h-3.5 fill-current" />,
              getQueue: () => {
                if (likedSongs.length > 0) return likedSongs as Song[];
                if (feed?.topSongs && feed.topSongs.length > 0) return feed.topSongs;
                return feed?.recentlyPlayed || [];
              },
            },
          ].map((mix) => {
            const queue = mix.getQueue();
            const trackCount = queue.length > 0 ? `${queue.length} tracks` : `${currentLang} Mix`;
            const isMixActive = currentSong && queue.some((s) => s.id === currentSong.id);
            const previewCovers = queue.slice(0, 3).map((s) => s.coverUrl).filter(Boolean);

            const handleCardClick = async () => {
              haptics.mediumImpact();
              let playableQueue = mix.getQueue();
              if (!playableQueue || playableQueue.length === 0) {
                try {
                  const fallback = await PersonalizationEngine.getInstance().getPersonalizedHomeFeed(activeUserId, currentLang);
                  playableQueue = fallback?.topSongs || fallback?.madeForYou || fallback?.trendingSongs || [];
                } catch (e) {
                  console.warn('Fallback mix fetch failed', e);
                }
              }
              if (playableQueue && playableQueue.length > 0) {
                if (mix.id === 'favorites-mix' || mix.id === 'discover-mix') {
                  usePlayerStore.getState().shufflePlay(playableQueue, { contextType: 'MADE_FOR_YOU', title: mix.label });
                } else {
                  playSong(playableQueue[0], playableQueue, { type: 'made_for_you', id: mix.id, title: mix.label });
                }
              } else {
                setActiveTab('library');
              }
            };

            return (
              <div
                key={mix.id}
                onClick={handleCardClick}
                className={`mfy-card ${mix.colorClass} relative rounded-[26px] overflow-hidden cursor-pointer group`}
              >
                {/* Animated flowing wave background */}
                <div className="mfy-flow" />

                {/* Glass overlay — light: white fade-up, dark: dark fade-up */}
                <div className="mfy-glass" />

                {/* Subtle album art tint behind glass */}
                {previewCovers[0] && (
                  <div
                    className="absolute inset-0 z-[-1] bg-cover bg-center opacity-20 dark:opacity-10 scale-110 pointer-events-none"
                    style={{ backgroundImage: `url(${previewCovers[0]})` }}
                  />
                )}

                {/* ── TOP ROW: Badge + Play ── */}
                <div className="relative z-10 flex items-start justify-between p-3 sm:p-4 pb-0">
                  {/* Badge */}
                  <div
                    className="mfy-badge flex items-center gap-1 px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest"
                    style={{
                      color: mix.badgeColorLight,
                      borderColor: mix.badgeBorderLight,
                      background: `color-mix(in srgb, ${mix.badgeColorLight} 10%, transparent)`,
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <span className="text-xs leading-none">{mix.badgeIcon}</span>
                    <span className="hidden sm:inline">{mix.badge}</span>
                    <span className="sm:hidden">{mix.badge.split(' ')[0]}</span>
                  </div>

                  {/* Play / Pause Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isMixActive && isPlaying
                        ? 'bg-[#FA233B] text-white shadow-[0_6px_16px_rgba(255,37,71,0.45)] scale-105'
                        : 'mfy-play-btn text-white group-hover:scale-105'
                    }`}
                    aria-label={isMixActive && isPlaying ? 'Pause' : 'Play'}
                  >
                    {isMixActive && isPlaying ? (
                      <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-white stroke-none" />
                    ) : (
                      <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-white stroke-none ml-0.5" />
                    )}
                  </button>
                </div>

                {/* ── BOTTOM CONTENT ── */}
                <div className="relative z-10 p-3 sm:p-4 pt-5 sm:pt-6">
                  <h3 className="text-sm sm:text-base font-black text-[var(--text-primary)] tracking-tight leading-tight mb-1">
                    {mix.label}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-medium mb-2 truncate">
                    {mix.desc}
                  </p>

                  {/* Bottom row: track count + avatar stack */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Track count pill */}
                    <span className="h-6 px-2.5 flex items-center rounded-lg bg-[var(--bg-surface)]/70 border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono text-[10px] font-black whitespace-nowrap backdrop-blur-sm">
                      {trackCount}
                    </span>

                    {/* Avatar Stack */}
                    <div className="flex items-center">
                      {mix.avatarInitials.map((initial, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-white dark:border-[var(--bg-surface)] flex items-center justify-center text-white text-[9px] font-black shadow-sm overflow-hidden"
                          style={{
                            marginLeft: i === 0 ? 0 : -5,
                            background: [
                              'linear-gradient(135deg, #ff6347, #ff9a44, #6d3cff)',
                              'linear-gradient(135deg, #111827, #f97316, #facc15)',
                              'linear-gradient(135deg, #0ea5e9, #ec4899, #f97316)',
                              'linear-gradient(135deg, #22c55e, #ef4444, #f59e0b)',
                            ][i % 4],
                          }}
                        >
                          {previewCovers[i] ? (
                            <img src={previewCovers[i]} alt={initial} className="w-full h-full object-cover" />
                          ) : initial}
                        </div>
                      ))}
                      <div
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-white dark:border-[var(--bg-surface)] bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-secondary)] text-[9px] font-black shadow-sm"
                        style={{ marginLeft: -5 }}
                      >
                        {mix.avatarMore}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

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
            imageUrl: pl.coverUrl || pl.songs?.[0]?.coverUrl || '/app-icon.png',
            type: 'playlist' as const,
            rawItem: pl,
          }))}
          showPlayAll={false}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 5. BECAUSE YOU LISTENED TO [ARTIST] — artist-based recommendations   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {feed?.moreLikeWhatYouHeard && feed.moreLikeWhatYouHeard.items.length > 0 && (
        <MoreLikeWhatYouHeardShelf
          initialSongs={feed.moreLikeWhatYouHeard.items}
          seedSongTitle={feed.moreLikeWhatYouHeard.seedSongTitle}
          seedSong={feed.moreLikeWhatYouHeard.seedSong}
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
      {/* 8. YOUR TOP ARTISTS                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {homeFeedControls.showPopularArtists !== false && feed?.topArtists && feed.topArtists.length > 0 && (
        <section className="space-y-3 pr-2 sm:pr-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#FA233B]" />
              <h2 className="text-[15px] sm:text-[17px] font-black text-white tracking-tight">
                {topArtistName ? `Because You Like ${topArtistName}` : 'Your Top Artists'}
              </h2>
            </div>
          </div>
          <div className="flex overflow-x-auto gap-4 sm:gap-5 pb-2 no-scrollbar">
            {feed.topArtists.map((artist, idx) => (
              <div
                key={artist.id ? `${artist.id}-${idx}` : `artist-${idx}`}
                onClick={() => { setSelectedArtistId(artist.id); setActiveTab('artist'); }}
                className="w-[88px] sm:w-[104px] flex-shrink-0 text-center cursor-pointer group"
              >
                <div className="relative mx-auto w-[88px] h-[88px] sm:w-[104px] sm:h-[104px] rounded-full overflow-hidden mb-2.5 border-2 border-white/10 group-hover:border-[#FA233B]/70 transition-all duration-300 shadow-lg group-hover:shadow-[0_0_20px_rgba(250,35,59,0.25)]">
                  <img
                    src={artist.coverUrl}
                    alt={artist.name}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <h4 className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-[#FA233B] transition-colors leading-tight">
                  {artist.name}
                </h4>
                <p className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 font-medium">{artist.playCount} plays</p>
              </div>
            ))}
          </div>
        </section>
      )}


      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 9. POPULAR IN YOUR LANGUAGE — Strictly language-filtered              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Recap banner placed here before "popular in language" content         */}
      <RecapBanner />

      {/* Dynamic backend sections — these can include Popular in [Language], Trending etc */}
      {!payload && isLoading ? (
        <div className="space-y-8 pt-2">
          <div className="space-y-3">
            <div className="h-4 bg-white/10 rounded w-44 animate-pulse" />
            <SkeletonGrid count={6} />
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
  );
}
