'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';

interface DynamicArtworkAtmosphereProps {
  artworkUrl?: string | null;
  isPlaying?: boolean;
  className?: string;
  height?: string;
  intensity?: 'subtle' | 'medium' | 'deep';
  children?: React.ReactNode;
}

/**
 * RaagaX Dynamic Artwork Atmosphere System
 * 
 * Creates a GPU-accelerated, multi-layered ambient background derived from artwork:
 * 1. Base dark foundation (#090A0F)
 * 2. Heavy GPU-blurred scaled artwork with subtle 1% breathing scale when playing
 * 3. Dominant-color radial mesh lighting
 * 4. Multi-stop vertical readability scrim (seamless fade to background with zero hard lines)
 * 5. Instant memory caching for zero dropped frames
 */
export function DynamicArtworkAtmosphere({
  artworkUrl,
  isPlaying = false,
  className = '',
  height = 'h-[460px] sm:h-[540px]',
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

  return (
    <div className={`relative w-full ${className}`}>
      {/* ── BACKGROUND ATMOSPHERE VIEWPORT ── */}
      <div 
        className={`absolute top-0 left-0 right-0 ${height} overflow-hidden pointer-events-none z-0 select-none`}
        aria-hidden="true"
      >
        {/* Layer 1: Base Dark Canvas */}
        <div className="absolute inset-0 bg-[#090A0F]" />

        {/* Layer 2: Enlarged, Cropped, Heavily-Blurred Artwork */}
        {cleanUrl ? (
          <div 
            className={`absolute -top-12 -left-12 -right-12 bottom-0 transition-transform duration-1000 ease-out ${
              isPlaying ? 'scale-[1.03]' : 'scale-100'
            }`}
          >
            <img
              src={cleanUrl}
              alt=""
              onLoad={() => setImageLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-1000 ${
                imageLoaded ? 'opacity-40' : 'opacity-0'
              }`}
              style={{
                filter: intensity === 'subtle' 
                  ? 'blur(45px) saturate(140%) brightness(0.6)' 
                  : intensity === 'deep' 
                  ? 'blur(75px) saturate(180%) brightness(0.5)' 
                  : 'blur(60px) saturate(160%) brightness(0.55)',
                transform: 'translate3d(0, 0, 0)',
                willChange: 'transform',
              }}
            />
          </div>
        ) : (
          /* RaagaX Fallback Atmosphere (when no artwork exists) */
          <div className="absolute inset-0 bg-gradient-to-b from-[#FA233B]/20 via-[#4F46E5]/15 to-[#090A0F] opacity-50 blur-3xl" />
        )}

        {/* Layer 3: Extracted Single Dominant Color Radial Mesh (Monochromatic Atmosphere) */}
        {palette && (
          <div 
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-[120%] h-[420px] rounded-full blur-3xl pointer-events-none transition-all duration-700 opacity-60"
            style={{
              background: `radial-gradient(ellipse at 50% 30%, ${palette.primary} 0%, ${palette.primary} 35%, transparent 70%)`,
            }}
          />
        )}

        {/* Layer 4: Multi-Stop Readability Scrim (Seamless fade to RaagaX page background) */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(9,10,15,0.18) 0%, rgba(9,10,15,0.55) 45%, rgba(9,10,15,0.92) 80%, #090A0F 100%)',
          }}
        />

        {/* Top Edge Refraction Highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>

      {/* ── FOREGROUND CONTENT (Rendered with 100% sharp contrast) ── */}
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
}
