'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';
import { useThemeStore } from '@/context/useThemeStore';

interface DynamicArtworkAtmosphereProps {
  artworkUrl?: string | null;
  isPlaying?: boolean;
  className?: string;
  intensity?: 'subtle' | 'medium' | 'deep';
  children?: React.ReactNode;
}

function toRgba(colorStr?: string, alpha = 1): string {
  if (!colorStr) return `rgba(250, 35, 59, ${alpha})`;
  if (colorStr.startsWith('rgb(')) {
    return colorStr.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  if (colorStr.startsWith('rgba(')) {
    return colorStr.replace(/[\d\.]+\)$/, `${alpha})`);
  }
  if (colorStr.startsWith('#')) {
    let hex = colorStr.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(250, 35, 59, ${alpha})`;
}

/**
 * RaagaX Dynamic Artwork Atmosphere System
 * 
 * Creates ONE continuous, smoothly blended color surface across the entire page:
 * - Subtle artwork-derived tint near the top
 * - Adapts to Light Mode (--bg-main) & Dark Mode (#07080b)
 * - Full-height coverage so the entire page shares one unified background
 */
export function DynamicArtworkAtmosphere({
  artworkUrl,
  isPlaying = false,
  className = '',
  intensity = 'medium',
  children,
}: DynamicArtworkAtmosphereProps) {
  const [palette, setPalette] = useState<ChameleonPalette | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { resolvedTheme } = useThemeStore();
  const isLight = resolvedTheme === 'light';

  // Normalize image URL
  const cleanUrl = useMemo(() => {
    if (!artworkUrl || artworkUrl.includes('/null/') || artworkUrl.includes('null/null')) {
      return null;
    }
    return artworkUrl.replace('http://', 'https://');
  }, [artworkUrl]);

  useEffect(() => {
    let isMounted = true;
    if (!cleanUrl) {
      setPalette(null);
      return;
    }

    ArtworkColorExtractor.getInstance()
      .extractPalette(cleanUrl)
      .then((p) => {
        if (isMounted) {
          setPalette(p);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [cleanUrl]);

  // Base canvas colors according to theme
  const fadeColor = isLight ? 'rgba(248, 250, 252, 0.98)' : 'rgba(7, 8, 11, 0.98)';

  // Color intensities
  const baseColor = palette?.primary || (isLight ? 'rgb(250, 35, 59)' : 'rgb(140, 28, 48)');
  const topAlpha = isLight
    ? (intensity === 'subtle' ? 0.12 : intensity === 'deep' ? 0.22 : 0.16)
    : (intensity === 'subtle' ? 0.22 : intensity === 'deep' ? 0.35 : 0.28);
  const midAlpha = topAlpha * 0.5;
  const lowAlpha = topAlpha * 0.25;
  const traceAlpha = 0.01;

  return (
    <div className={`relative w-full min-h-screen ${isLight ? 'bg-[var(--bg-main,#f8fafc)] text-[var(--text-primary)]' : 'bg-[#07080b] text-white'} ${className}`}>
      {/* ── FULL-PAGE CONTINUOUS ATMOSPHERE CANVAS (0 Seams, 1 Surface) ── */}
      <div 
        className="absolute inset-0 w-full h-full min-h-full overflow-hidden pointer-events-none z-0 select-none"
        aria-hidden="true"
      >
        {/* Layer 1: Base Dark/Light Canvas Foundation */}
        <div className="absolute inset-0" style={{ backgroundColor: isLight ? 'var(--bg-main, #f8fafc)' : '#07080b' }} />

        {/* Layer 2: Seamless Full-Height Continuous Gradient */}
        <div 
          className="absolute inset-0 transition-opacity duration-700 pointer-events-none"
          style={{
            background: `linear-gradient(180deg, 
              ${toRgba(baseColor, topAlpha)} 0%, 
              ${toRgba(baseColor, midAlpha)} 22%, 
              ${toRgba(baseColor, lowAlpha)} 45%, 
              ${toRgba(baseColor, traceAlpha)} 70%, 
              ${fadeColor} 90%,
              ${isLight ? '#f8fafc' : '#07080b'} 100%
            )`,
          }}
        />

        {/* Layer 3: Ultra-Soft Wide Diffused Ambient Glow (Top Region) */}
        <div 
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140%] h-[680px] pointer-events-none transition-all duration-1000"
          style={{
            background: `radial-gradient(ellipse 65% 50% at 50% 25%, ${toRgba(baseColor, topAlpha * 0.9)} 0%, ${toRgba(baseColor, midAlpha * 0.6)} 45%, transparent 80%)`,
            filter: 'blur(80px)',
          }}
        />

        {/* Layer 4: Feather-Masked Scaled Artwork Blur (Provides natural texture nuances) */}
        {cleanUrl && (
          <div 
            className={`absolute top-0 left-0 right-0 h-[600px] pointer-events-none transition-transform duration-1000 ease-out ${
              isPlaying ? 'scale-[1.02]' : 'scale-100'
            }`}
            style={{
              maskImage: isLight
                ? 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.03) 40%, transparent 85%)'
                : 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 40%, transparent 85%)',
              WebkitMaskImage: isLight
                ? 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.03) 40%, transparent 85%)'
                : 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 40%, transparent 85%)',
            }}
          >
            <img
              src={cleanUrl}
              alt=""
              onLoad={() => setImageLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-1000 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                filter: isLight ? 'blur(90px) saturate(120%) brightness(0.95)' : 'blur(90px) saturate(150%) brightness(0.55)',
                transform: 'translate3d(0, 0, 0)',
                willChange: 'transform',
              }}
            />
          </div>
        )}
      </div>

      {/* ── FOREGROUND CONTENT ── */}
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
}
