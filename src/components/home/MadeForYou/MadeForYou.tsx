'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { FluidCard, MadeForYouCardData } from './FluidCard';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

export const MADE_FOR_YOU_DATA: MadeForYouCardData[] = [
  {
    id: 'mfy-banti-poola-janaki',
    title: 'Banti Poola Janaki',
    artist: 'Thaman S',
    palette: 'magenta',
    seed: 1.42,
  },
  {
    id: 'mfy-oosupodhu',
    title: 'Oosupodhu',
    artist: 'Artist',
    palette: 'blue',
    seed: 2.85,
  },
  {
    id: 'mfy-kesariya',
    title: 'Kesariya',
    artist: 'Pritam',
    palette: 'amber',
    seed: 4.19,
  },
  {
    id: 'mfy-manasa',
    title: 'Manasa',
    artist: 'Anirudh Ravichander',
    palette: 'emerald',
    seed: 7.63,
  },
];

export function MadeForYou() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const { currentSong, isPlaying, playSong, togglePlayPause, likedSongs = [], queue = [] } = usePlayerStore();

  // Entrance Observer: Stagger entrance animation when section enters viewport
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
      { threshold: 0.15 }
    );

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handlePlayCard = (card: MadeForYouCardData) => {
    const isCurrent =
      currentSong &&
      (currentSong.id === card.id || currentSong.title.toLowerCase().includes(card.title.toLowerCase()));

    if (isCurrent) {
      togglePlayPause();
      return;
    }

    // Try to find a matching song from the user's likedSongs or queue
    const pool = [...likedSongs, ...queue];
    const match = pool.find((s) => s.title.toLowerCase().includes(card.title.toLowerCase()));

    const targetSong: Song = match || {
      id: card.id,
      title: card.title,
      artist: card.artist,
      artistId: 'mfy-artist',
      album: 'Made For You Mix',
      albumId: 'mfy-album',
      coverUrl: '/app-icon.png',
      audioUrl: '',
      duration: 210,
      genre: 'Soundtrack',
      releaseYear: 2024,
      plays: 1000,
      likes: 500,
      category: 'global_trending',
    };

    // Construct full queue for Made For You section
    const fullQueue: Song[] = MADE_FOR_YOU_DATA.map((item) => {
      const m = pool.find((s) => s.title.toLowerCase().includes(item.title.toLowerCase()));
      return (
        m || {
          id: item.id,
          title: item.title,
          artist: item.artist,
          artistId: 'mfy-artist',
          album: 'Made For You Mix',
          albumId: 'mfy-album',
          coverUrl: '/app-icon.png',
          audioUrl: '',
          duration: 210,
          genre: 'Soundtrack',
          releaseYear: 2024,
          plays: 1000,
          likes: 500,
          category: 'global_trending',
        }
      );
    });

    playSong(targetSong, fullQueue, {
      type: 'playlist',
      id: 'made_for_you',
      title: 'Made for You',
    });
  };

  return (
    <section ref={sectionRef} className="space-y-4 sm:space-y-5 my-6">
      {/* ── Section Header ── */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center text-[#FA233B] text-2xl font-bold leading-none select-none">
            ✦
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight leading-none">
              Made for You
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium mt-1">
              Living 3D music artwork crafted for your taste
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-semibold text-white/80">
          <Sparkles className="w-3.5 h-3.5 text-[#FA233B]" />
          <span>Generative 3D</span>
        </div>
      </div>

      {/* ── Responsive Card Grid / Mobile Carousel ── */}
      <div
        className={`flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6 overflow-x-auto sm:overflow-x-visible snap-x snap-mandatory scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-4 sm:pb-0 transition-all duration-700 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {MADE_FOR_YOU_DATA.map((card, idx) => {
          const isCurrentCardPlaying =
            Boolean(isPlaying) &&
            Boolean(
              currentSong &&
                (currentSong.id === card.id ||
                  currentSong.title.toLowerCase().includes(card.title.toLowerCase()))
            );

          return (
            <div
              key={card.id}
              className="w-[82vw] max-w-[300px] flex-shrink-0 snap-center sm:w-auto"
            >
              <FluidCard
                item={card}
                isPlaying={isCurrentCardPlaying}
                onPlayClick={handlePlayCard}
                staggerIndex={idx}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
