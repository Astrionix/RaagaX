'use client';

import React, { useState } from 'react';

export interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  size?: 'thumb' | 'card' | 'full';
  className?: string;
  fallbackSrc?: string;
}

/**
 * OptimizedImage
 * High-performance artwork image component for RaagaX:
 * - Smart sizing:
 *     • 'thumb': 150x150 for lists & mini-player
 *     • 'card':  250x250 for carousel cards & shelves
 *     • 'full':  500x500 for full-screen expanded player modal
 * - Progressive loading with smooth CSS crossfade
 * - Prevents layout shifts with fixed container
 * - Asynchronous image decoding + native lazy loading
 * - Robust error handling with graceful fallback to app-icon
 */
export function OptimizedImage({
  src,
  alt,
  size = 'card',
  className = '',
  fallbackSrc = '/app-icon.png',
  style,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Normalize and transform artwork resolution based on target size
  const resolveArtworkUrl = (rawUrl?: string | null): string => {
    if (!rawUrl || rawUrl.includes('/null/') || rawUrl.trim() === '') {
      return fallbackSrc;
    }

    let url = rawUrl.replace('http://', 'https://');

    if (size === 'thumb') {
      // 150x150 resolution for small lists & track rows
      url = url.replace(/500x500|250x250|50x50/g, '150x150');
    } else if (size === 'card') {
      // 250x250 or 150x150 for carousel cards
      url = url.replace(/500x500|50x50/g, '250x250');
    } else if (size === 'full') {
      // 500x500 for expanded player modal
      url = url.replace(/150x150|250x250|50x50/g, '500x500');
    }

    return url;
  };

  const finalSrc = hasError ? fallbackSrc : resolveArtworkUrl(src);

  return (
    <div className={`relative overflow-hidden bg-slate-800/60 ${className}`}>
      {/* Subtle skeleton shimmer placeholder while loading */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-white/[0.04] animate-pulse pointer-events-none" />
      )}

      <img
        src={finalSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setHasError(true);
          setIsLoaded(true);
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={style}
        {...props}
      />
    </div>
  );
}
