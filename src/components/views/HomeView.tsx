'use client';

import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { useThemeStore } from '@/context/useThemeStore';
import { HomePayload, HomeSection, ShelfItem } from '@/types/home';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { CarouselShelf } from '@/components/home/CarouselShelf';
import { ChartListShelf } from '@/components/home/ChartListShelf';
import { SkeletonGrid } from '@/components/ui/SkeletonLoader';
import { Play, Pause, Clock, Sparkles, Disc, Shuffle, Download, Heart, History, Flame, Bell, Laptop, Smartphone, Headphones } from 'lucide-react';
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

  const res = await fetch(fullUrl).catch(() => null);

  if (!res || !res.ok) throw new Error('Failed to fetch home');
  const data: HomePayload = await res.json();

  // Filter out any "This Week's Releases" or "new_releases" sections if present
  if (data?.sections) {
    data.sections = data.sections.filter(
      (s: HomeSection) => s.id !== 'this_week_releases' && s.id !== 'new_releases' && !s.title?.toLowerCase().includes('this week')
    );
  }

  return data;
};

function songsToShelfItems(songs: Song[]): ShelfItem[] {
  return songs.map(s => ({
    id: s.id,
    title: s.title,
    subtitle: s.artist,
    imageUrl: s.coverUrl,
    type: 'song',
    rawItem: s
  }));
}

function albumsToShelfItems(albums: any[]): ShelfItem[] {
  return albums.map(a => ({
    id: a.id,
    title: a.title,
    subtitle: `${a.year ? a.year + ' • ' : ''}${a.artist || 'Album'}`,
    imageUrl: a.coverUrl,
    type: 'album',
    rawItem: a
  }));
}

