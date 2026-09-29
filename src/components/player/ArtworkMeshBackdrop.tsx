'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';

interface ArtworkMeshBackdropProps {
  className?: string;
  intensity?: 'subtle' | 'vibrant' | 'deep';
  blurPx?: number;
  scrimOpacity?: number;
  continuous?: boolean;
}

export function ArtworkMeshBackdrop({
  className = '',
  intensity = 'vibrant',
  blurPx = 80,
  scrimOpacity = 0.65,
  continuous = true,
}: ArtworkMeshBackdropProps) {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const [palette, setPalette] = useState<ChameleonPalette | null>(null);
  const [prevPalette, setPrevPalette] = useState<ChameleonPalette | null>(null);
  const [crossfading, setCrossfading] = useState(false);

  // Extract palette on song change
  useEffect(() => {
    let isMounted = true;
    const coverUrl = currentSong?.coverUrl;

    ArtworkColorExtractor.getInstance()
      .extractPalette(coverUrl)
      .then((p) => {
        if (!isMounted) return;
        ArtworkColorExtractor.getInstance().applyToDocument(p);
        setPrevPalette(palette);
        setPalette(p);
        setCrossfading(true);
        const timer = setTimeout(() => {
          if (isMounted) setCrossfading(false);
        }, 1200);
        return () => clearTimeout(timer);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [currentSong?.id, currentSong?.coverUrl]);

  const activeColors = useMemo(() => {
    if (!palette) {
      return {
        c1: 'rgba(38, 20, 48, 0.75)',
        c2: 'rgba(20, 32, 60, 0.75)',
        c3: 'rgba(70, 24, 38, 0.65)',
        c4: 'rgba(15, 20, 30, 0.90)',
      };
    }
    return {
      c1: palette.primary || 'rgb(140, 28, 48)',
      c2: palette.secondary || 'rgb(85, 30, 25)',
      c3: palette.highlight || 'rgb(215, 75, 45)',
      c4: palette.accent || 'rgb(250, 35, 59)',
    };
  }, [palette]);

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none transition-opacity duration-1000 ${className}`}
      style={{ zIndex: 0 }}
    >
      {/* 1. Base Dark Deep Ambient Canvas */}
      <div className="absolute inset-0 bg-[#07090E]" />

      {/* 2. Fluid Luminous Mesh Gradient Layer */}
      <div
        className={`absolute inset-[-20%] w-[140%] h-[140%] ${
          continuous ? 'animate-raaga-mesh-drift' : ''
        } transition-all duration-1000 ease-out`}
        style={{
          filter: `blur(${blurPx}px)`,
          opacity: intensity === 'deep' ? 0.45 : intensity === 'subtle' ? 0.6 : 0.85,
        }}
      >
        {/* Blob 1: Top Left Primary */}
        <div
          className="absolute top-[10%] left-[10%] w-[55%] h-[55%] rounded-full transition-colors duration-1000"
          style={{
            background: `radial-gradient(circle, ${activeColors.c1} 0%, transparent 70%)`,
          }}
        />

        {/* Blob 2: Top Right Secondary */}
        <div
          className="absolute top-[15%] right-[10%] w-[60%] h-[60%] rounded-full transition-colors duration-1000"
          style={{
            background: `radial-gradient(circle, ${activeColors.c2} 0%, transparent 72%)`,
          }}
        />

        {/* Blob 3: Bottom Left Highlight */}
        <div
          className="absolute bottom-[10%] left-[15%] w-[50%] h-[50%] rounded-full transition-colors duration-1000"
          style={{
            background: `radial-gradient(circle, ${activeColors.c3} 0%, transparent 68%)`,
          }}
        />

        {/* Blob 4: Center-Bottom Accent */}
        <div
          className="absolute bottom-[5%] right-[20%] w-[55%] h-[55%] rounded-full transition-colors duration-1000"
          style={{
            background: `radial-gradient(circle, ${activeColors.c4} 0%, transparent 70%)`,
          }}
        />
      </div>

      {/* 3. Frosted Scrim Overlay for Material 3 High Contrast & Readability */}
      <div
        className="absolute inset-0 backdrop-blur-[40px] transition-colors duration-1000"
        style={{
          backgroundColor: `rgba(7, 9, 14, ${scrimOpacity})`,
        }}
      />

      {/* 4. Subtle Vignette Depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.65) 100%)',
        }}
      />
    </div>
  );
}
