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

  const { period, resolvedTheme, isQuietNight, sunMoonPosition } = timeDetails;
  const isDark = resolvedTheme === 'dark';

  // Rich atmospheric environment sky gradients for all 4 periods
  let skyGradient = '';
  let sunMoonGlow = '';
  let sunMoonBg = '';

  if (period === 'morning') {
    // Sunrise amber glow
    skyGradient = isDark
      ? 'linear-gradient(180deg, #091322 0%, #1a2a44 35%, #5c2c1a 75%, #180d08 100%)'
      : 'linear-gradient(180deg, #dbeafe 0%, #fef3c7 45%, #ffedd5 80%, #f8fafc 100%)';
    sunMoonBg = 'bg-amber-400';
    sunMoonGlow = '0 0 60px rgba(251, 191, 36, 0.75), 0 0 120px rgba(245, 158, 11, 0.4)';
  } else if (period === 'afternoon') {
    // Daylight sky blue
    skyGradient = isDark
      ? 'linear-gradient(180deg, #0a192f 0%, #112d4e 45%, #1e4570 80%, #0a121d 100%)'
      : 'linear-gradient(180deg, #bae6fd 0%, #e0f2fe 50%, #f0f9ff 85%, #f8fafc 100%)';
    sunMoonBg = 'bg-amber-300';
    sunMoonGlow = '0 0 70px rgba(56, 189, 248, 0.7), 0 0 130px rgba(14, 165, 233, 0.35)';
  } else if (period === 'evening') {
    // Sunset violet, peach & magenta dusk
    skyGradient = isDark
      ? 'linear-gradient(180deg, #160c28 0%, #31134a 40%, #5c1b43 75%, #190915 100%)'
      : 'linear-gradient(180deg, #ede9fe 0%, #fce7f3 45%, #ffe4e6 80%, #f8fafc 100%)';
    sunMoonBg = 'bg-rose-400';
    sunMoonGlow = '0 0 65px rgba(244, 63, 94, 0.75), 0 0 120px rgba(225, 29, 72, 0.4)';
  } else {
    // Night moonlight indigo & starry sky
    skyGradient = isDark
      ? isQuietNight
        ? 'linear-gradient(180deg, #060913 0%, #0e152a 40%, #17213d 75%, #05070c 100%)'
        : 'linear-gradient(180deg, #080d1a 0%, #121c36 40%, #1c2a4f 75%, #060810 100%)'
      : 'linear-gradient(180deg, #e0e7ff 0%, #eef2ff 50%, #f1f5f9 85%, #f8fafc 100%)';
    sunMoonBg = 'bg-indigo-100';
    sunMoonGlow = '0 0 60px rgba(199, 210, 254, 0.8), 0 0 110px rgba(129, 140, 248, 0.45)';
  }

  const shouldAnimate = isTabVisible && !reducedMotion;

  return (
    <div
      aria-hidden="true"
      className="absolute -top-6 -left-4 -right-4 sm:-left-6 sm:-right-6 md:-left-8 md:-right-8 h-[340px] sm:h-[420px] pointer-events-none overflow-hidden select-none z-0 transition-all duration-1000"
      style={{ background: skyGradient }}
    >
      {/* ── Currently Playing Album Artwork Ambient Overlay ── */}
      {currentSong?.coverUrl && (
        <div
          className="absolute inset-0 opacity-30 mix-blend-color-dodge transition-opacity duration-1000 blur-3xl pointer-events-none"
          style={{
            backgroundImage: `url(${currentSong.coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        />
      )}

      {/* ── Twinkling Star Field (Evening & Night) ── */}
      {(period === 'evening' || period === 'night') && (
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: isQuietNight ? 0.6 : 0.9 }}
        >
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {[
              { cx: '8%',  cy: '14%', r: 1.4, delay: '0s' },
              { cx: '18%', cy: '28%', r: 1.8, delay: '1.1s' },
              { cx: '29%', cy: '10%', r: 1.2, delay: '2.3s' },
              { cx: '41%', cy: '22%', r: 2.0, delay: '0.6s' },
              { cx: '53%', cy: '12%', r: 1.3, delay: '1.8s' },
              { cx: '64%', cy: '30%', r: 1.9, delay: '0.2s' },
              { cx: '76%', cy: '16%', r: 1.5, delay: '2.8s' },
              { cx: '87%', cy: '34%', r: 2.1, delay: '1.4s' },
              { cx: '94%', cy: '18%', r: 1.1, delay: '0.9s' },
              { cx: '14%', cy: '42%', r: 1.3, delay: '2.0s' },
              { cx: '34%', cy: '38%', r: 1.6, delay: '1.5s' },
              { cx: '48%', cy: '46%', r: 1.1, delay: '2.6s' },
              { cx: '71%', cy: '44%', r: 1.7, delay: '0.7s' },
              { cx: '83%', cy: '48%', r: 1.2, delay: '3.2s' },
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

      {/* ── Sun / Moon Celestial Body ── */}
      {sunMoonPosition.isVisible && (
        <div
          className={`absolute w-12 h-12 sm:w-14 sm:h-14 rounded-full ${sunMoonBg} transition-all duration-1000 border border-white/20`}
          style={{
            left: `${sunMoonPosition.xPct}%`,
            top: `${sunMoonPosition.yPct}%`,
            boxShadow: sunMoonGlow,
            transform: 'translate(-50%, -50%)',
            opacity: period === 'night' && isQuietNight ? 0.85 : 0.95,
          }}
        >
          {/* Crescent overlay if moon */}
          {sunMoonPosition.type === 'moon' && (
            <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-indigo-900/40" />
          )}
        </div>
      )}

      {/* ── Morning / Afternoon Horizon Atmospheric Light ── */}
      {period === 'morning' && (
        <div className="absolute inset-x-0 bottom-16 h-24 bg-gradient-to-t from-amber-500/20 via-amber-500/05 to-transparent blur-xl pointer-events-none" />
      )}
      {period === 'afternoon' && (
        <div className="absolute top-6 left-1/3 w-64 h-12 rounded-full bg-sky-300/15 blur-2xl animate-pulse" style={{ animationDuration: '6s' }} />
      )}
      {period === 'evening' && (
        <div className="absolute inset-x-0 bottom-16 h-28 bg-gradient-to-t from-rose-500/20 via-amber-500/10 to-transparent blur-xl pointer-events-none" />
      )}

      {/* ── Mountain Horizon Silhouette ── */}
      <div className="absolute bottom-0 inset-x-0 h-20 sm:h-24 opacity-35">
        <svg
          className="w-full h-full text-[var(--bg-primary)] fill-current"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path d="M0,120 L0,65 L120,35 L240,70 L400,25 L580,68 L740,20 L900,58 L1060,30 L1200,65 L1200,120 Z" />
        </svg>
      </div>

      {/* ── Gradient Mask into lower page ── */}
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-b from-transparent via-[var(--bg-primary)]/70 to-[var(--bg-primary)]" />
    </div>
  );
}
