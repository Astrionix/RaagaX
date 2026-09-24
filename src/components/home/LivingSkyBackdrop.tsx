'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { TimeThemeDetails } from '@/context/useTimeAwareTheme';
import { usePlayerStore } from '@/context/usePlayerStore';
import { LiquidMotionBackground } from '@/components/player/LiquidMotionBackground';

interface LivingSkyBackdropProps {
  timeDetails: TimeThemeDetails;
}

export function LivingSkyBackdrop({ timeDetails }: LivingSkyBackdropProps) {
  const { currentSong, isPlaying } = usePlayerStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { period, resolvedTheme } = timeDetails;
  const isDark = resolvedTheme === 'dark';

  // Time-driven animated gradient aurora palette spanning the FULL SCREEN
  const gradientStyles = useMemo(() => {
    if (period === 'morning') {
      return {
        mesh: 'radial-gradient(ellipse at 15% 10%, rgba(251, 146, 60, 0.5) 0%, transparent 60%), radial-gradient(ellipse at 85% 15%, rgba(244, 63, 94, 0.45) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(129, 140, 248, 0.4) 0%, transparent 65%), radial-gradient(ellipse at 20% 85%, rgba(245, 158, 11, 0.35) 0%, transparent 60%), radial-gradient(ellipse at 80% 90%, rgba(99, 102, 241, 0.35) 0%, transparent 60%)',
        blob1: 'from-amber-500/40 via-orange-500/30 to-transparent',
        blob2: 'from-rose-500/35 via-pink-600/25 to-transparent',
        blob3: 'from-indigo-500/30 via-sky-500/20 to-transparent',
        blob4: 'from-amber-600/30 via-rose-500/20 to-transparent',
        blob5: 'from-purple-600/30 via-indigo-600/20 to-transparent',
      };
    } else if (period === 'afternoon') {
      return {
        mesh: 'radial-gradient(ellipse at 20% 10%, rgba(14, 165, 233, 0.55) 0%, transparent 60%), radial-gradient(ellipse at 80% 15%, rgba(99, 102, 241, 0.5) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(168, 85, 247, 0.45) 0%, transparent 65%), radial-gradient(ellipse at 15% 85%, rgba(6, 182, 212, 0.4) 0%, transparent 60%), radial-gradient(ellipse at 85% 90%, rgba(79, 70, 229, 0.4) 0%, transparent 60%)',
        blob1: 'from-sky-500/45 via-cyan-500/35 to-transparent',
        blob2: 'from-indigo-600/40 via-blue-600/30 to-transparent',
        blob3: 'from-purple-600/35 via-violet-500/25 to-transparent',
        blob4: 'from-cyan-600/35 via-teal-600/25 to-transparent',
        blob5: 'from-violet-700/35 via-indigo-700/25 to-transparent',
      };
    } else if (period === 'evening') {
      return {
        mesh: 'radial-gradient(ellipse at 25% 10%, rgba(244, 63, 94, 0.55) 0%, transparent 60%), radial-gradient(ellipse at 75% 15%, rgba(168, 85, 247, 0.5) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(245, 158, 11, 0.45) 0%, transparent 65%), radial-gradient(ellipse at 20% 85%, rgba(225, 29, 72, 0.4) 0%, transparent 60%), radial-gradient(ellipse at 80% 90%, rgba(139, 92, 246, 0.4) 0%, transparent 60%)',
        blob1: 'from-rose-500/45 via-pink-500/35 to-transparent',
        blob2: 'from-purple-600/40 via-violet-600/30 to-transparent',
        blob3: 'from-amber-500/35 via-orange-500/25 to-transparent',
        blob4: 'from-pink-600/35 via-rose-600/25 to-transparent',
        blob5: 'from-indigo-700/35 via-purple-800/25 to-transparent',
      };
    } else {
      // Night
      return {
        mesh: 'radial-gradient(ellipse at 15% 10%, rgba(99, 102, 241, 0.5) 0%, transparent 60%), radial-gradient(ellipse at 85% 20%, rgba(139, 92, 246, 0.45) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(6, 182, 212, 0.35) 0%, transparent 65%), radial-gradient(ellipse at 20% 85%, rgba(67, 56, 202, 0.4) 0%, transparent 60%), radial-gradient(ellipse at 80% 90%, rgba(124, 58, 237, 0.4) 0%, transparent 60%)',
        blob1: 'from-indigo-600/40 via-purple-700/30 to-transparent',
        blob2: 'from-violet-600/35 via-fuchsia-700/25 to-transparent',
        blob3: 'from-cyan-600/30 via-blue-800/20 to-transparent',
        blob4: 'from-blue-700/35 via-indigo-800/25 to-transparent',
        blob5: 'from-purple-800/35 via-violet-900/25 to-transparent',
      };
    }
  }, [period]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    >
        {/* Layer A: Full-Viewport Liquid Motion Kinetic Canvas Engine */}
        {isMounted && (
          <LiquidMotionBackground
            artworkUrl={currentSong?.coverUrl}
            isPlaying={isPlaying}
            speedMultiplier={0.32}
            canvasOpacity={0.6}
            blurAmount={100}
            saturateAmount={180}
            vignetteIntensity="balanced"
            transparentBase={true}
            showCoverBackdrop={false}
            className="w-full h-full absolute inset-0"
          />
        )}

        {/* Layer B: Living Time-of-Day Multi-Stop Aurora Mesh (Spans Entire Viewport) */}
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            background: gradientStyles.mesh,
            opacity: isMounted ? 1 : 0,
          }}
        />

        {/* Layer C: Fluid Animated Glowing Gradient Orbs (Covering Entire Height) */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Top-Left Orb */}
          <div
            className={`absolute -top-16 -left-16 w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full bg-gradient-to-br ${gradientStyles.blob1} blur-[120px] animate-pulse`}
            style={{ animationDuration: '8s' }}
          />
          {/* Top-Right Orb */}
          <div
            className={`absolute top-0 -right-12 w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-bl ${gradientStyles.blob2} blur-[110px] animate-pulse`}
            style={{ animationDuration: '10s' }}
          />
          {/* Mid-Page Center Orb (Behind Playlists & Mix Cards) */}
          <div
            className={`absolute top-[35%] left-[20%] w-[55vw] h-[40vw] max-w-[700px] max-h-[500px] rounded-full bg-gradient-to-tr ${gradientStyles.blob3} blur-[130px] animate-pulse`}
            style={{ animationDuration: '12s' }}
          />
          {/* Lower-Page Bottom-Left Orb (Behind Lower Shelves) */}
          <div
            className={`absolute top-[65%] -left-12 w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-tr ${gradientStyles.blob4} blur-[125px] animate-pulse`}
            style={{ animationDuration: '9s' }}
          />
          {/* Lower-Page Bottom-Right Orb */}
          <div
            className={`absolute -bottom-16 -right-16 w-[55vw] h-[55vw] max-w-[650px] max-h-[650px] rounded-full bg-gradient-to-tl ${gradientStyles.blob5} blur-[120px] animate-pulse`}
            style={{ animationDuration: '11s' }}
          />
        </div>

        {/* Layer D: Currently Playing Album Artwork Atmospheric Color Projection */}
        {currentSong?.coverUrl && (
          <div
            className="absolute inset-0 opacity-25 mix-blend-color-dodge transition-opacity duration-1000 blur-3xl pointer-events-none"
            style={{
              backgroundImage: `url(${currentSong.coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}

        {/* Layer E: Atmospheric Contrast & Readability Tint Mask */}
        <div
          className={`absolute inset-0 transition-colors duration-1000 ${
            isDark
              ? 'bg-black/35 backdrop-blur-[18px]'
              : 'bg-white/40 backdrop-blur-[18px]'
          }`}
        />
      </div>
  );
}
