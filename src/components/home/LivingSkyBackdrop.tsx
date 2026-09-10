'use client';

import React, { useEffect, useState } from 'react';
import { TimeThemeDetails } from '@/context/useTimeAwareTheme';
import { usePlayerStore } from '@/context/usePlayerStore';

interface LivingSkyBackdropProps {
  timeDetails: TimeThemeDetails;
}

export function LivingSkyBackdrop({ timeDetails }: LivingSkyBackdropProps) {
  const { currentSong } = usePlayerStore();
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const handleVisibility = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleMotionChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      mediaQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  const { period, resolvedTheme, isQuietNight } = timeDetails;
  const isDark = resolvedTheme === 'dark';

  // Environment sky gradients for all 4 periods across Dark and Light themes
  let skyGradient = '';
  let tagline = '';

  if (period === 'morning') {
    tagline = isDark ? 'A BRIGHTER DAY BEGINS WITH GOOD MUSIC' : 'A FRESH START WITH GREAT MUSIC';
    skyGradient = isDark
      ? 'linear-gradient(180deg, #091322 0%, #172942 30%, #5c2f1a 65%, #c86927 88%, #160d09 100%)'
      : 'linear-gradient(180deg, #dbeafe 0%, #fef3c7 40%, #ffedd5 75%, #f8fafc 100%)';
  } else if (period === 'afternoon') {
    tagline = 'MORE MUSIC MORE POSSIBILITIES';
    skyGradient = isDark
      ? 'linear-gradient(180deg, #081d34 0%, #0e3766 35%, #185a9d 70%, #0a1828 100%)'
      : 'linear-gradient(180deg, #93c5fd 0%, #bae6fd 45%, #e0f2fe 80%, #f8fafc 100%)';
  } else if (period === 'evening') {
    tagline = isDark ? 'SET THE MOON & SUNSET ATMOSPHERE' : 'SUNSET GLOW & MUSIC';
    skyGradient = isDark
      ? 'linear-gradient(180deg, #150a24 0%, #36144c 35%, #6e1c44 70%, #f97316 92%, #14070a 100%)'
      : 'linear-gradient(180deg, #edd8f6 0%, #fce7f3 40%, #ffedd5 80%, #f8fafc 100%)';
  } else {
    // Night
    tagline = isDark ? 'GOOD MUSIC BETTER TOMORROW' : 'CALM MIND BETTER TOMORROW';
    skyGradient = isDark
      ? isQuietNight
        ? 'linear-gradient(180deg, #050813 0%, #0c1228 35%, #161d3e 70%, #05070e 100%)'
        : 'linear-gradient(180deg, #070b1a 0%, #111736 35%, #1c2550 70%, #060812 100%)'
      : 'linear-gradient(180deg, #c7d2fe 0%, #ddd6fe 45%, #e0e7ff 80%, #f8fafc 100%)';
  }

  const shouldAnimate = isTabVisible && !reducedMotion;

  return (
    <div
      aria-hidden="true"
      className="absolute -top-6 -left-4 -right-4 sm:-left-6 sm:-right-6 md:-left-8 md:-right-8 h-[360px] sm:h-[440px] pointer-events-none overflow-hidden select-none z-0 transition-all duration-1000"
      style={{ background: skyGradient }}
    >
      {/* ── Currently Playing Album Artwork Ambient Overlay ── */}
      {currentSong?.coverUrl && (
        <div
          className="absolute inset-0 opacity-25 mix-blend-color-dodge transition-opacity duration-1000 blur-3xl pointer-events-none"
          style={{
            backgroundImage: `url(${currentSong.coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        />
      )}

      {/* ── Top-Right Banner Tagline ── */}
      <div className="absolute top-10 right-6 sm:right-10 hidden sm:flex flex-col items-end z-10">
        <span className={`text-[10px] tracking-[0.22em] font-extrabold uppercase text-right leading-tight max-w-[170px] ${
          isDark ? 'text-white/45' : 'text-slate-700/55'
        }`}>
          {tagline}
        </span>
      </div>

      {/* ── Star Field (Active in Evening & Night) ── */}
      {(period === 'evening' || period === 'night') && (
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: isQuietNight ? 0.65 : 0.9 }}
        >
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {[
              { cx: '6%',  cy: '12%', r: 1.4, delay: '0s' },
              { cx: '16%', cy: '25%', r: 1.8, delay: '1.1s' },
              { cx: '27%', cy: '8%',  r: 1.2, delay: '2.3s' },
              { cx: '38%', cy: '20%', r: 2.0, delay: '0.6s' },
              { cx: '50%', cy: '10%', r: 1.3, delay: '1.8s' },
              { cx: '61%', cy: '28%', r: 1.9, delay: '0.2s' },
              { cx: '72%', cy: '14%', r: 1.5, delay: '2.8s' },
              { cx: '82%', cy: '32%', r: 2.1, delay: '1.4s' },
              { cx: '92%', cy: '16%', r: 1.1, delay: '0.9s' },
              { cx: '12%', cy: '38%', r: 1.3, delay: '2.0s' },
              { cx: '32%', cy: '34%', r: 1.6, delay: '1.5s' },
              { cx: '45%', cy: '42%', r: 1.1, delay: '2.6s' },
              { cx: '68%', cy: '40%', r: 1.7, delay: '0.7s' },
            ].map((star, i) => (
              <circle
                key={i}
                cx={star.cx}
                cy={star.cy}
                r={star.r}
                fill={isDark ? '#ffffff' : '#334155'}
                className={shouldAnimate ? 'animate-pulse' : ''}
                style={{
                  animationDuration: '2.8s',
                  animationDelay: star.delay,
                  opacity: 0.85,
                }}
              />
            ))}
          </svg>
        </div>
      )}

      {/* ── Real Celestial Sun & Moon Elements ── */}

      {/* 1. MORNING SUN: Golden Sunrise Sun Rising on Right Horizon */}
      {period === 'morning' && (
        <div className="absolute right-[12%] sm:right-[16%] top-[14%] sm:top-[16%] w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500 shadow-[0_0_80px_rgba(251,191,36,0.85),0_0_140px_rgba(245,158,11,0.5)] border border-amber-100/40">
          <div className="absolute -inset-4 rounded-full bg-amber-300/30 blur-lg scale-150 animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute -inset-8 rounded-full bg-orange-400/20 blur-xl scale-150" />
        </div>
      )}

      {/* 2. AFTERNOON SUN: Bright Radiant Sun High on Left */}
      {period === 'afternoon' && (
        <div className="absolute left-[8%] sm:left-[12%] top-[10%] sm:top-[12%] w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-amber-100 via-amber-300 to-yellow-400 shadow-[0_0_90px_rgba(253,224,71,0.9),0_0_160px_rgba(250,204,21,0.6)] border border-white/60">
          <div className="absolute -inset-3 rounded-full bg-yellow-200/30 blur-md animate-pulse" style={{ animationDuration: '5s' }} />
          <div className="absolute -inset-6 rounded-full bg-amber-300/20 blur-xl" />
        </div>
      )}

      {/* 3. EVENING SUN: Warm Glowing Sunset Sun Dipping Low on Horizon */}
      {period === 'evening' && (
        <div className="absolute right-[20%] sm:right-[24%] bottom-[28%] sm:bottom-[32%] w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-orange-200 via-rose-400 to-amber-600 shadow-[0_0_90px_rgba(249,115,22,0.9),0_0_150px_rgba(244,63,94,0.6)] border border-amber-200/40">
          <div className="absolute -inset-4 rounded-full bg-rose-500/25 blur-lg animate-pulse" style={{ animationDuration: '4s' }} />
        </div>
      )}

      {/* 4. NIGHT MOON: Photorealistic Glowing Full Moon on Upper Right */}
      {period === 'night' && (
        <div className="absolute right-[10%] sm:right-[15%] top-[12%] sm:top-[14%] w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-100 shadow-[0_0_70px_rgba(224,231,255,0.85),0_0_130px_rgba(165,180,252,0.45)] border border-white/60 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 opacity-90" />
          <div className="absolute top-2 left-3 w-4 h-4 rounded-full bg-slate-400/25 blur-[1px]" />
          <div className="absolute top-6 right-3 w-3 h-3 rounded-full bg-slate-400/20 blur-[1px]" />
          <div className="absolute bottom-3 left-5 w-5 h-5 rounded-full bg-slate-400/30 blur-[1px]" />
          <div className="absolute bottom-2 right-4 w-2.5 h-2.5 rounded-full bg-slate-400/20 blur-[0.5px]" />
        </div>
      )}

      {/* ── Landscape Silhouettes ── */}

      {/* AFTERNOON: City Skyline Vector Silhouette */}
      {period === 'afternoon' ? (
        <div className="absolute bottom-0 inset-x-0 h-24 sm:h-28 opacity-45">
          <svg className="w-full h-full text-[var(--bg-primary)] fill-current" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,120 L0,95 L30,95 L30,70 L50,70 L50,95 L80,95 L80,50 L95,50 L95,40 L105,40 L105,50 L120,50 L120,95 L160,95 L160,30 L180,30 L180,95 L220,95 L220,60 L240,60 L240,95 L300,95 L300,45 L320,45 L320,35 L330,35 L330,45 L350,45 L350,95 L400,95 L400,20 L415,20 L415,10 L425,10 L425,20 L440,20 L440,95 L500,95 L500,55 L530,55 L530,95 L600,95 L600,25 L615,25 L615,15 L625,15 L625,25 L640,25 L640,95 L720,95 L720,40 L745,40 L745,95 L810,95 L810,50 L830,50 L830,95 L900,95 L900,30 L920,30 L920,95 L980,95 L980,65 L1020,65 L1020,95 L1100,95 L1100,40 L1130,40 L1130,95 L1200,95 L1200,120 Z" />
          </svg>
        </div>
      ) : (
        /* MORNING, EVENING & NIGHT: Layered Mountain Silhouettes with Lake Water Reflection Glow */
        <div className="absolute bottom-0 inset-x-0 h-24 sm:h-30 opacity-40">
          <svg className="w-full h-full text-[var(--bg-primary)] fill-current" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,120 L0,65 L110,30 L220,75 L380,20 L560,70 L720,15 L880,60 L1040,28 L1200,65 L1200,120 Z" />
          </svg>
        </div>
      )}

      {/* Gradient Mask into lower page background */}
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-b from-transparent via-[var(--bg-primary)]/75 to-[var(--bg-primary)]" />
    </div>
  );
}
