'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { TimeThemeDetails } from '@/context/useTimeAwareTheme';
import { usePlayerStore } from '@/context/usePlayerStore';

interface LivingSkyBackdropProps {
  timeDetails: TimeThemeDetails;
}

export function LivingSkyBackdrop({ timeDetails }: LivingSkyBackdropProps) {
  const { currentSong } = usePlayerStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { period, resolvedTheme, isQuietNight } = timeDetails;
  const isDark = resolvedTheme === 'dark';

  // Editorial banner tagline
  let tagline = '';
  if (period === 'morning') {
    tagline = isDark ? 'A BRIGHTER DAY BEGINS WITH GOOD MUSIC' : 'A FRESH START WITH GREAT MUSIC';
  } else if (period === 'afternoon') {
    tagline = 'MORE MUSIC MORE POSSIBILITIES';
  } else if (period === 'evening') {
    tagline = isDark ? 'SET THE MOON & SUNSET ATMOSPHERE' : 'SUNSET GLOW & MUSIC';
  } else {
    tagline = isDark ? 'GOOD MUSIC BETTER TOMORROW' : 'CALM MIND BETTER TOMORROW';
  }

  // Realistic photographic landscape background selection
  const bgImage = useMemo(() => {
    if (period === 'morning') {
      return isDark ? '/sky/morning-dark.jpg' : '/sky/morning-light.jpg';
    } else if (period === 'afternoon') {
      return isDark ? '/sky/afternoon-dark.jpg' : '/sky/afternoon-light.jpg';
    } else if (period === 'evening') {
      return isDark ? '/sky/evening-dark.jpg' : '/sky/evening-light.jpg';
    } else {
      // Night
      return isDark ? '/sky/night-dark.jpg' : '/sky/evening-light.jpg';
    }
  }, [period, isDark]);

  return (
    <div
      aria-hidden="true"
      className="absolute -top-6 -left-4 -right-4 sm:-left-6 sm:-right-6 md:-left-8 md:-right-8 h-[380px] sm:h-[460px] pointer-events-none overflow-hidden select-none z-0 transition-all duration-1000"
    >
      {/* ── 1. High-Resolution Realistic Photographic Scenery ── */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-105"
        style={{
          backgroundImage: `url(${bgImage})`,
          opacity: isMounted ? 1 : 0,
        }}
      />

      {/* ── 2. Atmospheric Mood Tint & Readability Gradient ── */}
      <div
        className={`absolute inset-0 transition-colors duration-1000 ${
          isDark
            ? 'bg-gradient-to-t from-black via-black/50 to-black/20'
            : 'bg-gradient-to-t from-slate-50 via-slate-50/60 to-transparent'
        }`}
      />

      {/* ── 3. Currently Playing Album Artwork Ambient Overlay ── */}
      {currentSong?.coverUrl && (
        <div
          className="absolute inset-0 opacity-20 mix-blend-color-dodge transition-opacity duration-1000 blur-3xl pointer-events-none"
          style={{
            backgroundImage: `url(${currentSong.coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        />
      )}

      {/* ── 4. Top-Right Editorial Tagline Badge ── */}
      <div className="absolute top-8 right-6 sm:right-10 hidden sm:flex flex-col items-end z-10">
        <div className={`px-3 py-1.5 rounded-full backdrop-blur-md border shadow-lg ${
          isDark
            ? 'bg-black/40 border-white/10 text-white/70'
            : 'bg-white/60 border-slate-900/10 text-slate-800/80'
        }`}>
          <span className="text-[10px] tracking-[0.2em] font-black uppercase text-right leading-none block">
            {tagline}
          </span>
        </div>
      </div>

      {/* ── 5. Seamless Mask Blending into App Background ── */}
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-b from-transparent via-[var(--bg-primary)]/80 to-[var(--bg-primary)] pointer-events-none" />
    </div>
  );
}


