'use client';

import React from 'react';

interface PlaylistCoverOverlayProps {
  size?: 'small' | 'medium' | 'large' | 'hero';
  showTitle?: boolean;
}

export function PlaylistCoverOverlay({
  size = 'medium',
  showTitle = true,
}: PlaylistCoverOverlayProps) {
  // Vignette gradient height and density based on card size
  const bottomGradientHeight =
    size === 'small' ? 'h-3/4' : size === 'medium' ? 'h-2/3' : 'h-1/2';

  return (
    <>
      {/* ── 1. Top Atmospheric Tint & Vignette Rim ── */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, transparent 40%, rgba(3, 6, 12, 0.45) 100%)',
        }}
      />

      {/* ── 2. Bottom Scrim (Ensures 100% Crisp Title Readability) ── */}
      {showTitle && (
        <div
          className={`absolute bottom-0 inset-x-0 ${bottomGradientHeight} pointer-events-none z-10 transition-opacity duration-300`}
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(3, 6, 12, 0.25) 25%, rgba(3, 6, 12, 0.70) 65%, rgba(3, 6, 12, 0.94) 100%)',
          }}
        />
      )}

      {/* ── 3. Specular Inner Border for Glassmorphic Depth ── */}
      <div
        className="absolute inset-0 rounded-[inherit] pointer-events-none z-20 border border-white/15"
        style={{
          boxShadow: 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.20)',
        }}
      />

      {/* ── 4. Micro Noise Scrim (Eliminates color banding on 8-bit/OLED displays) ── */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </>
  );
}