export function HomeView() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    togglePlayPause,
    setActiveTab,
    likedSongs = [],
    preferredLanguage,
    activeDeviceId,
    onlineDevices,
    toggleDeviceModal,
    remoteDeviceName,
  } = usePlayerStore();

  const { user } = useAuthStore();
  const activeUserId = user?.id;

  const { data: payload, error, isLoading } = useSWR(
    `/api/home?preferredLanguage=${preferredLanguage || 'telugu'}`,
    (url) => homeFetcher(url, preferredLanguage || 'telugu'),
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000,
    }
  );

  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [recommended, setRecommended] = useState<Song[]>([]);
  const [recommendedAlbums, setRecommendedAlbums] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { QueueHistory } = await import('@/lib/queue/QueueHistory');
        const historyInstance = QueueHistory.getInstance();
        await historyInstance.ensureLoaded();
        let entries = historyInstance.getRecentlyPlayed(30);

        const seen = new Set<string>();
        const songs: Song[] = [];

        for (let i = entries.length - 1; i >= 0; i--) {
          const s = entries[i].song;
          if (s && !seen.has(s.id)) {
            seen.add(s.id);
            songs.push(s);
          }
        }

        if (songs.length < 4) {
          for (const s of likedSongs) {
            if (s && !seen.has(s.id)) {
              seen.add(s.id);
              songs.push(s);
            }
          }
        }

        setRecentlyPlayed(songs.slice(0, 10));
      } catch (e) {
        console.warn('[HomeView] Could not load recently played:', e);
      }
    };
    load();
  }, [currentSong?.id, likedSongs]);

  useEffect(() => {
    const load = async () => {
      try {
        const { UserLifecycleManager } = await import('@/lib/lifecycle/UserLifecycleManager');
        const { RecommendationEngine } = await import('@/lib/recommendation/RecommendationEngine');
        const { AlbumRecommendationEngine } = await import('@/lib/recommendation/AlbumRecommendationEngine');

        const selectedLangs = UserLifecycleManager.getInstance().getData().selectedLanguages ?? (preferredLanguage ? [preferredLanguage] : []);
        const uid = activeUserId || 'guest';
        const recSongs = await RecommendationEngine.getInstance().getRecommendations(uid, selectedLangs);
        setRecommended(recSongs);

        const recAlbums = await AlbumRecommendationEngine.getInstance().getRecommendedAlbums(uid, selectedLangs);
        setRecommendedAlbums(recAlbums);
      } catch (e) {
        console.warn('[HomeView] Could not load recommendations:', e);
      }
    };
    load();
  }, [preferredLanguage, activeUserId, payload?.sections?.length]);

  const hours = new Date().getHours();
  const greeting = !isMounted ? 'Good day' : (hours < 12 ? 'Good morning' : hours < 17 ? 'Good afternoon' : 'Good evening');
  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'Ram';

  const coverUrl = currentSong?.coverUrl && !currentSong.coverUrl.includes('/null/')
    ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  return (
    <div className="space-y-4 pb-20 md:pb-10 select-none relative">

      {/* ======================================================== */}
      {/* 0. CONTINUOUS ATMOSPHERIC BLUR LAYER                      */}
      {/* ======================================================== */}
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

      {/* ======================================================== */}
      {/* 1. TOP HEADER & CONTEXTUAL GREETING                       */}
      {/* ======================================================== */}
      <section className="pt-0 flex flex-col gap-2.5">

        {/* Dynamic Island Style Playback Status Capsule (Level 2 Floating Lens) */}
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

        {/* Contextual Greeting */}
        <div>
          <h2 suppressHydrationWarning className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none">
            {greeting}, {displayName}
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">What do you want to hear today?</p>
        </div>

        {/* Smart Natural Language Search Bar (Level 1 Soft Lens) */}
        <div
          onClick={() => setActiveTab('search')}
          className="md:hidden flex items-center justify-between px-3.5 py-2.5 rounded-2xl lens-soft border border-white/15 hover:border-[#E50914]/50 text-[#94A3B8] cursor-pointer transition-all active:scale-[0.99] shadow-lg group"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#E50914] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-slate-300">✦ Search songs, lyrics, or ask AI DJ...</span>
          </div>
          <div className="w-6 h-6 rounded-full bg-white/5 group-hover:bg-[#E50914]/20 flex items-center justify-center text-slate-400 group-hover:text-white text-xs transition-colors">
            🎙
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. HERO "CONTINUE LISTENING" (Level 3 Crystal Lens)      */}
      {/* ======================================================== */}
      {isMounted && currentSong ? (
        <section
          onClick={() => togglePlayPause()}
          className="relative rounded-3xl overflow-hidden lens-crystal p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer group border border-white/20 shadow-[0_24px_60px_rgba(0,0,0,0.85)]"
        >
          {/* Specular Top Rim Reflection */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

          {/* Chromatic Backlight from Album Art */}
          <div
            className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full pointer-events-none opacity-30 blur-2xl transition-opacity duration-700"
            style={{
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: 'cover',
            }}
          />

          <div className="flex items-center gap-4 min-w-0 z-10">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 bg-black/60 border border-white/20 group-hover:scale-105 transition-transform duration-300">
              <img
                src={coverUrl}
                alt={currentSong.title || ''}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
            </div>

            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#E50914] uppercase tracking-widest block mb-1">
                CONTINUE LISTENING
              </span>
              <h3 className="text-base sm:text-lg font-extrabold text-white truncate leading-tight group-hover:text-[#FF1E27] transition-colors">
                {currentSong.title}
              </h3>
              <p className="text-xs text-[#94A3B8] truncate mt-1">
                {currentSong.artist}
              </p>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#E50914] hover:bg-[#FF1E27] text-white font-bold text-xs shrink-0 z-10 shadow-[0_6px_25px_rgba(229,9,20,0.55)] transition-transform active:scale-95"
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
      ) : null}

      {/* ======================================================== */}
      {/* 3. SMART QUICK ACCESS MATRIX (Level 2 Floating Lens)      */}
      {/* ======================================================== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">Quick Access</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Primary: Shuffle Mix */}
          <button
            onClick={() => {
              if (recentlyPlayed.length > 0) {
                usePlayerStore.getState().playSong(recentlyPlayed[0]);
                usePlayerStore.getState().toggleShuffle();
              }
            }}
            className="flex items-center gap-3 p-3.5 rounded-2xl lens-floating border border-white/18 text-left transition-all hover:scale-[1.02] active:scale-95 shadow-md group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#E50914]/20 border border-[#E50914]/40 flex items-center justify-center text-[#FF1E27] group-hover:scale-105 transition-transform">
              <Shuffle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-white">Shuffle Mix</div>
              <div className="text-[10px] text-slate-400">Personalized radio</div>
            </div>
          </button>

          {/* Secondary: Offline Downloads */}
          <button
            onClick={() => setActiveTab('downloads')}
            className="flex items-center gap-3 p-3.5 rounded-2xl lens-floating border border-white/15 text-left transition-all hover:scale-[1.02] active:scale-95 shadow-md"
          >
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Downloads</div>
              <div className="text-[10px] text-slate-400">Sandboxed offline</div>
            </div>
          </button>

          {/* Liked Songs */}
          <button
            onClick={() => setActiveTab('favorites')}
            className="flex items-center gap-3 p-3.5 rounded-2xl lens-floating border border-white/15 text-left transition-all hover:scale-[1.02] active:scale-95 shadow-md"
          >
            <div className="w-9 h-9 rounded-xl bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center text-[#E50914]">
              <Heart className="w-4 h-4 fill-[#E50914]" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Liked Songs</div>
              <div className="text-[10px] text-slate-400">{likedSongs.length} favorites</div>
            </div>
          </button>

          {/* History */}
          <button
            onClick={() => setActiveTab('library')}
            className="flex items-center gap-3 p-3.5 rounded-2xl lens-floating border border-white/15 text-left transition-all hover:scale-[1.02] active:scale-95 shadow-md"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Listening History</div>
              <div className="text-[10px] text-slate-400">Recently played</div>
            </div>
          </button>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. SMART PERSONALIZED INSIGHT CARD (Level 1 Soft Lens)   */}
      {/* ======================================================== */}
      <section className="p-3.5 px-4 rounded-2xl lens-soft border border-white/15 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#E50914]/15 flex items-center justify-center text-[#FF1E27] flex-shrink-0">
            ✦
          </div>
          <p className="text-xs text-slate-300 font-medium truncate">
            Your evening Telugu melodies are up <span className="text-[#FF1E27] font-bold">24% this week</span>.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('profile')}
          className="text-[11px] font-bold text-[#FF1E27] hover:underline flex-shrink-0"
        >
          View DNA →
        </button>
      </section>

      {/* ======================================================== */}
      {/* 5. RECENTLY PLAYED & MADE FOR YOU SHELVES                */}
      {/* ======================================================== */}
      {recentlyPlayed.length > 0 && (
        <CarouselShelf
          title="Recently Played"
          icon={<Clock className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-cyan-400 flex-shrink-0" />}
          items={songsToShelfItems(recentlyPlayed)}
          showPlayAll={true}
        />
      )}

      {recommended.length > 0 && (
        <CarouselShelf
          title="Made For You"
          icon={<Sparkles className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-[#E50914] flex-shrink-0" />}
          items={songsToShelfItems(recommended)}
          showPlayAll={true}
        />
      )}

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

      {/* Dynamic Backend Sections */}
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
      )}

    </div>
  );
}
