'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';

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
 * - Subtle dark artwork-derived tint near the top
 * - Extremely gradual and soft transition throughout the entire scrollable height
 * - No horizontal seams, no color bands, no two-tone split
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

  // Color intensities
  const baseColor = palette?.primary || 'rgb(140, 28, 48)';
  const topAlpha = intensity === 'subtle' ? 0.22 : intensity === 'deep' ? 0.35 : 0.28;
  const midAlpha = intensity === 'subtle' ? 0.12 : intensity === 'deep' ? 0.20 : 0.16;
  const lowAlpha = intensity === 'subtle' ? 0.05 : intensity === 'deep' ? 0.09 : 0.07;
  const traceAlpha = 0.02;

  return (
    <div className={`relative w-full min-h-screen bg-[#07080b] ${className}`}>
      {/* ── FULL-PAGE CONTINUOUS ATMOSPHERE CANVAS (0 Seams, 1 Surface) ── */}
      <div 
        className="absolute inset-0 w-full h-full min-h-full overflow-hidden pointer-events-none z-0 select-none"
        aria-hidden="true"
      >
        {/* Layer 1: Base Dark Canvas Foundation */}
        <div className="absolute inset-0 bg-[#07080b]" />

        {/* Layer 2: Seamless Full-Height Continuous Gradient */}
        <div 
          className="absolute inset-0 transition-opacity duration-700 pointer-events-none"
          style={{
            background: `linear-gradient(180deg, 
              ${toRgba(baseColor, topAlpha)} 0%, 
              ${toRgba(baseColor, midAlpha)} 22%, 
              ${toRgba(baseColor, lowAlpha)} 45%, 
              ${toRgba(baseColor, traceAlpha)} 70%, 
              rgba(7, 8, 11, 0.98) 90%,
              #07080b 100%
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
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 40%, transparent 85%)',
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 40%, transparent 85%)',
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
                filter: 'blur(90px) saturate(150%) brightness(0.55)',
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
