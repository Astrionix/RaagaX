'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  size?: 'thumb' | 'card' | 'full';
  className?: string;
  fallbackSrc?: string;
  imageFit?: 'cover' | 'contain' | 'fill';
}

// In-memory cache set for already loaded image URLs across the user session
const loadedImageUrls = new Set<string>();

/**
 * OptimizedImage
 * Blazing fast, high-performance artwork image component for RaagaX:
 * - Zero delay / eager loading for immediate visual rendering
 * - JioSaavn CDN resolution auto-tuning (500x500 / 150x150)
 * - In-memory instant cache hit tracking (no opacity-0 pop-in)
 * - Resilient fallback recovery
 */
export function OptimizedImage({
  src,
  alt,
  size = 'card',
  className = '',
  fallbackSrc = '/app-icon.png',
  imageFit = 'cover',
  style,
  ...props
}: OptimizedImageProps) {
  // Normalize and preserve raw high resolution artwork directly from CDN
  const resolveArtworkUrl = (rawUrl?: string | null): string => {
    if (!rawUrl || rawUrl.includes('/null/') || rawUrl.trim() === '') {
      return fallbackSrc;
    }

    let url = rawUrl.replace('http://', 'https://');

    // Always deliver raw 500x500 high-res quality from JioSaavn CDN
    url = url.replace(/50x50|150x150|300x300/g, '500x500');

    return url;
  };

  const resolvedUrl = resolveArtworkUrl(src);
  const isAlreadyLoaded = loadedImageUrls.has(resolvedUrl);

  const [isLoaded, setIsLoaded] = useState(isAlreadyLoaded);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const finalSrc = hasError ? fallbackSrc : resolvedUrl;

  useEffect(() => {
    if (loadedImageUrls.has(resolvedUrl)) {
      setIsLoaded(true);
      return;
    }
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      loadedImageUrls.add(resolvedUrl);
      setIsLoaded(true);
    }
  }, [resolvedUrl]);

  useEffect(() => {
    setHasError(false);
    if (!loadedImageUrls.has(resolvedUrl)) {
      setIsLoaded(false);
    }
  }, [src, resolvedUrl]);

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 ${className}`}>
      {/* Subtle pulse placeholder only if not yet in memory cache */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-white/[0.04] animate-pulse pointer-events-none" />
      )}

      <img
        ref={imgRef}
        src={finalSrc}
        alt={alt}
        loading="eager"
        decoding="async"
        draggable={false}
        fetchPriority={size === 'thumb' ? 'auto' : 'high'}
        onLoad={() => {
          loadedImageUrls.add(resolvedUrl);
          setIsLoaded(true);
        }}
        onError={() => {
          if (!hasError) {
            setHasError(true);
            setIsLoaded(true);
          }
        }}
        className={`w-full h-full ${imageFit === 'contain' ? 'object-contain' : imageFit === 'fill' ? 'object-fill' : 'object-cover'} transition-transform duration-300 pointer-events-none select-none`}
        style={style}
        {...props}
      />
    </div>
  );
}
