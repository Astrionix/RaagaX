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

    // Clean up temporary expiring query parameters from YouTube CDN
    if (url.includes('ytimg.com/vi/')) {
      url = url.split('?')[0];
    } else if (url.includes('googleusercontent.com') && url.includes('=')) {
      url = url.replace(/=w\d+-h\d+[^?&]*/, '=w500-h500-l90-rj').replace(/=s\d+[^?&]*/, '=s500');
    } else if (url.includes('saavncdn.com')) {
      // Always deliver raw 500x500 high-res quality from JioSaavn CDN
      url = url.replace(/50x50|150x150|300x300/g, '500x500');
    }

    return url;
  };

  const resolvedUrl = resolveArtworkUrl(src);
  const [currentSrc, setCurrentSrc] = useState<string>(resolvedUrl);
  const isAlreadyLoaded = loadedImageUrls.has(resolvedUrl);

  const [isLoaded, setIsLoaded] = useState(isAlreadyLoaded);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCurrentSrc(resolvedUrl);
    setHasError(false);
    if (!loadedImageUrls.has(resolvedUrl)) {
      setIsLoaded(false);
    }
  }, [resolvedUrl]);

  useEffect(() => {
    if (loadedImageUrls.has(currentSrc)) {
      setIsLoaded(true);
      return;
    }
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      loadedImageUrls.add(currentSrc);
      setIsLoaded(true);
    }
  }, [currentSrc]);

  const fitMode = imageFit === 'contain' || className?.includes('object-contain')
    ? 'object-contain'
    : imageFit === 'fill' || className?.includes('object-fill')
    ? 'object-fill'
    : 'object-cover';

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 ${fitMode === 'object-contain' ? 'flex items-center justify-center' : ''} ${className}`}>
      {/* Subtle pulse placeholder only if not yet in memory cache */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-white/[0.04] animate-pulse pointer-events-none" />
      )}

      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading="eager"
        decoding="async"
        draggable={false}
        referrerPolicy="no-referrer"
        fetchPriority={size === 'thumb' ? 'auto' : 'high'}
        onLoad={() => {
          loadedImageUrls.add(currentSrc);
          setIsLoaded(true);
        }}
        onError={() => {
          if (currentSrc !== fallbackSrc && fallbackSrc) {
            setCurrentSrc(fallbackSrc);
            setHasError(true);
          } else if (currentSrc !== '/app-icon.png') {
            setCurrentSrc('/app-icon.png');
            setHasError(true);
            setIsLoaded(true);
          }
        }}
        className={`w-full h-full ${fitMode} transition-transform duration-300 pointer-events-none select-none`}
        style={style}
        {...props}
      />
    </div>
  );
}

