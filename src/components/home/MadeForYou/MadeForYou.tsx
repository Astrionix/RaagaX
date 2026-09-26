'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Sparkles, Heart, Coffee, Compass, Disc3 } from 'lucide-react';
import { FluidCard, MadeForYouCardData } from './FluidCard';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { Song } from '@/types/music';
import { PersonalizationEngine, PersonalizedHomeFeed } from '@/lib/recommendation/PersonalizationEngine';
import { haptics } from '@/lib/haptics/HapticEngine';

export interface MadeForYouProps {
  feed?: PersonalizedHomeFeed | null;
  likedSongs?: Song[];
  activeUserId?: string;
  currentLang?: string;
}

export function MadeForYou({
  feed: propFeed,
  likedSongs: propLikedSongs,
  activeUserId: propUserId,
  currentLang: propLang,
}: MadeForYouProps = {}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const {
    currentSong,
    isPlaying,
    playSong,
    togglePlayPause,
    likedSongs: storeLikedSongs = [],
    setActiveTab,
  } = usePlayerStore();

  const { user } = useAuthStore();
  const activeUserId = propUserId || user?.id || 'guest';
  const currentLang = propLang || 'Hindi';
  const likedSongs = propLikedSongs || storeLikedSongs;

  // Local feed snapshot state if not passed from HomeView
  const [localFeed, setLocalFeed] = useState<PersonalizedHomeFeed | null>(null);

  useEffect(() => {
    if (propFeed) {
      setLocalFeed(propFeed);
      return;
    }

    const cached = PersonalizationEngine.getInstance().getCachedHomeFeedSnapshot(activeUserId, currentLang);
    if (cached) {
      setLocalFeed(cached);
    }

    let isCancelled = false;
    PersonalizationEngine.getInstance()
      .getPersonalizedHomeFeed(activeUserId, currentLang)
      .then((data) => {
        if (!isCancelled && data) setLocalFeed(data);
      })
      .catch((err) => {
        console.warn('[MadeForYou] Feed fetch error:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [propFeed, activeUserId, currentLang]);

  const feed = propFeed || localFeed;

  // Entrance Observer: Smooth fade-in when section enters viewport
  useEffect(() => {
    if (!sectionRef.current || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Construct 4 Dynamic Mix Cards ──
  const cards: MadeForYouCardData[] = useMemo(() => {
    // 1. Favorites Mix (Midnight Violet) — Songs you love, all in one place.
    const favoritesQueue: Song[] =
      likedSongs.length > 0
        ? (likedSongs as Song[])
        : feed?.topSongs && feed.topSongs.length > 0
        ? feed.topSongs
        : feed?.recentlyPlayed || [];

    // 2. Chill Mix (Deep Ocean) — Relaxing tracks for your mood.
    const chillQueue: Song[] =
      feed?.dailyMixes?.[0]?.songs && feed.dailyMixes[0].songs.length > 0
        ? feed.dailyMixes[0].songs
        : feed?.madeForYou && feed.madeForYou.length > 0
        ? feed.madeForYou
        : [...(feed?.recentlyPlayed || []), ...(likedSongs as Song[])].length > 0
        ? [...(feed?.recentlyPlayed || []), ...(likedSongs as Song[])]
        : feed?.topSongs || [];

    // 3. New Music Mix (Burgundy Rose) — Fresh tracks picked for you.
    const newMusicQueue: Song[] =
      feed?.newReleases && feed.newReleases.length > 0
        ? feed.newReleases
        : feed?.trendingSongs && feed.trendingSongs.length > 0
        ? feed.trendingSongs
        : feed?.madeForYou || [];

    // 4. Discovery Mix (Emerald Noir) — Artists and songs you’ll love.
    const discoveryQueue: Song[] =
      feed?.madeForYou && feed.madeForYou.length > 0
        ? feed.madeForYou
        : feed?.trendingSongs && feed.trendingSongs.length > 0
        ? feed.trendingSongs
        : feed?.newReleases || [];

    return [
      {
        id: 'favorites-mix',
        title: 'Favorites Mix',
        description: 'Songs you love, all in one place.',
        badge: 'FAVORITES',
        badgeIcon: <Heart className="w-3 h-3 fill-current text-[#9B6BFF]" />,
        trackCount: `${favoritesQueue.length || 20} tracks`,
        palette: 'midnight-violet',
        seed: 1.42,
        queue: favoritesQueue,
        isShuffle: true,
      },
      {
        id: 'chill-mix',
        title: 'Chill Mix',
        description: 'Relaxing tracks for your mood.',
        badge: 'CHILL',
        badgeIcon: <Coffee className="w-3 h-3 text-[#2389A8]" />,
        trackCount: `${chillQueue.length || 15} tracks`,
        palette: 'deep-ocean',
        seed: 2.85,
        queue: chillQueue,
        isShuffle: false,
      },
      {
        id: 'new-music-mix',
        title: 'New Music Mix',
        description: 'Fresh tracks picked for you.',
        badge: 'NEW RELEASES',
        badgeIcon: <Disc3 className="w-3 h-3 text-[#A84D6F]" />,
        trackCount: `${newMusicQueue.length || 15} tracks`,
        palette: 'burgundy-rose',
        seed: 4.19,
        queue: newMusicQueue,
        isShuffle: false,
      },
      {
        id: 'discovery-mix',
        title: 'Discovery Mix',
        description: 'Artists and songs you’ll love.',
        badge: 'DISCOVERY',
        badgeIcon: <Compass className="w-3 h-3 text-[#299477]" />,
        trackCount: `${discoveryQueue.length || 15} tracks`,
        palette: 'emerald-noir',
        seed: 7.63,
        queue: discoveryQueue,
        isShuffle: true,
      },
    ];
  }, [feed, likedSongs]);

  // ── Card Click & Playback Handler ──
  const handlePlayCard = async (card: MadeForYouCardData) => {
    haptics.mediumImpact();

    let playableQueue = card.queue || [];

    // Check if the current song is already playing from this card's queue
    const isThisMixActive = Boolean(
      currentSong && playableQueue.some((s) => s.id === currentSong.id)
    );

    if (isThisMixActive) {
      togglePlayPause();
      return;
    }

    // Dynamic fallback for fresh cold-start users
    if (playableQueue.length === 0) {
      try {
        const fallback = await PersonalizationEngine.getInstance().getPersonalizedHomeFeed(
          activeUserId,
          currentLang
        );
        playableQueue =
          fallback?.topSongs || fallback?.madeForYou || fallback?.trendingSongs || [];
      } catch (e) {
        console.warn('[MadeForYou] Fallback mix fetch failed:', e);
      }
    }

    if (playableQueue && playableQueue.length > 0) {
      if (card.isShuffle) {
        usePlayerStore.getState().shufflePlay(playableQueue, {
          contextType: 'MADE_FOR_YOU',
          title: card.title,
        });
      } else {
        playSong(playableQueue[0], playableQueue, {
          type: 'made_for_you',
          id: card.id,
          title: card.title,
        });
      }
    } else {
      setActiveTab('library');
    }
  };

  return (
    <section ref={sectionRef} className="space-y-4 sm:space-y-5 my-6 select-none">
      {/* ── Section Header ── */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center text-[#FA233B] text-2xl font-bold leading-none select-none">
            ✦
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight leading-none">
              Made For You
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium mt-1">
              Personalized mixes curated for your taste
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-semibold text-white/75 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-[#FA233B]" />
          <span>Curated Mixes</span>
        </div>
      </div>

      {/* ── 2-Column × 2-Row Responsive Grid (Mobile: 1 × 4, Tablet/Desktop: 2 × 2) ── */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 transition-all duration-700 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {cards.map((card, idx) => {
          const isCurrentCardActive = Boolean(
            currentSong &&
              card.queue &&
              card.queue.some((s) => s.id === currentSong.id)
          );
          const isCurrentCardPlaying = Boolean(isPlaying) && isCurrentCardActive;

          return (
            <FluidCard
              key={card.id}
              item={card}
              isPlaying={isCurrentCardPlaying}
              onPlayClick={handlePlayCard}
              staggerIndex={idx}
            />
          );
        })}
      </div>
    </section>
  );
}
